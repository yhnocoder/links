/* Links · card renderers (from the card-style lab, v18). Every renderer returns {cls, style, html} for a w×h card.
   One master image per link; every slot is a 1:1 window onto it around the focal point (crop, never scale). */
import { SIMPLE } from './simple-icons';
import { SITES, type Site } from './sites';

/* what a card needs to know about a link, already formatted for display */
export interface L {
  id: string;
  k: 'yt' | 'bili' | 'xhs' | 'web' | 'gh' | 'ghpr' | 'paper' | 'chat';
  site: string;
  sn: string;
  host: string;
  path: string;
  url: string;
  t: string;
  ex?: string;
  img?: { src: string; w: number; h: number; fx: number; fy: number } | null;
  thumb?: string | null;
  state?: 'loading' | 'failed' | 'unclear';
  added: number; // days since saved
  opened: number; // days since last opened, -1 never
  clicks: number;
  [k: string]: any;
}
export interface Block { id?: string; kind: 'card' | 'list' | 'note'; link?: string; rows?: string[]; title?: string; style?: string; tint?: string; text?: string; items?: [string, number][]; w?: number; h?: number; proj?: string }
export type Links = Record<string, L>;
export interface Rendered { cls: string; style?: string; html: string }

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
let GAP = 6;
export const setGap = (g: number) => { GAP = g; };
export const px = (n: number) => n * 84 + (n - 1) * GAP;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const SIZES: [number, number][] = [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [2, 3]];
const ALL = SIZES.map(s => s.join('x'));
const has = (v: unknown) => v != null && v !== '';

function I(l: L, w: number, h: number) {
  const m = l.img; if (!m) return '';
  const x = Math.round(clamp(w / 2 - m.fx * m.w, w - m.w, 0)), y = Math.round(clamp(h / 2 - m.fy * m.h, h - m.h, 0));
  return `<img src="${esc(m.src)}" width="${m.w}" height="${m.h}" style="left:${x}px;top:${y}px" alt="" draggable="false" decoding="async" loading="lazy">`;
}
export const crop = (l: L, w: number, h: number) => (l.img ? I(l, w, h) : '');
export const thumb = (l: L) => (l.thumbPos != null ? `<i class="ti" style="background-position:${-l.thumbPos * 40}px 0"></i>` : l.thumb ? `<img class="ti" src="${esc(l.thumb)}" alt="" draggable="false" loading="lazy">` : l.img ? `<span class="ti">${I(l, 40, 40)}</span>` : '');
const T = thumb;
const slot = (l: L, w: number, h: number, extra = '', cls = '') => `<div class="cv ${cls}" style="width:${w}px;height:${h}px">${I(l, w, h)}${extra}</div>`;
const bleed = (l: L, w: number, h: number, extra = '') => `<div class="cv bl">${I(l, w, h)}${extra}</div>`;

