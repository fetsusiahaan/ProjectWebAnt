import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, KeyboardEvent, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  Send, ArrowLeft, Bot, User, Zap,
  Shield, Server, Code2, Database, Cloud, Cpu,
  RefreshCw, ChevronRight, Paperclip,
  X, FileText, AlertCircle, StopCircle,
  Copy, Check, Clock, Lock, Download, Sparkles,
  ZoomIn, ZoomOut, Mic, MicOff, Image as ImageIcon,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { ipToUuid, loadSessionJSON, saveSessionJSON } from '../utils/session';
import { putImages, loadSessionImages, clearSessionImages } from '../utils/imageStore';
import type { StoredImage } from '../utils/imageStore';
import { CHAT_CONFIG, SYSTEM_INSTRUCTION } from '../config/chatConfig';
import { SEOHead } from '../components/SEOHead';

const API_KEY = CHAT_CONFIG.apiKey;
const MODELS = CHAT_CONFIG.models || [CHAT_CONFIG.model || 'gemini-3.6-flash'];
const IMAGE_MODELS = CHAT_CONFIG.imageModels || [CHAT_CONFIG.imageModel, 'nano-banana', 'imagen-3.0-generate-002'];
const ACCEPTED_TYPES = CHAT_CONFIG.acceptedFileTypes;
const MAX_TOKENS = CHAT_CONFIG.maxTokens;
const SESSION_DURATION = CHAT_CONFIG.sessionDurationMs;
const BLOCK_DURATION = CHAT_CONFIG.blockDurationMs;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface HistoryEntry {
  role: 'user' | 'model';
  parts: Part[];
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  base64?: string;
  previewUrl?: string;
  fileObj?: File;
  isImage: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
  attachments?: AttachedFile[];
  isError?: boolean;
  isStreaming?: boolean;
  generatedImages?: string[];   // base64 dari Gemini Image Generation
  generatedMime?: string;       // MIME type gambar (image/png, image/jpeg, dll)
  isImageGeneration?: boolean;  // flag: sedang generate gambar
  tokenCount?: number;          // Jumlah token respons dari asisten
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Ceiling for anything sent verbatim (documents) and for post-compression images. */
const MAX_FILE_BYTES = 1 * 1024 * 1024;
/** Source ceiling for images — they are downscaled before reaching this budget. */
const MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;

function readAsBase64(file: Blob, fallbackMime: string): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parts = (reader.result as string).split(',');
      resolve({ base64: parts[1] || '', mimeType: file.type || fallbackMime });
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, mime, quality));
}

/**
 * Downscales an image before it ever reaches state.
 *
 * Uses createImageBitmap + toBlob rather than <img> + toDataURL. A 12 MP phone
 * photo is only ~1 MB on disk but ~48 MB once decoded; HTMLImageElement holds
 * that until GC decides otherwise, and toDataURL then builds a multi-megabyte
 * string synchronously on the main thread. On low-memory mobile that combination
 * gets the tab killed and reloaded. ImageBitmap can be released immediately via
 * close(), and toBlob keeps the encode off the critical path.
 */
async function compressImageIfNeeded(
  file: File,
  maxDimension = 1600,
  quality = 0.85,
): Promise<{ base64: string; mimeType: string }> {
  // Formats that must survive byte-for-byte (animation, vector) skip the canvas.
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return readAsBase64(file, 'application/octet-stream');
  }

  if (typeof createImageBitmap !== 'function') {
    return readAsBase64(file, 'image/jpeg');
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);

    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return await readAsBase64(file, 'image/jpeg');

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    bitmap = null;

    const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, targetMime, quality);

    // Release the backing store before the base64 string is built.
    canvas.width = 0;
    canvas.height = 0;

    if (!blob) return await readAsBase64(file, 'image/jpeg');
    const { base64 } = await readAsBase64(blob, targetMime);
    return { base64, mimeType: targetMime };
  } catch (err) {
    console.warn('Image compression failed, falling back to raw read:', err);
    return readAsBase64(file, 'image/jpeg');
  } finally {
    bitmap?.close();
  }
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const parts = dataUrl.split(',');
      const header = parts[0];
      const base64 = parts[1];
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function generateSvgFallbackBase64(promptText: string): { base64: string; mimeType: string } {
  const seed = Math.floor(Math.random() * 360);
  const title = promptText.length > 45 ? promptText.slice(0, 42) + '...' : promptText;
  const cleanTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${seed}, 70%, 15%)" />
        <stop offset="50%" stop-color="#09090F" />
        <stop offset="100%" stop-color="hsl(${(seed + 140) % 360}, 80%, 20%)" />
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#EF4444" />
        <stop offset="100%" stop-color="#F59E0B" />
      </linearGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)" />
    <circle cx="512" cy="400" r="280" fill="none" stroke="url(#accent)" stroke-width="4" opacity="0.3" />
    <circle cx="512" cy="400" r="200" fill="none" stroke="#EF4444" stroke-width="2" opacity="0.5" />
    <polygon points="512,220 640,460 384,460" fill="url(#accent)" opacity="0.8" />
    <text x="512" y="740" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="32" font-weight="bold">${cleanTitle}</text>
    <text x="512" y="790" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="20">AI Generated Visual Asset</text>
    <text x="512" y="940" text-anchor="middle" fill="#EF4444" font-family="sans-serif" font-size="18" font-weight="bold">FETSUBOT AI</text>
  </svg>`;

  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return { base64, mimeType: 'image/svg+xml' };
}

// ─── Rate Limit Config ───────────────────────────────────────────────────

interface LimitData {
  sessionStart: number;
  totalTokens: number;
  blockedAt?: number | null;
}

function storageKey(ip: string) {
  return `fetsubot_limit_${ip}`;
}

function loadLimit(ip: string): LimitData {
  try {
    const raw = localStorage.getItem(storageKey(ip));
    if (!raw) return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
    const data: LimitData = JSON.parse(raw);
    
    // Check block status first
    if (data.blockedAt) {
      if (Date.now() - data.blockedAt >= BLOCK_DURATION) {
        // Block duration expired -> reset everything
        return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
      }
    } else if (Date.now() - data.sessionStart >= SESSION_DURATION) {
      // Normal session reset (15 min)
      return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
    }
    return data;
  } catch { return { sessionStart: Date.now(), totalTokens: 0, blockedAt: null }; }
}

function saveLimit(ip: string, data: LimitData) {
  try { localStorage.setItem(storageKey(ip), JSON.stringify(data)); } catch { /* noop */ }
}

function formatMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function calculateTimeLeft(limit: LimitData): number {
  if (limit.blockedAt) {
    return BLOCK_DURATION - (Date.now() - limit.blockedAt);
  }
  return SESSION_DURATION - (Date.now() - limit.sessionStart);
}

// ─── Image Generation & Modification Helpers ────────────────────────────────
const IMAGE_KEYWORDS = [
  'buatkan logo', 'buat logo', 'bikin logo', 'generate logo',
  'desain logo', 'desainkan logo', 'rancang logo', 'desain kan logo',
  'create logo', 'make logo', 'design logo', 'buatin logo',
  'ilustrasi logo', 'gambar logo', 'gambarkan logo',
  'buatkan gambar', 'buat gambar', 'bikin gambar', 'generate gambar',
  'gambarkan', 'tolong gambarkan', 'buatin gambar', 'ilustrasikan',
  'create image', 'generate image', 'draw me', 'make image',
  'buatkan foto', 'buat foto', 'bikin foto', 'buat ilustrasi',
  'edit gambar', 'modifikasi gambar', 'edit foto',
  'modifikasi foto', 'ganti background', 'edit image',
  'modify image', 'transform image', 'filter gambar',
  'lukiskan gambar', 'lukis gambar',
];

/** Returns the image prompt if detected, otherwise null */
function extractImagePrompt(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of IMAGE_KEYWORDS) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const after = text.slice(idx + kw.length).replace(/^[:\s]+/, '').trim();
      return after || text;
    }
  }
  return null;
}

/**
 * Verbs that mean "produce a new image from this one". Anything else asked about
 * an attachment is a vision question ("ini gambar apa?") and belongs on the
 * normal chat path, which already forwards inlineData to the model.
 */
const IMAGE_EDIT_INTENT = /\b(edit|ubah|ganti|modifikasi|modif|hapus|tambah(?:kan)?|hilangkan|jadikan|buat(?:kan|in)?|bikin|warnai|perbaiki|retouch|upscale|crop|potong|blur|filter|restore|colorize|remove|replace|change|redraw|convert)\b/i;

/**
 * Generated images have no attachment id of their own, so they are keyed by the
 * message that produced them plus their position in that message.
 */
function generatedImageKey(messageId: string, index: number) {
  return `gen:${messageId}:${index}`;
}

/** Rebuilds a message's generated-image array from the IndexedDB read. */
function restoreGeneratedImages(
  messageId: string,
  imageMap: Map<string, StoredImage>,
): string[] | null {
  const out: string[] = [];
  for (let i = 0; ; i++) {
    const hit = imageMap.get(generatedImageKey(messageId, i));
    if (!hit) break;
    out.push(hit.base64);
  }
  return out.length > 0 ? out : null;
}

function downloadBase64Image(base64: string, filename: string, mime = 'image/jpeg') {
  const link = document.createElement('a');
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  link.click();
}


// ─── Markdown Renderer (Full Specification) ──────────────────────────────────

const LINK_CLASS =
  'text-red-400 hover:text-red-300 underline font-semibold transition-colors break-all cursor-pointer inline';

/**
 * Suffixes that parse as a TLD but never are. Without this "file www.config.json
 * rusak" turns the filename into a hyperlink.
 */
const NOT_A_TLD = new Set([
  'json', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'css', 'scss', 'html', 'htm',
  'md', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'yml', 'yaml',
  'env', 'lock', 'log', 'sh', 'bash', 'py', 'go', 'rs', 'java', 'php', 'rb',
  'xml', 'toml', 'ini', 'conf', 'sql', 'zip', 'tar', 'gz', 'pdf', 'doc', 'docx',
  'csv', 'xls', 'xlsx', 'exe', 'dll', 'bak', 'tmp', 'test', 'spec', 'd',
]);

function looksLikeDomain(candidate: string): boolean {
  const host = candidate.split(/[/?#]/)[0].replace(/^www\./, '');
  const tld = host.split('.').pop()?.toLowerCase() ?? '';
  return /^[a-z]{2,24}$/.test(tld) && !NOT_A_TLD.has(tld);
}

/**
 * Splits sentence punctuation off the tail of a URL: "kunjungi https://fetsu.id."
 * must not link the final full stop. A closing paren is kept when the URL opened
 * one, so /wiki/Foo_(bar) survives.
 */
function splitUrlTail(url: string): [string, string] {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (ch === ')') {
      const head = url.slice(0, end);
      const opens = (head.match(/\(/g) ?? []).length;
      const closes = (head.match(/\)/g) ?? []).length;
      if (opens >= closes) break;
    } else if (!'.,!?;:\'"]}'.includes(ch)) {
      break;
    }
    end--;
  }
  return [url.slice(0, end), url.slice(end)];
}

/**
 * Inline scanner. Alternatives are ordered by precedence at a shared starting
 * character, longest-delimiter first — `***` must be tried before `**` before
 * `*`, or the extra asterisks leak into the rendered text.
 *
 * Emphasis bodies open and close on a non-space, non-delimiter character, which
 * is what keeps arithmetic ("5 * 3 * 2") from rendering as italics. The `_`
 * variants additionally require a non-word neighbour so snake_case identifiers
 * are left alone. Bodies match [\s\S] so emphasis can span a soft line break
 * within one paragraph.
 */
const INLINE_RE = new RegExp(
  [
    '(?<code>`[^`\\n]+`)',
    '(?<link>\\[(?<linkLabel>[^\\]]+)\\]\\((?<linkUrl>[^)\\s]+)\\))',
    '(?<email>[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
    '(?<url>https?:\\/\\/[^\\s<>"\']+)',
    '(?<domain>(?:www\\.|github\\.com\\/)[^\\s<>"\']+)',
    // Bodies may not swallow their own delimiter. A body of [\s\S]*?[^\s*] let
    // "*x* dan *y*" read as one italic spanning both words, walking across the
    // opening star of the second pair to close on the last one. Blocking the
    // delimiter ([^*] / [^_]) short-circuits at the first matching pair, while
    // still allowing emphasis to span a soft line break inside one paragraph.
    '\\*\\*\\*(?<biText>[^\\s*](?:[^*]*?[^\\s*])?)\\*\\*\\*',
    '___(?<biUText>[^\\s_](?:[^_]*?[^\\s_])?)___',
    '\\*\\*(?<boldText>[^\\s*](?:[^*]*?[^\\s*])?)\\*\\*',
    '__(?<boldUText>[^\\s_](?:[^_]*?[^\\s_])?)__',
    '\\*(?<italText>[^\\s*](?:[^*]*?[^\\s*])?)\\*',
    '(?<![A-Za-z0-9_])_(?<italUText>[^\\s_](?:[^_]*?[^\\s_])?)_(?![A-Za-z0-9_])',
    '~~(?<strikeText>[\\s\\S]+?)~~',
  ].join('|'),
  'g',
);

