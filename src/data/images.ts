/* A link's picture, stored once: fetched through our server, cut to one master around its centre,
   saved at twice its display size, plus a small square for lists. Cards crop the master; nothing is scaled again. */
import type { ImageRef } from '../../shared/types';

/* the master's shorter side covers the tallest or widest card slot (3 cells = 264px) */
const SHORT = 270, LONG_MAX = 2.2, DPR = 2, THUMB = 40;

async function encode(c: HTMLCanvasElement): Promise<Blob> {
  const b = await new Promise<Blob | null>(r => c.toBlob(r, 'image/webp', 0.82));
  if (b && b.type === 'image/webp') return b;
  return (await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.84)))!;
}
function cut(src: ImageBitmap, w: number, h: number, fx = 0.5, fy = 0.5) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high';
  const s = Math.max(w / src.width, h / src.height), sw = w / s, sh = h / s;
  const sx = Math.min(Math.max(src.width * fx - sw / 2, 0), src.width - sw), sy = Math.min(Math.max(src.height * fy - sh / 2, 0), src.height - sh);
  g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}
async function put(key: string, blob: Blob) {
  const r = await fetch(`/api/images/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob });
  if (!r.ok) throw new Error('upload ' + r.status);
}

export async function storeImage(linkId: string, remote: string): Promise<ImageRef | null> {
  try {
    const r = await fetch(`/api/fetch-image?url=${encodeURIComponent(remote)}`);
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    if (bmp.width < 60 || bmp.height < 40) return null;
    const ar = bmp.width / bmp.height;
    let w: number, h: number;
    if (ar >= 1) { h = SHORT; w = Math.round(SHORT * Math.min(ar, LONG_MAX)); } else { w = SHORT; h = Math.round(SHORT * Math.min(1 / ar, LONG_MAX)); }
    /* a small source is kept at its own size rather than blown up */
    const k = Math.min(1, bmp.width / (w * DPR), bmp.height / (h * DPR));
    const master = cut(bmp, Math.round(w * DPR * k), Math.round(h * DPR * k));
    const thumb = cut(bmp, THUMB * DPR, THUMB * DPR);
    const key = `${linkId}-${Math.random().toString(36).slice(2, 8)}`;
    await Promise.all([put(key, await encode(master)), put(key + '.t', await encode(thumb))]);
    bmp.close();
    return { key, w, h, fx: 0.5, fy: 0.5 };
  } catch { return null; }
}
