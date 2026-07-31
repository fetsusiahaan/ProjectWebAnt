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
  ZoomIn, ZoomOut, Mic, MicOff, MapPin, Compass, Navigation, ExternalLink,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { ipToUuid, loadSessionJSON, saveSessionJSON } from '../utils/session';
import { CHAT_CONFIG, SYSTEM_INSTRUCTION } from '../config/chatConfig';

const API_KEY = CHAT_CONFIG.apiKey;
const MODEL = CHAT_CONFIG.model;
const IMAGE_MODELS = CHAT_CONFIG.imageModels || [CHAT_CONFIG.imageModel, 'nano-banana', 'imagen-3.0-generate-002'];
const ACCEPTED_TYPES = CHAT_CONFIG.acceptedFileTypes;
const MAX_TOKENS = CHAT_CONFIG.maxTokens;
const SESSION_DURATION = CHAT_CONFIG.sessionDurationMs;

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

export interface LocationData {
  query: string;
  title: string;
  address?: string;
  photoUrl?: string;
  mapEmbedUrl: string;
  googleMapsUrl: string;
  directionsUrl: string;
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
  locationData?: LocationData;  // data lokasi Google Maps & foto tempat
}

// ─── Location & Google Maps Helpers ─────────────────────────────────────────
const LOCATION_STOP_WORDS = new Set([
  'dan', 'peta', 'untuk', 'foto', 'gambar', 'lokasi', 'informasi', 'tentang',
  'apakah', 'ada', 'ke', 'di', 'pada', 'dari', 'yang', 'ini', 'itu', 'mengenai',
  'seputar', 'bisa', 'tolong', 'carikan', 'tampilkan', 'mana', 'dimana', 'posisi',
  'alamat', 'rute', 'maps', 'google', 'saya', 'kamu', 'anda', 'dia', 'mereka', 'saja'
]);

function cleanExtractedLocation(raw: string): string | null {
  if (!raw) return null;
  let cleaned = raw.replace(/[?!.,;:]+$/g, '').trim();

  const words = cleaned.split(/\s+/);
  while (words.length > 0 && LOCATION_STOP_WORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  while (words.length > 0 && LOCATION_STOP_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }

  cleaned = words.join(' ').trim();
  if (cleaned.length < 3) return null;
  return cleaned;
}

const GEOGRAPHIC_PREFIX_PATTERN = /(?:pulau|danau|gunung|pantai|candi|taman|air terjun|kota|kabupaten|kecamatan|desa|kelurahan|bukit|lembah|sungai|tanjung|selat|teluk|museum|monumen|alun-alun|stasiun|bandara|pelabuhan)\s+([a-zA-Z0-9\s.-]{3,40})/i;

function detectLocationQuery(text: string): string | null {
  if (!text) return null;
  const cleanText = text.trim();

  // 1. Check geographic place prefixes (e.g. "Pulau Samosir", "Danau Toba", "Gunung Bromo")
  const geoMatch = cleanText.match(GEOGRAPHIC_PREFIX_PATTERN);
  if (geoMatch && geoMatch[0]) {
    const cleaned = cleanExtractedLocation(geoMatch[0]);
    if (cleaned) return cleaned;
  }

  // 2. Explicit landmark & city match with strict word boundaries \b to avoid matching sub-words like "Balige" -> "bali"
  const landmarkPattern = /\b(monumen nasional|monas|candi borobudur|pantai kuta|grafana|fetsu|jakarta|bandung|surakarta|yogyakarta|jogja|bali|medan|semarang|surabaya|malang|bogor|bekasi|tangerang|depok|tanah abang|dufan|taman mini|tmii|ancol|senayan|gbk|samosir|toba|bromo|rinjani|komodo|labuan bajo|raja ampat)\b/i;
  const lmMatch = cleanText.match(landmarkPattern);
  if (lmMatch && lmMatch[1]) {
    return lmMatch[1].trim();
  }

  // 3. Keyword pattern search ("lokasi X", "peta X", "alamat X", etc.)
  const keywordPattern = /(?:lokasi|peta|maps|google maps|alamat|rute ke|posisi|dimana|di mana|tempat)\s+(?:di\s+|ke\s+|untuk\s+)?([a-zA-Z0-9\s,.-]{3,60})/i;
  const match = cleanText.match(keywordPattern);
  if (match && match[1]) {
    const cleaned = cleanExtractedLocation(match[1]);
    if (cleaned) return cleaned;
  }

  return null;
}

/**
 * Resolves context when user sends follow-up requests like "carikan fotonya", "mana fotonya"
 */
function resolveContextualSubject(userText: string, messageHistory: Message[]): string {
  const clean = userText.trim();
  const lower = clean.toLowerCase();

  const isFollowUp = /^(carikan|mana|tampilkan|minta|lihat|kirim|apakah ada)\s+(foto|gambar|peta|lokasi|fotonya|gambarnya|petanya|lokasinya)\b/i.test(lower) ||
    /^(foto|gambar|peta|lokasi|fotonya|gambarnya)$/i.test(lower);

  if (!isFollowUp) {
    return userText;
  }

  // Search recent history for active topic/location
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    const m = messageHistory[i];

    if (m.locationData?.title) {
      return m.locationData.title;
    }

    const loc = detectLocationQuery(m.text);
    if (loc) {
      return loc;
    }

    const lm = m.text.match(/\b(monumen nasional|monas|candi borobudur|pantai kuta|grafana|fetsu|jakarta|bandung|surakarta|yogyakarta|jogja|bali|medan|semarang|surabaya|malang|bogor|bekasi|tangerang|tanah abang|dufan|taman mini|tmii|ancol|senayan|gbk|samosir|toba|bromo|rinjani|komodo|labuan bajo|raja ampat)\b/i);
    if (lm && lm[1]) {
      return lm[1];
    }
  }

  return userText;
}