// Parse inline formatting: bold, italic, strikethrough, code, links, emails
function parseInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  const pushText = (value: string) => {
    if (value) result.push(<span key={key++}>{value}</span>);
  };

  const pushLink = (href: string, label: ReactNode) => {
    result.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {label}
      </a>
    );
  };

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    const g = match.groups as Record<string, string | undefined>;
    if (match.index > last) pushText(text.slice(last, match.index));
    last = match.index + match[0].length;

    if (g.code !== undefined) {
      result.push(
        <code key={key++} className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-red-300 font-mono text-[0.82em] align-middle">
          {g.code.slice(1, -1)}
        </code>
      );
    } else if (g.link !== undefined) {
      const raw = g.linkUrl!;
      // Anything that isn't an http(s)/mailto URL is prefixed rather than
      // trusted, which neutralises javascript: and data: targets.
      const href = /^(https?:\/\/|mailto:)/i.test(raw) ? raw : `https://${raw}`;
      pushLink(href, parseInline(g.linkLabel!));
    } else if (g.email !== undefined) {
      result.push(
        <a key={key++} href={`mailto:${g.email}`} className={LINK_CLASS}>
          {g.email}
        </a>
      );
    } else if (g.url !== undefined) {
      const [href, tail] = splitUrlTail(g.url);
      pushLink(href, href);
      pushText(tail);
    } else if (g.domain !== undefined) {
      const [candidate, tail] = splitUrlTail(g.domain);
      if (looksLikeDomain(candidate)) {
        pushLink(`https://${candidate}`, candidate);
        pushText(tail);
      } else {
        pushText(g.domain);
      }
    } else if (g.biText !== undefined || g.biUText !== undefined) {
      result.push(
        <strong key={key++} className="text-white font-bold italic">
          {parseInline((g.biText ?? g.biUText)!)}
        </strong>
      );
    } else if (g.boldText !== undefined || g.boldUText !== undefined) {
      result.push(
        <strong key={key++} className="text-white font-bold">
          {parseInline((g.boldText ?? g.boldUText)!)}
        </strong>
      );
    } else if (g.italText !== undefined || g.italUText !== undefined) {
      result.push(
        <em key={key++} className="italic text-slate-200">
          {parseInline((g.italText ?? g.italUText)!)}
        </em>
      );
    } else if (g.strikeText !== undefined) {
      result.push(
        <del key={key++} className="line-through text-slate-400">
          {parseInline(g.strikeText)}
        </del>
      );
    }
  }

  if (last < text.length) pushText(text.slice(last));
  return result;
}

