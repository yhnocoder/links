/* The canvas: retained DOM nodes for every Section and card, moved by springs toward the layout's targets.
   Ported from the full-product hi-fi with its tuning intact. Solid draws the chrome around it; the two talk through ui/bus. */
import { esc, fit, markOf, render, thumb, titleOf, openOf, snap as snapSize, SIZES, hasBrand, type L } from '../cards/render';
import { ic } from '../ui/icons';
import {
  S, LK, V, ver, setView as setV, bump, uid, GAP, U, PAD, LBL, FOOT, SG, P, MAXC, MAXR, capH, clamp,
  sizeOf, mkBoard, mkFrame, isCap, fRect, cRect, gapOf, collide, cfg, layoutFrom, commit, relayout, secsOf,
  framesOf, blocksIn, linksOfBlock, countOf, boardChain, coverOf, ruleMatch, ruleText, projOf,
  freeCardSpot, contentBounds, unimportant as isUnimpL, placeIntoSec, placeLoose, moveFrameToBoard, type Block, type Frame, type Layout, type Rect, type Cam,
} from './state';
import {
  openMenu, closeMenus, menu, openPop, closePop, pop, toast, closeToast, setCrumbs, setViewId, setZoomPct, bumpModel,
  inboxOpen, setInboxOpen, setMapOpen, mapOpen, paletteOpen, setPaletteOpen, sheet, setInboxFlash, setUnimpOpen, unimpOpen, setDropOn,
  type MenuItem, type ListSrc,
} from '../ui/bus';
import { persist, rows } from '../data/store';
import { toL } from '../data/links';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const $ = (s: string, r: ParentNode = document) => r.querySelector(s) as HTMLElement | null;
const $$ = (s: string, r: ParentNode = document) => [...r.querySelectorAll(s)] as HTMLElement[];

/* ---------- the canvas elements, handed over by the Solid shell once it is mounted ---------- */
let app: HTMLElement, stage: HTMLElement, world: HTMLElement, secLayer: HTMLElement, cardLayer: HTMLElement, ph: HTMLElement, dotsEl: HTMLElement;
let SR = new DOMRect(), AR = new DOMRect();
const measure = () => { SR = stage.getBoundingClientRect(); AR = app.getBoundingClientRect(); };
export const cam: Cam = { x: 0, y: 0, z: 1 };

type Node = {
  el: HTMLElement; b: Block; inn?: HTMLElement | null; key: string;
  x: number; y: number; w: number; h: number; vx: number; vy: number; vw: number; vh: number; tx: number; ty: number; tw: number; th: number;
  r: number; vr: number; tr: number; fresh?: boolean; free?: boolean; follow?: number; pw?: number; ph?: number; painted?: number;
};
type FNode = {
  el: HTMLElement; f: Frame; key: string; isF?: boolean;
  x: number; y: number; w: number; h: number; vx: number; vy: number; vw: number; vh: number; tx: number; ty: number; tw: number; th: number;
  first?: boolean; free?: boolean; stiff?: boolean; pw?: number; ph?: number; painted?: number; bw?: number; bx?: number; by?: number; k?: number;
};
export const nodes = new Map<string, Node>(), fnodes = new Map<string, FNode>();

function blockKey(b: Block, w: number, h: number) {
  const l = b.kind === 'card' ? LK[b.link!] : null;
  return [b.kind, w, h, b.tint || '', b.style || '', b.text || '', b.title || '', (b.rows || []).map(id => id + (LK[id]?.t || '')).join(','), b.items ? JSON.stringify(b.items) : '', l ? (l.state || '') + l.t + (l.img?.src || '') + (l.dur || '') : ''].join('|');
}
function cardInner(b: Block, w: number, h: number) {
  const r = render(b as any, w, h, LK);
  return `<div class="c ${r.cls}" style="--gw:${w};--gh:${h};${r.style || ''}">${r.html}</div>${b.proj ? '' : '<span class="rz"></span>'}`;
}
const fitQ = new Set<Element>(); let fitRaf = 0;
function queueFit(el: Element) { fitQ.add(el); if (!fitRaf) fitRaf = requestAnimationFrame(() => { fitRaf = 0; for (const e of fitQ) if (e.isConnected) fit(e); fitQ.clear(); }); }
function ensureCard(b: Block) {
  let n = nodes.get(b.id);
  if (!n) {
    const el = document.createElement('div');
    el.className = 'card' + (b.proj ? ' proj' : ''); el.dataset.id = b.id;
    cardLayer.appendChild(el);
    n = { el, b, x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, tx: 0, ty: 0, tw: 0, th: 0, r: 0, vr: 0, tr: 0, fresh: true, key: '' };
    nodes.set(b.id, n);
  }
  n.b = b; n.el.classList.toggle('loose', !b.sec && !b.proj);
  const key = blockKey(b, b.w, b.h);
  if (n.key !== key) { n.key = key; n.el.innerHTML = cardInner(b, b.w, b.h); n.inn = n.el.firstElementChild as HTMLElement; queueFit(n.el); }
  return n;
}
function paint(n: Node) {
  n.el.style.transform = `translate3d(${n.x}px,${n.y}px,0)`;
  if (n.pw !== n.w) { n.el.style.width = n.w + 'px'; n.pw = n.w; }
  if (n.ph !== n.h) { n.el.style.height = n.h + 'px'; n.ph = n.h; }
}
function paintF(n: FNode) {
  n.el.style.transform = `translate3d(${n.x}px,${n.y}px,0)`;
  if (n.pw !== n.w) { n.el.style.width = n.w + 'px'; n.pw = n.w; if (n.f.type === 'cover') coverScale(n); }
  if (n.ph !== n.h) { n.el.style.height = n.h + 'px'; n.ph = n.h; if (n.f.type === 'cover') coverScale(n); }
}

/* ---------- frames ---------- */
function marksOf(links: L[], n: number) {
  const seen = new Set<string>(), out: string[] = [];
  for (const l of links) { const k = l.site; if (seen.has(k)) continue; seen.add(k); out.push(markOf(l)); if (out.length >= n) break; }
  return out.join('');
}
function frameHTML(f: Frame) {
  const cnt = countOf(f);
  const big = `<div class="big"><b>${esc(f.name)}</b><span class="num">${cnt}</span></div>`;
  const lbl = `<div class="lbl"><b>${esc(f.name)}</b><span class="n num">${cnt}</span>${f.type === 'cover' ? '' : `<button class="fd" aria-label="${f.collapsed ? '展开' : '折叠'}">${ic('chev')}</button>`}${f.type === 'smart' ? `<button class="rule">${esc(ruleText(f.rule!))}</button>` : ''}<button class="sm" aria-label="更多">${ic('more')}</button></div>`;
  if (f.type === 'cover') return `<div class="fr"></div><div class="peek"><div class="pin"></div><div class="fade"></div><div class="nm"><b>${esc(f.name)}</b><div class="toc"></div></div></div>${lbl}${big}<div class="rzc"></div>`;
  if (f.collapsed) {
    const ls = blocksIn(f.id).flatMap(linksOfBlock).map(id => LK[id]).filter(Boolean);
    const sm = f.type === 'smart' ? ruleMatch(f.rule!) : ls;
    /* the folded row fills the Section's width; when links are left over, the last slot says how many */
    const fill = (k: number) => (sm.length > k ? sm.slice(0, k - 1) : sm);
    if (f.capStyle === 'one') {
      const bs = fill(f.cols);
      return `<div class="fr"></div>${lbl}<div class="capb capo">${bs.map(l => { const r = render({ kind: 'card', link: l.id }, 1, 1, LK); return `<div class="c ${r.cls}" style="--gw:1;--gh:1;width:84px;height:84px;${r.style || ''}">${r.html}</div>`; }).join('')}${sm.length > bs.length ? `<span class="more num">+${sm.length - bs.length}</span>` : ''}</div>${big}`;
    }
    const nm = (l: L) => esc(l.k === 'gh' && !l.t ? l.repo : titleOf(l)), lead = (l: L) => (l.img ? `<span class="im">${thumb(l)}</span>` : markOf(l));
    const shown = sm.length > 6 ? sm.slice(0, 5) : sm;
    return `<div class="fr"></div>${lbl}<div class="capb capl">${shown.map(l => `<div class="ri">${lead(l)}<span class="t">${nm(l)}</span></div>`).join('')}${sm.length > 6 ? `<div class="ri more"><span class="t">还有 ${sm.length - 5} 条</span></div>` : ''}</div>${big}`;
  }
  let foot = '';
  if (f.type === 'smart') {
    const all = ruleMatch(f.rule!);
    foot = all.length ? `<div class="foot" data-foot="smart"><span class="mks">${marksOf(all, 5)}</span><span>全部 <b class="num">${all.length}</b> 条</span><span class="cv2">${ic('chev')}</span></div>` : '';
  } else if (f.foot) {
    const fl = blocksIn(f.id).filter(b => b.fold).map(b => LK[b.link!]).filter(Boolean);
    foot = `<div class="foot" data-foot="fold"><span class="mks">${marksOf(fl, 5)}</span><span>不常用 <b class="num">${fl.length}</b></span><span class="cv2">${ic('chev')}</span></div>`;
  }
  return `<div class="fr"></div>${lbl}${foot}${big}${f.type === 'sec' ? '<div class="rze"></div>' : '<div class="rzc"></div>'}`;
}
function frameKey(f: Frame) {
  if (f.type === 'cover') return ['cover', f.name, countOf(f), f.peekV || 0].join('|');
  return [f.type, f.name, f.collapsed ? 1 : 0, f.capStyle || '', f.foot ? 1 : 0, f.nfold || 0, f.rule ? JSON.stringify(f.rule) : '', countOf(f), f.type === 'smart' || f.collapsed ? ver : ''].join('|');
}
function ensureFrame(f: Frame) {
  let n = fnodes.get(f.id);
  if (!n) {
    const el = document.createElement('div'); el.dataset.id = f.id;
    secLayer.appendChild(el);
    n = { el, f, x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, tx: 0, ty: 0, tw: 0, th: 0, first: true, key: '' };
    fnodes.set(f.id, n);
  }
  n.f = f;
  n.el.className = 'sec' + (f.type === 'smart' ? ' smart' : '') + (f.type === 'cover' ? ' board' : '') + (f.collapsed ? ' cap' : '') + (selF.has(f.id) ? ' sel' : '') + (n.free ? ' lift' : '');
  const key = frameKey(f);
  if (n.key !== key) {
    const editing = n.el.querySelector('[contenteditable="true"]');
    if (!editing) { n.key = key; n.el.innerHTML = frameHTML(f); if (f.type === 'cover') renderPeek(n); if (f.collapsed && f.capStyle === 'one') queueFit(n.el); }
  }
  if (f.type === 'cover') coverScale(n);
  return n;
}

/* ---------- covers: the inner board itself, scaled to the window the user sized ---------- */
function staticCard(b: Block, x: number, y: number) {
  return `<div class="card" style="transform:translate(${x}px,${y}px);width:${P(b.w)}px;height:${P(b.h)}px">${cardInner({ ...b, proj: 'peek' }, b.w, b.h)}</div>`;
}
function staticFrame(f: Frame, list: Block[], ox: number, oy: number, maxY: number) {
  const r = fRect(f), x = r.x - ox, y = r.y - oy;
  let inner = '';
  if (!isCap(f)) {
    const cards = f.type === 'smart' ? projOf(f).cards : list;
    for (const b of cards) { const cy = (f.gy + b.y) * U - oy; if (cy > maxY) continue; inner += staticCard(b, (f.gx + b.x) * U - ox, cy); }
  }
  const foot = f.foot && !isCap(f) ? `<div class="foot"><span>${f.type === 'smart' ? '全部' : '不常用'}</span></div>` : '';
  return `<div class="sec${f.type === 'smart' ? ' smart' : ''}${isCap(f) ? ' cap' : ''}${f.type === 'cover' ? ' board' : ''}" style="transform:translate(${x}px,${y}px);width:${r.w}px;height:${r.h}px"><div class="fr"></div><div class="lbl"><b>${esc(f.name)}</b><span class="n">${countOf(f)}</span></div>${foot}</div>` + inner;
}
function renderPeek(n: FNode) {
  const f = n.f, lay = layoutFrom(S, null, { view: f.target, noSettle: true });
  const R = [...lay.frames.map(fRect), ...lay.loose.map(cRect)];
  const toc = lay.frames.slice().sort((a, b) => a.gy - b.gy || a.gx - b.gx).slice(0, 6).map(k => `<span>${esc(k.name)}<em class="num">${countOf(k)}</em></span>`).join('');
  $('.toc', n.el)!.innerHTML = toc;
  if (!R.length) { n.bw = 0; $('.pin', n.el)!.innerHTML = ''; return; }
  const x0 = Math.min(...R.map(r => r.x)), y0 = Math.min(...R.map(r => r.y));
  n.bw = Math.max(...R.map(r => r.x + r.w)) - x0; n.bx = x0; n.by = y0;
  /* only what can show through the window gets drawn */
  const k = peekK(n, f.cols * U + 2 * PAD - GAP), maxY = (f.rows * U + 2 * PAD - GAP) / Math.max(k, 0.01), maxX = (MAXC * U) / Math.max(k, 0.01);
  let html = '';
  for (const fr of lay.frames) { const r = fRect(fr); if (r.y - y0 > maxY || r.x - x0 > maxX) continue; html += staticFrame(fr, lay.lists.get(fr.id) || [], x0, y0, maxY); }
  for (const b of lay.loose) { if (b.y * U - y0 > maxY) continue; html += staticCard(b, b.x * U - x0, b.y * U - y0); }
  $('.pin', n.el)!.innerHTML = html;
}
const PEEK_IN = 14;
const peekK = (n: { bw?: number }, w: number) => (n.bw ? clamp((w - PEEK_IN * 2) / n.bw, 0.32, 0.5) : 0);
function coverScale(n: FNode) {
  const k = peekK(n, n.w || fRect(n.f).w);
  n.k = k;
  n.el.classList.toggle('tiny', n.f.cols <= 2);
  n.el.classList.toggle('crop', (n.bw || 0) * k > (n.w || 0) - PEEK_IN);
  const pin = n.el.querySelector('.pin') as HTMLElement | null; if (pin) pin.style.transform = `translate(${PEEK_IN}px,${PEEK_IN}px) scale(${k.toFixed(4)})`;
}