const REAL_LANDMARK_PHOTOS: Record<string, string> = {
  samosir: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  'pulau samosir': 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  toba: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  'danau toba': 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  bekasi: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
  jakarta: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=800&q=80',
  monas: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=800&q=80',
  'monumen nasional': 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?auto=format&fit=crop&w=800&q=80',
  ancol: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
  dufan: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80',
  bandung: 'https://images.unsplash.com/photo-1584810359583-96fc3448beaa?auto=format&fit=crop&w=800&q=80',
  surabaya: 'https://images.unsplash.com/photo-1601058268499-e52658b8bb88?auto=format&fit=crop&w=800&q=80',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  kuta: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
  yogyakarta: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  jogja: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  borobudur: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  'candi borobudur': 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  bogor: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80',
  tangerang: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
  depok: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
  medan: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80',
  semarang: 'https://images.unsplash.com/photo-1601058268499-e52658b8bb88?auto=format&fit=crop&w=800&q=80',
  malang: 'https://images.unsplash.com/photo-1584810359583-96fc3448beaa?auto=format&fit=crop&w=800&q=80',
};

function getInstagramPhotoUrl(query: string): string {
  const clean = query.toLowerCase().trim();
  for (const [key, url] of Object.entries(REAL_LANDMARK_PHOTOS)) {
    if (clean.includes(key)) return url;
  }
  const seed = Math.abs(query.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0));
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(`real landmark photograph of ${query} city location place indonesia, realistic shot, 8k resolution`)}?width=800&height=500&nologo=true&seed=${seed}`;
}

/**
 * Scrapes & fetches Instagram location & hashtag photography for any place query
 */
async function fetchInstagramPlacePhoto(query: string): Promise<string> {
  const clean = query.trim().replace(/\s+/g, '');
  const tag = clean.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Try fetching public Instagram hashtag media via public CORS proxy
  try {
    const igProxyUrl = `https://www.instagram.com/explore/tags/${tag}/?__a=1&__d=dis`;
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(igProxyUrl)}`);
    if (res.ok) {
      const data = await res.json();
      const mediaList = data?.graphql?.hashtag?.edge_hashtag_to_media?.edges;
      if (mediaList && mediaList.length > 0) {
        const photoSrc = mediaList[0]?.node?.display_url || mediaList[0]?.node?.thumbnail_src;
        if (photoSrc) return photoSrc;
      }
    }
  } catch (err) {
    console.warn('Instagram direct scrape failed or CORS blocked, using Instagram media stream fallback:', err);
  }

  // 2. Instagram Aesthetic Real Place Stream Fallback
  return getInstagramPhotoUrl(query);
}

function formatLocationQueryForMaps(query: string): string {
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // If query doesn't already contain indonesia, append indonesia for global precision
  if (!lower.includes('indonesia') && !lower.includes('jakarta') && !lower.includes('bali') && !lower.includes('java')) {
    return `${clean}, Indonesia`;
  }
  return clean;
}

function buildLocationData(query: string): LocationData {
  const fullSearchQuery = formatLocationQueryForMaps(query);
  const encoded = encodeURIComponent(fullSearchQuery);

  // iwloc=B forces Google Maps to place a RED PIN marker directly on the exact location
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encoded}&t=&z=14&ie=UTF8&iwloc=B&output=embed`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const photoUrl = getInstagramPhotoUrl(query);

  return {
    query,
    title: query.charAt(0).toUpperCase() + query.slice(1),
    address: `Lokasi Referensi Google Maps (${fullSearchQuery})`,
    photoUrl,
    mapEmbedUrl,
    googleMapsUrl,
    directionsUrl,
  };
}