// ─── Generated Image Card ────────────────────────────────────────────────────
const GeneratedImageCard: FC<{
  base64: string;
  prompt: string;
  index: number;
  mime?: string;
  onZoom?: () => void;
}> = ({ base64, prompt, index, mime = 'image/png', onZoom }) => {
  const ext = mime.split('/')[1] || 'png';
  const filename = `fetsubot-image-${index + 1}.${ext}`;
  const src = `data:${mime};base64,${base64}`;

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-[#09090F] group w-full sm:max-w-sm my-1 shadow-xl">
      {/* Clickable Image Container */}
      <div
        onClick={onZoom}
        className="relative cursor-pointer overflow-hidden group/img"
        title="Klik untuk Zoom / Perbesar"
      >
        <img
          src={src}
          alt={`Generated: ${prompt}`}
          // Cap the height so a portrait render can't push the action bar off-screen
          className="w-full max-h-[55vh] sm:max-h-none object-cover transition-transform duration-300 group-hover/img:scale-105"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs">
          <ZoomIn className="w-5 h-5 text-red-400" />
          <span>Klik untuk Zoom</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between gap-2">
        <p className="text-[11px] font-mono text-slate-400 truncate flex-1 min-w-0" title={prompt}>
          🎨 &quot;{prompt}&quot;
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onZoom && (
            <button
              onClick={onZoom}
              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all active:scale-95 flex items-center justify-center"
              title="Mode Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
          <button
            onClick={() => downloadBase64Image(base64, filename, mime)}
            className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-semibold shadow-md hover:from-red-500 hover:to-red-400 transition-all active:scale-95"
            title="Download Gambar"
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden min-[380px]:inline">Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function downloadTextFile(content: string, lang: string) {
  const extMap: Record<string, string> = {
    javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx',
    python: 'py', py: 'py', html: 'html', css: 'css', json: 'json',
    markdown: 'md', md: 'md', sql: 'sql', sh: 'sh', bash: 'sh',
    rust: 'rs', rs: 'rs', go: 'go', php: 'php', java: 'java',
    cpp: 'cpp', c: 'c', xml: 'xml', yaml: 'yaml', yml: 'yml',
  };
  const ext = extMap[lang.toLowerCase()] || 'txt';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modified-file.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// Code block with copy & download buttons — responsive + scrollable when > 10 lines
const LINE_HEIGHT_PX = 22; // approximate line height in px (matches leading-relaxed @ ~13-14px font)
const MAX_VISIBLE_LINES = 10;

const CodeBlock: FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);
  const trimmed = code.trim();
  const lineCount = trimmed.split('\n').length;
  const needsScroll = lineCount > MAX_VISIBLE_LINES;

  const copy = () => {
    navigator.clipboard.writeText(trimmed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-[#09090F] max-w-full min-w-0 shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-800/90 border-b border-slate-700/80">
        <span className="font-mono text-[10px] sm:text-[11px] text-slate-400 tracking-wide uppercase">
          {lang || 'code'}
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => downloadTextFile(trimmed, lang)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white text-[11px] font-semibold transition-all active:scale-95 shadow-sm"
            title="Download File"
          >
            <Download className="w-3.5 h-3.5 text-red-400 group-hover:text-white" />
            <span>Download File</span>
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-white text-[11px] font-medium transition-all active:scale-95"
            title="Copy Code"
          >
            {copied
              ? <Check className="w-3.5 h-3.5 text-emerald-400" />
              : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className={copied ? 'text-emerald-400 font-semibold' : ''}>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code body — vertical scroll kicks in when > 10 lines */}
      <div
        className="overflow-x-auto overflow-y-auto"
        style={needsScroll ? { maxHeight: `${MAX_VISIBLE_LINES * LINE_HEIGHT_PX + 32}px` } : undefined}
      >
        <pre className="px-3 sm:px-4 py-3 sm:py-4 min-w-0">
          <code className="font-mono text-[11px] sm:text-[13px] text-slate-200 leading-relaxed whitespace-pre block">
            {trimmed}
          </code>
        </pre>
      </div>
    </div>
  );
};

// Full markdown renderer
function renderMarkdown(text: string): ReactNode[] {
  // Split into code-block segments vs. text segments
  const segments: { type: 'text' | 'code'; lang?: string; content: string }[] = [];
  // Accepts ``` and ~~~ fences, and — critically — an unterminated one. The
  // renderer re-runs on every prefix of the reply as it streams in, so a block
  // whose closing fence has not arrived yet must still render as code; matching
  // only closed fences made the source text flash as a paragraph mid-stream.
  const codeRe = /(?:^|\n)[ \t]*(```|~~~)([\w+-]*)[ \t]*(?:\n([\s\S]*?))?(?:\n[ \t]*\1[ \t]*(?=\n|$)|$)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = codeRe.exec(text)) !== null) {
    // The leading \n is part of the match but belongs to the preceding text.
    const start = m.index + (text[m.index] === '\n' ? 1 : 0);
    if (start > last) segments.push({ type: 'text', content: text.slice(last, start) });
    segments.push({ type: 'code', lang: m[2] || 'code', content: m[3] ?? '' });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) });

  return segments.map((seg, si) => {
    if (seg.type === 'code') {
      return <CodeBlock key={`cb-${si}`} lang={seg.lang!} code={seg.content} />;
    }
    return (
      <div key={si} className="space-y-0.5">
        {renderBlocks(seg.content.split('\n'), String(si))}
      </div>
    );
  });
}

/**
 * Shared block-level renderer used by both the closed-fence and the
 * unterminated-fence paths so they stay in sync.
 *
 * Key contract: every React key is unique across the whole message
 * because it carries the `segId` prefix (the segment index) and the
 * line index `i`. Adjacent segments therefore never collide even when
 * both contain a list or table that starts at line 0.
 */
function renderBlocks(lines: string[], segId: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Table ──────────────────────────────────────────────────
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      let tIdx = i;
      while (tIdx < lines.length && lines[tIdx].trim().startsWith('|')) {
        tableLines.push(lines[tIdx].trim());
        tIdx++;
      }

      if (tableLines.length >= 2) {
        // slice(1, -1) only strips a trailing pipe; a row without
        // one keeps its last column intact.
        const parseRow = (l: string) => l.split('|').slice(1, l.endsWith('|') ? -1 : undefined).map(c => c.trim());
        const headers = parseRow(tableLines[0]);
        const isSeparator = /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/.test(tableLines[1]);
        const dataRows = (isSeparator ? tableLines.slice(2) : tableLines.slice(1)).map(parseRow);

        nodes.push(
          <div key={`${segId}-tbl-${i}`} className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-[#09090F] shadow-lg">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-800/90 border-b border-slate-700 text-red-400 font-mono">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3.5 py-2 font-bold uppercase tracking-wider">
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2.5 leading-relaxed">
                        {parseInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = tIdx;
        continue;
      }
    }

    // ── Headings ───────────────────────────────────────────────
    if (/^#{1,6}\s+.+/.test(line)) {
      const m = line.match(/^(#{1,6})\s+(.+)/)!;
      const level = m[1].length;
      const cls = ['text-lg font-extrabold text-white mt-3 mb-1', 'text-base font-bold text-white mt-2.5 mb-1', 'text-sm font-bold text-slate-200 mt-2 mb-0.5', 'text-xs font-bold text-slate-300 uppercase tracking-wider mt-1.5 mb-0.5', 'text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1 mb-0.5', 'text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1 mb-0.5'][level - 1];
      nodes.push(<p key={`${segId}-h${level}-${i}`} className={cls}>{parseInline(m[2])}</p>);
      i++; continue;
    }

    // ── Blockquote ─────────────────────────────────────────────
    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s+/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s+/, ''));
        i++;
      }
      nodes.push(
        <blockquote key={`${segId}-bq-${i}`} className="border-l-4 border-red-500 bg-red-950/20 pl-3.5 py-1.5 my-2 rounded-r-lg italic text-slate-300 text-xs sm:text-sm">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{parseInline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // ── Task List ──────────────────────────────────────────────
    if (/^[-*•]\s\[(x| )\]/i.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s\[(x| )\]/i.test(lines[i])) {
        const isChecked = /^[-*•]\s\[x\]/i.test(lines[i]);
        const textContent = lines[i].replace(/^[-*•]\s\[(x| )\]\s*/i, '');
        items.push(
          <li key={`${segId}-task-${i}`} className="flex items-center gap-2 leading-relaxed">
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold ${isChecked ? 'bg-red-600 border-red-500 text-white' : 'border-slate-600 bg-slate-800 text-transparent'}`}>
              ✓
            </span>
            <span className={isChecked ? 'line-through text-slate-400' : ''}>{parseInline(textContent)}</span>
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`${segId}-task-${i}`} className="space-y-1.5 my-1.5">{items}</ul>);
      continue;
    }

    // ── Unordered list (supports 2-space indent for nesting) ──
    if (/^[-*•]\s/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(
          <li key={`${segId}-ul-${i}`} className="flex gap-2 leading-relaxed">
            <span className="text-red-400 mt-1 flex-shrink-0">•</span>
            <span>{parseInline(lines[i].replace(/^[-*•]\s/, ''))}</span>
          </li>
        );
        i++;
      }
      nodes.push(<ul key={`${segId}-ul-${i}`} className="space-y-1 my-1">{items}</ul>);
      continue;
    }

    // ── Ordered list (renumbered from 1) ──────────────────────
    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      let n = 1;
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(
          <li key={`${segId}-ol-${i}`} className="flex gap-2 leading-relaxed">
            <span className="text-red-400 font-mono text-[11px] mt-[3px] flex-shrink-0 w-4 text-right">{n}.</span>
            <span>{parseInline(lines[i].replace(/^\d+\.\s+/, ''))}</span>
          </li>
        );
        i++; n++;
      }
      nodes.push(<ol key={`${segId}-ol-${i}`} className="space-y-1 my-1">{items}</ol>);
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────
    if (/^(---|\*{3}|_{3}|-{4,}|\*{4,}|_{4,})$/.test(line.trim())) {
      nodes.push(<hr key={`${segId}-hr-${i}`} className="border-slate-700/80 my-3" />);
      i++; continue;
    }

    // ── Empty line → spacing ───────────────────────────────────
    if (line.trim() === '') {
      nodes.push(<div key={`${segId}-sp-${i}`} className="h-2" />);
      i++; continue;
    }

    // ── Paragraph ──────────────────────────────────────────────
    nodes.push(
      <p key={`${segId}-p-${i}`} className="leading-relaxed">
        {parseInline(line)}
      </p>
    );
    i++;
  }
  return nodes;
}