/* push a layout into the spring targets (instant = jump there) */
export let LAY: Layout = { view: 'home', frames: [], lists: new Map(), loose: [] };
function applyLayout(lay: Layout, instant: boolean, skip?: Set<string>) {
  LAY = lay;
  const keepF = new Set<string>(), keepC = new Set<string>(), sk = skip || new Set<string>();
  const target = (n: Node | FNode, x: number, y: number, w: number, h: number, inst: boolean) => {
    n.tx = x; n.ty = y; n.tw = w; n.th = h;
    if (inst || (n as Node).fresh || (n as FNode).first) { n.x = x; n.y = y; n.w = w; n.h = h; n.vx = n.vy = n.vw = n.vh = 0; (n as Node).fresh = (n as FNode).first = false; (n as FNode).isF ? paintF(n as FNode) : paint(n as Node); }
  };
  for (const f of lay.frames) {
    keepF.add(f.id);
    const n = ensureFrame(f); n.isF = true;
    const r = fRect(f);
    if (!n.free) target(n, r.x, r.y, r.w, r.h, instant);
    else { n.tw = r.w; n.th = r.h; }
    if (isCap(f)) continue;
    const cards = f.type === 'smart' ? projOf(f).cards : lay.lists.get(f.id) || [];
    for (const b of cards) {
      keepC.add(b.id); if (sk.has(b.id)) continue;
      const c = ensureCard(b); if (c.free) continue;
      target(c, (f.gx + b.x) * U, (f.gy + b.y) * U, P(b.w), P(b.h), instant);
    }
  }
  for (const b of lay.loose) {
    keepC.add(b.id); if (sk.has(b.id)) continue;
    const c = ensureCard(b); if (c.free) continue;
    target(c, b.x * U, b.y * U, P(b.w), P(b.h), instant);
  }
  for (const [id, n] of fnodes) if (!keepF.has(id)) { n.el.remove(); fnodes.delete(id); }
  for (const [id, n] of nodes) if (!keepC.has(id) && !sk.has(id) && !n.free) { n.el.remove(); nodes.delete(id); }
  kick();
}
/* after every change: redraw, tell the panels, save */
export function sync(instant = false) {
  applyLayout(layoutFrom(S, null, { noSettle: true }), instant);
  syncSel(); bumpModel(); persist(S);
}

/* ---------- springs ---------- */
let raf = 0, last = 0;
function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
function spring(p: number, v: number, t: number, k: number, c: number, dt: number): [number, number] { const a = k * (t - p) - c * v; v += a * dt; p += v * dt; return [p, v]; }
const K = 420, CK = 30, FK = 900, FC = 48;
function stepRect(n: Node | FNode, dt: number, k: number, c: number) {
  if (RM.matches) { n.x = n.tx; n.y = n.ty; n.w = n.tw; n.h = n.th; n.vx = n.vy = n.vw = n.vh = 0; return false; }
  [n.x, n.vx] = spring(n.x, n.vx, n.tx, k, c, dt);
  [n.y, n.vy] = spring(n.y, n.vy, n.ty, k, c, dt);
  [n.w, n.vw] = spring(n.w, n.vw, n.tw, k * 1.3, c * 1.15, dt);
  [n.h, n.vh] = spring(n.h, n.vh, n.th, k * 1.3, c * 1.15, dt);
  const rest = Math.abs(n.x - n.tx) < 0.08 && Math.abs(n.y - n.ty) < 0.08 && Math.abs(n.vx) < 1 && Math.abs(n.vy) < 1 && Math.abs(n.w - n.tw) < 0.08 && Math.abs(n.h - n.th) < 0.08 && Math.abs(n.vw) < 1 && Math.abs(n.vh) < 1;
  if (rest) { n.x = n.tx; n.y = n.ty; n.w = n.tw; n.h = n.th; n.vx = n.vy = n.vw = n.vh = 0; }
  return !rest;
}
const phs = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, tx: 0, ty: 0, tw: 0, th: 0 };
function tick() {
  raf = 0; const now = performance.now();
  const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000)); last = now;
  let busy = false;
  for (const n of fnodes.values()) {
    if (n.free) {
      paintF(n);
      if (n.f.type !== 'cover') for (const c of nodes.values()) if (c.b.sec === n.f.id || c.b.proj === n.f.id) { c.x = n.x + PAD + c.b.x * U; c.y = n.y + LBL + PAD + c.b.y * U; paint(c); }
      busy = true; continue;
    }
    if (stepRect(n, dt, n.stiff ? 1600 : K, n.stiff ? 68 : CK)) { paintF(n); busy = true; n.painted = 0; } else if (n.painted !== 1) { paintF(n); n.painted = 1; }
  }
  for (const n of nodes.values()) {
    if (drag && drag.kind === 'frame' && (drag.ids.has(n.b.sec) || drag.ids.has(n.b.proj))) continue;
    if (n.free) {
      if (n.follow && drag && drag.n) {
        const Ld = drag.n, tx = Ld.x + (Ld.w - n.w) / 2, ty = Ld.y + (Ld.h - n.h) / 2;
        [n.x, n.vx] = spring(n.x, n.vx, tx, 900, 50, dt); [n.y, n.vy] = spring(n.y, n.vy, ty, 900, 50, dt);
        paint(n); busy = true; continue;
      }
      if (drag && drag.n === n && !drag.rs) {
        if (RM.matches) { n.x = drag.px; n.y = drag.py; } else { [n.x, n.vx] = spring(n.x, n.vx, drag.px, FK, FC, dt); [n.y, n.vy] = spring(n.y, n.vy, drag.py, FK, FC, dt); }
        paint(n);
      }
      if (drag && drag.n === n && drag.rs) { [n.w, n.vw] = spring(n.w, n.vw, n.tw, 1600, 68, dt); [n.h, n.vh] = spring(n.h, n.vh, n.th, 1600, 68, dt); paint(n); }
      [n.r, n.vr] = spring(n.r, n.vr, n.tr, 260, 22, dt);
      if (Math.abs(n.r - n.tr) < 0.02 && Math.abs(n.vr) < 0.5) { n.r = n.tr; n.vr = 0; } else busy = true;
      if (n.inn) n.inn.style.rotate = n.r ? n.r.toFixed(2) + 'deg' : '';
      busy = busy || !!drag; continue;
    }
    const moving = stepRect(n, dt, K, CK);
    if (n.r || n.vr) { [n.r, n.vr] = spring(n.r, n.vr, 0, 260, 22, dt); if (Math.abs(n.r) < 0.02 && Math.abs(n.vr) < 0.5) { n.r = 0; n.vr = 0; } else busy = true; if (n.inn) n.inn.style.rotate = n.r ? n.r.toFixed(2) + 'deg' : ''; }
    if (moving || n.painted !== 1) { paint(n); n.painted = moving ? 0 : 1; }
    if (moving) busy = true; else if (n.el.classList.contains('settling')) n.el.classList.remove('settling');
  }
  if (drag && ph.classList.contains('on')) {
    if (RM.matches) Object.assign(phs, { x: phs.tx, y: phs.ty, w: phs.tw, h: phs.th });
    else {
      [phs.x, phs.vx] = spring(phs.x, phs.vx, phs.tx, 700, 42, dt); [phs.y, phs.vy] = spring(phs.y, phs.vy, phs.ty, 700, 42, dt);
      [phs.w, phs.vw] = spring(phs.w, phs.vw, phs.tw, 700, 42, dt); [phs.h, phs.vh] = spring(phs.h, phs.vh, phs.th, 700, 42, dt);
    }
    ph.style.transform = `translate3d(${phs.x}px,${phs.y}px,0)`; ph.style.width = phs.w + 'px'; ph.style.height = phs.h + 'px';
  }
  if (drag) { autoPan(dt); busy = true; }
  if (busy) kick();
}

/* ================= camera ================= */
const ZMIN = 0.2, ZMAX = 2;
let lodNow = 0, lodLock = 0, camT0 = 0;
function applyCam() {
  world.style.transform = `translate3d(${cam.x}px,${cam.y}px,0) scale(${cam.z})`;
  setZoomPct(Math.round(cam.z * 100));
  const lod = lodLock || (cam.z >= 0.46 ? 1 : cam.z >= 0.24 ? 2 : 3);
  if (lod !== lodNow) { stage.classList.toggle('lod2', lod === 2); stage.classList.toggle('lod3', lod === 3); lodNow = lod; }
  stage.style.setProperty('--z', String(cam.z));
  const m = cam.z < 0.3 ? 4 : cam.z < 0.6 ? 2 : 1, st = U * cam.z * m;
  dotsEl.style.backgroundSize = `${st}px ${st}px`;
  dotsEl.style.backgroundPosition = `${cam.x - 6 * cam.z}px ${cam.y - 6 * cam.z}px`;
  dotsEl.style.opacity = cam.z < 0.24 ? '0.3' : '';
  /* where the user was looking, per board, kept on this device only */
  clearTimeout(camT0); camT0 = window.setTimeout(() => { S.cams[V] = { ...cam }; try { localStorage.setItem('links-cams', JSON.stringify(S.cams)); } catch { /* fine */ } }, 400);
}
function zoomAt(f: number, cx: number, cy: number) {
  const z = clamp(cam.z * f, ZMIN, ZMAX);
  cam.x = cx - (cx - cam.x) * z / cam.z; cam.y = cy - (cy - cam.y) * z / cam.z; cam.z = z; applyCam();
}
let camAnim = 0;
function animateCam(t: Cam, ms = 460, done?: () => void) {
  cancelAnimationFrame(camAnim);
  if (RM.matches) { Object.assign(cam, t); applyCam(); done && done(); return; }
  measure();
  const from = { ...cam }, t0 = performance.now(), ease = (x: number) => 1 - Math.pow(1 - x, 3.2);
  /* zoom in log space and move the world point under the centre in a straight line: no drift, even pace */
  const hw = SR.width / 2, hh = SR.height / 2;
  const a = { x: (hw - from.x) / from.z, y: (hh - from.y) / from.z }, b = { x: (hw - t.x) / t.z, y: (hh - t.y) / t.z };
  const lz0 = Math.log(from.z), lz1 = Math.log(t.z);
  const go = () => {
    const k = Math.min(1, (performance.now() - t0) / ms), e = ease(k), z = Math.exp(lz0 + (lz1 - lz0) * e);
    const cx = a.x + (b.x - a.x) * e, cy = a.y + (b.y - a.y) * e;
    cam.z = z; cam.x = hw - cx * z; cam.y = hh - cy * z;
    if (k >= 1) Object.assign(cam, t);
    applyCam();
    if (k < 1) camAnim = requestAnimationFrame(go); else { camAnim = 0; done && done(); }
  };
  camAnim = requestAnimationFrame(go);
}
function fitCam(lay: Layout | null, opt: { all?: boolean } = {}): Cam {
  const b = contentBounds(lay || LAY); measure();
  if (!b) return { x: SR.width / 2, y: SR.height / 2, z: 1 };
  const narrow = SR.width < 700, mx = narrow ? 16 : 56, mt = 70, mb = narrow ? 70 : 40;
  const aw = SR.width - mx * 2, ah = SR.height - mt - mb;
  let z = Math.min(aw / (b.x1 - b.x0), ah / (b.y1 - b.y0), 1);
  if (opt.all) z = clamp(z, ZMIN, 1);
  else z = clamp(z, narrow ? ZMIN : 0.5, 1);
  const cw = (b.x1 - b.x0) * z, chh = (b.y1 - b.y0) * z;
  const x = cw <= aw ? mx + (aw - cw) / 2 - b.x0 * z : mx - b.x0 * z;
  const y = chh <= ah ? mt + (ah - chh) / 2 - b.y0 * z : mt - b.y0 * z;
  return { x, y, z };
}
export function fitAll(animate = true) { const t = fitCam(LAY, { all: true }); animate ? animateCam(t) : (Object.assign(cam, t), applyCam()); }
/* bring a world rect into view, zooming in only if it would be too small to read */
function reveal(r: { x: number; y: number; w: number; h: number }, zmin = 0.7) {
  measure();
  const m = 80;
  const vis = r.x * cam.z + cam.x > m && (r.x + r.w) * cam.z + cam.x < SR.width - m && r.y * cam.z + cam.y > m && (r.y + r.h) * cam.z + cam.y < SR.height - m;
  if (vis && cam.z >= zmin) return;
  const z = Math.max(cam.z, zmin), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  animateCam({ x: SR.width / 2 - cx * z, y: SR.height / 2 - cy * z, z }, 520);
}
const wpt = (e: { clientX: number; clientY: number }) => ({ x: (e.clientX - SR.left - cam.x) / cam.z, y: (e.clientY - SR.top - cam.y) / cam.z, cx: e.clientX, cy: e.clientY });
type Pt = ReturnType<typeof wpt>;
export function zoomStep(dir: 1 | -1) {
  measure();
  if (dir > 0) return zoomAt(1.25, SR.width / 2, SR.height / 2);
  const z0 = cam.z; zoomAt(1 / 1.25, SR.width / 2, SR.height / 2);
  if (V !== S.home && cam.z === z0) exitBoard();
}

