export interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface HistoryEntry {
  role: 'user' | 'model';
  parts: Part[];
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  base64?: string;
  previewUrl?: string;
  fileObj?: File;
  isImage: boolean;
}

export interface Message {
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

export interface LimitData {
  sessionStart: number;
  totalTokens: number;
  blockedAt?: number | null;
}

export interface ZoomImageData {
  src: string;
  prompt: string;
  filename?: string;
  mime?: string;
  base64?: string;
}