export const SVG: Record<string, string> = {
  yt: '<svg class="mk" viewBox="0 0 16 16"><rect x="0" y="2.5" width="16" height="11" rx="3.4" fill="#FF0033"/><path d="M6.4 5.4 10.6 8l-4.2 2.6z" fill="#fff"/></svg>',
  bili: '<svg class="mk" viewBox="0 0 16 16"><rect width="16" height="16" rx="4.5" fill="#FB7299"/><path d="M5.2 3.2 6.8 4.8M10.8 3.2 9.2 4.8" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><rect x="2.6" y="4.9" width="10.8" height="7.8" rx="2" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M6 8v1.3M10 8v1.3" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>',
  xhs: '<svg class="mk" viewBox="0 0 16 16"><rect width="16" height="16" rx="4.5" fill="#FF2442"/><text x="8" y="9.9" text-anchor="middle" font-size="5.3" font-weight="700" fill="#fff" font-family="PingFang SC,Hiragino Sans GB,Noto Sans SC,sans-serif">小红书</text></svg>',
  gh: '<svg class="mk" viewBox="0 0 16 16"><path fill="var(--ink)" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
  pr: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>',
  prdraft: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"/></svg>',
  prclosed: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>',
  issue: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/><path fill="currentColor" d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/></svg>',
  disc: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"/></svg>',
  merge: '<svg viewBox="0 0 16 16"><path fill="currentColor" d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"/></svg>',
  play: '<svg viewBox="0 0 12 12"><rect x="1" y="2" width="10" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M5 4.4 7.6 6 5 7.6z" fill="currentColor"/></svg>',
  dm: '<svg viewBox="0 0 12 12"><rect x="1" y="2" width="10" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M3.4 5h3.2M3.4 7h5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>',
  heart: '<svg class="heart" viewBox="0 0 12 12"><path d="M6 10.2S1.6 7.6 1.6 4.6A2.3 2.3 0 0 1 6 3.6a2.3 2.3 0 0 1 4.4 1c0 3-4.4 5.6-4.4 5.6z" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/></svg>',
  star: '<svg viewBox="0 0 12 12"><path d="m6 1.4 1.4 2.9 3.2.4-2.3 2.2.6 3.2L6 8.6 3.1 10.1l.6-3.2L1.4 4.7l3.2-.4z" fill="none" stroke="currentColor" stroke-width="1.05" stroke-linejoin="round"/></svg>',
  fork: '<svg viewBox="0 0 12 12"><circle cx="3.2" cy="2.6" r="1.2" fill="none" stroke="currentColor"/><circle cx="8.8" cy="2.6" r="1.2" fill="none" stroke="currentColor"/><circle cx="6" cy="9.6" r="1.2" fill="none" stroke="currentColor"/><path d="M3.2 3.8v.8c0 .9.7 1.6 1.6 1.6h2.4c.9 0 1.6-.7 1.6-1.6v-.8M6 6.2v2.2" fill="none" stroke="currentColor"/></svg>',
};
const siDark = (hex: string) => { const v = parseInt(hex.slice(1), 16); return ((v >> 16) * .299 + (v >> 8 & 255) * .587 + (v & 255) * .114) < 40; };
export const siCol = (k: string) => (siDark(SIMPLE[k].hex) ? 'var(--ink)' : SIMPLE[k].hex);
export const siSvg = (k: string, cls: string, style = '') => `<svg class="${cls}" viewBox="0 0 24 24" style="${style}" aria-hidden="true"><path fill="currentColor" d="${SIMPLE[k].d}"/></svg>`;
export const siteOf = (l: L): Site => SITES[l.site] || { key: l.site, n: l.sn || l.host, h: l.host, g: '?', c: '#888' };
const siOf = (l: L) => { const s = siteOf(l).si; return s && SIMPLE[s] ? s : null; };
/* the platforms draw their own marks, but still have a brand colour and logo for the 品牌色 look */
const PLAT: Record<string, string> = { yt: 'youtube', bili: 'bilibili', xhs: 'xiaohongshu' };
const brandKey = (l: L) => (PLAT[l.k] && SIMPLE[PLAT[l.k]] ? PLAT[l.k] : siOf(l));
const sq = (g: string, c: string, cls = '') => `<span class="mk sq ${cls}" style="background:${c}">${esc(g)}</span>`;
export function markOf(l: L, cls = '') {
  const add = (s: string) => (cls ? s.replace('class="mk"', `class="mk ${cls}"`) : s);
  if (l.k === 'yt') return add(SVG.yt);
  if (l.k === 'bili') return add(SVG.bili);
  if (l.k === 'xhs') return add(SVG.xhs);
  if (l.k === 'gh' || l.k === 'ghpr') return add(SVG.gh);
  if (l.k === 'chat') return `<span class="cmk ${cls}" style="--c:${siteOf(l).dot || '#10A37F'}"></span>`;
  const si = siOf(l); if (si) return siSvg(si, 'mk ' + cls, `color:${siCol(si)}`);
  const s = siteOf(l); return sq(s.g || '?', s.c || '#888', cls);
}
const av = (a?: [string, string]) => (a ? `<span class="av" style="--c:${a[1]}">${esc(a[0])}</span>` : '');

const tt = (t: string, l: number, fs: number, extra = '') => `<div class="tt" style="--l:${l};--fs:${fs}px${extra}">${esc(t)}</div>`;
const ttf = (t: string, fs: number) => `<div class="tt fill" style="--fs:${fs}px">${esc(t)}</div>`;
const ds = (t: string | undefined, l: number, fs = 12) => (t ? `<div class="ds" style="--l:${l};font-size:${fs}px">${esc(t)}</div>` : '');
const dsf = (t: string | undefined, fs = 12) => (t ? `<div class="ds fill" style="font-size:${fs}px">${esc(t)}</div>` : '');
const mt = (inner: string, st = '') => `<div class="mt"${st ? ` style="${st}"` : ''}>${inner}</div>`;
const pgOf = (l: L) => (l.prog ? `<i class="pg ${l.k === 'bili' ? 'bili' : ''}" style="--p:${l.prog}"></i>` : '');
const dur = (l: L, cls = 'dur') => (has(l.dur) ? `<b class="${cls}">${esc(l.dur)}</b>` : '');

