import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Server, Code2, Zap, Database, Cloud,
  X, FileText, Download, ZoomIn, ZoomOut,
  Image as ImageIcon,
} from 'lucide-react';
import { downloadBase64Image, formatFileSize } from './mediaUtils';
import type { AttachedFile, ZoomImageData } from './types';

// ─── Quick prompts ────────────────────────────────────────────────────────────
export const QUICK_PROMPTS = [
  { label: 'Siapa Fetsu?', icon: <User className="w-3 h-3" /> },
  { label: 'Layanan apa saja?', icon: <Server className="w-3 h-3" /> },
  { label: 'Tech stack?', icon: <Code2 className="w-3 h-3" /> },
  { label: 'Berapa harganya?', icon: <Zap className="w-3 h-3" /> },
  { label: 'Cara menghubungi?', icon: <Database className="w-3 h-3" /> },
  { label: 'Cloud & DevOps?', icon: <Cloud className="w-3 h-3" /> },
];

// ─── Generated Image Card ────────────────────────────────────────────────────
export const GeneratedImageCard: FC<{
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

// ─── Attachment chip ──────────────────────────────────────────────────────────
export const AttachmentChip: FC<{ file: AttachedFile; onRemove?: () => void; onZoom?: () => void }> = ({ file, onRemove, onZoom }) => (
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
export const ImageZoomModal: FC<{ image: ZoomImageData | null; onClose: () => void }> = ({ image, onClose }) => {
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