/* ================= selection & undo ================= */
const sel = new Set<string>(), selF = new Set<string>();
function syncSel() {
  for (const id of sel) if (!nodes.has(id)) sel.delete(id);
  for (const id of selF) if (!fnodes.has(id)) selF.delete(id);
  for (const n of nodes.values()) n.el.classList.toggle('sel', sel.has(n.b.id));
  for (const n of fnodes.values()) n.el.classList.toggle('sel', selF.has(n.f.id));
}
const clearSel = () => { if (!sel.size && !selF.size) return; sel.clear(); selF.clear(); syncSel(); };
const snapState = () => JSON.stringify({ frames: S.frames, blocks: S.blocks, loc: S.loc, inbox: S.inbox, boards: S.boards, unimp: S.unimp, keep: S.keep });
const undoStack: string[] = [];
export function pushUndo(s?: string) { undoStack.push(s || snapState()); if (undoStack.length > 40) undoStack.shift(); }
export function undo() {
  const s = undoStack.pop(); if (!s) return;
  Object.assign(S, JSON.parse(s)); bump();
  if (!S.boards[V]) setV(S.home);
  rebuildView(); renderCrumbs(); closeToast();
}
export function rebuildView() {
  for (const n of nodes.values()) n.el.remove(); nodes.clear();
  for (const n of fnodes.values()) n.el.remove(); fnodes.clear();
  sync(true);
}

/* ================= pointer: press, lift, drag, drop ================= */
let press: any = null, drag: any = null, pan: any = null, marq: any = null, pinch: any = null, rsz: any = null, morphing = false;
export const busy = () => !!(press || drag || pan || marq || pinch || rsz || morphing || ext || document.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"]'));
const pointers = new Map<number, { x: number; y: number }>();
const modKey = (e: MouseEvent | KeyboardEvent) => e.shiftKey || e.metaKey || e.ctrlKey;

function onDown(e: PointerEvent) {
  if (e.button !== 0) return;
  closeMenus(); measure();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2 && !drag && !rsz) { startPinch(); return; }
  if (drag || press || rsz || morphing || pointers.size > 1) return;
  cancelAnimationFrame(camAnim);
  const t = e.target as HTMLElement, p = wpt(e);
  if (t.closest('[contenteditable="true"],[contenteditable="plaintext-only"],input,button.sm,button.rule,button.chev,button.fd,.foot')) return;
  const cEl = t.closest('.card') as HTMLElement | null, fEl = t.closest('.sec') as HTMLElement | null;
  const base = { x0: p.x, y0: p.y, cx: e.clientX, cy: e.clientY, pid: e.pointerId, touch: e.pointerType !== 'mouse', timer: 0, mod: modKey(e) };
  if (cEl) {
    const n = nodes.get(cEl.dataset.id!); if (!n) return;
    press = { ...base, kind: 'card', n, rs: !!t.closest('.rz'), open: !!t.closest('[data-open]'), row: t.closest('[data-row]'), more: !!t.closest('[data-more]'), chk: t.closest('.chk li') };
    stage.setPointerCapture(e.pointerId); cEl.classList.add('pressed');
    if (press.touch && !n.b.proj) press.timer = window.setTimeout(() => { if (press && !drag) beginCard(press, p); }, 260);
    return;
  }
  if (fEl) {
    const n = fnodes.get(fEl.dataset.id!); if (!n) return;
    if (t.closest('.rze')) { beginFrameResize(e, n, 'x'); return; }
    if (t.closest('.rzc')) { beginFrameResize(e, n, 'xy'); return; }
    const onLbl = t.closest('.lbl'), onCap = t.closest('.capb'), far = lodNow === 3;
    const cover = n.f.type === 'cover' && !onLbl;
    if (onLbl || onCap || cover || far) {
      press = { ...base, kind: 'frame', n, click: cover ? 'enter' : onCap ? 'expand' : far ? 'zoom' : 'select' };
      stage.setPointerCapture(e.pointerId);
      if (press.touch) press.timer = window.setTimeout(() => { if (press && !drag) beginFrame(press, p); }, 220);
      return;
    }
  }
  if (e.shiftKey) { startMarquee(e); return; }
  pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, pid: e.pointerId };
  stage.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { movePinch(); return; }
  if (rsz) { rsz.move(e); return; }
  if (ext && !drag) { moveExt(e); return; }
  if (marq) { moveMarquee(e); return; }
  if (pan) {
    const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
    if (!pan.moved && Math.hypot(dx, dy) > 3) { pan.moved = true; stage.classList.add('panning'); }
    if (pan.moved) { cam.x = pan.cx + dx; cam.y = pan.cy + dy; applyCam(); }
    return;
  }
  if (!press && !drag) return;
  const p = wpt(e);
  if (!drag) {
    const dist = Math.hypot(e.clientX - press.cx, e.clientY - press.cy);
    if (press.touch) { if (dist > 10) { const pr = press; release(); if (pr.kind !== 'card' || pr.n.b.proj) startPan(e); } return; }
    if (dist < 5) return;
    if (press.kind === 'card') {
      if (press.n.b.proj) { release(); startPan(e); return; }
      beginCard(press, p);
    } else beginFrame(press, p);
  }
  if (drag) move(p);
}
function startPan(e: PointerEvent) { pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: true, pid: e.pointerId }; stage.classList.add('panning'); }
function onUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) endPinch(); return; }
  if (rsz) { rsz.up(e); return; }
  if (ext && !drag) { endExt(); return; }
  if (marq) { endMarquee(); return; }
  if (pan) { const moved = pan.moved; pan = null; stage.classList.remove('panning'); if (!moved && e.type === 'pointerup') clearSel(); return; }
  if (drag) { if (e.type === 'pointercancel') cancelDrag(); else drop(); return; }
  if (!press) return;
  const pr = press; release();
  if (e.type === 'pointerup') clickPress(pr);
}
function release() { if (!press) return; clearTimeout(press.timer); if (press.n && press.n.el) press.n.el.classList.remove('pressed'); press = null; }

function clickPress(pr: any) {
  if (pr.kind === 'card') {
    const b = pr.n.b as Block;
    if (pr.chk && b.kind === 'note' && b.items) { const i = [...pr.chk.parentNode.children].indexOf(pr.chk); pushUndo(); const it = S.blocks[b.id].items!; it[i][1] = it[i][1] ? 0 : 1; bump(); sync(false); return; }
    if (pr.row && !pr.mod) { openLink(LK[pr.row.dataset.row]); return; }
    if (pr.more && b.kind === 'list' && !pr.mod) { openListPop({ type: 'list', id: b.id }, pr.n.el.querySelector('[data-more]') || pr.n.el); return; }
    if (pr.open && b.kind === 'card' && !pr.mod) { openLink(LK[b.link!]); return; }
    if (b.proj) return;
    if (pr.mod) { sel.has(b.id) ? sel.delete(b.id) : sel.add(b.id); } else { sel.clear(); selF.clear(); sel.add(b.id); }
    syncSel(); return;
  }
  const f = pr.n.f as Frame;
  if (pr.click === 'enter') { enterBoard(f.id); return; }
  if (pr.click === 'expand') { toggleCollapse(f.id); return; }
  if (pr.click === 'zoom') { if (f.type === 'cover') enterBoard(f.id); else { const r = fRect(f); measure(); const z = clamp(Math.min((SR.width - 120) / r.w, (SR.height - 160) / r.h), 0.5, 1); animateCam({ z, x: SR.width / 2 - (r.x + r.w / 2) * z, y: SR.height / 2 - (r.y + r.h / 2) * z }, 520); } return; }
  if (pr.mod) { selF.has(f.id) ? selF.delete(f.id) : selF.add(f.id); } else { sel.clear(); selF.clear(); selF.add(f.id); }
  syncSel();
}