// ─── Google Maps Card Component ─────────────────────────────────────────────
const GoogleMapsCard: FC<{
  location: LocationData;
  onZoomImage?: (photoUrl: string, title: string) => void;
}> = ({ location, onZoomImage }) => {
  const [showMap, setShowMap] = useState(true);
  const initialPhoto = location.photoUrl || getInstagramPhotoUrl(location.query);
  const [imgSrc, setImgSrc] = useState<string>(initialPhoto);

  useEffect(() => {
    let isMounted = true;
    const defaultPhoto = location.photoUrl || getInstagramPhotoUrl(location.query);
    setImgSrc(defaultPhoto);

    fetchInstagramPlacePhoto(location.query)
      .then(url => {
        if (isMounted && url) {
          setImgSrc(url);
        }
      })
      .catch(() => {
        if (isMounted) setImgSrc(defaultPhoto);
      });

    return () => { isMounted = false; };
  }, [location.photoUrl, location.query]);

  const handleImageError = () => {
    setImgSrc(`https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80`);
  };

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-[#09090F] shadow-xl max-w-full min-w-0">
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 truncate">
          <div className="p-1.5 rounded-lg bg-red-600/15 border border-red-500/30 text-red-400 flex-shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-white truncate">{location.title}</p>
            <p className="text-[10px] font-mono text-slate-400 truncate">{location.address}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowMap(prev => !prev)}
          className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-mono transition-all flex items-center gap-1 flex-shrink-0"
        >
          <Compass className="w-3.5 h-3.5 text-red-400" />
          <span>{showMap ? 'Sembunyikan Peta' : 'Tampilkan Peta'}</span>
        </button>
      </div>

      {/* 1. Foto Tempat dari Instagram (Selalu Tampil di Atas) */}
      {imgSrc && (
        <div
          onClick={() => onZoomImage?.(imgSrc, location.title)}
          className="relative group cursor-pointer overflow-hidden h-52 sm:h-60 bg-slate-950"
          title="Klik untuk Zoom Foto Tempat Instagram"
        >
          <img
            src={imgSrc}
            alt={location.title}
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs">
            <ZoomIn className="w-5 h-5 text-red-400" />
            <span>Klik untuk Zoom Foto Instagram</span>
          </div>
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white flex items-center gap-1.5 shadow-md">
            <Sparkles className="w-3 h-3 text-pink-400" />
            <span>📸 Foto Instagram Location</span>
          </div>
        </div>
      )}

      {/* 2. Peta Google Maps Interaktif (Di Bawah Foto) */}
      {showMap && (
        <div className="w-full h-48 sm:h-56 overflow-hidden relative border-t border-slate-800">
          <iframe
            title={`Google Maps ${location.title}`}
            src={location.mapEmbedUrl}
            className="w-full h-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </div>
      )}

      {/* Footer Buttons */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        <a
          href={location.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs font-semibold shadow-md transition-all active:scale-95 text-center whitespace-nowrap"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Buka di Google Maps</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </a>

        <a
          href={location.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all active:scale-95 text-center whitespace-nowrap"
        >
          <Navigation className="w-3.5 h-3.5 text-red-400" />
          <span>Petunjuk Arah</span>
        </a>
      </div>
    </div>
  );
};

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
  'buatkan logo', 'buat logo', 'bikin logo', 'generate logo',
  'desain logo', 'desainkan logo', 'rancang logo', 'desain kan logo',
  'create logo', 'make logo', 'design logo', 'buatin logo',
  'ilustrasi logo', 'gambar logo', 'gambarkan logo', 'edit logo',
  'modifikasi logo', 'ubah logo', 'variasi logo', 'logo',
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
    'logo', 'desain', 'rancang', 'lambang', 'simbol',
  ];
  return keywords.some(k => lower.includes(k));
}