function vidOver(l: L, w: number) {
  let o = '';
  if (l.k === 'bili') {
    if (l.part && w >= 130) o += `<span class="pt">${esc(l.part)}</span>`;
    o += w >= 130 && has(l.play) ? `<div class="bst"><span>${SVG.play}${esc(l.play)}</span>${has(l.dm) ? `<span>${SVG.dm}${esc(l.dm)}</span>` : ''}<b>${esc(l.dur ?? '')}</b></div>` : dur(l);
  } else o += dur(l);
  return o + pgOf(l);
}
const who = (l: L) => `${markOf(l)}<span>${esc(l.by || l.sn)}</span>`;
function media(l: L, w: number, h: number): Rendered {
  const big = w * h >= 6, sub = l.part || l.by, name = l.k === 'bili' ? 'bilibili' : 'YouTube';
  const st = `--ps:${big ? 54 : 44}px;--mf:${big ? 15.5 : 14}px;--mp:${big ? 14 : 11}px`;
  return { cls: 'bleed media', style: st, html: bleed(l, px(w), px(h), `<div class="mshd"></div><span class="play" data-open></span>${pgOf(l)}`) + `<div class="mo"><div class="mt2">${esc(l.t)}</div><div class="mm">${markOf(l)}<span>${name}${sub ? ' · ' + esc(sub) : ''}</span>${dur(l, 'mdu')}</div></div>` };
}
function video(l: L, w: number, h: number): Rendered {
  if (h >= 2 && w >= 2) return media(l, w, h);
  switch (w + 'x' + h) {
    case '1x1': return { cls: 'bleed', html: bleed(l, 84, 84, `${dur(l)}${pgOf(l)}`) };
    case '2x1': return { cls: 'row', html: slot(l, 76, 76, `${dur(l)}${pgOf(l)}`) + `<div class="tx">${tt(l.t, 2, 12)}${mt(who(l))}</div>` };
    case '3x1': return { cls: 'row', html: slot(l, 136, 76, vidOver(l, 136)) + `<div class="tx">${tt(l.t, 2, 12.5)}${mt(who(l))}</div>` };
    default: return { cls: '', html: slot(l, 76, 100, `${dur(l)}${pgOf(l)}`) + `<div class="tx" style="padding:8px 8px 9px">${tt(l.t, 2, 12)}${mt(who(l))}</div>` };
  }
}
function xhs(l: L, w: number, h: number): Rendered {
  const like = has(l.like) ? `<span class="r">${SVG.heart}${esc(l.like)}</span>` : '', by = `${av(l.av)}<span>${esc(l.by || '小红书')}</span>${like}`;
  const n = l.n > 1 ? `<span class="nimg">1/${l.n}</span>` : '';
  switch (w + 'x' + h) {
    case '1x1': return { cls: 'bleed', html: bleed(l, 84, 84, `<div class="shd"></div>`) + (like ? `<div class="ov" style="padding:0 7px 6px">${mt(`${SVG.heart}<span>${esc(l.like)}</span>`)}</div>` : '') };
    case '2x1': return { cls: 'row', html: slot(l, 76, 76) + `<div class="tx">${tt(l.t, 2, 12)}${mt(`${SVG.xhs}${like}`)}</div>` };
    case '3x1': return { cls: 'row', html: slot(l, 76, 76) + `<div class="tx">${tt(l.t, 2, 12.5)}${mt(by)}</div>` };
    case '1x2': return { cls: '', html: slot(l, 76, 100) + `<div class="tx" style="padding:8px 8px 9px">${tt(l.t, 2, 12)}${mt(`${SVG.xhs}${like}`)}</div>` };
    case '2x2': return { cls: 'bleed', html: bleed(l, 174, 174, `<div class="shd"></div>${n}`) + `<div class="ov">${tt(l.t, 2, 13)}${mt(by)}</div>` };
    case '3x2': return { cls: 'row', html: slot(l, 124, 166, n) + `<div class="tx" style="justify-content:flex-start;padding:10px 11px 9px;gap:6px">${tt(l.t, 2, 14)}${dsf(l.d)}${mt(by)}</div>` };
    default: return { cls: '', html: slot(l, 166, 188, n) + `<div class="tx" style="gap:6px;padding:8px 10px 9px">${tt(l.t, 2, 13)}${mt(by)}</div>` };
  }
}
/* sizes where the picture fills the whole card have no surface to tint */
const platBleed = (l: L, w: number, h: number) => (w === 1 && h === 1) || (l.k === 'xhs' ? w === 2 && h === 2 : w >= 2 && h >= 2);
function wmark(k: string, w: number, h: number) {
  const W = px(w), H = px(h), side = Math.min(W, H) * (w === h ? 1 : 1.2), col = siCol(k);
  return { col, wm: w * h >= 2 ? siSvg(k, 'wm', `width:${side}px;height:${side}px;right:${-side * .22}px;bottom:${-side * .22}px;color:${col}`) : '' };
}
function tinted(r: Rendered, k: string, w: number, h: number): Rendered {
  const { col, wm } = wmark(k, w, h);
  return { ...r, cls: r.cls + ' v-logo', style: (r.style ? r.style + ';' : '') + `--tint:${col}`, html: wm + r.html };
}
function web(l: L, w: number, h: number, tint?: string): Rendered {
  const s = w + 'x' + h, si = siOf(l);
  if (l.state) return pending(l, w, h, l.state);
  if (tint === 'brand' && si && !l.img) return tinted(web(l, w, h, ''), si, w, h);
  const site = `${markOf(l)}<span>${esc(l.sn)}</span>`, top = `<div class="ty-top">${markOf(l)}<span>${esc(l.sn)}</span></div>`;
  if (s === '1x1') return { cls: 'pad', html: `<div class="tx" style="gap:6px">${markOf(l)}${tt(l.t, 3, 11.5, ';line-height:1.25')}</div>` };
  if (l.img) switch (s) {
    case '2x1': return { cls: 'row', html: slot(l, 76, 76) + `<div class="tx">${tt(l.t, 2, 12)}${mt(site)}</div>` };
    case '3x1': return { cls: 'row', html: slot(l, 112, 76) + `<div class="tx">${tt(l.t, 2, 12.5)}${mt(site)}</div>` };
    case '1x2': return { cls: '', html: slot(l, 76, 100) + `<div class="tx" style="padding:8px 8px 9px">${tt(l.t, 2, 12)}${mt(site)}</div>` };
    case '2x2': return { cls: '', html: slot(l, 166, 100) + `<div class="tx">${tt(l.t, 2, 13)}${mt(site)}</div>` };
    case '3x2': return { cls: '', html: slot(l, 256, 100) + `<div class="tx">${tt(l.t, 2, 13)}${mt(site)}</div>` };
    case '2x3': return { cls: '', html: slot(l, 166, 124) + `<div class="tx" style="gap:5px">${tt(l.t, 3, 13.5)}${dsf(l.ex)}${mt(site)}</div>` };
  }
  switch (s) {
    case '2x1': return { cls: 'pad', html: `<div class="tx" style="gap:6px">${top}${tt(l.t, 2, 13)}</div>` };
    case '3x1': return { cls: 'pad', html: `<div class="tx" style="gap:4px">${top}${tt(l.t, 1, 13.5)}${ds(l.ex, 1)}</div>` };
    case '1x2': return { cls: 'pad', html: `<div class="tx" style="gap:8px">${markOf(l, 'lg')}${ttf(l.t, 14)}<div class="mt"><span>${esc(l.sn)}</span></div></div>` };
    case '2x2': return { cls: 'pad', html: `<div class="tx" style="gap:8px">${top}${tt(l.t, 3, 17)}${dsf(l.ex)}</div>` };
    case '3x2': return { cls: 'pad', html: `<div class="tx" style="gap:8px">${top}${tt(l.t, 2, 19)}${dsf(l.ex, 12.5)}</div>` };
    default: return { cls: 'pad', html: `<div class="tx" style="gap:9px">${top}${tt(l.t, 4, 19)}${dsf(l.ex, 12.5)}</div>` };
  }
}
function gh(l: L, w: number, h: number): Rendered {
  const owner = l.owner || '', repo = l.repo || l.t, showOwner = owner && owner !== repo && w >= 3;
  const head = `<div class="gh-h" data-open>${SVG.gh}${showOwner ? `<span>${esc(owner)}/</span>` : ''}<b>${esc(repo)}</b></div>`;
  /* a folder or file inside the repo says more than the repo's own description */
  /* the end of a long path says where it points; the branch in front of it matters less */
  const tail = (q: string, max: number) => { if (q.length <= max) return q; const seg = q.split('/'); let out = seg.pop()!; while (seg.length && out.length + seg[seg.length - 1].length + 1 <= max - 2) out = seg.pop() + '/' + out; return '…/' + out; };
  const dsg = (d: string | undefined, n: number, fs?: number) => (l.ghPath ? `<div class="ds gp" style="--l:${h > 1 ? 2 : 1}">${esc(tail(l.ghPath, (h > 1 ? 2 : 1) * w * 9))}</div>` : ds(d, n, fs));
  const langs: [string, string, number][] = l.lang || [];
  const lang = langs[0];
  const star = has(l.star) ? `<span>${SVG.star}${esc(l.star)}</span>` : '';
  const foot = (more?: boolean) => `<div class="gf">${lang ? `<span><i style="--c:${lang[1]}"></i>${esc(lang[0])}</span>` : ''}${star}${more ? `${has(l.fork) ? `<span>${SVG.fork}${esc(l.fork)}</span>` : ''}${l.up ? `<span>${esc(l.up)}</span>` : ''}` : ''}</div>`;
  const bar = langs.length ? `<div class="lbar">${langs.map(x => `<i style="width:${x[2] * 100}%;background:${x[1]}"></i>`).join('')}</div>` : '';
  switch (w + 'x' + h) {
    case '1x1': return { cls: 'pad', html: `<div class="tx" style="gap:5px">${SVG.gh}<b class="rn" data-open>${esc(repo)}</b><div class="gf">${star}</div></div>${bar}` };
    case '2x1': return { cls: 'pad', html: `<div class="tx" style="gap:4px">${head}${dsg(l.d, 1)}${foot()}</div>${bar}` };
    case '3x1': return { cls: 'pad', html: `<div class="tx" style="gap:4px">${head}${dsg(l.d, 1)}${foot(true)}</div>${bar}` };
    case '2x2': return { cls: 'pad', html: `<div class="tx" style="gap:7px">${head}${dsg(l.d, 3, 12.5)}${dsf(l.readme, 11.5)}${foot()}</div>${bar}` };
    default: return { cls: 'pad', html: `<div class="tx" style="gap:7px">${head}${dsg(l.d, 2, 12.5)}${dsf(l.readme, 11.5)}${(l.topics || []).length ? `<div class="tops">${l.topics.map((t: string) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}${foot(true)}</div>${bar}` };
  }
}
function paper(l: L, w: number, h: number): Rendered {
  const id = `<div class="pid">${markOf(l)}<span>${esc(l.aid)}</span></div>`;
  const Tt = (n: number, fs: number) => `<div class="ptt" data-open style="--l:${n};font-size:${fs}px">${esc(l.t)}</div>`, A = (n: number) => (l.au ? `<div class="pau" style="--l:${n}">${esc(l.au)}</div>` : '');
  const ab = (fs: number) => (l.ab ? `<div class="pab fill" style="font-size:${fs}px">${esc(l.ab)}</div>` : '');
  switch (w + 'x' + h) {
    case '1x1': return { cls: 'pad pp', html: `<div class="tx" style="gap:5px">${markOf(l)}${Tt(3, 12)}</div>` };
    case '2x1': return { cls: 'pad pp', html: `<div class="tx" style="gap:5px">${id}${Tt(2, 14.5)}</div>` };
    case '3x1': return { cls: 'pad pp', html: `<div class="tx" style="gap:4px">${id}${Tt(1, 15.5)}${A(1)}</div>` };
    case '1x2': return { cls: 'pad pp', html: `<div class="tx" style="gap:6px">${markOf(l)}${Tt(4, 12.5)}<div style="margin-top:auto">${A(3)}</div></div>` };
    case '2x2': return { cls: 'pad pp', html: `<div class="tx" style="gap:6px">${id}${Tt(3, 18)}${A(2)}<div class="pln"><i></i><i></i><i></i></div></div>` };
    case '3x2': return { cls: 'pad pp', html: `<div class="tx" style="gap:6px">${id}${Tt(2, 19)}${A(1)}${ab(12)}</div>` };
    default: return { cls: 'pad pp', html: `<div class="tx" style="gap:7px">${id}${Tt(4, 20)}${A(2)}${ab(12)}</div>` };
  }
}
function chat(l: L, w: number, h: number): Rendered {
  const dot = siteOf(l).dot || '#10A37F', Q = l.q || l.t, Ans = l.a || l.ex || '';
  const q = (n: number) => `<div class="cq" data-open style="--l:${n}"><span>${esc(Q)}</span></div>`, a = (n: number, fill?: boolean) => (Ans ? `<div class="ca"><i style="background:${dot}"></i><span${fill ? ' class="fill"' : ''} style="--l:${n}">${esc(Ans)}</span></div>` : '');
  const foot = mt(`${markOf(l)}<span>${esc(l.sn)}</span>`);
  switch (w + 'x' + h) {
    case '1x1': return { cls: 'pad cc', html: `<div class="tx" style="gap:6px">${markOf(l)}${tt(Q, 3, 11.5)}</div>` };
    case '2x1': case '3x1': return { cls: 'pad cc', html: `<div class="tx" style="gap:6px">${q(1)}${a(2)}</div>` };
    case '1x2': return { cls: 'pad cc', html: `<div class="tx" style="gap:7px">${q(2)}${a(0, true)}${foot}</div>` };
    default: return { cls: 'pad cc', html: `<div class="tx" style="gap:8px">${q(2)}${a(0, true)}${foot}</div>` };
  }
}
function pending(l: L, w: number, h: number, st: string): Rendered {
  const s = w + 'x' + h, top = `<div class="ty-top">${markOf(l)}<span>${esc(l.sn)}</span></div>`;
  const path = l.path || l.host, url = `<div class="url">${esc(path.slice(l.host.length) || '/')}</div>`;
  if (st === 'loading') {
    const bars = (n: number) => `<div class="skl">${Array.from({ length: n }, (_, i) => `<i style="width:${[92, 70, 84][i]}%"></i>`).join('')}</div>`;
    if (s === '2x2') return { cls: 'ld', html: `<div class="cv skb" style="width:166px;height:100px"></div><div class="tx" style="gap:8px">${bars(2)}${top}</div>` };
    if (s === '1x2') return { cls: 'ld', html: `<div class="cv skb" style="width:76px;height:100px"></div><div class="tx" style="gap:8px;padding:8px 8px 9px">${bars(2)}${top}</div>` };
    return { cls: 'pad ld', html: `<div class="tx" style="gap:8px">${top}${bars(w >= 3 ? 1 : 2)}</div>` };
  }
  const title = st === 'failed' || !l.t ? l.host.replace(/\./g, '.​') : l.t;
  if (s === '1x1') return { cls: 'pad', html: `<div class="tx" style="gap:6px">${markOf(l)}${tt(title, 3, 11.5, ';line-height:1.25')}</div>` };
  if (s === '1x2') return { cls: 'pad', html: `<div class="tx" style="gap:7px">${markOf(l, 'lg')}${tt(title, 3, 13)}${url}<div class="mt" style="margin-top:auto"><span>${esc(l.sn)}</span></div></div>` };
  if (w * h >= 4) return { cls: 'pad', html: `<div class="tx" style="gap:7px">${top}<div style="margin-top:auto;display:flex;flex-direction:column;gap:6px">${tt(title, 3, 16.5)}${url}</div></div>` };
  return { cls: 'pad', html: `<div class="tx" style="gap:5px">${top}${tt(title, 1, 13.5)}${url}</div>` };
}
function ghpr(l: L, w: number, h: number): Rendered {
  const S = l.prState && ({ merged: [SVG.merge, '#8250df'], open: [SVG.pr, '#1a7f37'], draft: [SVG.prdraft, 'var(--ink3)'], closed: [SVG.prclosed, '#cf222e'], issue: [SVG.issue, '#1a7f37'], disc: [SVG.disc, 'var(--ink3)'] } as Record<string, string[]>)[l.prState];
  const st = S ? `<span class="pst" style="color:${S[1]}">${S[0]}</span>` : '';
  const diff = l.diff ? `<span style="color:#1a7f37">${esc(l.diff[0])}</span><span style="color:#cf222e">${esc(l.diff[1])}</span>` : l.cm ? `<span>${l.cm} 条评论</span>` : '';
  const row = (repo: string) => `<div class="gf">${SVG.gh}${repo ? `<span>${repo} #${l.num}</span>` : ''}${st}</div>`;
  const up = l.up ? `<span>${esc(l.up)}</span>` : '';
  switch (w + 'x' + h) {
    case '1x1': return { cls: 'pad', html: `<div class="tx" style="gap:6px">${row('')}${tt(l.t, 3, 12)}</div>` };
    case '2x1': return { cls: 'pad', html: `<div class="tx" style="gap:6px">${row(esc(l.repo))}${tt(l.t, l.diff ? 1 : 2, 12.5)}${l.diff ? `<div class="gf" style="margin-top:auto">${diff}</div>` : ''}</div>` };
    case '3x1': return { cls: 'pad', html: `<div class="tx" style="gap:6px">${row(`${esc(l.owner)}/${esc(l.repo)}`)}${tt(l.t, 1, 12.5)}<div class="gf" style="margin-top:auto">${diff}${up}</div></div>` };
    case '1x2': return { cls: 'pad', html: `<div class="tx" style="gap:6px">${row('')}${tt(l.t, 5, 12.5)}<div class="gf" style="margin-top:auto">${diff}</div></div>` };
    default: return { cls: 'pad', html: `<div class="tx" style="gap:6px">${row(esc(l.repo))}${tt(l.t, 2, 12.5)}${dsf(l.body, 11.5)}<div class="gf" style="margin-top:auto">${diff}${up}</div></div>` };
  }
}
function note(b: Block, w: number, h: number): Rendered {
  const body = b.items ? `<div class="nh">${esc(b.title)}</div><ul class="chk">${b.items.map(i => `<li class="${i[1] ? 'dn' : ''}"><i></i>${esc(i[0])}</li>`).join('')}</ul>` : esc(b.text);
  return { cls: 'note n-bd', html: `<div class="note-l">便签</div><div class="fit" data-min="11" data-max="${w * h === 1 ? 13 : 14}">${body}</div>` };
}

/* ---------- Link List ---------- */
const brandOf = (l: L) => brandKey(l) || null;
export const siteName = (l: L) => siteOf(l).n;
export const rowMeta = (l: L) => ((l.k === 'yt' || l.k === 'bili') && has(l.dur) ? l.dur : l.k === 'xhs' && has(l.like) ? `♡ ${l.like}` : l.k === 'gh' && has(l.star) ? `★ ${l.star}` : siteOf(l).n);
export const titleOf = (l: L) => (l.k === 'gh' && l.owner ? `${l.owner}/${l.repo}${l.ghPath ? ' / ' + l.ghPath : ''}` : l.t || l.host || '').replace(/^【[^】]*】\s*/, '');
export const tileOf = (l: L) => {
  if (l.img || l.thumb || l.thumbPos != null) return T(l);
  const bt = brandOf(l), s = siteOf(l);
  return `<span class="tile" style="--tc:${bt ? siCol(bt) : s.c || (l.k === 'xhs' ? '#FF2442' : 'var(--ink3)')}">${bt ? siSvg(bt, 'mk', `color:${siCol(bt)}`) : markOf(l)}</span>`;
};
function restBy(rest: L[], one: L | null) {
  if (one) { const k = rest.filter(l => l.img).length; return k ? `${k} 条有封面` : ''; }
  const by = new Map<string, { l: L; n: number }>();
  rest.forEach(l => { const k = siteName(l); if (!by.has(k)) by.set(k, { l, n: 0 }); by.get(k)!.n++; });
  return [...by.values()].sort((a, b) => b.n - a.n).slice(0, 3).map(({ l, n }) => `<span class="rb">${markOf(l, 'xs')}${n}</span>`).join('') + (by.size > 3 ? `<span class="rb">+${by.size - 3}</span>` : '');
}
export const oneSite = (items: L[]) => { const k0 = items[0] && items[0].site; return items.length && items.every(i => i.site === k0) ? items[0] : null; };
function list(b: Block, w: number, h: number, LINKS: Links): Rendered {
  const items = (b.rows || []).map(id => LINKS[id]).filter(Boolean), n = items.length, o = b.style === 'c' && w >= 2 && h >= 2 ? 'c' : 'a';
  const one = oneSite(items), bk = one && brandOf(one), brand = b.tint === 'brand' && bk;
  let res: Rendered;
  const name = `<b data-more>${esc(b.title)}</b>`;
  if (w === 1 && h === 1) res = { cls: 'lst', html: `<div class="l1b" data-more><b>${esc(b.title)}</b><span class="n">${n}</span></div>` };
  else if (h === 1) {
    const mini = items.slice(0, 2).map(l => `<a class="lr mini" data-row="${l.id}">${one ? '' : markOf(l)}<span class="t">${esc(titleOf(l))}</span>${w >= 3 && !one ? `<span class="s">${esc(rowMeta(l) === siteName(l) ? '' : rowMeta(l))}</span>` : ''}</a>`).join('');
    res = { cls: 'lst', html: `<div class="lh lh21">${one ? markOf(one) : ''}${name}<span class="n">${n}</span></div><div class="rows">${mini}</div>` };
  } else {
    const head = `<div class="lh">${one ? markOf(one) : ''}${name}</div>`;
    const slots = Math.floor(o === 'c' ? (px(h) - 8 - 31) / 45 : (px(h) - 12 - 42) / 30);
    const shown = n > slots ? slots - 1 : n;
    const rows = items.slice(0, shown).map(l => {
      const meta = rowMeta(l), sub = one ? (meta === siteName(l) ? '' : meta) : `${siteName(l)}${meta && meta !== siteName(l) ? ' · ' + meta : ''}`;
      if (o === 'c') return `<a class="lr th" data-row="${l.id}"><span class="tn">${tileOf(l)}</span><span class="tw"><span class="t">${esc(titleOf(l))}</span><span class="s">${one ? '' : markOf(l, 'xs')}<span>${esc(sub)}</span></span></span></a>`;
      return `<a class="lr" data-row="${l.id}">${one ? '' : markOf(l)}<span class="t">${esc(titleOf(l))}</span>${w >= 3 && meta && !one ? `<span class="s">${esc(meta)}</span>` : ''}</a>`;
    }).join('');
    res = { cls: 'lst ' + (o === 'c' ? 'lc' : 'la'), html: head + `<div class="rows">${rows}${shown < n ? (o === 'c'
      ? `<a class="lr th lmore" data-more><span class="tn mos">${items.slice(shown, shown + 4).map(l => `<span>${tileOf(l)}</span>`).join('')}</span><span class="tw"><span class="t">还有 ${n - shown} 条</span><span class="s">${restBy(items.slice(shown), one)}</span></span></a>`
      : `<a class="lr lmore${one ? ' one' : ''}" data-more>还有 ${n - shown} 条</a>`) : ''}</div>` };
  }
  return brand ? tinted(res, bk!, w, h) : res;
}

/* which sizes each kind opens; anything else snaps to the nearest open one */
const NO = (...x: string[]) => ALL.filter(s => !x.includes(s));
const OPEN: Record<string, string[]> = { paper: ALL, chat: ALL, yt: ALL, bili: ALL, xhs: ALL, web: ALL, gh: NO('1x2', '2x3'), ghpr: NO('3x2', '2x3'), note: ALL, list: ALL, listc: ['2x2', '3x2', '2x3'] };
export const openOf = (b: Block, LINKS: Links) => (b.kind === 'card' ? OPEN[LINKS[b.link!]?.k || 'web'] : b.kind === 'note' ? OPEN.note : b.style === 'c' ? OPEN.listc : OPEN.list);
export const snap = (open: string[], w: number, h: number): [number, number] | null => { let best: [number, number] | null = null, bd = 1e9; for (const s of open) { const [a, c] = s.split('x').map(Number), d = (a - w) ** 2 + (c - h) ** 2 + a * c * 0.01; if (d < bd) { bd = d; best = [a, c]; } } return best; };
export const hasBrand = (b: Block, LINKS: Links) => {
  if (b.kind === 'card') { const l = LINKS[b.link!]; if (!l) return false; if (PLAT[l.k]) return !!brandKey(l) && !platBleed(l, b.w!, b.h!); return l.k === 'web' && !l.img && !l.state && !!siOf(l); }
  if (b.kind === 'list') { const one = oneSite((b.rows || []).map(id => LINKS[id]).filter(Boolean)); return !!(one && brandOf(one)); }
  return false;
};

export function render(b: Block, w: number, h: number, LINKS: Links): Rendered {
  if (b.kind === 'note') return note(b, w, h);
  if (b.kind === 'list') return list(b, w, h, LINKS);
  const l = LINKS[b.link!];
  if (!l) return { cls: 'pad', html: '' };
  if (l.state === 'loading') return pending(l, w, h, 'loading');
  /* nothing read from the page: the address stands in, whatever site it is */
  if (!l.t && !l.q && !l.repo) return pending(l, w, h, 'failed');
  /* a picture-led card without its picture reads as a plain web card */
  if ((l.k === 'yt' || l.k === 'bili' || l.k === 'xhs') && !l.img) return web({ ...l, k: 'web' } as L, w, h, b.tint);
  if ((l.k !== 'web') && l.state === 'failed') return pending(l, w, h, 'failed');
  const fn = ({ yt: video, bili: video, xhs, web: (a: L, x: number, y: number) => web(a, x, y, b.tint), gh, ghpr, paper, chat } as Record<string, (l: L, w: number, h: number) => Rendered>)[l.k] || ((a: L, x: number, y: number) => web(a, x, y, b.tint));
  const r = fn(l, w, h);
  return PLAT[l.k] && b.tint === 'brand' && !platBleed(l, w, h) ? tinted(r, brandKey(l)!, w, h) : r;
}

/* text that fills its box: clamp to whole lines; notes shrink only when they overflow */
export function fit(root: Element) {
  root.querySelectorAll<HTMLElement>('.fill').forEach(el => {
    el.hidden = false; el.style.flex = ''; el.style.maxHeight = ''; el.style.removeProperty('--l');
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 18, n = Math.floor((el.clientHeight + 1) / lh);
    if (n < 1) { el.hidden = true; return; }
    el.style.setProperty('--l', String(n)); el.style.flex = 'none'; el.style.maxHeight = n * lh + 'px';
  });
  root.querySelectorAll<HTMLElement>('.fit').forEach(el => {
    const lo = +el.dataset.min!; let f = +el.dataset.max!;
    el.style.fontSize = f + 'px';
    while (f > lo && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) { f -= 0.5; el.style.fontSize = f + 'px'; }
  });
}