/* ---------- lifting a card ---------- */
function beginCard(pr: any, p: Pt) {
  clearTimeout(pr.timer); closeMenus();
  const n = pr.n as Node, it = n.b;
  n.free = true; n.vx = n.vy = n.vw = n.vh = 0;
  const group = !pr.rs && sel.has(it.id) ? [...sel].filter(id => id !== it.id && nodes.has(id) && !nodes.get(id)!.b.proj && !nodes.get(id)!.free) : [];
  const baseStr = pr.baseStr || snapState();
  drag = {
    kind: 'card', n, rs: pr.rs, baseStr, base: JSON.parse(baseStr), item: { ...it }, gitems: group.map(id => ({ ...nodes.get(id)!.b })),
    tgt: it.sec && !pr.ext ? { type: 'sec', id: it.sec } : { type: 'canvas' }, tx: it.x, ty: it.y, tw: it.w, th: it.h,
    offX: p.x - n.x, offY: p.y - n.y, w0: n.w, h0: n.h, x0: p.x, y0: p.y, px: n.x, py: n.y,
    last: p, samples: [{ t: performance.now(), x: p.x, y: p.y }], layout: null, client: { x: p.cx, y: p.cy }, ext: pr.ext || null, spots: [],
  };
  if (pr.ext) delete drag.base.blocks[it.id];
  drag.floor = layoutFrom(drag.base, { kind: 'card', item: drag.item, group: drag.gitems, tgt: { type: 'none' }, hold: true });
  drag.obst = [...drag.floor.frames.map(fRect), ...drag.floor.loose.map(cRect)];
  n.el.classList.remove('pressed'); n.el.classList.add('lift'); if (pr.rs) n.el.classList.add('rs');
  group.forEach((id, i) => { const g = nodes.get(id)!; g.free = true; g.follow = i + 1; g.vx = g.vy = 0; g.el.classList.add('stack'); });
  if (group.length) { const bd = document.createElement('div'); bd.className = 'gbadge num'; bd.textContent = String(group.length + 1); n.el.appendChild(bd); }
  stage.classList.add('dragging');
  Object.assign(phs, { x: n.x, y: n.y, w: n.w, h: n.h, tx: n.x, ty: n.y, tw: n.w, th: n.h, vx: 0, vy: 0, vw: 0, vh: 0 });
  ph.className = 'ph on';
  if (navigator.vibrate && pr.touch) { try { navigator.vibrate(8); } catch { /* no buzz */ } }
  move(p); kick();
}
/* hysteresis: a cell only changes once the card is clearly past the boundary */
const pick = (f: number, cur: number) => (Math.abs(f - cur) <= 0.5 + cfg.hyst ? cur : Math.round(f));
const tkey = (t: any) => t.type + ':' + (t.id || t.board || '');
function frameAt(x: number, y: number, cur: any) {
  const fl: Frame[] = drag.floor.frames, curF = cur && cur.type === 'sec' ? fl.find(f => f.id === cur.id) : null;
  const inside = (f: Frame, slop: number, bslop: number) => { const r = fRect(f); return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y + LBL - slop && y <= r.y + r.h + bslop; };
  if (curF && inside(curF, 32, U * 0.6 + 30)) return { type: 'sec', id: curF.id };
  for (const f of fl) {
    if (f.type === 'smart') continue;
    if (isCap(f)) { if (inside(f, 0, 0)) return { type: 'into', id: f.id }; continue; }
    if (inside(f, 6, U * 0.6)) return { type: 'sec', id: f.id };
  }
  return null;
}
function screenTarget(cx: number, cy: number) {
  if (drag.item.kind !== 'note' && !(drag.ext && drag.ext.type === 'inbox')) {
    const ib = $('#inbox');
    if (ib && inboxOpen()) { const r = ib.getBoundingClientRect(); if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) return { type: 'inbox' }; }
    const btn = $('#inboxBtn');
    if (btn) { const bt = btn.getBoundingClientRect(); if (cx >= bt.left - 6 && cx <= bt.right + 6 && cy >= bt.top - 6 && cy <= bt.bottom + 6) return { type: 'inbox', btn: true }; }
  }
  for (const el of $$('#crumbs .cr[data-b]')) { const r = el.getBoundingClientRect(); if (el.dataset.b !== V && cx >= r.left && cx <= r.right && cy >= r.top - 4 && cy <= r.bottom + 4) return { type: 'crumb', board: el.dataset.b }; }
  return null;
}
function move(p: Pt) {
  const d = drag;
  d.last = p; d.client = { x: p.cx, y: p.cy };
  const now = performance.now(); d.samples.push({ t: now, x: p.x, y: p.y }); while (d.samples.length > 6) d.samples.shift();
  if (d.kind === 'frame') return moveFrame(p);
  const n = d.n;
  if (d.rs) return moveResize(p);
  d.px = p.x - d.offX; d.py = p.y - d.offY;
  const s0 = d.samples[0], dtv = (now - s0.t) / 1000, vx = dtv > 0.016 ? (p.x - s0.x) / dtv : 0;
  n.tr = clamp(vx / 90, -4, 4);
  let cand: any = screenTarget(p.cx, p.cy) || frameAt(p.x, p.y, d.tgt) || { type: 'canvas' };
  if (tkey(cand) !== tkey(d.tgt)) {
    /* a new target has to hold the hand for a beat before it takes the card: nothing is captured in passing */
    if (d.cand !== tkey(cand)) { d.cand = tkey(cand); d.candT = now; }
    if (now - d.candT < 120) { cand = d.tgt; clearTimeout(d.candTimer); d.candTimer = setTimeout(() => { if (drag === d && !d.dropping) move(d.last); }, 130 - (now - d.candT)); }
  } else d.cand = null;
  let nx = d.tx, ny = d.ty;
  const same = tkey(cand) === tkey(d.tgt);
  if (cand.type === 'sec') {
    const f = d.floor.frames.find((x: Frame) => x.id === cand.id), w = Math.min(d.tw, f.cols);
    const rx = d.px / U - f.gx, ry = d.py / U - f.gy;
    nx = clamp(same ? pick(rx, d.tx) : Math.round(rx), 0, f.cols - w); ny = Math.max(0, same ? pick(ry, d.ty) : Math.round(ry));
  } else if (cand.type === 'canvas') {
    const gx = same ? pick(d.px / U, d.cgx ?? Math.round(d.px / U)) : Math.round(d.px / U), gy = same ? pick(d.py / U, d.cgy ?? Math.round(d.py / U)) : Math.round(d.py / U);
    d.cgx = gx; d.cgy = gy;
    const s = freeCardSpot(gx, gy, d.tw, d.th, d.obst); nx = s.x; ny = s.y;
  }
  if (!same || nx !== d.tx || ny !== d.ty || !d.layout) {
    const wasSec = d.tgt.type === 'sec';
    d.tgt = cand; d.tx = nx; d.ty = ny;
    if (cand.type === 'canvas') {
      const lead: Rect = { t: 'c', id: '', x: nx * U, y: ny * U, w: P(d.tw), h: P(d.th) }, ob = [...d.obst, lead];
      d.spots = d.gitems.map((g: Block) => { const s = freeCardSpot(nx + d.tw, ny, g.w, g.h, ob); ob.push({ t: 'c', id: '', x: s.x * U, y: s.y * U, w: P(g.w), h: P(g.h) }); return s; });
    }
    /* the placeholder moves at once; other cards step aside once the hand has rested for a beat */
    if (!d.layout || cand.type !== 'sec' || !wasSec || !same) preview();
    else { d.pending = true; clearTimeout(d.settleT); d.settleT = setTimeout(() => { if (drag === d && d.pending) { d.pending = false; preview(); } }, 80); }
  }
}
function preview() {
  const d = drag;
  const t = d.tgt.type === 'sec' || d.tgt.type === 'canvas' ? d.tgt : { type: 'none' };
  const f = { kind: 'card', item: d.item, group: d.gitems, tgt: t, x: d.tx, y: d.ty, w: d.tw, h: d.th, spots: d.spots, hold: !d.dropping };
  d.layout = layoutFrom(d.base, f);
  let on = true;
  if (t.type === 'sec') {
    const fr = d.layout.frames.find((x: Frame) => x.id === t.id), me = d.layout.lists.get(t.id).find((i: Block) => i.id === d.item.id);
    phs.tx = (fr.gx + me.x) * U; phs.ty = (fr.gy + me.y) * U; phs.tw = P(me.w); phs.th = P(me.h);
  } else if (t.type === 'canvas') { phs.tx = d.tx * U; phs.ty = d.ty * U; phs.tw = P(d.tw); phs.th = P(d.th); }
  else on = false;
  if (on && !ph.classList.contains('on')) { Object.assign(phs, { x: phs.tx, y: phs.ty, w: phs.tw, h: phs.th, vx: 0, vy: 0, vw: 0, vh: 0 }); }
  ph.classList.toggle('on', on);
  const skip = new Set<string>([d.item.id, ...d.gitems.map((g: Block) => g.id)]);
  applyLayout(d.layout, false, skip);
  const src = d.item.sec;
  for (const n of fnodes.values()) {
    n.el.classList.toggle('target', d.tgt.type === 'sec' && n.f.id === d.tgt.id && n.f.id !== src);
    n.el.classList.toggle('drop', d.tgt.type === 'into' && n.f.id === d.tgt.id);
  }
  setDropOn(d.tgt.type === 'inbox' ? { type: 'inbox', btn: d.tgt.btn } : d.tgt.type === 'crumb' ? { type: 'crumb', board: d.tgt.board } : null);
}
function moveResize(p: Pt) {
  const d = drag, n = d.n as Node, b = d.item as Block;
  n.tw = Math.max(52, d.w0 + (p.x - d.x0)); n.th = Math.max(52, d.h0 + (p.y - d.y0));
  const fr = b.sec && d.floor.frames.find((x: Frame) => x.id === b.sec), cols = fr ? fr.cols : 3;
  const gw = clamp(Math.round((n.tw + GAP) / U), 1, Math.min(3, cols)), gh = clamp(Math.round((n.th + GAP) / U), 1, 3);
  const [w, h] = snapSize(openOf(b as any, LK).filter(s => +s[0] <= cols), gw, gh) || [d.tw, d.th];
  if (w === d.tw && h === d.th && d.layout) return;
  if (!fr) { const r: Rect = { t: 'c', id: '', x: b.x * U, y: b.y * U, w: P(w), h: P(h) }; if (d.obst.some((o: Rect) => collide(r, o))) return; }
  d.tw = w; d.th = h;
  n.b = { ...b, w, h }; n.key = ''; ensureCard(n.b); n.el.classList.add('lift', 'rs');
  let tag = n.el.querySelector('.szt'); if (!tag) { tag = document.createElement('div'); tag.className = 'szt num'; n.el.appendChild(tag); }
  tag.textContent = `${w} × ${h}`;
  d.layout = layoutFrom(d.base, { kind: 'cardsize', sec: b.sec, item: b, w, h });
  const lay = d.layout;
  if (fr) { const f2 = lay.frames.find((x: Frame) => x.id === b.sec), me = lay.lists.get(b.sec).find((i: Block) => i.id === b.id); phs.tx = (f2.gx + me.x) * U; phs.ty = (f2.gy + me.y) * U; }
  else { phs.tx = b.x * U; phs.ty = b.y * U; }
  phs.tw = P(w); phs.th = P(h);
  applyLayout(lay, false, new Set([b.id]));
}
function autoPan(dt: number) {
  const d = drag; if (!d || d.rs) return;
  if (d.tgt && (d.tgt.type === 'inbox' || d.tgt.type === 'crumb')) return;
  for (const id of ['tl', 'tr', 'hud', 'addBtn', 'inbox', 'map']) { const el = document.getElementById(id); if (!el || el.classList.contains('off')) continue; const r = el.getBoundingClientRect(); if (d.client.x >= r.left - 8 && d.client.x <= r.right + 8 && d.client.y >= r.top - 8 && d.client.y <= r.bottom + 8) return; }
  const edge = 40, max = 760, x = d.client.x - SR.left, y = d.client.y - SR.top, Wd = SR.width, Hd = SR.height;
  let vx = 0, vy = 0;
  if (x < edge) vx = max * (1 - x / edge); else if (x > Wd - edge) vx = -max * (1 - (Wd - x) / edge);
  if (y < edge) vy = max * (1 - y / edge); else if (y > Hd - edge) vy = -max * (1 - (Hd - y) / edge);
  if (!vx && !vy) return;
  cam.x += clamp(vx, -max, max) * dt; cam.y += clamp(vy, -max, max) * dt; applyCam();
  move({ x: (d.client.x - SR.left - cam.x) / cam.z, y: (d.client.y - SR.top - cam.y) / cam.z, cx: d.client.x, cy: d.client.y });
}
function endDragVisuals(d: any) {
  stage.classList.remove('dragging'); ph.className = 'ph';
  for (const n of fnodes.values()) n.el.classList.remove('target', 'drop');
  setDropOn(null);
  clearTimeout(d.settleT); clearTimeout(d.candTimer);
}
export function cancelDrag() {
  const d = drag; if (!d) return;
  drag = null; press = null; endDragVisuals(d);
  if (d.kind === 'frame') { clearTimeout(d.roomT); d.fn.free = false; d.fn.el.classList.remove('lift'); for (const c of nodes.values()) c.el.classList.remove('ride'); sync(false); return; }
  const n = d.n as Node; n.free = false; n.tr = 0; n.el.classList.remove('lift', 'rs'); $$('.gbadge,.szt', n.el).forEach(x => x.remove());
  for (const g of d.gitems) { const gn = nodes.get(g.id); if (gn) { gn.free = false; gn.follow = 0; gn.el.classList.remove('stack'); } }
  if (d.ext) { n.el.remove(); nodes.delete(n.b.id); $$('.dragout').forEach(x => x.classList.remove('dragout')); }
  else { n.b = S.blocks[n.b.id] || n.b; n.key = ''; }
  sync(false);
}
function drop() {
  const d = drag;
  if (d.kind === 'frame') return landFrame();
  if (d.rs) return landCard();
  d.dropping = true; clearTimeout(d.settleT); d.pending = false;
  preview(); landCard();
}
function landCard() {
  const d = drag; drag = null; press = null; endDragVisuals(d);
  const n = d.n as Node, movers: Block[] = [d.item, ...d.gitems];
  n.free = false; $$('.gbadge,.szt', n.el).forEach(x => x.remove());
  for (const g of d.gitems) { const gn = nodes.get(g.id); if (gn) { gn.free = false; gn.follow = 0; gn.el.classList.remove('stack'); gn.el.classList.add('settling'); } }
  n.tr = 0; n.el.classList.remove('lift', 'rs'); n.el.classList.add('settling');
  $$('.dragout').forEach(x => x.classList.remove('dragout'));
  const t = d.tgt.type;
  if (d.rs) { if (d.tw !== d.item.w || d.th !== d.item.h) { pushUndo(d.baseStr); commit(d.layout); } n.b = S.blocks[d.item.id]; n.key = ''; sync(false); return; }
  if (t === 'sec' || t === 'canvas') {
    const moved = d.ext || d.tx !== d.item.x || d.ty !== d.item.y || (t === 'sec' ? d.tgt.id !== d.item.sec : !!d.item.sec) || d.gitems.length;
    if (moved) { pushUndo(d.baseStr); commit(d.layout); if (d.ext) { takeFromSource(d.ext, d.item); S.loc[d.item.link] = d.item.id; } }
    for (const m of movers) { const nn = nodes.get(m.id), rb = S.blocks[m.id]; if (nn && rb) { nn.b = rb; } }
    sync(false);
    return;
  }
  pushUndo(d.baseStr);
  if (d.ext) { S.blocks[d.item.id] = { ...d.item }; S.loc[d.item.link] = d.item.id; takeFromSource(d.ext, d.item); }
  if (t === 'into') { intoFrame(movers.map(m => m.id), d.tgt.id); }
  else if (t === 'inbox') { toInbox(movers.map(m => m.id)); }
  else if (t === 'crumb') { toBoard(movers.map(m => m.id), d.tgt.board); }
  /* the cards that left this board fly a short way and fade instead of vanishing */
  for (const m of movers) { const nn = nodes.get(m.id); if (nn) vanish(nn); }
  sync(false);
}
function vanish(n: Node) {
  nodes.delete(n.b.id);
  const el = n.el; el.classList.remove('settling', 'lift', 'stack'); el.style.pointerEvents = 'none'; el.style.zIndex = '31';
  const a = el.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.72 }], { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
  a.finished.then(() => el.remove(), () => el.remove());
}
function flashCard(id: string) { const n = nodes.get(id); if (!n) return; n.el.classList.remove('flash'); void n.el.offsetWidth; n.el.classList.add('flash'); setTimeout(() => n.el.classList.remove('flash'), 2100); }