// ─── Quick prompts ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Siapa Fetsu?', icon: <User className="w-3 h-3" /> },
  { label: 'Layanan apa saja?', icon: <Server className="w-3 h-3" /> },
  { label: 'Tech stack?', icon: <Code2 className="w-3 h-3" /> },
  { label: 'Berapa harganya?', icon: <Zap className="w-3 h-3" /> },
  { label: 'Cara menghubungi?', icon: <Database className="w-3 h-3" /> },
  { label: 'Cloud & DevOps?', icon: <Cloud className="w-3 h-3" /> },
];

// ─── Streaming cursor ─────────────────────────────────────────────────────────
const Cursor: FC = () => (
  <motion.span
    className="inline-block w-0.5 h-4 bg-red-400 ml-0.5 align-middle"
    animate={{ opacity: [1, 0] }}
    transition={{ repeat: Infinity, duration: 0.5 }}
  />
);

// ─── Attachment chip ──────────────────────────────────────────────────────────
const AttachmentChip: FC<{ file: AttachedFile; onRemove?: () => void; onZoom?: () => void }> = ({ file, onRemove, onZoom }) => (
  <div className="relative group flex-shrink-0">
    {file.isImage && !file.base64 ? (
      // Restored from a session record whose payload is still loading from
      // IndexedDB, or was never stored. A placeholder beats a broken <img>.
      <div
        className="w-16 h-16 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center"
        title={file.name}
      >
        <ImageIcon className="w-5 h-5 text-slate-700" />
      </div>
    ) : file.isImage ? (
      <div
        onClick={onZoom}
        className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer group/chip"
        title="Klik untuk Zoom / Perbesar"
      >
        <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} className="w-full h-full object-cover transition-transform duration-300 group-hover/chip:scale-110" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/chip:opacity-100 flex items-center justify-center transition-opacity">
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
        {onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-slate-300 hover:text-red-400 transition-colors z-10"
            title="Hapus Lampiran"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    ) : (
      <div className="relative flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 max-w-[180px] sm:max-w-none">
        <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-white font-medium truncate">{file.name}</p>
          <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
        </div>
        {onRemove && (
          <button onClick={onRemove} className="ml-0.5 flex-shrink-0 text-slate-500 hover:text-red-400 transition-colors" title="Hapus Lampiran">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )}
  </div>
);

// ─── Image Zoom Lightbox Modal ────────────────────────────────────────────────
interface ZoomImageData {
  src: string;
  prompt: string;
  filename?: string;
  mime?: string;
  base64?: string;
}

const ImageZoomModal: FC<{ image: ZoomImageData | null; onClose: () => void }> = ({ image, onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!image) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none touch-none"
      >
        {/* Top Controls */}
        <div className="flex items-center justify-between gap-4 z-10" onClick={(e) => e.stopPropagation()}>
          <div className="min-w-0">
            <p className="text-white text-xs sm:text-sm font-bold truncate max-w-xs sm:max-w-md">
              🎨 {image.prompt || 'Gambar'}
            </p>
            <p className="text-[10px] sm:text-[11px] font-mono text-slate-400">Mode Zoom Lightbox</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsZoomed((prev) => !prev)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1.5 text-xs font-mono"
              title={isZoomed ? 'Zoom Reset (100%)' : 'Zoom In (150%)'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4 text-red-400" /> : <ZoomIn className="w-4 h-4 text-red-400" />}
              <span className="hidden sm:inline">{isZoomed ? '100%' : '150%'}</span>
            </button>

            {image.base64 && (
              <button
                onClick={() =>
                  downloadBase64Image(
                    image.base64!,
                    image.filename || 'fetsubot-image.png',
                    image.mime || 'image/png'
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-semibold transition-all shadow-lg"
                title="Download Gambar"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-red-600 transition-all"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Image Viewport */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: isZoomed ? 1.5 : 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            src={image.src}
            alt={image.prompt}
            onClick={() => setIsZoomed((prev) => !prev)}
            className={`max-h-[76vh] sm:max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl transition-transform cursor-pointer border border-slate-800/80 ${
              isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
            }`}
          />
        </div>

        {/* Bottom Bar Info */}
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400 z-10" onClick={(e) => e.stopPropagation()}>
          <span className="truncate max-w-xs sm:max-w-md">🔍 Klik gambar untuk perbesar/kecil • Esc untuk keluar</span>
          <button onClick={onClose} className="hover:text-red-400 underline transition-colors">
            Tutup (Esc)
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};



// ─── Main ─────────────────────────────────────────────────────────────────────
export const ChatPage: FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [copiedLink, setCopiedLink] = useState(false);

  const defaultWelcomeMessage = (): Message[] => [{
    id: 'init', role: 'bot', timestamp: new Date(),
    text: '👋 Halo! Saya **FetsuBot** — asisten virtual Fetsu Siahaan, powered by **Gemini AI**.\n\nSilakan tanyakan apa saja, atau lampirkan **gambar / file** untuk dianalisis! 🚀',
  }];

  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [persistFailed, setPersistFailed] = useState(false);
  const [zoomImage, setZoomImage] = useState<ZoomImageData | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startMediaRecorderFallback = async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      setIsListening(false);
      setIsRecordingMedia(false);
      setApiError('🎙️ Perekaman suara diizinkan di localhost atau HTTPS. Silakan akses via http://localhost:5173');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 1000) {
          setIsListening(false);
          setIsRecordingMedia(false);
          return;
        }

        setIsListening(true);
        setApiError(null);

        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            if (!base64Audio || !aiRef.current) return;

            let res = null;
            let transcrError = null;
            for (const modelName of MODELS) {
              try {
                res = await aiRef.current.models.generateContent({
                  model: modelName,
                  contents: [{
                    role: 'user',
                    parts: [
                      { inlineData: { mimeType, data: base64Audio } },
                      { text: 'Transkripsikan rekaman suara ini ke dalam teks Bahasa Indonesia. Hanya kembalikan teks hasil transkrip saja tanpa komentar atau penjelasan tambahan.' }
                    ]
                  }]
                });
                break;
              } catch (e) {
                console.warn(`Transcription failed with model ${modelName}:`, e);
                transcrError = e;
              }
            }

            if (!res) {
              throw transcrError || new Error('All models failed to transcribe audio');
            }

            const text = res.text?.trim() || '';
            if (text) {
              setInput(text);
              sendMessage(text);
            }
          };
        } catch (err) {
          console.error('Audio transcribe error:', err);
          setApiError('Gagal memproses rekaman suara.');
        } finally {
          setIsListening(false);
          setIsRecordingMedia(false);
        }
      };

      mediaRecorder.start();
      setIsRecordingMedia(true);
      setIsListening(true);
      setApiError(null);
    } catch (err) {
      console.error('MediaRecorder error:', err);
      setIsListening(false);
      setIsRecordingMedia(false);
      setApiError('Tidak dapat mengakses mikrofon. Pastikan izin mikrofon telah diberikan pada browser Anda.');
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMedia(false);
  };

  const toggleListening = async () => {
    if (isRecordingMedia) {
      stopMediaRecorder();
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch { /* empty */ }
      setIsListening(false);
      return;
    }

    // 1. Check if browser is on secure context (https: or localhost)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isHttps = window.location.protocol === 'https:';

    if (!isLocalhost && !isHttps) {
      setApiError('🎙️ Fitur Mikrofon (Suara) memerlukan HTTPS atau http://localhost:5173. Di dev lokal, silakan buka via http://localhost:5173');
      return;
    }

    // 2. Safely prompt microphone permission
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach(track => track.stop());
      }
    } catch (micErr) {
      console.warn('Microphone permission denied:', micErr);
      setApiError('Akses mikrofon ditolak. Mohon izinkan mikrofon di pengaturan browser Anda.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // 3. Try native Web Speech API first
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID';
        recognition.continuous = false;
        recognition.interimResults = true;

        let finalSpeechText = '';

        recognition.onstart = () => {
          setIsListening(true);
          setApiError(null);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((result: any) => result[0].transcript)
            .join('');
          finalSpeechText = transcript;
          setInput(transcript);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error, falling back to MediaRecorder:', event.error);
          try { recognition.stop(); } catch { /* empty */ }
          setIsListening(false);
          if (event.error !== 'aborted') {
            startMediaRecorderFallback();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          const toSend = finalSpeechText.trim();
          if (toSend) {
            sendMessage(toSend);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('Web Speech API failed to start, using MediaRecorder fallback:', err);
      }
    }

    // 3. Fallback to MediaRecorder + Gemini 3.6 Transcribe if Web Speech API is not available/failed
    startMediaRecorderFallback();
  };

  // Rate limit state
  const [userIp, setUserIp] = useState<string>('127.0.0.1');
  const [limitData, setLimitData] = useState<LimitData>({ sessionStart: Date.now(), totalTokens: 0 });
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);

  const isBlocked = limitData.totalTokens >= MAX_TOKENS || !!limitData.blockedAt;
  const tokenPct = Math.min(100, (limitData.totalTokens / MAX_TOKENS) * 100);
  const canSend = !isStreaming && !isBlocked;

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Singleton Gemini client
  const aiRef = useRef<GoogleGenAI | null>(null);
  if (!aiRef.current) aiRef.current = new GoogleGenAI({ apiKey: API_KEY });

  // Scroll to bottom — instant on first mount, smooth on new messages
  const isFirstMount = useRef(true);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isFirstMount.current ? 'instant' : (isStreaming ? 'auto' : 'smooth'),
    });
    isFirstMount.current = false;
  }, [messages, isStreaming]);

  const mainWrapperRef = useRef<HTMLDivElement>(null);

  // Prevent browser viewport pinch-to-zoom and gestures on the entire page/document
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventGesture = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    };
  }, []);

  const hasInitializedSession = useRef(false);

  // Ids already written to IndexedDB this session — re-writing an unchanged
  // 500 KB payload on every keystroke would be pure waste.
  const persistedImageIds = useRef<Set<string>>(new Set());

  // ── Fetch IP, load & restore Session JSON by sessionId / IP ─────────────────
  useEffect(() => {
    if (hasInitializedSession.current) return;
    hasInitializedSession.current = true;

    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : ipToUuid('127.0.0.1'));

    const savedSession = loadSessionJSON(activeSid);
    if (savedSession) {
      if (savedSession.messages && savedSession.messages.length > 0) {
        const restored: Message[] = savedSession.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
          // A stream interrupted by the reload would otherwise restore stuck
          // mid-typing, with a blinking cursor that never resolves.
          isStreaming: false,
          isImageGeneration: false,
        }));
        setMessages(restored);

        // Images live in IndexedDB, not in the session record — localStorage
        // cannot hold base64 payloads. Paint the text first, then fill the
        // pictures back in once the async read lands.
        loadSessionImages(activeSid).then(imageMap => {
          if (imageMap.size === 0) return;
          // Mark as already-stored so the next auto-save doesn't rewrite them.
          for (const key of imageMap.keys()) persistedImageIds.current.add(key);
          setMessages(prev => prev.map(msg => ({
            ...msg,
            attachments: msg.attachments?.map(a =>
              a.base64 ? a : { ...a, base64: imageMap.get(a.id)?.base64 },
            ),
            generatedImages: msg.generatedImages?.length
              ? msg.generatedImages
              : restoreGeneratedImages(msg.id, imageMap) ?? undefined,
            generatedMime:
              msg.generatedMime ?? imageMap.get(generatedImageKey(msg.id, 0))?.mimeType,
          })));
        });
      } else {
        setMessages(defaultWelcomeMessage());
      }
      if (savedSession.history) {
        setHistory(savedSession.history);
      }
      if (savedSession.limitData) {
        setLimitData(savedSession.limitData);
        setTimeLeft(calculateTimeLeft(savedSession.limitData));
      }
    } else {
      setMessages(defaultWelcomeMessage());
      const saved = loadLimit(userIp);
      setLimitData(saved);
      setTimeLeft(calculateTimeLeft(saved));
    }
    setIsLoadingSession(false);

    // Fetch user IP in background without overwriting messages
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    fetch('https://api.ipify.org?format=json', { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        clearTimeout(timer);
        if (data.ip) setUserIp(data.ip);
      })
      .catch(() => clearTimeout(timer));
  }, [sessionId, userIp]);

  // ── Auto-save session state ─────────────────────────────────────────────────
  // Split by storage medium: text and metadata go to localStorage, base64 image
  // payloads go to IndexedDB. Inlining images in the session record blows past
  // the ~5 MB quota, and serializing them on every keystroke/token is what kills
  // low-memory mobile tabs.
  useEffect(() => {
    if (isLoadingSession) return;
    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : null);
    if (!activeSid || !userIp) return;

    const save = setTimeout(() => {
      const ok = saveSessionJSON({
        sessionId: activeSid,
        ip: userIp,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        messages: messages.map(m => ({
          ...m,
          timestamp: m.timestamp.toISOString(),
          isStreaming: undefined,
          // Payloads are stripped here and rehydrated from IndexedDB on load.
          // Attachment metadata (id, name, size, mimeType) is kept so the
          // message can be rebuilt even if the image read fails.
          generatedImages: undefined,
          attachments: m.attachments?.map(a => ({ ...a, base64: undefined, fileObj: undefined })),
        })),
        history: history.map(h => ({
          ...h,
          parts: h.parts.filter(p => p.text !== undefined),
        })),
        limitData,
      });
      setPersistFailed(!ok);

      const pending: StoredImage[] = [];
      const seen = persistedImageIds.current;
      const now = Date.now();

      for (const m of messages) {
        if (m.isStreaming) continue; // a half-generated image is not worth storing
        for (const a of m.attachments ?? []) {
          if (a.isImage && a.base64 && !seen.has(a.id)) {
            seen.add(a.id);
            pending.push({ id: a.id, sessionId: activeSid, base64: a.base64, mimeType: a.mimeType, createdAt: now });
          }
        }
        m.generatedImages?.forEach((b64, idx) => {
          const key = generatedImageKey(m.id, idx);
          if (b64 && !seen.has(key)) {
            seen.add(key);
            pending.push({
              id: key, sessionId: activeSid, base64: b64,
              mimeType: m.generatedMime ?? 'image/png', createdAt: now,
            });
          }
        });
      }

      void putImages(pending);
    }, 400);

    return () => clearTimeout(save);
  }, [sessionId, userIp, messages, history, limitData, isLoadingSession]);

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      setLimitData(prev => {
        // If blocked, count down from BLOCK_DURATION (5 minutes)
        if (prev.blockedAt) {
          const remainingBlock = BLOCK_DURATION - (Date.now() - prev.blockedAt);
          setTimeLeft(remainingBlock);
          if (remainingBlock <= 0 && userIp) {
            // Block duration expired -> reset limit completely!
            const fresh = { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
            saveLimit(userIp, fresh);
            setTimeLeft(SESSION_DURATION);
            return fresh;
          }
          return prev;
        }

        // If not blocked, count down from normal SESSION_DURATION (15 minutes)
        const remainingSession = SESSION_DURATION - (Date.now() - prev.sessionStart);
        setTimeLeft(remainingSession);
        if (remainingSession <= 0 && userIp) {
          const fresh = { sessionStart: Date.now(), totalTokens: 0, blockedAt: null };
          saveLimit(userIp, fresh);
          setTimeLeft(SESSION_DURATION);
          return fresh;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [userIp]);

  // ── Download Session JSON & Copy Session URL ───────────────────────────────
  const downloadSessionJSON = () => {
    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : 'session');
    // Built from live state, not storage: the persisted copy has base64 payloads
    // stripped to stay under quota, so only this path yields a complete export.
    const dataObj = {
      sessionId: activeSid,
      ip: userIp || '127.0.0.1',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      messages: messages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
      history,
      limitData,
    };

    const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-session-${activeSid.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySessionUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ── File handling ──────────────────────────────────────────────────────────
  const processFiles = useCallback(async (files: File[] | FileList | null) => {
    if (!files || files.length === 0) return;
    const filesArray = Array.isArray(files) ? files : Array.from(files);
    const toAdd: AttachedFile[] = [];

    for (const file of filesArray) {
      const isImage = file.type.startsWith('image/');
      if (!ACCEPTED_TYPES.includes(file.type) && !isImage) {
        setApiError(`Tipe tidak didukung: ${file.name}`);
        continue;
      }
      // Images get a far looser gate because compressImageIfNeeded downscales them
      // first — a 4 MB camera photo lands well under 1 MB. Documents are sent
      // as-is, so they keep the strict limit.
      const sizeLimit = isImage ? MAX_IMAGE_SOURCE_BYTES : MAX_FILE_BYTES;
      if (file.size > sizeLimit) {
        setApiError(
          `File terlalu besar (maksimal ${formatFileSize(sizeLimit)}): ${file.name} (${formatFileSize(file.size)})`,
        );
        continue;
      }
      try {
        const { base64, mimeType } = await compressImageIfNeeded(file);
        if (!base64) {
          setApiError(`Gagal memproses gambar: ${file.name}`);
          continue;
        }
        // Guard the post-compression payload too: a photo that resists downscaling
        // would otherwise blow the request size at send time instead of here.
        const encodedBytes = Math.ceil((base64.length * 3) / 4);
        if (encodedBytes > MAX_FILE_BYTES) {
          setApiError(
            `Gambar masih terlalu besar setelah dikompres: ${file.name} (${formatFileSize(encodedBytes)})`,
          );
          continue;
        }
        toAdd.push({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}-${file.name}`,
          name: file.name,
          size: encodedBytes,
          mimeType,
          base64,
          isImage: mimeType.startsWith('image/'),
        });
      } catch (err) {
        console.error('File reading error:', err);
        setApiError(`Gagal membaca file: ${file.name} — ${err instanceof Error ? err.message : 'error tidak dikenal'}`);
      }
    }
    if (toAdd.length > 0) {
      setAttachments(prev => [...prev, ...toAdd]);
      setApiError(null);
    }
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const files = target.files;
    if (!files || files.length === 0) return;

    // Clone the FileList before clearing the input — the list is live and empties on reset
    const filesArray = Array.from(files);

    // Reset value so picking the same file twice still fires onChange.
    // Never remount the input here: on mobile WebKit/Blink the element is still
    // mid-dialog and unmounting it aborts the page, which reads as a reload.
    target.value = '';

    processFiles(filesArray);
  };
  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(f => f.id !== id));

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); };

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const msgText = (text ?? input).trim();
    if (!msgText && attachments.length === 0) return;
    if (isStreaming) return;
    if (isBlocked) return;
    if (!userIp) return;

    setApiError(null);
    const snapshot = [...attachments];
    const userMsg: Message = {
      id: `u-${Date.now()}`, role: 'user', text: msgText,
      timestamp: new Date(), attachments: snapshot.length > 0 ? snapshot : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsStreaming(true);

    // ── Image generation & modification branch ──────────────────────────────
    const attachedImage = snapshot.find(f => f.isImage);
    const extractedPrompt = extractImagePrompt(msgText);
    // An attachment alone is not an edit request. "Ini gambar apa?" is a vision
    // question and must go down the chat path, which already forwards the image
    // to the model. Only an explicit edit verb (or a bare attachment with no
    // text at all) routes into the image-generation branch.
    const isImageReq = attachedImage
      ? (!msgText.trim()
          ? 'modifikasi gambar ini'
          : (extractedPrompt || (IMAGE_EDIT_INTENT.test(msgText) ? msgText : null)))
      : extractedPrompt;

    if (isImageReq) {
      const botId = `b-${Date.now()}`;
      setIsGeneratingImage(true);

      setMessages(prev => [...prev, {
        id: botId, role: 'bot', text: '', timestamp: new Date(),
        isStreaming: true, isImageGeneration: true,
      }]);

      try {
        let promptText = isImageReq;
        // These rewrites synthesize a scene from scratch, so they must not touch
        // an edit request — "hapus motor" is short but means edit this photo,
        // not "photograph of hapus motor".
        if (attachedImage) {
          // keep the user's wording verbatim
        } else if (/carikan fotonya|mana fotonya|tampilkan foto|lihat foto|foto tempat/i.test(promptText) || promptText.length < 15) {
          promptText = `Real high resolution photograph of ${msgText} landmark Indonesia`;
        } else if (/logo|lambang|simbol|brand/i.test(isImageReq) || /logo|lambang|simbol|brand/i.test(msgText)) {
          promptText = `Professional logo design: ${isImageReq}. Clean vector graphic, high resolution, minimalist modern logo aesthetic, solid white background, iconic branding.`;
        }

        const reqParts: Part[] = [{ text: promptText }];
        for (const f of snapshot) {
          if (f.isImage && f.base64) {
            reqParts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
          }
        }

        let base64 = '';
        let mimeType = 'image/jpeg';

        // Multimodel fallback loop: coba model 1 (gemini-3.1-flash-image), jika gagal lanjut ke opsi 2 (nano-banana), dst.
        for (const modelName of IMAGE_MODELS) {
          try {
            const response = await aiRef.current!.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: reqParts }],
            });

            const resParts = response.candidates?.[0]?.content?.parts ?? [];
            for (const part of resParts) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inlineData = (part as any).inlineData;
              if (inlineData?.data) {
                base64 = inlineData.data as string;
                mimeType = (inlineData.mimeType as string) || 'image/jpeg';
                break;
              }
            }

            if (base64) break; // Berhasil! Keluar dari loop fallback
          } catch (err) {
            console.warn(`Model gambar '${modelName}' gagal/error, mencoba model berikutnya...`, err);
          }
        }

        // Tier 2 Fallback Engine: High Quality Public AI Image Endpoint
        if (!base64) {
          try {
            console.warn('Gemini models unavailable, switching to Tier 2 AI image engine fallback...');
            const seed = Math.floor(Math.random() * 1000000);
            const encodedPrompt = encodeURIComponent(promptText);
            const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;
            const fetched = await fetchImageAsBase64(pollUrl);
            base64 = fetched.base64;
            mimeType = fetched.mimeType;
          } catch (pollErr) {
            console.warn('Tier 2 image generator failed:', pollErr);
          }
        }

        // Tier 3 Fallback Engine: Dynamic SVG Canvas Graphic Generator
        if (!base64) {
          console.warn('Switching to Tier 3 SVG Graphic Generator fallback...');
          const fallback = generateSvgFallbackBase64(msgText);
          base64 = fallback.base64;
          mimeType = fallback.mimeType;
        }

        setMessages(prev => prev.map(m => m.id === botId ? {
          ...m,
          text: attachedImage ? '✅ Gambar berhasil dimodifikasi!' : `✅ Foto ${msgText} berhasil dibuat!`,
          generatedImages: [base64],
          generatedMime: mimeType,
          isStreaming: false,
          isImageGeneration: false,
        } : m));

        let added = Math.ceil(isImageReq.length / 4) + 200;
        try {
          const tokenRes = await aiRef.current!.models.countTokens({
            model: IMAGE_MODELS[0] || MODELS[0],
            contents: isImageReq,
          });
          if (tokenRes && tokenRes.totalTokens) {
            added = tokenRes.totalTokens + 200;
          }
        } catch (e) {
          console.warn('Fallback to estimateTokens for image:', e);
        }

        setMessages(prev => prev.map(m => m.id === botId ? { ...m, tokenCount: added } : m));

        setLimitData(prev => {
          const newTokens = prev.totalTokens + added;
          const isNowBlocked = newTokens >= MAX_TOKENS;
          const blockedAt = isNowBlocked ? (prev.blockedAt || Date.now()) : null;
          const updated = { ...prev, totalTokens: newTokens, blockedAt };
          saveLimit(userIp!, updated);
          return updated;
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setApiError(msg);
        setMessages(prev => prev.map(m => m.id === botId ? {
          ...m,
          text: `⚠️ Gagal ${attachedImage ? 'memodifikasi' : 'membuat'} gambar.\n\n${msg}`,
          isError: true,
          isStreaming: false,
          isImageGeneration: false,
        } : m));
      } finally {
        setIsGeneratingImage(false);
        setIsStreaming(false);
      }
      return;
    }

    // ── Normal text streaming branch ─────────────────────────────────────────
    const userParts: Part[] = [];
    if (msgText) userParts.push({ text: msgText });
    for (const f of snapshot) {
      if (f.base64) {
        userParts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
      }
    }

    const contents = [
      ...history,
      { role: 'user' as const, parts: userParts },
    ];

    const botId = `b-${Date.now()}`;
    setMessages(prev => [...prev, { id: botId, role: 'bot', text: '', timestamp: new Date(), isStreaming: true }]);

    const abort = new AbortController();
    abortRef.current = abort;

    let fullText = '';
    let currentLength = 0;
    let streamFinished = false;

    // Start a typewriter loop for smooth streaming rendering
    const typewriterInterval = setInterval(() => {
      if (currentLength < fullText.length) {
        const diff = fullText.length - currentLength;
        // Easing-based typing speed: catches up ~90% in 0.6s (30 steps @ 20ms) using a 0.12 factor
        const step = Math.max(0.25, diff * 0.12);
        currentLength = Math.min(fullText.length, currentLength + step);
        const typed = fullText.slice(0, Math.floor(currentLength));
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: typed } : m));
      } else if (streamFinished) {
        clearInterval(typewriterInterval);
      }
    }, 20);

    try {
      let stream = null;
      let textError = null;
      let selectedModel = MODELS[0];

      for (const modelName of MODELS) {
        if (abort.signal.aborted) break;
        try {
          console.log(`Attempting generateContentStream with model: ${modelName}`);
          stream = await aiRef.current!.models.generateContentStream({
            model: modelName,
            contents,
            config: { systemInstruction: SYSTEM_INSTRUCTION },
          });
          selectedModel = modelName;
          break; // Success!
        } catch (err) {
          console.warn(`Model ${modelName} failed, trying next:`, err);
          textError = err;
        }
      }

      if (!stream && !abort.signal.aborted) {
        throw textError || new Error('All models failed to respond.');
      }

      if (stream) {
        for await (const chunk of stream) {
          if (abort.signal.aborted) break;
          const piece = chunk.text ?? '';
          fullText += piece;
        }
      }

      // Wait a moment for typewriter to finish catching up
      while (currentLength < fullText.length && !abort.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setHistory(prev => [
        ...prev,
        { role: 'user', parts: userParts },
        { role: 'model', parts: [{ text: fullText }] },
      ]);

      if (!abort.signal.aborted) {
        let added = Math.ceil(fullText.length / 4);
        try {
          const tokenRes = await aiRef.current!.models.countTokens({
            model: selectedModel,
            contents: fullText,
          });
          if (tokenRes && tokenRes.totalTokens) {
            added = tokenRes.totalTokens;
          }
        } catch (e) {
          console.warn('Fallback to estimateTokens for response:', e);
        }

        setMessages(prev => prev.map(m => m.id === botId ? { ...m, tokenCount: added } : m));

        setLimitData(prev => {
          const newTokens = prev.totalTokens + added;
          const isNowBlocked = newTokens >= MAX_TOKENS;
          const blockedAt = isNowBlocked ? (prev.blockedAt || Date.now()) : null;
          const updated = { ...prev, totalTokens: newTokens, blockedAt };
          saveLimit(userIp!, updated);
          return updated;
        });
      }

    } catch (err) {
      clearInterval(typewriterInterval);
      if (abort.signal.aborted) {
        fullText = fullText || '⏹ Respons dihentikan.';
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setApiError(msg);
        fullText = `⚠️ Gagal menghubungi Gemini AI.\n\n${msg}`;
      }
      setMessages(prev => prev.map(m =>
        m.id === botId ? { ...m, text: fullText, isError: !abort.signal.aborted } : m
      ));
    } finally {
      streamFinished = true;
      clearInterval(typewriterInterval);
      // Ensure the final state shows the exact fullText
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: fullText || m.text, isStreaming: false } : m));
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => { abortRef.current?.abort(); };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) sendMessage();
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setHistory([]);
    const freshMessages: Message[] = [{ id: `init-${Date.now()}`, role: 'bot', text: '🔄 Sesi baru dimulai. Ada yang bisa saya bantu?', timestamp: new Date() }];
    setMessages(freshMessages);
    setAttachments([]);
    setApiError(null);

    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : null);
    if (activeSid) {
      const ok = saveSessionJSON({
        sessionId: activeSid,
        ip: userIp || '127.0.0.1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        messages: freshMessages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
        history: [],
        limitData,
      });
      setPersistFailed(!ok);

      // Drop the binaries too, otherwise a reset frees the text but leaves the
      // images occupying storage with nothing referencing them.
      persistedImageIds.current.clear();
      void clearSessionImages(activeSid);
    }
  };


  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-[#08080C] text-slate-100 flex flex-col items-center justify-center gap-3 font-mono text-sm">
        <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        <p className="text-slate-400 animate-pulse">Memuat Sesi Chat (IP Session UUID)...</p>
      </div>
    );
  }

  // ── Render Main Chat UI ───────────────────────────────────────────────────
  return (
    <div
      ref={mainWrapperRef}
      className="fixed inset-0 bg-[#08080C] flex flex-col text-slate-100 font-sans selection:bg-red-600 selection:text-white overflow-hidden"
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {/* The session id in the URL is per-visitor, so this page is kept out of
          search results — indexing it would publish one entry per conversation
          and leak session ids into the SERP. robots.txt disallows /chat too. */}
      <SEOHead
        title="AI Assistant Workspace — Fetsu Siahaan Software Architecture"
        description="Konsultasikan solusi REST API, arsitektur cloud, dan transformasi sistem enterprise secara langsung dengan AI Assistant Fetsu Siahaan."
        canonicalUrl="https://fetsu.id/chat"
        indexable={false}
      />

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="border-4 border-dashed border-red-500/70 rounded-3xl p-12 flex flex-col items-center gap-4">
              <Paperclip className="w-14 h-14 text-red-400" />
              <p className="text-white text-2xl font-bold">Lepaskan File di Sini</p>
              <p className="text-slate-400 text-sm">Gambar, PDF, atau file teks (Maks 1 MB)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative z-50 flex-shrink-0 bg-[#08080C]/95 backdrop-blur-md border-b border-red-500/20 shadow-[0_2px_30px_rgba(0,0,0,0.9)] pt-[calc(10px+env(safe-area-inset-top))] sm:pt-0">
        <div className="max-w-4xl mx-auto px-2.5 sm:px-6 flex items-center h-14 sm:h-16 gap-2 sm:gap-3">

          <Link
            to="/"
            title="Kembali ke Beranda"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center group flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-600/15 border border-red-500/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              {isStreaming && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-[#08080C] animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm leading-tight flex items-center gap-1.5 min-w-0">
                <span className="truncate">FetsuBot</span>
                <span className="hidden min-[400px]:inline-flex text-[9px] sm:text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">
                  Gemini 3.6
                </span>
              </p>
              <p className="text-[10px] sm:text-[11px] font-mono text-emerald-400 flex items-center gap-1 leading-tight mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block flex-shrink-0" />
                <span className="truncate">{isStreaming ? 'Sedang mengetik...' : 'Online'}</span>
              </p>
            </div>
          </div>

          {/* Uniform square hit targets: mixed padding made these look ragged on mobile */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={downloadSessionJSON}
              title="Download Sesi Chat (JSON)"
              className="w-9 h-9 sm:w-auto sm:h-9 sm:px-3 rounded-xl bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white text-xs font-mono transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            <button
              onClick={copySessionUrl}
              title="Salin Link Sesi"
              className="w-9 h-9 sm:w-auto sm:h-9 sm:px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-mono transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              {copiedLink ? <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" /> : <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Tersalin' : 'Link'}</span>
            </button>
            <button
              onClick={clearChat}
              title="Reset Chat"
              className="w-9 h-9 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center flex-shrink-0 active:scale-95"
            >
              <RefreshCw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>

        {/* Session Info Ribbon */}
        <div className="bg-[#0D0D14] border-t border-b border-slate-800/80 px-3 sm:px-6 py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400 gap-3">
          {/* Truncate from the left: the tail of a UUID is what distinguishes sessions */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-red-400 font-bold flex-shrink-0">SID</span>
            <span className="text-slate-300 truncate min-w-0" dir="rtl">
              {sessionId || (userIp ? ipToUuid(userIp) : 'loading...')}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="hidden sm:inline text-slate-500">FORMAT: JSON</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              {userIp || '...'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 sm:pt-5 pb-8 sm:pb-10 space-y-3 sm:space-y-4">


          {/* Error banner */}
          <AnimatePresence>
            {apiError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-mono"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{apiError}</span>
                <button onClick={() => setApiError(null)}><X className="w-3.5 h-3.5" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Storage quota warning — chat still works, only persistence is lost */}
          <AnimatePresence>
            {persistFailed && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">
                  Penyimpanan browser penuh — riwayat chat tidak tersimpan dan akan hilang jika halaman ditutup.
                  Tekan <strong className="font-semibold">Reset Chat</strong> untuk mengosongkan, atau unduh sesi via tombol JSON.
                </span>
                <button onClick={() => setPersistFailed(false)} title="Tutup peringatan">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list — skip placeholder while waiting for first token (typing bubble handles it) */}
          <AnimatePresence initial={false}>
            {messages.filter(msg => !(msg.isStreaming && msg.text === '')).map((msg) => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className={`flex items-start gap-2 sm:gap-2.5 min-w-0 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar beside the bubble, not above it — stacking cost a full row
                    of vertical space per message on a phone screen. */}
                <div className={`flex-shrink-0 w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center border mt-0.5 ${msg.role === 'bot'
                  ? msg.isError
                    ? 'bg-red-900/30 border-red-500/50 text-red-400'
                    : 'bg-red-600/15 border-red-500/40 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}>
                  {msg.role === 'bot' ? <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </div>

                <div className={`max-w-[calc(100%-2.75rem)] sm:max-w-[78%] min-w-0 flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Attachment previews */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.attachments.map(f => (
                        <AttachmentChip
                          key={f.id}
                          file={f}
                          onZoom={f.isImage && f.base64 ? () => setZoomImage({
                            src: `data:${f.mimeType};base64,${f.base64}`,
                            prompt: f.name,
                            filename: f.name,
                            mime: f.mimeType,
                            base64: f.base64,
                          }) : undefined}
                        />
                      ))}
                    </div>
                  )}

                  {/* Text Bubble */}
                  {(msg.text || (msg.isStreaming && msg.text !== '')) && (
                    <div className={`rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-sm leading-relaxed min-w-0 max-w-full overflow-hidden break-words ${msg.role === 'bot'
                      ? msg.isError
                        ? 'bg-red-950/40 border border-red-500/30 text-red-300 rounded-tl-sm'
                        : 'bg-[#0F0F16] border border-slate-800 text-slate-300 rounded-tl-sm'
                      : 'bg-gradient-to-br from-red-600 to-red-500 text-white rounded-tr-sm shadow-lg shadow-red-900/30'
                      }`}>
                      {msg.role === 'bot' ? (
                        <>
                          {renderMarkdown(msg.text)}
                          {msg.isStreaming && <Cursor />}
                        </>
                      ) : (
                        renderMarkdown(msg.text)
                      )}
                    </div>
                  )}

                  {/* Generated Images */}
                  {msg.generatedImages && msg.generatedImages.length > 0 && (
                    <div className="flex flex-col gap-2 w-full max-w-full sm:max-w-sm">
                      {msg.generatedImages.map((b64, idx) => (
                        <GeneratedImageCard
                          key={idx}
                          base64={b64}
                          prompt={msg.text.replace('✅ Gambar berhasil dibuat!', '').trim() || 'generated'}
                          index={idx}
                          mime={msg.generatedMime ?? 'image/png'}
                          onZoom={() => setZoomImage({
                            src: `data:${msg.generatedMime ?? 'image/png'};base64,${b64}`,
                            prompt: msg.text.replace('✅ Gambar berhasil dibuat!', '').trim() || `Gambar ${idx + 1}`,
                            filename: `fetsubot-image-${idx + 1}.${(msg.generatedMime ?? 'image/png').split('/')[1] || 'png'}`,
                            mime: msg.generatedMime ?? 'image/png',
                            base64: b64,
                          })}
                        />
                      ))}
                    </div>
                  )}



                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 px-0.5">
                    <span>
                      {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'bot' && msg.tokenCount !== undefined && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500/80">{msg.tokenCount} tokens</span>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* ── Typing / Loading Bubbles ─────────────────────────────────────── */}
          <AnimatePresence>
            {isStreaming && messages[messages.length - 1]?.text === '' && (
              <motion.div
                key="typing-bubble"
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="flex flex-col gap-1.5 items-start"
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${isGeneratingImage
                  ? 'bg-violet-600/15 border-violet-500/40 text-violet-400'
                  : 'bg-red-600/15 border-red-500/40 text-red-400'
                  }`}>
                  {isGeneratingImage ? <Sparkles className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 px-1">
                    <motion.span
                      className={`w-1.5 h-1.5 rounded-full inline-block ${isGeneratingImage ? 'bg-violet-500' : 'bg-emerald-500'}`}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    />
                    {isGeneratingImage ? 'FetsuBot sedang membuat gambar...' : 'FetsuBot sedang mengetik...'}
                  </span>

                  {isGeneratingImage ? (
                    /* Image generation loading */
                    <div className="bg-[#0F0F16] border border-violet-500/20 rounded-2xl rounded-tl-sm px-5 py-5 flex flex-col items-center gap-3 w-48">
                      <motion.div
                        className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center"
                        animate={{ rotate: [0, 360] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      >
                        <Sparkles className="w-5 h-5 text-violet-400" />
                      </motion.div>
                      <div className="flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <motion.span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-violet-500"
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] font-mono text-violet-400/70 text-center">Generating image...</p>
                    </div>
                  ) : (
                    /* Text streaming dots */
                    <div className="bg-[#0F0F16] border border-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-2.5 h-2.5 rounded-full bg-red-500"
                          animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.18, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />

        </div>
      </main>

      {/* ── Input Area ──────────────────────────────────────────────────────── */}
      <div className="relative z-30 flex-shrink-0 bg-[#08080C]/95 backdrop-blur-md border-t border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.8)]">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 pt-2.5 sm:pt-4 pb-[calc(10px+env(safe-area-inset-bottom))] sm:pb-4 space-y-2 sm:space-y-3">

          {/* Quick prompts — bleeds to the screen edge so the strip reads as scrollable */}
          <div className="-mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto no-scrollbar fade-edge-r sm:[mask-image:none]">
            <div className="flex gap-2 w-max pr-3 sm:pr-0">
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => sendMessage(p.label)} disabled={!canSend}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full bg-slate-900/80 border border-slate-800 hover:border-red-500/50 hover:text-red-400 text-slate-400 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap active:scale-95"
                >
                  {p.icon}{p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── BLOCKED OVERLAY ─────────────────────────────────────────────── */}
          <AnimatePresence>
            {isBlocked && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-2xl bg-[#0F0F16] border border-red-500/40 p-4 flex flex-col items-center gap-3 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-red-600/15 border border-red-500/40 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Batas Token Tercapai</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Kamu telah menggunakan <span className="text-red-400 font-mono">{limitData.totalTokens}</span> / {MAX_TOKENS} token.
                    <br />Chat akan tersedia kembali dalam:
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-slate-800 font-mono text-xl text-white">
                  <Clock className="w-5 h-5 text-red-400" />
                  <span>{formatMs(timeLeft)}</span>
                </div>
                <p className="text-slate-600 text-[10px]">
                  Atau <a href="https://wa.me/6287824383200" target="_blank" rel="noreferrer" className="text-red-400 hover:underline">hubungi Fetsu langsung</a> untuk kebutuhan lebih lanjut.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Attachment previews */}
          <AnimatePresence>
            {attachments.length > 0 && !isBlocked && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 p-2.5 sm:p-3 rounded-xl bg-slate-900/50 border border-slate-800 overflow-hidden"
              >
                {attachments.map(f => (
                  <AttachmentChip
                    key={f.id}
                    file={f}
                    onRemove={() => removeAttachment(f.id)}
                    onZoom={f.isImage ? () => setZoomImage({
                      src: `data:${f.mimeType};base64,${f.base64}`,
                      prompt: f.name,
                      filename: f.name,
                      mime: f.mimeType,
                      base64: f.base64,
                    }) : undefined}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice listening indicator banner */}
          <AnimatePresence>
            {isListening && !isBlocked && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-red-600/15 border border-red-500/40 text-red-300 text-xs font-mono"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                  <span className="truncate">🎙️ Mendengarkan... Bicara sekarang dalam Bahasa Indonesia</span>
                </div>
                <button onClick={toggleListening} className="text-slate-400 hover:text-white text-xs underline flex-shrink-0 ml-2">
                  Batal
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input row */}
          {!isBlocked && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Attach File (Native Label for Mobile Safety) */}
              <label
                htmlFor="chat-file-input"
                title="Lampirkan gambar / file"
                className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer active:scale-95 ${
                  !canSend ? 'opacity-40 pointer-events-none' : ''
                } ${attachments.length > 0
                  ? 'bg-red-500/15 border-red-500/50 text-red-400'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-red-500/40 hover:text-red-400'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                {attachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {attachments.length}
                  </span>
                )}
              </label>
              <input
                id="chat-file-input"
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.txt,.csv,.json,.md"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Voice Input (Mic) */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={!canSend}
                title={isListening ? 'Berhenti mendengarkan' : 'Bicara sekarang (Input Suara)'}
                className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition-all flex-shrink-0 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isListening
                    ? 'bg-red-600 text-white border-red-500 animate-pulse shadow-lg shadow-red-600/40'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-red-500/40 hover:text-red-400'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
                {isListening && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
                )}
              </button>

              {/* Text input — min-w-0 keeps the flex row from overflowing on narrow screens */}
              <div className="flex-1 relative min-w-0">
                <input
                  type="text" value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={!canSend}
                  placeholder={isListening ? 'Mendengarkan...' : attachments.length > 0 ? 'Keterangan...' : 'Ketik pesan...'}
                  className="w-full h-10 sm:h-11 px-3.5 sm:px-4 pr-8 rounded-xl bg-[#0F0F16] border border-slate-800 focus:border-red-500/70 text-white placeholder-slate-600 focus:outline-none transition-colors font-mono text-base sm:text-sm disabled:opacity-60"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-600 pointer-events-none">↵</span>
              </div>

              {/* Send / Stop */}
              {isStreaming ? (
                <button onClick={stopStreaming}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 border border-red-500/40 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all flex-shrink-0 active:scale-95"
                >
                  <StopCircle className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={() => sendMessage()}
                  disabled={(!input.trim() && attachments.length === 0) || !canSend}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-900/30 disabled:shadow-none flex-shrink-0 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* ── Token & Time usage bar ──────────────────────────────────────── */}
          <div className="space-y-1.5">
            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${tokenPct >= 100 ? 'bg-red-500' :
                    tokenPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  animate={{ width: `${tokenPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className={`text-[10px] font-mono flex-shrink-0 ${tokenPct >= 100 ? 'text-red-400' :
                tokenPct >= 75 ? 'text-amber-400' : 'text-slate-500'
                }`}>
                {limitData.totalTokens}/{MAX_TOKENS} tk
              </span>
            </div>

            {/* Footer info */}
            <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-600">
              <span className="flex items-center gap-1.5 min-w-0">
                <Shield className="w-3 h-3 flex-shrink-0" />
                <span className="hidden sm:inline">Gemini AI • Streaming</span>
                <span className="hidden sm:inline mx-1 text-slate-700">•</span>
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">Reset <span className="text-slate-500">{formatMs(timeLeft)}</span></span>
              </span>
              <a
                href="https://wa.me/6287824383200"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-0.5 text-red-500/60 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <span>Hubungi Fetsu</span>
                <ChevronRight className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Image Zoom Modal ────────────────────────────────────────────────── */}
      <ImageZoomModal image={zoomImage} onClose={() => setZoomImage(null)} />
    </div>
  );
};

export default ChatPage;

