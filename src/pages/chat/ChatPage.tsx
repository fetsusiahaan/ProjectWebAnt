import { useState, useRef, useEffect, useCallback } from 'react';
import type { FC, KeyboardEvent, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ArrowLeft, Bot, User, Shield, Cpu,
  RefreshCw, ChevronRight, Paperclip,
  X, AlertCircle, StopCircle,
  Copy, Check, Clock, Lock, Download, Sparkles,
  Mic, MicOff,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { ipToUuid, loadSessionJSON, saveSessionJSON } from '../../utils/session';
import { putImages, loadSessionImages, clearSessionImages } from '../../utils/imageStore';
import { CHAT_CONFIG, SYSTEM_INSTRUCTION, MAINTENANCE_CONFIG } from '../../config/chatConfig';
import { SEOHead } from '../../components/SEOHead';
import { MaintenancePage } from './MaintenancePage';
import type { Part, HistoryEntry, AttachedFile, Message, LimitData, ZoomImageData } from './types';
import { compressImageIfNeeded, formatFileSize, fetchImageAsBase64, generateSvgFallbackBase64, MAX_FILE_BYTES, MAX_IMAGE_SOURCE_BYTES } from './mediaUtils';
import { loadLimit, saveLimit, formatMs, calculateTimeLeft } from './rateLimit';
import { extractImagePrompt, IMAGE_EDIT_INTENT, generatedImageKey, restoreGeneratedImages } from './imageIntent';
import { Markdown, Cursor } from './markdown';
import { GeneratedImageCard, AttachmentChip, ImageZoomModal, QUICK_PROMPTS } from './components';

const API_KEY = CHAT_CONFIG.apiKey;
const MODELS = CHAT_CONFIG.models || [CHAT_CONFIG.model || 'gemini-3.6-flash'];
const IMAGE_MODELS = CHAT_CONFIG.imageModels || [CHAT_CONFIG.imageModel, 'nano-banana', 'imagen-3.0-generate-002'];
const ACCEPTED_TYPES = CHAT_CONFIG.acceptedFileTypes;
const MAX_TOKENS = CHAT_CONFIG.maxTokens;
const SESSION_DURATION = CHAT_CONFIG.sessionDurationMs;
const BLOCK_DURATION = CHAT_CONFIG.blockDurationMs;

// ─── Main ─────────────────────────────────────────────────────────────────────
export const ChatPage: FC = () => {
  if (MAINTENANCE_CONFIG.enabled) {
    return <MaintenancePage until={MAINTENANCE_CONFIG.until} />;
  }

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
  const [userIp, setUserIp] = useState<string>('');
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

      const pending: import('../../utils/imageStore').StoredImage[] = [];
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
                          <Markdown text={msg.text} />
                          {msg.isStreaming && <Cursor />}
                        </>
                      ) : (
                        <Markdown text={msg.text} />
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
