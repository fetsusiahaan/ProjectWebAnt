import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, KeyboardEvent, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  Send, ArrowLeft, Bot, User, Zap,
  Shield, Server, Code2, Database, Cloud, Cpu,
  RefreshCw, Activity, ChevronRight, Paperclip,
  X, FileText, AlertCircle, StopCircle,
  Copy, Check, Clock, Lock, Download, Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const MODEL = 'gemini-3.6-flash';
const IMAGE_MODEL = 'gemini-3.1-flash-image';

const SYSTEM_INSTRUCTION = `Kamu adalah FetsuBot, asisten virtual dari Fetsu Siahaan — seorang Software Engineer, Backend Developer, dan Solution Architect asal Indonesia.

Tugasmu membantu pengunjung website portfolio Fetsu menjawab pertanyaan seputar:
- Keahlian & tech stack (Go, Rust, Python, TypeScript, React, dll.)
- Layanan yang ditawarkan (REST API, Web App, Cloud Architecture, dll.)
- Proyek, portofolio, dan pengalaman Fetsu
- Cara menghubungi Fetsu & estimasi harga/waktu

Info penting tentang Fetsu:
- 📧 Email: fettsu@gmail.com
- 💼 LinkedIn: linkedin.com/in/fetsu-siahaan
- 🐙 GitHub: github.com/fetsusiahaan
- 🔧 Tech utama: Go (Golang), Rust, Python, TypeScript, React, Next.js
- 🏗️ Spesialisasi: REST API enterprise, microservices, cloud-native architecture
- ⚡ Performa API: 14.000+ req/sec, latency P99 < 12ms, uptime 99.998%
- 🛡️ Stack favorit: Go + PostgreSQL + Redis + Docker/Kubernetes
- ☁️ Cloud: AWS, GCP, Terraform, Prometheus, Grafana
- 💰 Harga: fleksibel, hubungi langsung untuk estimasi

Jika ada gambar atau file yang dikirim, analisis dengan cermat dan berikan respons yang relevan.
Gunakan bahasa Indonesia yang ramah, profesional, dan ringkas. Gunakan emoji secukupnya.`;

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
  base64: string;
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown', 'application/json',
];

// ─── Rate Limit Config ───────────────────────────────────────────────────
const MAX_TOKENS = 4000;
const SESSION_DURATION = 15 * 60 * 1000; // 15 minutes

interface LimitData {
  sessionStart: number;
  totalTokens: number;
}