/* where things go when they leave the canvas */
function takeFromSource(src: any, item: Block) {
  if (src.type === 'inbox') S.inbox = S.inbox.filter(id => id !== item.link);
  if (src.type === 'list') { const Lb = S.blocks[src.id]; if (Lb) { Lb.rows = (Lb.rows || []).filter(id => id !== item.link); if (!Lb.rows.length) delete S.blocks[src.id]; } }
  bump();
}
function intoFrame(ids: string[], fid: string) {
  const fr = S.frames[fid], left = secsOf(ids);
  if (fr.type === 'cover') {
    const tb = fr.target!, first = framesOf(tb).filter(f => f.type === 'sec').sort((a, b) => a.gy - b.gy || a.gx - b.gx)[0];
    if (first) { placeIntoSec(ids, first.id); relayout(tb, [first.id]); } else placeLoose(ids, tb);
    fr.peekV = (fr.peekV || 0) + 1;
    relayout(V, null, left);
    pulse(fid);
    toast(`已放进「${fr.name}」`, '撤销', undo);
  } else { placeIntoSec(ids, fid); relayout(V, [fid], left); pulse(fid); }
}
function pulse(fid: string) { const n = fnodes.get(fid); if (!n) return; n.el.animate([{ scale: 1 }, { scale: 1.025 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.4,.5,1)' }); }
function toInbox(ids: string[]) {
  const links: string[] = [], left = secsOf(ids);
  for (const id of ids) { const b = S.blocks[id]; if (!b || b.kind === 'note') continue; links.push(...linksOfBlock(b)); delete S.blocks[id]; }
  links.forEach(l => { S.loc[l] = 'inbox'; S.inbox = S.inbox.filter(x => x !== l); S.inbox.unshift(l); S.keep[l] = 1; delete S.unimp[l]; });
  relayout(V, null, left); bump();
  flashInbox(links);
}
function toBoard(ids: string[], bid: string) {
  const left = secsOf(ids); placeLoose(ids, bid); relayout(V, null, left); relayout(bid); bump();
  const cv = coverOf(V); if (cv) cv.peekV = (cv.peekV || 0) + 1;
  toast(`已移到「${S.boards[bid].name}」`, '撤销', undo);
}
export function flashInbox(ids: string[]) {
  if (inboxOpen()) setInboxFlash(f => ({ ids, n: f.n + 1 }));
  else document.getElementById('inboxBtn')?.animate([{ scale: 1 }, { scale: 1.18 }, { scale: 1 }], { duration: 360, easing: 'cubic-bezier(.3,1.5,.5,1)' });
}

/* ---------- moving a Section or a cover: it sticks to the hand and lands on the nearest free spot ---------- */
function beginFrame(pr: any, p: Pt) {
  clearTimeout(pr.timer); closeMenus();
  const n = pr.n as FNode, f = n.f;
  n.free = true; n.vx = n.vy = 0;
  const baseStr = snapState();
  const others = LAY.frames.filter(x => x.id !== f.id).map(fRect).concat(LAY.loose.map(cRect));
  drag = { kind: 'frame', fn: n, id: f.id, ids: new Set([f.id]), baseStr, offX: p.x - n.x, offY: p.y - n.y, px: n.x, py: n.y, obst: others, spot: { gx: f.gx, gy: f.gy }, last: p, samples: [], client: { x: p.cx, y: p.cy }, into: null };
  n.el.classList.add('lift'); stage.classList.add('dragging');
  const r = fRect(f);
  Object.assign(phs, { x: r.x, y: r.y + LBL, w: r.w, h: r.h - LBL, tx: r.x, ty: r.y + LBL, tw: r.w, th: r.h - LBL, vx: 0, vy: 0, vw: 0, vh: 0 });
  ph.className = 'ph sec';
  drag.ride = new Set();
  for (const c of nodes.values()) if (c.b.sec === f.id || c.b.proj === f.id) { c.el.classList.add('ride'); drag.ride.add(c.b.id); }
  drag.spot = null; drag.spotKey = f.gx + ',' + f.gy; drag.base0 = layoutFrom(S, null, { noSettle: true });
  move(p); kick();
}
function moveFrame(p: Pt) {
  const d = drag, n = d.fn as FNode, f = n.f;
  d.px = p.x - d.offX; d.py = p.y - d.offY; n.x = d.px; n.y = d.py;
  /* a Section dropped on a cover goes inside that board */
  let into: string | null = null;
  if (f.type !== 'cover') for (const o of d.base0.frames as Frame[]) if (o.type === 'cover' && o.id !== f.id) { const r = fRect(o); if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y + LBL && p.y <= r.y + r.h) into = o.id; }
  /* going inside a board needs the hand to rest on its cover, so passing over covers only makes room */
  const now = performance.now();
  if (into !== d.intoCand) { d.intoCand = into; d.intoT = now; clearTimeout(d.intoTimer); if (into) { const want = into; d.intoTimer = setTimeout(() => { if (drag === d && d.intoCand === want) moveFrame(d.last); }, 360); } }
  if (into && now - d.intoT < 350) into = null;
  if (into !== d.into) { d.into = into; for (const m of fnodes.values()) m.el.classList.toggle('drop', m.f.id === into); }
  if (into) { ph.classList.remove('on'); if (d.layout) { d.layout = null; d.spotKey = ''; applyLayout(d.base0, false, d.ride); } return; }
  /* the target follows the hand and clicks onto the edges around it: lined up with a neighbour, or one Section gap from it */
  d.spot = snapSpot(f, d.px, d.py, d.obst);
  /* neighbours only step aside once this Section's cards, where they are on screen, cover a whole cell of theirs (released at half a cell) */
  const th = d.room ? U * 0.5 : U, me = f.type === 'cover' || f.collapsed ? { ...bodyOf(f), x: d.px, y: d.py + LBL } : { x: d.px + PAD, y: d.py + LBL + PAD, w: P(f.cols), h: P(Math.max(1, f.rows)) };
  const deep = [...(d.base0.frames as Frame[]).filter(o => o.id !== f.id).map(bodyOf), ...d.base0.loose.map(cRect)].some(o => Math.min(me.x + me.w, o.x + o.w) - Math.max(me.x, o.x) > th && Math.min(me.y + me.h, o.y + o.h) - Math.max(me.y, o.y) > th);
  d.room = deep && !d.intoCand;
  if (d.room) d.target = d.spot;
  else d.target = freeSpot(f, d.spot, d.obst);
  const r = fRect({ ...f, ...d.target });
  phs.tx = r.x; phs.ty = r.y + LBL; phs.tw = r.w; phs.th = r.h - LBL;
  const near = Math.abs(r.x - d.px) < 22 && Math.abs(r.y - d.py) < 22;
  if (!ph.classList.contains('on')) Object.assign(phs, { x: phs.tx, y: phs.ty, w: phs.tw, h: phs.th, vx: 0, vy: 0 });
  ph.classList.toggle('on', !near);
  /* not deep enough, or the hand is on a board's cover: everyone stays home */
  if (!d.room) { clearTimeout(d.roomT); d.spotKey = ''; if (d.layout) { d.layout = null; applyLayout(d.base0, false, d.ride); } return; }
  const key = Math.round(d.spot.gx * U) + ',' + Math.round(d.spot.gy * U);
  if (key !== d.spotKey) {
    d.spotKey = key; clearTimeout(d.roomT);
    /* neighbours step aside once the hand rests for a beat */
    d.roomT = setTimeout(() => { if (drag !== d || d.into || !d.room) return; d.layout = layoutFrom(S, { kind: 'frame', id: f.id, gx: d.spot.gx, gy: d.spot.gy, room: true }); applyLayout(d.layout, false, d.ride); }, 80);
  }
}
const toSpot = (x: number, y: number) => ({ gx: (x + PAD) / U, gy: (y + LBL + PAD) / U });
function snapSpot(f: Frame, x: number, y: number, obst: Rect[]) {
  /* edges of everything around, and the place this Section came from, so it can line up or swap cleanly */
  const r = fRect(f), R = U * 0.45;
  const pk = (v: number, size: number, a: 'x' | 'y', as: 'w' | 'h') => {
    let best: number | null = null, bd = R;
    for (const o of [...obst, r]) {
      const m = gapOf(r, o);
      for (const c of [o[a], o[a] + o[as] - size, o[a] + o[as] + m, o[a] - m - size]) if (Math.abs(c - v) < bd) { bd = Math.abs(c - v); best = c; }
    }
    return best ?? Math.round(v / 2) * 2;
  };
  return toSpot(pk(x, r.w, 'x', 'w'), pk(y, r.h, 'y', 'h'));
}
/* nearest place around the target where the Section fits without touching anything */
function freeSpot(f: Frame, spot: { gx: number; gy: number }, obst: Rect[]) {
  const r0 = fRect({ ...f, ...spot });
  if (!obst.some(o => collide(r0, o))) return spot;
  let best: Rect | null = null, bd = Infinity, front = [r0];
  for (let k = 0; k < 3 && front.length; k++) {
    const next: Rect[] = [];
    for (const c of front) for (const o of obst.filter(o => collide(c, o))) {
      const m = gapOf(c, o);
      for (const n of [{ ...c, x: o.x + o.w + m }, { ...c, x: o.x - m - c.w }, { ...c, y: o.y + o.h + m }, { ...c, y: o.y - m - c.h }]) {
        const dd = Math.hypot(n.x - r0.x, (n.y - r0.y) * 1.1);
        if (!obst.some(q => collide(n, q))) { if (dd < bd) { bd = dd; best = n; } } else if (dd < 900) next.push(n);
      }
    }
    front = next.slice(0, 40);
  }
  return best ? toSpot(best.x, best.y) : { gx: f.gx, gy: f.gy };
}
const bodyOf = (o: Frame) => o.type === 'cover' ? { x: o.gx * U - PAD, y: o.gy * U - PAD, w: o.cols * U + 2 * PAD - GAP, h: o.rows * U + 2 * PAD - GAP } : o.collapsed ? { x: o.gx * U - PAD, y: o.gy * U - PAD, w: o.cols * U + 2 * PAD - GAP, h: capH(o) } : { x: o.gx * U, y: o.gy * U, w: P(o.cols), h: P(Math.max(1, o.rows)) };
function landFrame() {
  const d = drag; drag = null; press = null; endDragVisuals(d);
  const n = d.fn as FNode; n.free = false; n.el.classList.remove('lift');
  for (const c of nodes.values()) c.el.classList.remove('ride');
  pushUndo(d.baseStr);
  if (d.into) { const into = d.into; moveFrameToBoard(d.id, S.frames[into].target!); vanishFrame(n); sync(false); pulse(into); toast(`已移到「${S.frames[into].name}」`, '撤销', undo); return; }
  clearTimeout(d.roomT); clearTimeout(d.intoTimer);
  if (d.room) commit(layoutFrom(S, { kind: 'frame', id: d.id, gx: d.spot.gx, gy: d.spot.gy, room: true }));
  else if (d.target) { const f = S.frames[d.id]; f.gx = d.target.gx; f.gy = d.target.gy; }
  bump(); sync(false);
}
function vanishFrame(n: FNode) {
  fnodes.delete(n.f.id);
  const els = [n.el, ...[...nodes.values()].filter(c => c.b.sec === n.f.id || c.b.proj === n.f.id).map(c => (nodes.delete(c.b.id), c.el))];
  for (const el of els) { el.style.pointerEvents = 'none'; const a = el.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.8 }], { duration: 220, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }); a.finished.then(() => el.remove(), () => el.remove()); }
}

/* ---------- resizing a frame: it follows the hand on a stiff spring, the cells inside reflow as it crosses each column ---------- */
function beginFrameResize(e: PointerEvent, n: FNode, mode: 'x' | 'xy') {
  e.preventDefault(); closeMenus();
  const f = n.f, baseStr = snapState(), base = JSON.parse(baseStr);
  const minC = f.type === 'sec' ? Math.max(2, ...blocksIn(f.id).filter(b => !b.fold).map(b => b.w)) : 2;
  const r0 = fRect(f);
  rsz = { n, mode, x0: e.clientX, y0: e.clientY, w0: r0.w, h0: r0.h, cols: f.cols, rows: f.rows, lay: null };
  n.el.classList.add('rsz'); n.stiff = true; stage.classList.add('dragging');
  stage.setPointerCapture(e.pointerId);
  const tag = document.createElement('div'); tag.className = 'szt num'; tag.style.top = 'calc(50% + 17px)'; n.el.appendChild(tag);
  const show = () => { tag.textContent = mode === 'x' ? `${rsz.cols} 列` : `${rsz.cols} × ${rsz.rows}`; };
  show();
  rsz.move = (ev: PointerEvent) => {
    const dx = (ev.clientX - rsz.x0) / cam.z, dy = (ev.clientY - rsz.y0) / cam.z;
    const hw = Math.max(minC * U + 2 * PAD - GAP, rsz.w0 + dx), hh = Math.max(U + LBL + 2 * PAD - GAP, rsz.h0 + dy);
    const cols = clamp(Math.round((hw - 2 * PAD + GAP) / U), minC, MAXC), rows = mode === 'xy' ? clamp(Math.round((hh - LBL - 2 * PAD + GAP - (f.foot ? FOOT : 0)) / U), 1, MAXR) : f.rows;
    if (cols !== rsz.cols || rows !== rsz.rows || !rsz.lay) {
      rsz.cols = cols; rsz.rows = rows; show();
      rsz.lay = layoutFrom(base, { kind: 'frame', id: f.id, cols, rows });
      applyLayout(rsz.lay, false);
    }
    n.tw = hw; if (mode === 'xy') n.th = hh;
    kick();
  };
  rsz.up = () => {
    const c = rsz; rsz = null; n.stiff = false; n.el.classList.remove('rsz'); tag.remove(); stage.classList.remove('dragging');
    if (c.lay && (c.cols !== f.cols || c.rows !== f.rows)) { pushUndo(baseStr); commit(c.lay); const real = S.frames[f.id]; if (real.type === 'cover') real.peekV = (real.peekV || 0) + 1; }
    sync(false);
  };
}

/* ---------- marquee ---------- */
function startMarquee(e: PointerEvent) {
  const el = document.createElement('div'); el.className = 'marq'; app.appendChild(el);
  marq = { x0: e.clientX, y0: e.clientY, base: new Set(sel), el };
  stage.setPointerCapture(e.pointerId);
}
function moveMarquee(e: PointerEvent) {
  const x = Math.min(e.clientX, marq.x0), y = Math.min(e.clientY, marq.y0), w = Math.abs(e.clientX - marq.x0), h = Math.abs(e.clientY - marq.y0);
  Object.assign(marq.el.style, { left: x - AR.left + 'px', top: y - AR.top + 'px', width: w + 'px', height: h + 'px' });
  sel.clear(); for (const id of marq.base) sel.add(id);
  for (const n of nodes.values()) {
    if (n.b.proj) continue;
    const r = { x: n.x * cam.z + cam.x + SR.left, y: n.y * cam.z + cam.y + SR.top, w: n.w * cam.z, h: n.h * cam.z };
    if (r.x < x + w && r.x + r.w > x && r.y < y + h && r.y + r.h > y) sel.add(n.b.id);
  }
  syncSel();
}
function endMarquee() { marq.el.remove(); marq = null; }

