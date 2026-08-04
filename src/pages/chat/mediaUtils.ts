/** Ceiling for anything sent verbatim (documents) and for post-compression images. */
export const MAX_FILE_BYTES = 1 * 1024 * 1024;
/** Source ceiling for images — they are downscaled before reaching this budget. */
export const MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;

export function readAsBase64(file: Blob, fallbackMime: string): Promise<{ base64: string; mimeType: string }> {
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

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
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
export async function compressImageIfNeeded(
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

/** Decodes base64 into a Blob URL — avoids the double memory cost of a `data:` URI string sitting in the DOM alongside its decoded bitmap. Caller must URL.revokeObjectURL when done. */
export function base64ToBlobUrl(base64: string, mimeType: string): string {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mimeType }));
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
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

export function generateSvgFallbackBase64(promptText: string): { base64: string; mimeType: string } {
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

export function downloadBase64Image(base64: string, filename: string, mime = 'image/jpeg') {
  const link = document.createElement('a');
  link.href = `data:${mime};base64,${base64}`;
  link.download = filename;
  link.click();
}

export function downloadTextFile(content: string, lang: string) {
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
