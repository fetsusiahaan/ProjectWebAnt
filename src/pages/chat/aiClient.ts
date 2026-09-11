// ─── OpenAI-compatible client for the IDU AI gateway ──────────────────────────
//
// The app previously spoke the @google/genai SDK dialect ({ role, parts,
// inlineData }). The gateway at CHAT_CONFIG.baseUrl is OpenAI-shaped instead,
// so this module keeps the old part-based vocabulary at its edges and does the
// translation in one place — ChatPage never sees an OpenAI message object.

import { CHAT_CONFIG } from '../../config/chatConfig';
import type { Part, HistoryEntry } from './types';

const BASE_URL = CHAT_CONFIG.baseUrl.replace(/\/+$/, '');
const API_KEY = CHAT_CONFIG.apiKey;

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export interface GenerateResult {
  text: string;
  images: GeneratedImage[];
  /** Completion tokens reported by the gateway, when it sends a usage block. */
  completionTokens?: number;
}

// ─── Message translation ──────────────────────────────────────────────────────

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

/** Audio needs the input_audio block; images and documents ride image_url. */
function inlineDataToBlock(mimeType: string, data: string): ContentBlock {
  if (mimeType.startsWith('audio/')) {
    const format = mimeType.split('/')[1]?.split(';')[0] || 'webm';
    return { type: 'input_audio', input_audio: { data, format } };
  }
  return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } };
}

function partsToContent(parts: Part[]): string | ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const p of parts) {
    if (p.text) blocks.push({ type: 'text', text: p.text });
    if (p.inlineData) blocks.push(inlineDataToBlock(p.inlineData.mimeType, p.inlineData.data));
  }
  // A text-only turn is sent as a plain string: some upstream providers behind
  // the gateway reject a single-element block array for simple messages.
  if (blocks.length === 1 && blocks[0].type === 'text') return blocks[0].text;
  if (blocks.length === 0) return '';
  return blocks;
}

export function toChatMessages(
  contents: HistoryEntry[],
  systemInstruction?: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  for (const entry of contents) {
    messages.push({
      role: entry.role === 'model' ? 'assistant' : 'user',
      content: partsToContent(entry.parts),
    });
  }
  return messages;
}

// ─── Transport ────────────────────────────────────────────────────────────────

/**
 * The key has to travel twice, and both copies are load-bearing:
 *
 * - As `?key=`, because sending Authorization + application/json makes the
 *   browser fire a CORS preflight, and the gateway answers a bare OPTIONS with
 *   401 (no CORS headers) — which surfaces as an opaque "Failed to fetch".
 *   With the key on the URL the OPTIONS returns 200 and the allow-* headers.
 * - As the Authorization header, because the query parameter alone does not
 *   authenticate the POST itself ("Missing API key").
 *
 * Dropping either one breaks every request from a browser.
 */
function endpoint(path: string): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (API_KEY) url.searchParams.set('key', API_KEY);
  return url.toString();
}

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(endpoint(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.error?.message || err?.error || err?.message || detail;
    } catch { /* body was not JSON */ }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return res;
}

// ─── Streaming chat ───────────────────────────────────────────────────────────

export interface StreamChunk {
  text: string;
  completionTokens?: number;
}

/**
 * Yields text deltas as they arrive. The final SSE chunk carries the usage
 * block, so the caller gets exact token counts without a separate count call.
 */
export async function* streamChat(opts: {
  model: string;
  contents: HistoryEntry[];
  systemInstruction?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): AsyncGenerator<StreamChunk> {
  const res = await post('/chat/completions', {
    model: opts.model,
    messages: toChatMessages(opts.contents, opts.systemInstruction),
    stream: true,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  }, opts.signal);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Respons streaming kosong dari server.');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line; a partial event stays in the
      // buffer until its terminator arrives.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        for (const line of rawEvent.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            if (json.error) throw new Error(json.error?.message || String(json.error));
            const delta = json.choices?.[0]?.delta?.content;
            const text = typeof delta === 'string' ? delta : '';
            const completionTokens = json.usage?.completion_tokens;
            if (text || completionTokens !== undefined) yield { text, completionTokens };
          } catch (err) {
            // A malformed keep-alive frame should not kill a live stream, but a
            // genuine error object from the gateway must surface.
            if (err instanceof Error && err.message && !/JSON/i.test(err.message)) throw err;
          }
        }
      }
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
  }
}