/* ---------- pinch & wheel ---------- */
function startPinch() { release(); if (pan) { pan = null; stage.classList.remove('panning'); } const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 - SR.left, my: (a.y + b.y) / 2 - SR.top, cam: { ...cam } }; }
function movePinch() {
  const [a, b] = [...pointers.values()]; if (!b) return;
  const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2 - SR.left, my = (a.y + b.y) / 2 - SR.top;
  const z = clamp(pinch.cam.z * d / pinch.d, ZMIN, ZMAX);
  cam.z = z; cam.x = mx - (pinch.mx - pinch.cam.x) * z / pinch.cam.z; cam.y = my - (pinch.my - pinch.cam.y) * z / pinch.cam.z; applyCam();
  if (V !== S.home && z <= viewZmin() * 0.75) { pinch = null; exitBoard(); }
}
function endPinch() { pinch = null; }
let outPush = 0, outT = 0;
const viewZmin = () => (V === S.home ? ZMIN : Math.max(ZMIN, Math.min(0.42, fitCam(LAY, { all: true }).z * 0.85)));
function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (drag || morphing) return;
  measure(); cancelAnimationFrame(camAnim);
  const dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX, dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  if (e.ctrlKey || e.metaKey) {
    const f = Math.exp(-clamp(dy, -40, 40) * 0.01), zmin = viewZmin();
    /* past the smallest zoom of a sub-board, keep pulling out to go back to its parent */
    if (V !== S.home && f < 1 && cam.z <= zmin * 1.001) {
      const now = performance.now(); if (now - outT > 400) outPush = 0; outT = now;
      outPush += -Math.log(f); if (outPush > 0.5) { outPush = 0; exitBoard(); }
      return;
    }
    const z = clamp(cam.z * f, V === S.home ? ZMIN : zmin, ZMAX);
    zoomAt(z / cam.z, e.clientX - SR.left, e.clientY - SR.top);
  } else { cam.x -= dx; cam.y -= dy; applyCam(); }
}

/* ================= whiteboards: going in and out ================= */
function switchView(bid: string, later?: boolean) {
  if (!S.boards[bid]) bid = S.home;
  S.cams[V] = { ...cam };
  if (drag) cancelDrag(); release(); closeMenus(); closePop();
  setV(bid); sel.clear(); selF.clear();
  rebuildView(); if (!later) renderCrumbs();
}
function camFor(bid: string): Cam { const c = S.cams[bid]; return c && isFinite(c.z) ? { ...c } : fitCam(LAY); }
function peekMap(n: { f: Frame; k?: number; bx?: number; by?: number; bw?: number }, pc: Cam): Cam {
  const f = n.f, r = fRect(f), k = n.k || peekK(n, r.w), z = k * pc.z;
  return { z, x: pc.x + (r.x + PEEK_IN) * pc.z - (n.bx || 0) * z, y: pc.y + (r.y + LBL + PEEK_IN) * pc.z - (n.by || 0) * z };
}
function ghostOf(under?: boolean) { const g = world.cloneNode(true) as HTMLElement; g.removeAttribute('id'); g.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); g.querySelectorAll('.ph').forEach(x => x.remove()); g.classList.add('ghostw'); g.style.pointerEvents = 'none'; stage.insertBefore(g, under ? world : world.nextSibling); return g; }
const coverW = (f: Frame) => { const r = fRect(f); return { x: r.x, y: r.y + LBL, w: r.w, h: r.h - LBL }; };
type R4 = { x: number; y: number; w: number; h: number };
const onScr = (w: R4, Kc: Cam) => ({ x: w.x * Kc.z + Kc.x, y: w.y * Kc.z + Kc.y, w: w.w * Kc.z, h: w.h * Kc.z });
const mixR = (a: R4, b: R4, e: number) => ({ x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, w: a.w + (b.w - a.w) * e, h: a.h + (b.h - a.h) * e });
function clipWrap(el: HTMLElement) { const w = document.createElement('div'); w.className = 'clipw'; el.parentNode!.insertBefore(w, el); w.appendChild(el); return w; }
function unwrap(w: HTMLElement) { if (w.parentNode) { w.parentNode.insertBefore(w.firstChild!, w); w.remove(); } }
function clipTo(w: HTMLElement, R: R4, rad: number) { w.style.clipPath = `inset(${R.y}px ${SR.width - R.x - R.w}px ${SR.height - R.y - R.h}px ${R.x}px round ${Math.max(0, rad)}px)`; }
const camT = (c: Cam) => `translate3d(${c.x}px,${c.y}px,0) scale(${c.z})`;
function lerpCam(a: Cam, b: Cam, e: number): Cam {
  /* one similarity takes camera a to b on screen; zoom about its fixed point so the target never drifts */
  const r = b.z / a.z;
  if (Math.abs(Math.log(r)) > 0.05) {
    const fx = (b.x - r * a.x) / (1 - r), fy = (b.y - r * a.y) / (1 - r), q = Math.pow(r, e);
    if (Math.abs(fx) < SR.width * 3 && Math.abs(fy) < SR.height * 3) return { z: a.z * q, x: fx + (a.x - fx) * q, y: fy + (a.y - fy) * q };
  }
  const hw = SR.width / 2, hh = SR.height / 2;
  const ca = { x: (hw - a.x) / a.z, y: (hh - a.y) / a.z }, cb = { x: (hw - b.x) / b.z, y: (hh - b.y) / b.z };
  const z = Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e), cx = ca.x + (cb.x - ca.x) * e, cy = ca.y + (cb.y - ca.y) * e;
  return { z, x: hw - cx * z, y: hh - cy * z };
}
/* screen similarity M = to∘from⁻¹ applied to camera c */
const carry = (c: Cam, from: Cam, to: Cam) => ({ z: c.z * to.z / from.z, x: (c.x - from.x) / from.z * to.z + to.x, y: (c.y - from.y) / from.z * to.z + to.y });
const ease3 = (x: number) => 1 - Math.pow(1 - x, 3.4), seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
function runMorph(ms: number, frame: (t: number) => void, done: () => void) {
  morphing = true; stage.classList.add('morph');
  const t0 = performance.now();
  const go = () => {
    const t = Math.min(1, (performance.now() - t0) / ms); frame(t);
    if (t < 1) requestAnimationFrame(go); else { morphing = false; stage.classList.remove('morph'); done(); }
  };
  requestAnimationFrame(go);
}
export function enterBoard(fid: string) {
  const f = S.frames[fid]; if (!f || f.type !== 'cover' || morphing) return;
  const n = fnodes.get(fid); measure();
  const old = { ...cam };
  if (!n || RM.matches || !n.bw) { switchView(f.target!); Object.assign(cam, camFor(f.target!)); applyCam(); return; }
  const pm0 = { bx: n.bx, by: n.by, k: n.k };
  const cw = coverW(f), full = { x: -40, y: -40, w: SR.width + 80, h: SR.height + 80 };
  const ghost = ghostOf(true), gp = ghost.querySelector(`[data-id="${fid}"] .pin`) as HTMLElement | null;
  const T0 = peekMap({ f, k: pm0.k, bx: pm0.bx, by: pm0.by }, old);
  switchView(f.target!, true);
  const Tt = camFor(f.target!);
  lodLock = 1;
  world.style.opacity = '0'; const wrap = clipWrap(world);
  runMorph(560, t => {
    const e = ease3(t), c = lerpCam(T0, Tt, e), G = carry(old, T0, c);
    Object.assign(cam, c); applyCam();
    ghost.style.transform = camT(G);
    const cs = onScr(cw, G), u = ease3(seg(t, 0, 0.6));
    clipTo(wrap, mixR(cs, full, u), 22 * G.z * (1 - u));
    ghost.style.opacity = String(1 - seg(t, 0.12, 0.55));
    if (gp) gp.style.opacity = String(1 - seg(t, 0, 0.14));
    world.style.opacity = String(seg(t, 0, 0.14));
  }, () => { ghost.remove(); unwrap(wrap); renderCrumbs(); world.style.opacity = ''; lodLock = 0; Object.assign(cam, Tt); applyCam(); });
}
export function exitBoard() {
  const bd = S.boards[V]; if (!bd || !bd.parent || morphing) return;
  measure();
  const inner = { ...cam }, from = V, ghost = ghostOf();
  switchView(bd.parent, true);
  const Pc = camFor(bd.parent), cv = coverOf(from), n = cv && fnodes.get(cv.id);
  Object.assign(cam, Pc); applyCam();
  if (!cv || !n || !n.bw || RM.matches) { ghost.remove(); renderCrumbs(); return; }
  const T0 = peekMap(n, Pc), pin = n.el.querySelector('.pin') as HTMLElement | null, cw = coverW(cv), wrap = clipWrap(ghost);
  lodLock = 1;
  runMorph(520, t => {
    const e = ease3(t), g = lerpCam(inner, T0, e);
    ghost.style.transform = camT(g);
    ghost.style.opacity = String(1 - seg(t, 0.72, 0.96));
    if (pin) pin.style.opacity = String(seg(t, 0.72, 0.96));
    const pc = carry(Pc, T0, g); Object.assign(cam, pc); applyCam();
    const u = ease3(seg(t, 0, 0.45)), full = { x: -40, y: -40, w: SR.width + 80, h: SR.height + 80 };
    clipTo(wrap, mixR(full, onScr(cw, pc), u), 22 * pc.z * u);
    world.style.opacity = String(seg(t, 0.1, 0.55));
  }, () => { ghost.remove(); wrap.remove(); renderCrumbs(); world.style.opacity = ''; if (pin) pin.style.opacity = ''; lodLock = 0; Object.assign(cam, Pc); applyCam(); pulse(cv.id); });
}
export function goBoard(bid: string) {
  if (bid === V) return;
  if (S.boards[V].parent === bid) return exitBoard();
  const cv = coverOf(bid);
  if (cv && cv.board === V) return enterBoard(cv.id);
  switchView(bid); Object.assign(cam, camFor(bid)); applyCam();
  for (const el of [secLayer, cardLayer]) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
}
function renderCrumbs() {
  setCrumbs(boardChain(V).map(b => ({ id: b, name: S.boards[b].name })));
  setViewId(V);
}
export function afterMorph(fn: () => void) { if (!morphing) return fn(); const w = () => (morphing ? setTimeout(w, 40) : fn()); setTimeout(w, 40); }

/* ================= links ================= */
export function openLink(l?: L) {
  if (!l) return;
  const r = rows[l.id];
  if (r) { r.openedAt = Date.now(); r.clicks = (r.clicks || 0) + 1; LK[l.id] = toL(r); bump(); persist(S); }
  try { window.open(l.url, '_blank', 'noopener'); } catch { /* blocked */ }
}