function downloadBase64Image(base64: string, filename: string, mime = 'image/jpeg') {
  const link = document.createElement('a');
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  link.click();
}


// ─── Markdown Renderer (Full Specification) ──────────────────────────────────

// Parse inline formatting: **bold**, *italic*, ~~strikethrough~~, `code`, [link](url), raw URLs, emails
function parseInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  // Match order: 
  // 1. [label](url)
  // 2. email address
  // 3. raw https?:// url
  // 4. raw domain url (www. or github.com/)
  // 5. **bold**
  // 6. *italic*
  // 7. ~~strikethrough~~
  // 8. `code`
  const regex = /(\[([^\]]+)\]\(([^)\s]+)\)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(https?:\/\/[^\s<)"']+)|((?:www\.|github\.com\/)[^\s<)"']+)|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(~~(.+?)~~)|(`([^`]+)`))/gi;

  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      result.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }

    const [full, , mdLabel, mdUrl, email, rawUrl, domainUrl, , boldText, , italicText, , strikeText, , codeText] = match;

    if (mdLabel && mdUrl) {
      // 1. Markdown link [label](url)
      const targetUrl = mdUrl.startsWith('http://') || mdUrl.startsWith('https://') || mdUrl.startsWith('mailto:')
        ? mdUrl
        : `https://${mdUrl}`;

      result.push(
        <a
          key={key++}
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:text-red-300 underline font-semibold transition-colors break-all cursor-pointer inline"
        >
          {parseInline(mdLabel)}
        </a>
      );
    } else if (email) {
      // 2. Email address
      result.push(
        <a
          key={key++}
          href={`mailto:${email}`}
          className="text-red-400 hover:text-red-300 underline font-semibold transition-colors break-all cursor-pointer inline"
        >
          {email}
        </a>
      );
    } else if (rawUrl) {
      // 3. Raw HTTP/HTTPS URL
      result.push(
        <a
          key={key++}
          href={rawUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:text-red-300 underline font-semibold transition-colors break-all cursor-pointer inline"
        >
          {rawUrl}
        </a>
      );
    } else if (domainUrl) {
      // 4. Raw domain URL
      const targetUrl = domainUrl.startsWith('www.') ? `https://${domainUrl}` : `https://${domainUrl}`;
      result.push(
        <a
          key={key++}
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 hover:text-red-300 underline font-semibold transition-colors break-all cursor-pointer inline"
        >
          {domainUrl}
        </a>
      );
    } else if (boldText) {
      result.push(<strong key={key++} className="text-white font-semibold">{parseInline(boldText)}</strong>);
    } else if (italicText) {
      result.push(<em key={key++} className="italic text-slate-200">{parseInline(italicText)}</em>);
    } else if (strikeText) {
      result.push(<del key={key++} className="line-through text-slate-400">{parseInline(strikeText)}</del>);
    } else if (codeText) {
      result.push(
        <code key={key++} className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-800 border border-slate-700/80 text-red-300 font-mono text-[0.82em] align-middle">
          {codeText}
        </code>
      );
    }

    last = match.index + full.length;
  }

  if (last < text.length) {
    result.push(<span key={key++}>{text.slice(last)}</span>);
  }

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
    <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-[#09090F] group max-w-xs sm:max-w-sm my-2 shadow-xl">
      {/* Clickable Image Container */}
      <div
        onClick={onZoom}
        className="relative cursor-pointer overflow-hidden group/img"
        title="Klik untuk Zoom / Perbesar"
      >
        <img
          src={src}
          alt={`Generated: ${prompt}`}
          className="w-full object-cover rounded-t-xl transition-transform duration-300 group-hover/img:scale-105"
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-medium text-xs">
          <ZoomIn className="w-5 h-5 text-red-400" />
          <span>Klik untuk Zoom</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-3 py-2.5 bg-slate-900/90 border-t border-slate-700/80 flex items-center justify-between gap-2">
        <p className="text-[11px] font-mono text-slate-400 truncate flex-1" title={prompt}>
          🎨 &quot;{prompt}&quot;
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onZoom && (
            <button
              onClick={onZoom}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition-all active:scale-95"
              title="Mode Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
          <button
            onClick={() => downloadBase64Image(base64, filename, mime)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-semibold shadow-md hover:from-red-500 hover:to-red-400 transition-all active:scale-95"
            title="Download Gambar"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
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
      return <CodeBlock key={`cb-${si}`} lang={seg.lang!} code={seg.content} />;
    }

    const lines = seg.content.split('\n');
    const nodes: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Markdown Table parsing
      if (line.trim().startsWith('|')) {
        const tableLines: string[] = [];
        let tIdx = i;
        while (tIdx < lines.length && lines[tIdx].trim().startsWith('|')) {
          tableLines.push(lines[tIdx].trim());
          tIdx++;
        }

        if (tableLines.length >= 2) {
          const parseRow = (l: string) => l.split('|').slice(1, -1).map(c => c.trim());
          const headers = parseRow(tableLines[0]);
          const isSeparator = /^\|?\s*:?-+:?\s*(\|?\s*:?-+:?\s*)*\|?$/.test(tableLines[1]);
          const dataRows = (isSeparator ? tableLines.slice(2) : tableLines.slice(1)).map(parseRow);

          nodes.push(
            <div key={`${si}-tbl-${i}`} className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-[#09090F] shadow-lg">
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

      // H1
      if (/^# (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-lg font-extrabold text-white mt-3 mb-1">{parseInline(line.slice(2))}</p>);
        i++; continue;
      }
      // H2
      if (/^## (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-base font-bold text-white mt-2.5 mb-1">{parseInline(line.slice(3))}</p>);
        i++; continue;
      }
      // H3
      if (/^### (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-sm font-bold text-slate-200 mt-2 mb-0.5">{parseInline(line.slice(4))}</p>);
        i++; continue;
      }
      // H4+
      if (/^####+ (.+)/.test(line)) {
        nodes.push(<p key={`${si}-${i}`} className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1.5 mb-0.5">{parseInline(line.replace(/^#+\s*/, ''))}</p>);
        i++; continue;
      }

      // Blockquotes (> Quote)
      if (/^> (.+)/.test(line)) {
        const quoteLines: string[] = [];
        while (i < lines.length && /^> /.test(lines[i])) {
          quoteLines.push(lines[i].slice(2));
          i++;
        }
        nodes.push(
          <blockquote key={`${si}-bq-${i}`} className="border-l-4 border-red-500 bg-red-950/20 pl-3.5 py-1.5 my-2 rounded-r-lg italic text-slate-300 text-xs sm:text-sm">
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{parseInline(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // Task List items (- [ ] or - [x])
      if (/^[-*•] \[(x| )\] /i.test(line)) {
        const items: ReactNode[] = [];
        while (i < lines.length && /^[-*•] \[(x| )\] /i.test(lines[i])) {
          const isChecked = /^[-*•] \[x\] /i.test(lines[i]);
          const textContent = lines[i].replace(/^[-*•] \[(x| )\] /i, '');
          items.push(
            <li key={i} className="flex items-center gap-2 leading-relaxed">
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold ${isChecked ? 'bg-red-600 border-red-500 text-white' : 'border-slate-600 bg-slate-800 text-transparent'
                }`}>
                ✓
              </span>
              <span className={isChecked ? 'line-through text-slate-400' : ''}>{parseInline(textContent)}</span>
            </li>
          );
          i++;
        }
        nodes.push(<ul key={`${si}-task-${i}`} className="space-y-1.5 my-1.5">{items}</ul>);
        continue;
      }

      // Unordered Bullet list block
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

      // Horizontal rule (---, ***, ___)
      if (/^(---|[*]{3}|_{3})$/.test(line.trim())) {
        nodes.push(<hr key={`${si}-${i}`} className="border-slate-700/80 my-3" />);
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
const AttachmentChip: FC<{ file: AttachedFile; onRemove?: () => void; onZoom?: () => void }> = ({ file, onRemove, onZoom }) => (
  <div className="relative group flex-shrink-0">
    {file.isImage ? (
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
        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6"
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
          className="flex-1 flex items-center justify-center overflow-auto py-4 select-none"
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

  const [messages, setMessages] = useState<Message[]>(() => {
    if (sessionId) {
      const saved = loadSessionJSON(sessionId);
      if (saved && saved.messages && saved.messages.length > 0) {
        return saved.messages.map(m => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    }
    return [{
      id: 'init', role: 'bot', timestamp: new Date(),
      text: '👋 Halo! Saya **FetsuBot** — asisten virtual Fetsu Siahaan, powered by **Gemini AI**.\n\nSilakan tanyakan apa saja, atau lampirkan **gambar / file** untuk dianalisis! 🚀',
    }];
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (sessionId) {
      const saved = loadSessionJSON(sessionId);
      if (saved && saved.history) return saved.history;
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
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

            const res = await aiRef.current.models.generateContent({
              model: MODEL,
              contents: [{
                role: 'user',
                parts: [
                  { inlineData: { mimeType, data: base64Audio } },
                  { text: 'Transkripsikan rekaman suara ini ke dalam teks Bahasa Indonesia. Hanya kembalikan teks hasil transkrip saja tanpa komentar atau penjelasan tambahan.' }
                ]
              }]
            });

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

  const isBlocked = limitData.totalTokens >= MAX_TOKENS;
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
      behavior: isFirstMount.current ? 'instant' : 'smooth',
    });
    isFirstMount.current = false;
  }, [messages]);

  // ── Fetch IP, load & restore Session JSON by sessionId / IP ─────────────────
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(data => {
        const ip = (data.ip as string) || '127.0.0.1';
        setUserIp(ip);

        const activeSid = sessionId || ipToUuid(ip);
        if (!sessionId) {
          window.history.replaceState(null, '', `/chat/${activeSid}`);
        }

        const savedSession = loadSessionJSON(activeSid);
        if (savedSession) {
          if (savedSession.limitData) {
            setLimitData(savedSession.limitData);
            setTimeLeft(SESSION_DURATION - (Date.now() - savedSession.limitData.sessionStart));
          }
        } else {
          const saved = loadLimit(ip);
          setLimitData(saved);
          setTimeLeft(SESSION_DURATION - (Date.now() - saved.sessionStart));
        }
      })
      .catch(() => {
        const fallbackIp = '127.0.0.1';
        setUserIp(fallbackIp);
        const activeSid = sessionId || ipToUuid(fallbackIp);
        const savedSession = loadSessionJSON(activeSid);
        if (savedSession && savedSession.limitData) {
          setLimitData(savedSession.limitData);
        } else {
          const saved = loadLimit(fallbackIp);
          setLimitData(saved);
        }
      });
  }, [sessionId]);

  // ── Auto-save session state to JSON ─────────────────────────────────────────
  useEffect(() => {
    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : null);
    if (!activeSid || !userIp) return;

    saveSessionJSON({
      sessionId: activeSid,
      ip: userIp,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      messages: messages.map(m => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
      history,
      limitData,
    });
  }, [sessionId, userIp, messages, history, limitData]);

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

  // ── Download Session JSON & Copy Session URL ───────────────────────────────
  const downloadSessionJSON = () => {
    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : 'session');
    const dataObj = loadSessionJSON(activeSid) || {
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
    const contextualSubject = resolveContextualSubject(msgText, messages);
    const attachedImage = snapshot.find(f => f.isImage);
    const extractedPrompt = extractImagePrompt(msgText);
    const isImageReq = attachedImage
      ? (msgText.trim() ? msgText : 'modifikasi gambar ini')
      : (extractedPrompt || (isImageModifyIntent(msgText) ? msgText : null));

    if (isImageReq) {
      const botId = `b-${Date.now()}`;
      setIsGeneratingImage(true);

      const resolvedLocQuery = detectLocationQuery(contextualSubject) || detectLocationQuery(msgText);
      const locData = resolvedLocQuery ? buildLocationData(resolvedLocQuery) : undefined;

      setMessages(prev => [...prev, {
        id: botId, role: 'bot', text: '', timestamp: new Date(),
        isStreaming: true, isImageGeneration: true,
        locationData: locData,
      }]);

      try {
        let promptText = isImageReq;
        if (/carikan fotonya|mana fotonya|tampilkan foto|lihat foto|foto tempat/i.test(promptText) || promptText.length < 15) {
          promptText = `Real high resolution photograph of ${contextualSubject} landmark Indonesia`;
        } else if (/logo|lambang|simbol|brand/i.test(isImageReq) || /logo|lambang|simbol|brand/i.test(msgText)) {
          promptText = `Professional logo design: ${isImageReq}. Clean vector graphic, high resolution, minimalist modern logo aesthetic, solid white background, iconic branding.`;
        }

        const reqParts: Part[] = [{ text: promptText }];
        for (const f of snapshot) {
          if (f.isImage) {
            reqParts.push({ inlineData: { mimeType: f.mimeType, data: f.base64 } });
          }
        }

        let base64 = '';
        let mimeType = 'image/jpeg';
        let lastErr: Error | null = null;

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
            lastErr = err instanceof Error ? err : new Error(String(err));
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
          const fallback = generateSvgFallbackBase64(contextualSubject);
          base64 = fallback.base64;
          mimeType = fallback.mimeType;
        }

        setMessages(prev => prev.map(m => m.id === botId ? {
          ...m,
          text: attachedImage ? '✅ Gambar berhasil dimodifikasi!' : `✅ Foto ${contextualSubject} berhasil dibuat!`,
          generatedImages: [base64],
          generatedMime: mimeType,
          isStreaming: false,
          isImageGeneration: false,
          locationData: locData || m.locationData,
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

        // Detect location query and attach Google Maps Location Card
        const locQuery = detectLocationQuery(msgText) || detectLocationQuery(fullText);
        if (locQuery) {
          const locData = buildLocationData(locQuery);
          setMessages(prev => prev.map(m => m.id === botId ? { ...m, locationData: locData } : m));
        }
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
    const freshMessages: Message[] = [{ id: `init-${Date.now()}`, role: 'bot', text: '🔄 Sesi baru dimulai. Ada yang bisa saya bantu?', timestamp: new Date() }];
    setMessages(freshMessages);
    setAttachments([]);
    setApiError(null);

    const activeSid = sessionId || (userIp ? ipToUuid(userIp) : null);
    if (activeSid) {
      saveSessionJSON({
        sessionId: activeSid,
        ip: userIp || '127.0.0.1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        messages: freshMessages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() })),
        history: [],
        limitData,
      });
    }
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
      <header className="sticky top-0 z-50 bg-[#08080C]/95 backdrop-blur-md border-b border-red-500/20 shadow-[0_2px_30px_rgba(0,0,0,0.9)] pt-2.5 sm:pt-0">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 flex items-center justify-between h-14 sm:h-16 gap-2">

          <Link
            to="/"
            title="Kembali ke Beranda"
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center group flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-600/15 border border-red-500/40 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              {isStreaming && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-[#08080C] animate-pulse" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-xs sm:text-sm leading-tight flex items-center gap-1.5 truncate">
                <span className="truncate">FetsuBot</span>
                <span className="hidden min-[380px]:inline-flex text-[9px] sm:text-[10px] font-mono bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded flex-shrink-0">
                  Gemini 3.6
                </span>
              </p>
              <p className="text-[10px] sm:text-[11px] font-mono text-emerald-400 flex items-center gap-1 leading-tight mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block flex-shrink-0" />
                <span className="truncate">{isStreaming ? 'Sedang mengetik...' : 'Online'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={downloadSessionJSON}
              title="Download Sesi Chat (JSON)"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white text-xs font-mono transition-all flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            <button
              onClick={copySessionUrl}
              title="Salin Link Sesi"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-mono transition-all flex items-center gap-1"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedLink ? 'Tersalin' : 'Link'}</span>
            </button>
            <button onClick={clearChat} title="Reset Chat" className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all flex items-center justify-center">
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Session Info Ribbon */}
        <div className="bg-[#0D0D14] border-t border-b border-slate-800/80 px-3 sm:px-6 py-1 flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-slate-400 gap-2">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <span className="text-red-400 font-bold flex-shrink-0">SESSION:</span>
            <span className="text-slate-300 truncate max-w-[100px] min-[360px]:max-w-[150px] sm:max-w-none">
              {sessionId || (userIp ? ipToUuid(userIp) : 'loading...')}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="hidden sm:inline text-slate-500">FORMAT: JSON</span>
            <span className="text-emerald-400">● IP: {userIp || '...'}</span>
          </div>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-10 space-y-4">


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
                      {msg.attachments.map(f => (
                        <AttachmentChip
                          key={f.id}
                          file={f}
                          onZoom={f.isImage ? () => setZoomImage({
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
                      ) : (
                        renderMarkdown(msg.text)
                      )}
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

                  {/* Google Maps Location Card */}
                  {msg.locationData && (
                    <div className="w-full max-w-full sm:max-w-md">
                      <GoogleMapsCard
                        location={msg.locationData}
                        onZoomImage={(photoUrl, title) =>
                          setZoomImage({
                            src: photoUrl,
                            prompt: title,
                            filename: `${title.toLowerCase().replace(/\s+/g, '-')}-location.jpg`,
                          })
                        }
                      />
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
      <div className="sticky bottom-0 z-30 bg-[#08080C]/95 backdrop-blur-md border-t border-slate-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.8)]">
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

              {/* Voice Input (Mic) */}
              <button
                type="button"
                onClick={toggleListening}
                disabled={!canSend}
                title={isListening ? 'Berhenti mendengarkan' : 'Bicara sekarang (Input Suara)'}
                className={`relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
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

              {/* Text input */}
              <div className="flex-1 relative">
                <input
                  type="text" value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={!canSend}
                  placeholder={isListening ? 'Mendengarkan suara Anda...' : attachments.length > 0 ? 'Tambahkan keterangan (opsional)...' : 'Ketik pesan, suara (mic), atau drop file...'}
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

      {/* ── Image Zoom Modal ────────────────────────────────────────────────── */}
      <ImageZoomModal image={zoomImage} onClose={() => setZoomImage(null)} />
    </div>
  );
};

export default ChatPage;