// ─── Non-streaming generate (image branch, transcription) ─────────────────────

/** Pulls base64 images out of a response, whichever shape the gateway uses. */
function extractImages(message: unknown): GeneratedImage[] {
  const out: GeneratedImage[] = [];
  const msg = message as Record<string, unknown> | null;
  if (!msg) return out;

  const pushDataUri = (url: string) => {
    const m = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (m) out.push({ mimeType: m[1], base64: m[2] });
  };

  // Shape A: message.images = [{ image_url: { url: "data:..." } }]
  const images = msg.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      const url = (img as Record<string, { url?: string }>)?.image_url?.url
        ?? (img as Record<string, string>)?.url;
      if (typeof url === 'string') pushDataUri(url);
      else if (typeof (img as Record<string, string>)?.b64_json === 'string') {
        out.push({ base64: (img as Record<string, string>).b64_json, mimeType: 'image/png' });
      }
    }
  }

  // Shape B: content blocks carrying image_url
  if (Array.isArray(msg.content)) {
    for (const block of msg.content as Record<string, { url?: string }>[]) {
      const url = block?.image_url?.url;
      if (typeof url === 'string') pushDataUri(url);
    }
  }

  // Shape C: a markdown ![](data:image/...;base64,...) inside the text
  if (typeof msg.content === 'string') {
    const re = /data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g;
    for (const m of msg.content.matchAll(re)) out.push({ mimeType: m[1], base64: m[2] });
  }

  return out;
}

export async function generateContent(opts: {
  model: string;
  contents: HistoryEntry[];
  systemInstruction?: string;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<GenerateResult> {
  const res = await post('/chat/completions', {
    model: opts.model,
    messages: toChatMessages(opts.contents, opts.systemInstruction),
    stream: false,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  }, opts.signal);

  const json = await res.json();
  if (json.error) throw new Error(json.error?.message || String(json.error));

  const message = json.choices?.[0]?.message;
  const content = message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter((b: ContentBlock) => b.type === 'text').map((b) => (b as { text: string }).text).join('')
      : '';

  return {
    text,
    images: extractImages(message),
    completionTokens: json.usage?.completion_tokens,
  };
}

// ─── Dedicated image endpoint ─────────────────────────────────────────────────

/**
 * The gateway exposes an OpenAI-style /images/generations. No provider behind it
 * currently serves image output, so every call throws today — the path is kept
 * so a future image-capable model works with no code change. Callers must treat
 * a throw as "try the next tier".
 */
export async function generateImage(model: string, prompt: string): Promise<GeneratedImage> {
  // A model with no image provider behind it makes this endpoint hang rather
  // than 4xx, so the deadline is what actually moves us on to the next tier.
  const timeout = AbortSignal.timeout(20_000);
  const res = await post('/images/generations', {
    model,
    prompt,
    n: 1,
    response_format: 'b64_json',
  }, timeout);
  const json = await res.json();
  const item = json?.data?.[0];
  if (item?.b64_json) return { base64: item.b64_json, mimeType: 'image/png' };
  if (typeof item?.url === 'string') {
    const m = /^data:([^;]+);base64,(.+)$/.exec(item.url);
    if (m) return { mimeType: m[1], base64: m[2] };
  }
  throw new Error('Endpoint gambar tidak mengembalikan data gambar.');
}

// ─── Token estimation fallback ────────────────────────────────────────────────

/** Used only when the gateway omits a usage block. ~4 chars per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