/* dragging a row out of a panel or a list: it becomes a card under the hand */
let ext: any = null;
export function pressExt(e: PointerEvent, lid: string, src: any, el: HTMLElement) { ext = { lid, src, el, cx: e.clientX, cy: e.clientY, pid: e.pointerId, started: false, touch: e.pointerType !== 'mouse', t0: performance.now() }; try { el.setPointerCapture(e.pointerId); } catch { /* fine */ } }
function moveExt(e: PointerEvent) {
  const d = Math.hypot(e.clientX - ext.cx, e.clientY - ext.cy);
  if (ext.touch && performance.now() - ext.t0 < 220) { if (d > 10) ext = null; return; }
  if (d < 6) return;
  beginExt(e);
}
export function newCardFor(l: L, wh?: [number, number]) { const [w, h] = wh || sizeOf(l); const id = uid('c'); S.blocks[id] = { id, kind: 'card', link: l.id, board: V, sec: null, x: 0, y: 0, w, h }; return id; }
function beginExt(e: PointerEvent) {
  const x = ext; ext = null; measure();
  const l = LK[x.lid]; if (!l) return;
  let b: Block;
  if (x.src.type === 'fold') b = { ...S.blocks[x.src.bid] };
  else { const [w, h] = sizeOf(l); b = { id: uid('c'), kind: 'card', link: l.id, board: V, sec: null, x: 0, y: 0, w, h }; }
  const baseStr = snapState();
  b.board = V;
  const n = ensureCard(b); n.fresh = false;
  const p = wpt(e);
  n.w = n.tw = P(b.w); n.h = n.th = P(b.h); n.x = p.x - Math.min(n.w / 2, 60); n.y = p.y - 24; paint(n);
  n.inn?.animate([{ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }], { duration: 160, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  if (x.src.type !== 'inbox') closePop();
  if (x.src.type === 'inbox' && innerWidth < 760) setInboxOpen(false);
  if (x.el) x.el.classList.add('dragout');
  try { stage.setPointerCapture(x.pid); } catch { /* fine */ }
  beginCard({ n, ext: x.src, rs: false, touch: x.touch, baseStr }, p);
}
function endExt() { const x = ext; ext = null; if (x && !x.started) openLink(LK[x.lid]); }

/* ================= list popover and rule editor live in Solid; these open them ================= */
export function openListPop(src: ListSrc, anchor: Element, flash?: string) {
  const cur = pop();
  if (cur && cur.kind === 'list' && cur.src.type === src.type && JSON.stringify(cur.src) === JSON.stringify(src) && !flash) { closePop(); return; }
  openPop({ kind: 'list', src, anchor, flash });
}
export function openRuleEditor(fid: string, anchor: Element | null) { openPop({ kind: 'rule', fid, anchor }); }
export const ruleCount = ruleMatch;

/* ================= finding things ================= */
export function revealFrame(fid: string) {
  const f = S.frames[fid]; if (!f) return;
  if (f.board !== V) goBoard(f.board);
  afterMorph(() => { const lf = LAY.frames.find(x => x.id === fid); if (!lf) return; const r = fRect(lf); measure(); const z = clamp(Math.min((SR.width - 140) / r.w, (SR.height - 170) / r.h), 0.45, 1); animateCam({ z, x: SR.width / 2 - (r.x + r.w / 2) * z, y: Math.max(76, SR.height / 2 - r.h * z / 2) - r.y * z }, 520, () => pulse(fid)); });
}
export function revealLink(lid: string) {
  const loc = S.loc[lid];
  if (loc === 'inbox') {
    setInboxOpen(true);
    if (!unimpOpen()) { const l = LK[lid]; if (l && !S.keep[lid] && (S.unimp[lid] || isUnimpL(l))) setUnimpOpen(true); }
    setTimeout(() => flashInbox([lid]), 30); return;
  }
  const b = S.blocks[loc]; if (!b) return;
  if (b.board !== V) goBoard(b.board);
  afterMorph(() => {
    if (b.fold && b.sec) { const sec = b.sec; revealFrame(sec); setTimeout(() => { const fn = fnodes.get(sec), ft = fn && fn.el.querySelector('.foot'); if (ft) openListPop({ type: 'fold', fid: sec }, ft, lid); }, 560); return; }
    const f = b.sec ? S.frames[b.sec] : null;
    if (f && f.collapsed) { toggleCollapse(f.id); }
    setTimeout(() => {
      const n = nodes.get(b.id); if (!n) return;
      reveal({ x: n.tx, y: n.ty, w: n.tw, h: n.th }, 0.75);
      sel.clear(); selF.clear(); sel.add(b.id); syncSel(); flashCard(b.id);
    }, f && f.collapsed ? 260 : 0);
  });
}

/* ================= saving a link into a place ================= */
export function saveLinkTo(lid: string, where: string) {
  if (where === 'here') return placeLinkAt(lid);
  pushUndo();
  if (where === 'inbox' || !S.frames[where]) {
    S.inbox = S.inbox.filter(x => x !== lid); S.inbox.unshift(lid); S.loc[lid] = 'inbox'; bump(); sync(false); flashInbox([lid]); return;
  }
  const l = LK[lid], f = S.frames[where], id = uid('c'), [w, h] = sizeOf(l);
  S.blocks[id] = { id, kind: 'card', link: lid, board: f.board, sec: f.id, x: 0, y: 0, w: Math.min(w, f.cols), h };
  S.loc[lid] = id;
  placeIntoSec([id], f.id); relayout(f.board, [f.id]);
  if (f.board !== V) { const cv = coverOf(f.board); if (cv) cv.peekV = (cv.peekV || 0) + 1; relayout(V); }
  sync(false);
  const n = nodes.get(id);
  if (n) { n.el.classList.add('born'); setTimeout(() => n.el.classList.remove('born'), 600); reveal({ x: n.tx, y: n.ty, w: n.tw, h: n.th }, cam.z); flashCard(id); }
  else toast(`已放进「${f.name}」`, '查看', () => revealLink(lid));
}
/* a link that changed after it was placed (its page was read, its picture arrived): redraw where it shows */
export function refreshLink(lid: string) {
  for (const n of nodes.values()) if (n.b.link === lid || (n.b.rows || []).includes(lid)) n.key = '';
  bump(); sync(false);
}
export function placeNear(ids: string[]) {
  measure();
  const gx = Math.round(((SR.width / 2 - cam.x) / cam.z) / U) - 1, gy = Math.round(((SR.height / 2 - cam.y) / cam.z) / U) - 1;
  const lay = layoutFrom(S, null, { noSettle: true }), ob = [...lay.frames.map(fRect), ...lay.loose.filter(b => !ids.includes(b.id)).map(cRect)];
  for (const id of ids) { const b = S.blocks[id], s = freeCardSpot(gx, gy, b.w, b.h, ob); Object.assign(b, { board: V, sec: null, x: s.x, y: s.y }); ob.push(cRect(b)); }
}
/* a link saved straight onto the board, or dropped from another tab: into the Section under the point, else loose beside it */
export function placeLinkAt(lid: string, cx?: number, cy?: number) {
  const l = LK[lid]; if (!l) return;
  measure();
  const p = cx == null || cy == null ? { x: (SR.width / 2 - cam.x) / cam.z, y: (SR.height / 2 - cam.y) / cam.z } : wpt({ clientX: cx, clientY: cy });
  const lay = layoutFrom(S, null, { noSettle: true });
  const f = lay.frames.find(f => f.type === 'sec' && !isCap(f) && (r => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)(fRect(f)));
  if (f) { S.inbox = S.inbox.filter(x => x !== lid); return saveLinkTo(lid, f.id); }
  pushUndo();
  const id = newCardFor(l), b = S.blocks[id];
  const s = freeCardSpot(Math.round(p.x / U - b.w / 2), Math.round(p.y / U - b.h / 2), b.w, b.h, [...lay.frames.map(fRect), ...lay.loose.map(cRect)]);
  Object.assign(b, { x: s.x, y: s.y }); S.loc[lid] = id; S.inbox = S.inbox.filter(x => x !== lid);
  bump(); sync(false);
  const n = nodes.get(id);
  if (n) { n.el.classList.add('born'); setTimeout(() => n.el.classList.remove('born'), 600); reveal({ x: n.tx, y: n.ty, w: n.tw, h: n.th }, cam.z); }
}
/* what is under a point while something is dragged in from outside, so the Section can show it will take it */
export function dropHint(cx: number, cy: number) {
  measure(); const p = wpt({ clientX: cx, clientY: cy });
  let hit: string | null = null;
  for (const n of fnodes.values()) { const r = fRect(n.f); if (n.f.type === 'sec' && !isCap(n.f) && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) hit = n.f.id; }
  for (const n of fnodes.values()) n.el.classList.toggle('drop', n.f.id === hit);
}
export function inboxToBoard(lid: string) {
  const l = LK[lid]; if (!l) return;
  pushUndo(); const b = newCardFor(l); placeNear([b]); S.inbox = S.inbox.filter(x => x !== lid); S.loc[lid] = b; bump(); sync(false); flashCard(b);
}
export function deleteInbox(lid: string) {
  pushUndo(); S.inbox = S.inbox.filter(x => x !== lid); S.loc[lid] = 'del'; bump(); sync(false); toast('已删除', '撤销', undo);
}
export function setUnimp(lid: string, on: boolean) {
  if (on) { S.unimp[lid] = 1; delete S.keep[lid]; } else { S.keep[lid] = 1; delete S.unimp[lid]; }
  bump(); sync(false);
}
function frameSpotNear(f: Partial<Frame>) {
  measure();
  const cx = (SR.width / 2 - cam.x) / cam.z, cy = (SR.height / 2 - cam.y) / cam.z;
  const gx0 = Math.round(cx / U - (f.cols || 4) / 2), gy0 = Math.round(cy / U - 1);
  const ob = [...LAY.frames.map(fRect), ...LAY.loose.map(cRect)];
  for (let r = 0; r < 14; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
    const g = { gx: gx0 + i, gy: gy0 + j }; if (!ob.some(o => collide(fRect({ ...(f as Frame), ...g }), o))) return g;
  }
  return { gx: gx0, gy: gy0 };
}

/* ================= creating ================= */
export function newFrame(type: Frame['type']) {
  pushUndo();
  const o: Partial<Frame> = { type, board: V, name: '未命名', cols: 4, rows: type === 'sec' ? 1 : 2, collapsed: false };
  if (type === 'smart') { o.rule = { type: 'kw', v: '' }; o.auto = true; o.foot = true; }
  if (type === 'cover') { o.target = mkBoard('未命名', V); }
  Object.assign(o, frameSpotNear(o));
  const id = mkFrame(o); bump(); sync(false);
  const n = fnodes.get(id); if (n) n.el.animate([{ opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
  const r = fRect(S.frames[id]); reveal(r, Math.min(cam.z, 1));
  setTimeout(() => (type === 'smart' ? openRuleEditor(id, fnodes.get(id)?.el.querySelector('.rule') || null) : renameFrame(id)), 120);
}
export function newNote() {
  pushUndo();
  const id = uid('n'); S.blocks[id] = { id, kind: 'note', board: V, sec: null, x: 0, y: 0, w: 2, h: 1, text: '' };
  placeNear([id]); bump(); sync(false);
  const n = nodes.get(id); if (n) n.el.classList.add('born');
  setTimeout(() => editNote(id), 80);
}

/* ================= editing in place ================= */
export function renameFrame(fid: string) {
  const n = fnodes.get(fid); if (!n) return;
  const b = n.el.querySelector('.lbl b') as HTMLElement, f = S.frames[fid], old = f.name;
  b.contentEditable = 'true'; b.spellcheck = false; b.focus();
  const rg = document.createRange(); rg.selectNodeContents(b); const s = getSelection()!; s.removeAllRanges(); s.addRange(rg);
  const end = (ok: boolean) => {
    b.removeEventListener('keydown', kd); b.removeEventListener('blur', bl); b.contentEditable = 'false';
    const v = (b.textContent || '').trim();
    if (ok && v && v !== old) { pushUndo(); f.name = v; f.auto = false; if (f.type === 'cover' && S.boards[f.target!]) S.boards[f.target!].name = v; bump(); renderCrumbs(); }
    else b.textContent = old;
    n.key = ''; sync(false);
  };
  const kd = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); end(true); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); } };
  const bl = () => end(true);
  b.addEventListener('keydown', kd); b.addEventListener('blur', bl);
}
function editNote(id: string) {
  const n = nodes.get(id), b = S.blocks[id]; if (!n || !b || b.items) return;
  const el = n.el.querySelector('.fit') as HTMLElement | null; if (!el) return;
  el.contentEditable = 'plaintext-only'; if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  el.focus();
  const rg = document.createRange(); rg.selectNodeContents(el); rg.collapse(false); const s = getSelection()!; s.removeAllRanges(); s.addRange(rg);
  const end = () => {
    el.removeEventListener('blur', end); el.removeEventListener('keydown', kd); el.contentEditable = 'false';
    const v = el.innerText.trim();
    if (v !== (b.text || '')) { pushUndo(); b.text = v; bump(); }
    if (!v) { delete S.blocks[id]; bump(); }
    n.key = ''; sync(false);
  };
  const kd = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); el.blur(); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); el.blur(); } };
  el.addEventListener('blur', end); el.addEventListener('keydown', kd);
}
export function toggleCollapse(fid: string) {
  const f = S.frames[fid]; if (!f || f.type === 'cover') return;
  pushUndo(); f.collapsed = !f.collapsed; bump();
  relayout(V, [fid]); sync(false);
}
function setCardSize(id: string, w: number, h: number) {
  const b = S.blocks[id]; if (!b || (b.w === w && b.h === h)) return;
  pushUndo(); commit(layoutFrom(S, { kind: 'cardsize', sec: b.sec, item: b, w, h })); sync(false);
}
function deleteBlocks(ids: string[]) {
  ids = ids.filter(id => S.blocks[id]); if (!ids.length) return;
  pushUndo(); const left = secsOf(ids);
  for (const id of ids) { const b = S.blocks[id]; linksOfBlock(b).forEach(l => (S.loc[l] = 'del')); delete S.blocks[id]; const n = nodes.get(id); if (n) vanish(n); }
  relayout(V, null, left); bump(); sync(false);
  toast(ids.length > 1 ? `已删除 ${ids.length} 张卡片` : '已删除', '撤销', undo);
}
function inboxBlocks(ids: string[]) {
  ids = ids.filter(id => S.blocks[id] && S.blocks[id].kind !== 'note'); if (!ids.length) return;
  pushUndo(); ids.forEach(id => { const n = nodes.get(id); if (n) vanish(n); }); toInbox(ids); sync(false);
}
function deleteFrame(fid: string) {
  const f = S.frames[fid]; if (!f) return;
  pushUndo();
  const out: string[] = [];
  const drain = (bid: string) => { for (const id in S.blocks) { const b = S.blocks[id]; if (b.board === bid) { out.push(...linksOfBlock(b)); delete S.blocks[id]; } } for (const x of framesOf(bid)) { if (x.type === 'cover') { drain(x.target!); delete S.boards[x.target!]; } delete S.frames[x.id]; } };
  if (f.type === 'cover') { drain(f.target!); delete S.boards[f.target!]; }
  else for (const b of blocksIn(fid)) { out.push(...linksOfBlock(b)); delete S.blocks[b.id]; }
  delete S.frames[fid];
  out.forEach(l => { S.loc[l] = 'inbox'; S.inbox.unshift(l); });
  const n = fnodes.get(fid); if (n) vanishFrame(n);
  bump(); sync(false);
  toast(out.length ? `${out.length} 条链接回到了 Inbox` : '已删除', '撤销', undo);
}
function unpackBoard(fid: string) {
  const f = S.frames[fid]; if (!f || f.type !== 'cover') return;
  pushUndo();
  const tb = f.target!, lay = layoutFrom(S, null, { view: tb, noSettle: true }), bb = contentBounds(lay);
  const dx = bb ? f.gx - Math.round((bb.x0 + PAD) / U) : 0, dy = bb ? f.gy - Math.round((bb.y0 + LBL + PAD) / U) : 0;
  const moved: string[] = [];
  for (const x of framesOf(tb)) { x.board = V; x.gx += dx; x.gy += dy; moved.push(x.id); }
  for (const id in S.blocks) { const b = S.blocks[id]; if (b.board === tb) { b.board = V; if (!b.sec) { b.x += dx; b.y += dy; moved.push(b.id); } } }
  delete S.frames[fid]; delete S.boards[tb];
  relayout(V, moved); sync(false);
  toast(`「${f.name}」已拆开`, '撤销', undo);
}
function promote(fid: string) {
  const f = S.frames[fid]; if (!f || f.type !== 'sec' || V !== S.home) return;
  pushUndo();
  const b = mkBoard(f.name, V);
  mkFrame({ type: 'cover', name: f.name, board: V, target: b, cols: Math.max(3, Math.min(f.cols, 5)), rows: 2, gx: f.gx, gy: f.gy });
  f.board = b; f.gx = 0; f.gy = 1; for (const x of blocksIn(fid)) x.board = b;
  relayout(V); bump(); sync(false);
  toast(`「${f.name}」变成了白板`, '撤销', undo);
}