function storageKey(ip: string) {
  return `fetsubot_limit_${ip}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function loadLimit(ip: string): LimitData {
  try {
    const raw = localStorage.getItem(storageKey(ip));
    if (!raw) return { sessionStart: Date.now(), totalTokens: 0 };
    const data: LimitData = JSON.parse(raw);
    // expired → fresh session
    if (Date.now() - data.sessionStart >= SESSION_DURATION) {
      return { sessionStart: Date.now(), totalTokens: 0 };
    }
    return data;
  } catch { return { sessionStart: Date.now(), totalTokens: 0 }; }
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

// ─── Image Generation & Modification Helpers ────────────────────────────────
const IMAGE_KEYWORDS = [
  'buatkan gambar', 'buat gambar', 'bikin gambar', 'generate gambar',
  'gambarkan', 'tolong gambarkan', 'buatin gambar', 'ilustrasikan',
  'create image', 'generate image', 'draw me', 'make image',
  'buatkan foto', 'buat foto', 'bikin foto', 'buat ilustrasi',
  'edit gambar', 'modifikasi gambar', 'ubah gambar', 'edit foto',
  'modifikasi foto', 'ubah foto', 'ganti background', 'edit image',
  'modify image', 'transform image', 'filter gambar', 'style gambar',
  'ubah warna', 'tambahkan pada gambar', 'perbaiki gambar', 'variasi gambar',
  'tambahkan', 'tambah', 'edit', 'ubah', 'ganti', 'lukis',
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

function isImageModifyIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = [
    'edit', 'ubah', 'modifikasi', 'ganti', 'perbaiki', 'filter',
    'tambah', 'tambahkan', 'hapus', 'style', 'jadikan', 'variasi', 'revisi', 'transform',
    'gambar', 'foto', 'image', 'background', 'warna', 'isi', 'isikan', 'lukis',
  ];
  return keywords.some(k => lower.includes(k));
}

function downloadBase64Image(base64: string, filename: string, mime = 'image/jpeg') {
  const link = document.createElement('a');
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  link.click();
}


// ─── Markdown Renderer (Claude-style) ───────────────────────────────────────

// Parse inline: **bold**, *italic*, `code`
function parseInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0, match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) result.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    if (match[2]) result.push(<strong key={key++} className="text-white font-semibold">{match[2]}</strong>);
    else if (match[3]) result.push(<em key={key++} className="italic text-slate-200">{match[3]}</em>);
    else if (match[4]) result.push(
      <code key={key++} className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-red-300 font-mono text-[0.82em] align-middle">
        {match[4]}
      </code>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push(<span key={key++}>{text.slice(last)}</span>);
  return result;
}

// ─── Generated Image Card ────────────────────────────────────────────────────
const GeneratedImageCard: FC<{ base64: string; prompt: string; index: number; mime?: string }> = ({ base64, prompt, index, mime = 'image/png' }) => {
  const ext = mime.split('/')[1] || 'png';
  const filename = `fetsubot-image-${index + 1}.${ext}`;

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-[#09090F] group max-w-xs sm:max-w-sm my-2 shadow-xl">
      <img
        src={`data:${mime};base64,${base64}`}
        alt={`Generated: ${prompt}`}
        className="w-full object-cover rounded-t-xl"
      />
      {/* Overlay on hover (desktop) */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 hidden sm:flex items-end justify-end p-2 opacity-0 group-hover:opacity-100">
        <button
          onClick={() => downloadBase64Image(base64, filename, mime)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors shadow-lg"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
      </div>
      {/* Action Bar (Always visible on both Mobile & Desktop) */}
      <div className="px-3 py-2.5 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between gap-2">
        <p className="text-[11px] font-mono text-slate-400 truncate flex-1" title={prompt}>
          🎨 &quot;{prompt}&quot;
        </p>
        <button
          onClick={() => downloadBase64Image(base64, filename, mime)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-semibold shadow-md hover:from-red-500 hover:to-red-400 transition-all active:scale-95 flex-shrink-0"
          title="Download Gambar"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
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
  const codeRe = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = codeRe.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'text', content: text.slice(last, m.index) });
    segments.push({ type: 'code', lang: m[1] || 'code', content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) });

  return segments.map((seg, si) => {
    if (seg.type === 'code') {
      return <CodeBlock key={si} lang={seg.lang!} code={seg.content} />;
    }

    // Text segment: parse line by line
    const lines = seg.content.split('\n');
    const nodes: ReactNode[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // H1
      if (/^# (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-base font-bold text-white mt-3 mb-1">{parseInline(line.slice(2))}</p>);
        i++; continue;
      }
      // H2
      if (/^## (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-sm font-bold text-white mt-2 mb-1">{parseInline(line.slice(3))}</p>);
        i++; continue;
      }
      // H3
      if (/^### (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-sm font-semibold text-slate-200 mt-1.5 mb-0.5">{parseInline(line.slice(4))}</p>);
        i++; continue;
      }

      // Bullet list block
      if (/^[-*•] /.test(line)) {
        const items: ReactNode[] = [];
        while (i < lines.length && /^[-*•] /.test(lines[i])) {
          items.push(
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="text-red-400 mt-1 flex-shrink-0">•</span>
              <span>{parseInline(lines[i].replace(/^[-*•] /, ''))}</span>
            </li>
          );
          i++;
        }
        nodes.push(<ul key={`${si}-ul-${i}`} className="space-y-1 my-1">{items}</ul>);
        continue;
      }

      // Numbered list block
      if (/^\d+\. /.test(line)) {
        const items: ReactNode[] = [];
        let n = 1;
        while (i < lines.length && /^\d+\. /.test(lines[i])) {
          items.push(
            <li key={i} className="flex gap-2 leading-relaxed">
              <span className="text-red-400 font-mono text-[11px] mt-[3px] flex-shrink-0 w-4 text-right">{n}.</span>
              <span>{parseInline(lines[i].replace(/^\d+\. /, ''))}</span>
            </li>
          );
          i++; n++;
        }
        nodes.push(<ol key={`${si}-ol-${i}`} className="space-y-1 my-1">{items}</ol>);
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        nodes.push(<hr key={`${si}-${i}`} className="border-slate-700 my-3" />);
        i++; continue;
      }

      // Empty line → spacing
      if (line.trim() === '') {
        nodes.push(<div key={`${si}-${i}`} className="h-2" />);
        i++; continue;
      }

      // Regular paragraph line
      nodes.push(
        <p key={`${si}-${i}`} className="leading-relaxed">
          {parseInline(line)}
        </p>
      );
      i++;
    }
    return <div key={si} className="space-y-0.5">{nodes}</div>;
  });
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
const AttachmentChip: FC<{ file: AttachedFile; onRemove?: () => void }> = ({ file, onRemove }) => (
  <div className="relative group flex-shrink-0">
    {file.isImage ? (
      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
        <img src={`data:${file.mimeType};base64,${file.base64}`} alt={file.name} className="w-full h-full object-cover" />
        {onRemove && (
          <button onClick={onRemove} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    ) : (
      <div className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700">
        <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-white font-medium truncate max-w-[100px]">{file.name}</p>
          <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
        </div>
        {onRemove && (
          <button onClick={onRemove} className="ml-1 text-slate-500 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )}
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export const ChatPage: FC = () => {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'init', role: 'bot', timestamp: new Date(),
    text: '👋 Halo! Saya **FetsuBot** — asisten virtual Fetsu Siahaan, powered by **Gemini AI**.\n\nSilakan tanyakan apa saja, atau lampirkan **gambar / file** untuk dianalisis! 🚀',
  }]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Rate limit state
  const [userIp, setUserIp] = useState<string | null>(null);
  const [limitData, setLimitData] = useState<LimitData>({ sessionStart: Date.now(), totalTokens: 0 });
  const [timeLeft, setTimeLeft] = useState<number>(SESSION_DURATION);

  const isBlocked = limitData.totalTokens >= MAX_TOKENS;
  const tokenPct = Math.min(100, (limitData.totalTokens / MAX_TOKENS) * 100);
  const canSend = !isStreaming && !isBlocked && !!userIp;

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
      behavior: isFirstMount.current ? 'instant' : 'smooth',
    });
    isFirstMount.current = false;
  }, [messages]);

  // ── Fetch IP & load limit ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(data => {
        const ip = data.ip as string;
        setUserIp(ip);
        const saved = loadLimit(ip);
        setLimitData(saved);
        setTimeLeft(SESSION_DURATION - (Date.now() - saved.sessionStart));
      })
      .catch(() => {
        // Fallback: use a fixed key if IP fetch fails
        const fallback = 'unknown';
        setUserIp(fallback);
        const saved = loadLimit(fallback);
        setLimitData(saved);
        setTimeLeft(SESSION_DURATION - (Date.now() - saved.sessionStart));
      });
  }, []);

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    const tick = setInterval(() => {
      setLimitData(prev => {
        const remaining = SESSION_DURATION - (Date.now() - prev.sessionStart);
        setTimeLeft(remaining);
        // Auto-reset expired session
        if (remaining <= 0 && userIp) {
          const fresh = { sessionStart: Date.now(), totalTokens: 0 };
          saveLimit(userIp, fresh);
          setTimeLeft(SESSION_DURATION);
          return fresh;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [userIp]);

  // ── File handling ──────────────────────────────────────────────────────────
  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const toAdd: AttachedFile[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setApiError(`Tipe tidak didukung: ${file.name}`); continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setApiError(`File terlalu besar (maks 10 MB): ${file.name}`); continue;
      }
      const base64 = await fileToBase64(file);
      toAdd.push({ id: `${Date.now()}-${file.name}`, name: file.name, size: file.size, mimeType: file.type, base64, isImage: file.type.startsWith('image/') });
    }
    setAttachments(prev => [...prev, ...toAdd]);
    setApiError(null);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { processFiles(e.target.files); e.target.value = ''; };
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
    const isImageReq = attachedImage
      ? (msgText.trim() ? msgText : 'modifikasi gambar ini')
      : (extractedPrompt || (isImageModifyIntent(msgText) ? msgText : null));

    if (isImageReq) {
      const botId = `b-${Date.now()}`;
      setIsGeneratingImage(true);
      setMessages(prev => [...prev, {
        id: botId, role: 'bot', text: '', timestamp: new Date(),
        isStreaming: true, isImageGeneration: true,
      }]);

      try {
        const reqParts: Part[] = [{ text: isImageReq }];
        for (const f of snapshot) {
          if (f.isImage) {
            reqParts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
          }
        }

        const response = await aiRef.current!.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: 'user', parts: reqParts }],
        });

        // Cari part inlineData (gambar)
        const resParts = response.candidates?.[0]?.content?.parts ?? [];
        let base64 = '';
        let mimeType = 'image/jpeg';
        for (const part of resParts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inlineData = (part as any).inlineData;
          if (inlineData?.data) {
            base64 = inlineData.data as string;
            mimeType = (inlineData.mimeType as string) || 'image/jpeg';
            break;
          }
        }

        if (!base64) throw new Error('Model tidak mengembalikan data gambar.');

        setMessages(prev => prev.map(m => m.id === botId ? {
          ...m,
          text: attachedImage ? '✅ Gambar berhasil dimodifikasi!' : '✅ Gambar berhasil dibuat!',
          generatedImages: [base64],
          generatedMime: mimeType,
          isStreaming: false,
          isImageGeneration: false,
        } : m));

        const added = estimateTokens(isImageReq) + 200;
        setLimitData(prev => {
          const updated = { ...prev, totalTokens: prev.totalTokens + added };
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
      userParts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
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
    try {
      const stream = await aiRef.current!.models.generateContentStream({
        model: MODEL,
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });

      for await (const chunk of stream) {
        if (abort.signal.aborted) break;
        const piece = chunk.text ?? '';
        fullText += piece;
        setMessages(prev => prev.map(m => m.id === botId ? { ...m, text: fullText } : m));
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }

      setHistory(prev => [
        ...prev,
        { role: 'user', parts: userParts },
        { role: 'model', parts: [{ text: fullText }] },
      ]);

      if (!abort.signal.aborted) {
        const added = estimateTokens(fullText);
        setLimitData(prev => {
          const updated = { ...prev, totalTokens: prev.totalTokens + added };
          saveLimit(userIp!, updated);
          return updated;
        });
      }

    } catch (err) {
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
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, isStreaming: false } : m));
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
    setMessages([{ id: `init-${Date.now()}`, role: 'bot', text: '🔄 Sesi baru dimulai. Ada yang bisa saya bantu?', timestamp: new Date() }]);
    setAttachments([]);
    setApiError(null);
    // NOTE: does NOT reset limit — user must wait for session to expire
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#08080C] flex flex-col text-slate-100 font-sans selection:bg-red-600 selection:text-white"
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >

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
              <p className="text-slate-400 text-sm">Gambar, PDF, atau file teks</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#08080C]/90 backdrop-blur-md border-b border-red-500/20 shadow-[0_2px_30px_rgba(0,0,0,0.9)]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">

          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="hidden sm:inline">Kembali ke Beranda</span>
            <span className="sm:hidden">Kembali</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/40 flex items-center justify-center">
              <Bot className="w-5 h-5 text-red-400" />
              {isStreaming && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#08080C] animate-pulse" />
              )}
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight flex items-center gap-1.5">
                FetsuBot
                <span className="text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded">
                  Gemini 3.6
                </span>
              </p>
              <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                {isStreaming ? 'Sedang mengetik...' : `Online — ${userIp ?? '...'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={clearChat} title="Reset Chat" className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-red-500/30 text-xs font-mono text-red-400">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>STREAM</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-6 space-y-4">


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

          {/* Message list — skip placeholder while waiting for first token (typing bubble handles it) */}
          <AnimatePresence initial={false}>
            {messages.filter(msg => !(msg.isStreaming && msg.text === '')).map((msg) => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className={`flex flex-col min-w-0 gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Avatar — selalu di atas */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${msg.role === 'bot'
                  ? msg.isError
                    ? 'bg-red-900/30 border-red-500/50 text-red-400'
                    : 'bg-red-600/15 border-red-500/40 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}>
                  {msg.role === 'bot' ? <Cpu className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Content — di bawah avatar */}
                <div className={`max-w-[85%] sm:max-w-[78%] min-w-0 flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Attachment previews */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.attachments.map(f => <AttachmentChip key={f.id} file={f} />)}
                    </div>
                  )}

                  {/* Text Bubble */}
                  {(msg.text || (msg.isStreaming && msg.text !== '')) && (
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed min-w-0 w-full overflow-hidden ${msg.role === 'bot'
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
                      ) : msg.text}
                    </div>
                  )}

                  {/* Generated Images */}
                  {msg.generatedImages && msg.generatedImages.length > 0 && (
                    <div className="flex flex-col gap-2 w-full max-w-xs sm:max-w-sm">
                      {msg.generatedImages.map((b64, idx) => (
                        <GeneratedImageCard
                          key={idx}
                          base64={b64}
                          prompt={msg.text.replace('✅ Gambar berhasil dibuat!', '').trim() || 'generated'}
                          index={idx}
                          mime={msg.generatedMime ?? 'image/png'}
                        />
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] font-mono text-slate-600 px-1">
                    {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
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
      <div className="sticky bottom-0 bg-[#08080C]/95 backdrop-blur-md border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-3">

          {/* Quick prompts */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} onClick={() => sendMessage(p.label)} disabled={!canSend}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 hover:border-red-500/50 hover:text-red-400 text-slate-400 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {p.icon}{p.label}
              </button>
            ))}
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
                className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-900/50 border border-slate-800"
              >
                {attachments.map(f => <AttachmentChip key={f.id} file={f} onRemove={() => removeAttachment(f.id)} />)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input row */}
          {!isBlocked && (
            <div className="flex items-center gap-2">
              {/* Attach */}
              <button onClick={() => fileRef.current?.click()} disabled={!canSend}
                title="Lampirkan gambar / file"
                className={`relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${attachments.length > 0
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
              </button>
              <input ref={fileRef} type="file" multiple accept={ACCEPTED_TYPES.join(',')} onChange={handleFileChange} className="hidden" />

              {/* Text input */}
              <div className="flex-1 relative">
                <input
                  type="text" value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={!canSend}
                  placeholder={attachments.length > 0 ? 'Tambahkan keterangan (opsional)...' : 'Ketik pesan atau drag & drop file...'}
                  className="w-full px-4 py-3 pr-10 rounded-xl bg-[#0F0F16] border border-slate-800 focus:border-red-500/70 text-white placeholder-slate-600 focus:outline-none transition-colors font-mono text-sm disabled:opacity-60"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-600">↵</span>
              </div>

              {/* Send / Stop */}
              {isStreaming ? (
                <button onClick={stopStreaming}
                  className="w-11 h-11 rounded-xl bg-slate-800 border border-red-500/40 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-all flex-shrink-0"
                >
                  <StopCircle className="w-5 h-5" />
                </button>
              ) : (
                <button onClick={() => sendMessage()}
                  disabled={(!input.trim() && attachments.length === 0) || !canSend}
                  className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all shadow-lg shadow-red-900/30 disabled:shadow-none flex-shrink-0"
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
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                <span className="hidden sm:inline">Gemini AI • Streaming</span>
                <span className="mx-1 text-slate-700">•</span>
                <Clock className="w-3 h-3" />
                <span>Reset: <span className="text-slate-500">{formatMs(timeLeft)}</span></span>
              </span>
              <a
                href="https://wa.me/6287824383200"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-red-500/60 hover:text-red-400 transition-colors"
              >
                <span>Hubungi Fetsu</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

