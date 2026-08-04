import type { StoredImage } from '../../utils/imageStore';

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
export function extractImagePrompt(text: string): string | null {
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
export const IMAGE_EDIT_INTENT = /\b(edit|ubah|ganti|modifikasi|modif|hapus|tambah(?:kan)?|hilangkan|jadikan|buat(?:kan|in)?|bikin|warnai|perbaiki|retouch|upscale|crop|potong|blur|filter|restore|colorize|remove|replace|change|redraw|convert)\b/i;

/**
 * Generated images have no attachment id of their own, so they are keyed by the
 * message that produced them plus their position in that message.
 */
export function generatedImageKey(messageId: string, index: number) {
  return `gen:${messageId}:${index}`;
}

/** Rebuilds a message's generated-image array from the IndexedDB read. */
export function restoreGeneratedImages(
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