/* ================= context menus ================= */
const sizeItem = (b: Block): MenuItem => {
  const open = openOf(b as any, LK), fr = b.sec && S.frames[b.sec], cols = fr ? fr.cols : 3;
  return { sizes: SIZES.filter(([w]) => w <= cols).filter(([w, h]) => open.includes(w + 'x' + h)).map(([w, h]) => ({ w, h, on: b.w === w && b.h === h })), fn: (w, h) => setCardSize(b.id, w, h) };
};
const CAP_STYLES: [string, string][] = [['list', '列表'], ['one', '一格']];
function cardMenu(n: Node, x: number, y: number) {
  const b = S.blocks[n.b.id] || n.b;
  if (b.proj) {
    const l = LK[b.link!];
    return openMenu(x, y, [{ t: '打开', ic: 'open', kbd: '↩', act: () => openLink(l) }, { t: '在原位置查看', ic: 'locate', act: () => revealLink(l.id) }]);
  }
  if (sel.size > 1 && sel.has(b.id)) {
    const ids = [...sel];
    return openMenu(x, y, [{ lab: `${ids.length} 张卡片` }, { t: '移到 Inbox', ic: 'inbox', act: () => inboxBlocks(ids) }, '-', { t: '删除', ic: 'trash', kbd: '⌫', danger: true, act: () => deleteBlocks(ids) }]);
  }
  sel.clear(); selF.clear(); sel.add(b.id); syncSel();
  const items: MenuItem[] = [];
  if (b.kind === 'card') items.push({ t: '打开', ic: 'open', kbd: '↩', act: () => openLink(LK[b.link!]) }, '-');
  if (b.kind === 'list') items.push({ t: '展开全部', ic: 'open', act: () => openListPop({ type: 'list', id: b.id }, n.el) }, '-');
  if (b.kind === 'note' && !b.items) items.push({ t: '编辑', ic: 'pen', act: () => editNote(b.id) }, '-');
  items.push({ lab: '大小' }, sizeItem(b));
  if (b.kind === 'list') items.push({ seg: '样式', opts: [['a', '列表'], ['c', '缩略图']], cur: b.style || 'a', fn: v => { pushUndo(); b.style = v as 'a' | 'c'; const op = openOf(b as any, LK); if (!op.includes(b.w + 'x' + b.h)) { const [w, h] = snapSize(op, b.w, b.h)!; commit(layoutFrom(S, { kind: 'cardsize', sec: b.sec, item: b, w, h })); } bump(); sync(false); } });
  if (hasBrand(b as any, LK)) items.push({ seg: '颜色', opts: [['', '白色'], ['brand', '品牌色']], cur: b.tint || '', fn: v => { pushUndo(); b.tint = (v || undefined) as 'brand' | undefined; if (!b.tint) delete b.tint; bump(); sync(false); } });
  items.push('-');
  if (b.kind !== 'note') items.push({ t: '移到 Inbox', ic: 'inbox', act: () => inboxBlocks([b.id]) });
  items.push({ t: '删除', ic: 'trash', kbd: '⌫', danger: true, act: () => deleteBlocks([b.id]) });
  openMenu(x, y, items);
}
function frameMenu(n: FNode, x: number, y: number, anchor?: Element) {
  const f = S.frames[n.f.id]; if (!f) return;
  sel.clear(); selF.clear(); selF.add(f.id); syncSel();
  if (f.type === 'cover') return openMenu(x, y, [
    { t: '打开', ic: 'open', kbd: '↩', act: () => enterBoard(f.id) },
    { t: '重命名', ic: 'pen', act: () => renameFrame(f.id) },
    { t: '拆开白板', ic: 'split', act: () => unpackBoard(f.id) },
    '-', { t: '删除白板', ic: 'trash', danger: true, act: () => deleteFrame(f.id) }], anchor);
  openMenu(x, y, [
    f.type === 'smart' ? { t: '编辑规则', ic: 'smart', act: () => openRuleEditor(f.id, fnodes.get(f.id)?.el.querySelector('.rule') || null) } : null,
    { t: '重命名', ic: 'pen', act: () => renameFrame(f.id) },
    { t: f.collapsed ? '展开' : '折叠', ic: f.collapsed ? 'unfold' : 'fold', act: () => toggleCollapse(f.id) },
    { seg: '折叠后', opts: CAP_STYLES, cur: f.capStyle || 'list', fn: v => { pushUndo(); if (v === 'list') delete f.capStyle; else f.capStyle = 'one'; bump(); relayout(V, [f.id]); sync(false); } },
    f.type === 'sec' && V === S.home ? { t: '变成白板', ic: 'board', act: () => promote(f.id) } : null,
    '-', { t: '删除分组', ic: 'trash', danger: true, act: () => deleteFrame(f.id) }], anchor);
}
export const createItems = (onLink: () => void): MenuItem[] => [
  { t: '链接', ic: 'link', kbd: '⌘V', act: onLink },
  { t: '便签', ic: 'note', act: newNote },
  '-',
  { t: '分组', ic: 'sec', act: () => newFrame('sec') },
  { t: '智能分组', ic: 'smart', act: () => newFrame('smart') },
  V === S.home ? { t: '白板', ic: 'board', act: () => newFrame('cover') } : null,
];
let onPasteLink: (text?: string) => void = () => {};
function canvasMenu(x: number, y: number) {
  openMenu(x, y, [...createItems(() => onPasteLink()), '-', { t: '显示全部', ic: 'fit', kbd: '⌘0', act: () => fitAll() }]);
}

/* ================= keyboard ================= */
export const isFs = () => !!document.fullscreenElement;
export function toggleFs() {
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  document.documentElement.requestFullscreen?.().catch(() => toast('这里不能全屏'));
}
let closeSheetFn: (save: boolean) => void = () => {};
let sheetEnterFn: () => void = () => {};
function onKey(e: KeyboardEvent) {
  const tEl = e.target as HTMLElement;
  const editing = tEl.closest && tEl.closest('input,textarea,[contenteditable="true"],[contenteditable="plaintext-only"]');
  const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
  if (e.key === 'Escape') {
    if (drag) { cancelDrag(); return; }
    if (paletteOpen()) { setPaletteOpen(false); return; }
    if (menu()) { closeMenus(); return; }
    if (pop()) { closePop(); return; }
    if (sheet()) { closeSheetFn(false); return; }
    if (editing) { tEl.blur(); return; }
    if (sel.size || selF.size) { clearSel(); return; }
    if (inboxOpen()) { setInboxOpen(false); return; }
    if (mapOpen()) { setMapOpen(false); return; }
    if (V !== S.home) exitBoard();
    return;
  }
  if (mod && k === 'k') { e.preventDefault(); setPaletteOpen(!paletteOpen()); return; }
  if (editing || paletteOpen()) return;
  if (sheet() && e.key === 'Enter') { e.preventDefault(); sheetEnterFn(); return; }
  if (e.ctrlKey && e.metaKey && k === 'f') { e.preventDefault(); toggleFs(); return; }
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomStep(1); return; }
  if (mod && e.key === '-') { e.preventDefault(); zoomStep(-1); return; }
  if (mod && e.key === '0') { e.preventDefault(); fitAll(); return; }
  if (mod && e.key === 'ArrowUp') { e.preventDefault(); exitBoard(); return; }
  if (mod && k === 'a') { e.preventDefault(); sel.clear(); selF.clear(); for (const n of nodes.values()) if (!n.b.proj) sel.add(n.b.id); syncSel(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel.size) { e.preventDefault(); deleteBlocks([...sel]); return; }
  if (e.key === 'Enter') {
    if (selF.size === 1) { const f = S.frames[[...selF][0]]; if (f && f.type === 'cover') { e.preventDefault(); enterBoard(f.id); } else if (f) { e.preventDefault(); renameFrame(f.id); } return; }
    if (sel.size === 1) { const b = S.blocks[[...sel][0]]; if (b && b.kind === 'card') openLink(LK[b.link!]); else if (b && b.kind === 'note') editNote(b.id); }
  }
}

/* ================= start ================= */
export interface Hooks { pasteLink: (text?: string) => void; closeSheet: (silent: boolean) => void; sheetEnter: () => void }
export function mount(el: { app: HTMLElement; stage: HTMLElement; world: HTMLElement; secs: HTMLElement; cards: HTMLElement; ph: HTMLElement; dots: HTMLElement }, hooks: Hooks) {
  app = el.app; stage = el.stage; world = el.world; secLayer = el.secs; cardLayer = el.cards; ph = el.ph; dotsEl = el.dots;
  onPasteLink = hooks.pasteLink; closeSheetFn = hooks.closeSheet; sheetEnterFn = hooks.sheetEnter;
  measure();
  stage.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  document.addEventListener('touchmove', e => { if (drag || pinch || rsz) e.preventDefault(); }, { passive: false });
  addEventListener('blur', () => { if (drag) cancelDrag(); });
  stage.addEventListener('wheel', onWheel, { passive: false });
  stage.addEventListener('contextmenu', e => {
    e.preventDefault(); if (drag || morphing) return;
    const t = e.target as HTMLElement, c = t.closest('.card') as HTMLElement | null, f = t.closest('.sec') as HTMLElement | null;
    if (c) { const n = nodes.get(c.dataset.id!); if (n) return cardMenu(n, e.clientX, e.clientY); }
    if (f) { const n = fnodes.get(f.dataset.id!); if (n) return frameMenu(n, e.clientX, e.clientY); }
    canvasMenu(e.clientX, e.clientY);
  });
  app.addEventListener('contextmenu', e => { if (!(e.target as HTMLElement).closest('input,[contenteditable="true"]')) e.preventDefault(); });
  stage.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const sm = t.closest('.lbl .sm'); if (sm) { const n = fnodes.get((sm.closest('.sec') as HTMLElement).dataset.id!); if (n) frameMenu(n, 0, 0, sm); return; }
    const rl = t.closest('.rule'); if (rl) { const fid = (rl.closest('.sec') as HTMLElement).dataset.id!; const cur = pop(); if (cur && cur.kind === 'rule' && cur.fid === fid) closePop(); else openRuleEditor(fid, rl); return; }
    const ch = t.closest('.capb .chev,.lbl .fd'); if (ch) { toggleCollapse((ch.closest('.sec') as HTMLElement).dataset.id!); return; }
    const ft = t.closest('.foot') as HTMLElement | null; if (ft) { const fid = (ft.closest('.sec') as HTMLElement).dataset.id!; openListPop(ft.dataset.foot === 'fold' ? { type: 'fold', fid } : { type: 'smart', fid }, ft); }
  });
  stage.addEventListener('dblclick', e => {
    const t = e.target as HTMLElement;
    const lb = t.closest('.lbl b'); if (lb) { renameFrame((lb.closest('.sec') as HTMLElement).dataset.id!); return; }
    const c = t.closest('.card') as HTMLElement | null; if (!c) return;
    const n = nodes.get(c.dataset.id!); if (!n) return;
    if (n.b.kind === 'note') editNote(n.b.id);
    else if (n.b.kind === 'card' && !t.closest('[data-open]')) openLink(LK[n.b.link!]);
  });
  addEventListener('keydown', onKey);
  document.addEventListener('paste', e => {
    const t = e.target as HTMLElement;
    if (t.closest && t.closest('input,[contenteditable="true"],[contenteditable="plaintext-only"]')) return;
    const text = (e.clipboardData && e.clipboardData.getData('text') || '').trim();
    if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(text)) { e.preventDefault(); onPasteLink(text); }
  });
  document.addEventListener('dragstart', e => e.preventDefault());
  addEventListener('resize', measure);
  document.addEventListener('fullscreenchange', () => setTimeout(measure, 60));
}
/* show the current model: first load, or after another device changed it */
export function show(opts: { fit?: boolean } = {}) {
  if (drag) cancelDrag();
  if (!S.boards[V]) setV(S.home);
  measure();
  rebuildView(); renderCrumbs();
  if (opts.fit) {
    const c = S.cams[V];
    Object.assign(cam, c && isFinite(c.z) ? c : fitCam(LAY));
    applyCam();
    for (const el of [secLayer, cardLayer]) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  }
}
export { V as view };
