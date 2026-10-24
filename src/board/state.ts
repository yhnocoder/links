/* The board model and its layout rules. No DOM here: everything is plain data, so it can be tested and synced.
   Ported from the full-product hi-fi; the feel of every rule (make room, settle, snap) is kept as tuned there. */
import type { Rule } from '../../shared/types';
import { siteName, titleOf, type L } from '../cards/render';

/* one lattice for everything: an 84px cell + 6px gap. Loose cards sit on it, Section cells sit on it. */
export const GAP = 6, U = 84 + GAP, PAD = GAP, LBL = 34, FOOT = 40;
/* Sections keep their own spacing: they are not on the card grid, only the cards inside them are */
export const SG = 32;
export const P = (n: number) => n * U - GAP;
export const COLD = 90;
export const MAXC = 8, MAXR = 6;
/* a folded Section: two columns of named rows (default), or one grid row of real cards */
export const capH = (f: Frame) => (f.capStyle === 'one' ? 84 + 2 * PAD : 16 + 3 * 28);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface Board { id: string; name: string; parent: string | null }
export interface Frame {
  id: string; type: 'sec' | 'smart' | 'cover'; board: string; name: string; gx: number; gy: number; cols: number; rows: number; collapsed: boolean;
  capStyle?: 'one'; rule?: Rule; target?: string; auto?: boolean;
  /* computed while laying out, never stored */
  foot?: boolean; nfold?: number; peekV?: number;
}
export interface Block {
  id: string; kind: 'card' | 'list' | 'note'; board: string; sec: string | null; x: number; y: number; w: number; h: number;
  link?: string; rows?: string[]; title?: string; style?: 'a' | 'c'; tint?: 'brand'; text?: string; items?: [string, number][]; fold?: boolean; proj?: string;
}
export interface Cam { x: number; y: number; z: number }
export interface State {
  home: string;
  boards: Record<string, Board>;
  frames: Record<string, Frame>;
  blocks: Record<string, Block>;
  /* where each link is: a block id, 'inbox' or 'del' */
  loc: Record<string, string>;
  inbox: string[]; // newest first
  unimp: Record<string, 1>;
  keep: Record<string, 1>;
  cams: Record<string, Cam>;
}

export let S: State = null as unknown as State;
export let LK: Record<string, L> = {};
export let V = 'home';
export let ver = 0;
export const setState = (s: State, lk: Record<string, L>) => { S = s; LK = lk; ver++; };
export const setView = (v: string) => { V = v; };
export const bump = () => { ver++; };

export const emptyState = (): State => ({ home: 'home', boards: { home: { id: 'home', name: '首页', parent: null } }, frames: {}, blocks: {}, loc: {}, inbox: [], unimp: {}, keep: {}, cams: {} });

/* ids are random so two devices never mint the same one */
export const uid = (p: string) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 9);

/* ---------- time ---------- */
export const idle = (l: L) => (l.opened >= 0 ? l.opened : l.added);
export const heat = (l: L) => { const d = idle(l) - Math.min(l.clicks, 20) * 0.6; return d < 10 ? 'hot' : d < 40 ? 'warm' : d < 120 ? 'cool' : 'cold'; };
/* Linda: unimportant = in Inbox, never placed, not opened for a long time */
export const unimportant = (l: L) => l.added > 45 && (l.opened < 0 || l.opened > 60);
export const ago = (d: number) => (d < 1 ? '今天' : d < 2 ? '昨天' : d < 7 ? `${d} 天前` : d < 30 ? `${Math.floor(d / 7)} 周前` : d < 365 ? `${Math.floor(d / 30)} 个月前` : `${Math.floor(d / 365)} 年前`);
export const bucket = (d: number) => (d < 1 ? '今天' : d < 2 ? '昨天' : d < 7 ? '本周' : d < 30 ? '本月' : d < 365 ? `${Math.floor(d / 30)} 个月前` : `${Math.floor(d / 365)} 年前`);
export const cold = (l: L) => idle(l) >= COLD;
export const score = (l: L) => idle(l) - Math.min(l.clicks, 20) * 0.6;
export const isUnimp = (id: string) => { const l = LK[id]; return !!l && !S.keep[id] && (!!S.unimp[id] || unimportant(l)); };

/* the size a new card starts at: pictures get room, plain pages stay small */
export function sizeOf(l: L): [number, number] {
  if (l.state) return [2, 1];
  switch (l.k) {
    case 'yt': case 'bili': return l.img ? [2, 2] : [2, 1];
    case 'xhs': return l.img ? [2, 2] : [2, 1];
    case 'web': return l.img ? [2, 2] : [2, 1];
    case 'gh': return [2, 1];
    case 'ghpr': return [3, 1];
    case 'paper': return [2, 1];
    case 'chat': return [2, 1];
  }
  return [2, 1];
}

export function mkBoard(name: string, parent: string | null) { const id = uid('b'); S.boards[id] = { id, name, parent }; return id; }
export function mkFrame(o: Partial<Frame>) { const id = uid('f'); S.frames[id] = { id, type: 'sec', board: V, name: '', cols: 4, rows: 2, gx: 0, gy: 0, collapsed: false, ...o } as Frame; return id; }

export const groupBy = <T, K>(arr: T[], f: (x: T) => K): [K, T[]][] => { const m = new Map<K, T[]>(); arr.forEach(x => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); }); return [...m].sort((a, b) => b[1].length - a[1].length); };

/* ================= geometry ================= */
export type Rect = { t: 'f' | 'c'; id: string; x: number; y: number; w: number; h: number; dx?: number; dy?: number };
export const isCap = (f: Frame) => f.type === 'cover' || (f.collapsed && (f.type as string) !== 'cover');
export function frameH(f: Frame) {
  if (f.type === 'cover') return f.rows * U + LBL + 2 * PAD - GAP;
  if (f.collapsed) return LBL + capH(f);
  return f.rows * U + LBL + 2 * PAD - GAP + (f.foot ? FOOT : 0);
}
export const fRect = (f: Frame): Rect => ({ t: 'f', id: f.id, x: f.gx * U - PAD, y: f.gy * U - LBL - PAD, w: f.cols * U + 2 * PAD - GAP, h: frameH(f) });
export const cRect = (b: { id: string; x: number; y: number; w: number; h: number }): Rect => ({ t: 'c', id: b.id, x: b.x * U, y: b.y * U, w: P(b.w), h: P(b.h) });
export const gapOf = (a: { t: string }, b: { t: string }) => (a.t === 'c' && b.t === 'c' ? 0 : SG);
export function collide(a: Rect, b: Rect) {
  const m = gapOf(a, b) - 0.5;
  return a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
}
type Box = { x: number; y: number; w: number; h: number };
export const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const byPos = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x;
export const rowsOf = (list: { y: number; h: number }[]) => list.reduce((m, b) => Math.max(m, b.y + b.h), 0);

/* pull every Section left, then up, until it sits exactly one Section gap from what is beside or above it.
   Loose cards stay on their grid cells and only act as walls. */
export function tighten(rects: Rect[]) {
  for (const [a, as, b, bs] of [['x', 'w', 'y', 'h'], ['y', 'h', 'x', 'w']] as const) {
    const lo = Math.min(...rects.map(r => r[a])), done: Rect[] = [];
    for (const r of rects.slice().sort((p, q) => p[a] - q[a] || p[b] - q[b])) {
      if (r.t === 'f') {
        let v = lo;
        for (const q of done) { const m = gapOf(r, q); if (r[b] < q[b] + q[bs] + m && q[b] < r[b] + r[bs] + m) v = Math.max(v, q[a] + q[as] + m); }
        r[a] = Math.round(v);
      }
      done.push(r);
    }
  }
}
export function respace(bid: string) {
  const lay = layoutFrom(S, null, { view: bid, noSettle: true }); commit(lay);
  const rects = [...lay.frames.map(fRect), ...lay.loose.map(cRect)];
  tighten(rects);
  for (const r of rects) if (r.t === 'f') { const f = S.frames[r.id]; f.gx = (r.x + PAD) / U; f.gy = (r.y + LBL + PAD) / U; }
  relayout(bid);
}

/* ================= layout: one board, optionally with something held ================= */
export const cfg = { hyst: 0.12 };
type Item = Block & { [k: string]: any };
/* rebuild a Section from its committed layout with `forced` placed at x,y. Starting from the committed one every time
   means moving the hand back puts everything back. */
export function resolve(L0: Item[], cols: number, forced: any, pinned: string[] = [], compact = true): Item[] {
  const list = L0.map(o => ({ ...o }));
  let d: Item | null = null, origin: Box | null = null;
  if (forced) {
    d = list.find(i => i.id === forced.id) || null;
    if (d) origin = { x: d.x, y: d.y, w: d.w, h: d.h }; else { d = { ...forced.item }; list.push(d!); }
    d!.x = forced.x; d!.y = forced.y; d!.w = forced.w; d!.h = forced.h;
  }
  for (const it of list) { it.w = clamp(it.w, 1, cols); it.x = clamp(it.x, 0, cols - it.w); it.y = Math.max(0, it.y); it.h = Math.max(1, it.h); }
  const pin = new Set(pinned);
  const placed: Item[] = (d ? [d] : []).concat(list.filter(i => i !== d && pin.has(i.id)));
  const others = list.filter(i => i !== d && !pin.has(i.id)).sort(byPos);
  const movingDown = d && origin && d.y > origin.y;
  for (const it of others) {
    let hits = placed.filter(p => hit(it, p));
    if (hits.length) {
      let done = false;
      if (d && hits.includes(d) && origin) {
        if (it.w <= origin.w && it.h <= origin.h) {
          outer: for (let yy = origin.y; yy + it.h <= origin.y + origin.h; yy++) for (let xx = origin.x; xx + it.w <= origin.x + origin.w; xx++) {
            const c = { x: xx, y: yy, w: it.w, h: it.h };
            if (!placed.some(p => hit(c, p))) { it.x = xx; it.y = yy; done = true; break outer; }
          }
        }
        if (!done && movingDown) {
          const c = { x: it.x, y: Math.max(0, d.y - it.h), w: it.w, h: it.h };
          if (c.y + c.h <= d.y && !placed.some(p => hit(c, p))) { it.y = c.y; done = true; }
        }
      }
      let guard = 0;
      while (!done && hits.length && guard++ < 300) { it.y = Math.max(...hits.map(p => p.y + p.h)); hits = placed.filter(p => hit(it, p)); }
    }
    placed.push(it);
  }
  if (compact) {
    /* reading-order flow: every card takes the earliest free cell, so the hole a card leaves closes up.
       Only run where a card left; the card in hand, and anything placed by hand, stays put. */
    const occ = new Map<number, number>(), free = (x: number, y: number, w: number, h: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (occ.get(j * 64 + i)) return false; return true; };
    const mark = (it: Item, v: number) => { for (let j = it.y; j < it.y + it.h; j++) for (let i = it.x; i < it.x + it.w; i++) occ.set(j * 64 + i, (occ.get(j * 64 + i) || 0) + v); };
    list.forEach(it => mark(it, 1));
    for (const it of list.slice().sort(byPos)) {
      if (it === d || pin.has(it.id)) continue;
      mark(it, -1);
      search: for (let y = 0; y <= it.y; y++) for (let x = 0; x + it.w <= cols; x++) {
        if (y === it.y && x >= it.x) break search;
        if (free(x, y, it.w, it.h)) { it.x = x; it.y = y; break search; }
      }
      mark(it, 1);
    }
  }
  return list;
}
export function firstFree(list: Box[], cols: number, w: number, h: number) {
  for (let y = 0; y < 999; y++) for (let x = 0; x + w <= cols; x++) { const c = { x, y, w, h }; if (!list.some(p => hit(c, p))) return { x, y }; }
  return { x: 0, y: rowsOf(list) };
}
/* nothing ever overlaps: whatever grew pushes what is under it down, row by row. Nothing is pulled up. */
export function settle(rects: Rect[], fixed?: Set<string>) {
  const F = new Set(fixed || []);
  const placed = rects.filter(r => F.has(r.id));
  for (const r of rects.filter(r => !F.has(r.id)).sort(byPos)) {
    let g = 0;
    if (r.t === 'f') { const y0 = r.y; pastAll(r, placed, 'y', 1); r.dy = (r.y - y0) / U; }
    else while (placed.some(p => collide(r, p)) && g++ < 400) { r.y += U; r.dy = (r.dy || 0) + 1; }
    placed.push(r);
  }
}
/* move a Section along one axis until it clears everything in `placed`, stopping exactly one gap past each */
export function pastAll(r: Rect, placed: Rect[], ax: 'x' | 'y', dir: number, limit = Infinity) {
  const s = ax === 'x' ? 'w' : 'h', from = r[ax];
  for (let g = 0; g < 60; g++) {
    const hits = placed.filter(p => p !== r && collide(r, p)); if (!hits.length) return true;
    r[ax] = dir > 0 ? Math.max(...hits.map(p => p[ax] + p[s] + gapOf(r, p))) : Math.min(...hits.map(p => p[ax] - gapOf(r, p) - r[s]));
    if (Math.abs(r[ax] - from) > limit) { r[ax] = from; return false; }
  }
  return false;
}

/* a moved Section asks its neighbours to step aside, the way cards do inside a Section:
   whatever it lands on first tries the space it left, then (when it moves down) hops above it, else is pushed down; pushes cascade */
export function makeRoom(rects: Rect[], dId: string, origin: Rect) {
  const D = rects.find(r => r.id === dId); if (!D) return;
  const placed = [D], down = origin && D.y > origin.y, tol = 14;
  const clear = (c: Rect) => !placed.some(p => collide(c, p));
  for (const r of rects.filter(r => r !== D).sort(byPos)) {
    if (!placed.some(p => collide(r, p))) { placed.push(r); continue; }
    if (r.t === 'f') { roomFor(r, D, placed, origin, down); placed.push(r); continue; }
    let ok = false;
    if (origin && Math.abs(r.y - origin.y) < U * 2) {
      /* a neighbour in the row it left slides toward the gap, like a list making room */
      const dir = origin.x + origin.w / 2 >= r.x + r.w / 2 ? 1 : -1, hits = placed.filter(p => collide(r, p));
      const lim = Math.ceil((Math.max(...hits.map(h => h.w)) + r.w) / U) + 1;
      for (let k = 1; k <= lim && !ok; k++) {
        const c = { ...r, x: r.x + dir * k * U };
        if (clear(c)) { r.dx = (r.dx || 0) + dir * k; r.x = c.x; ok = true; }
      }
    }
    if (!ok && origin && collide(r, D)) {
      const ox = Math.round((origin.x - r.x) / U), oy = Math.round((origin.y - r.y) / U);
      for (let j = 0; j < 14 && !ok; j++) for (let i = 0; i < 14 && !ok; i++) {
        const c = { ...r, x: r.x + (ox + i) * U, y: r.y + (oy + j) * U };
        if (c.x + c.w > origin.x + origin.w + tol || c.y > origin.y + origin.h - U) continue;
        if (clear(c)) { r.dx = (r.dx || 0) + ox + i; r.dy = (r.dy || 0) + oy + j; r.x = c.x; r.y = c.y; ok = true; }
      }
      if (!ok && down && r.y >= origin.y) {
        const c = { ...r }; let k = 0;
        while (collide(c, D) && k < 40) { c.y -= U; k++; }
        if (!collide(c, D) && clear(c) && c.y + c.h <= D.y + D.h) { r.dy = (r.dy || 0) - k; r.y = c.y; ok = true; }
      }
    }
    let g = 0;
    while (!ok && placed.some(p => collide(r, p)) && g++ < 400) { r.y += U; r.dy = (r.dy || 0) + 1; }
    placed.push(r);
  }
}
function roomFor(r: Rect, D: Rect, placed: Rect[], origin: Rect, down: boolean) {
  const x0 = r.x, y0 = r.y, clear = (c: Rect) => !placed.some(p => collide(c, p)), done = () => { r.dx = (r.x - x0) / U; r.dy = (r.y - y0) / U; };
  /* a neighbour in the row it left slides toward the gap, like a list making room */
  if (origin && Math.abs(r.y - origin.y) < U * 2) {
    const dir = origin.x + origin.w / 2 >= r.x + r.w / 2 ? 1 : -1, c = { ...r };
    if (pastAll(c, placed, 'x', dir, r.w + D.w + 2 * SG)) { r.x = c.x; return done(); }
  }
  if (origin && collide(r, D)) {
    /* it takes the space the moved Section left, when it fits there */
    const c = { ...r, x: origin.x, y: origin.y };
    if (c.w <= origin.w + 14 && clear(c)) { r.x = c.x; r.y = c.y; return done(); }
    /* when the moved Section goes down, what it lands on hops above it */
    if (down && r.y >= origin.y) { const c2 = { ...r, y: D.y - gapOf(r, D) - r.h }; if (clear(c2)) { r.y = c2.y; return done(); } }
  }
  pastAll(r, placed, 'y', 1); done();
}

export interface Layout { view: string; frames: Frame[]; lists: Map<string, Item[]>; loose: Item[] }
export function layoutFrom(base: State, f: any, o: { view?: string; noSettle?: boolean; fixed?: string[] | Set<string> | null; compact?: Set<string> | null } = {}): Layout {
  const vb = o.view || V;
  const frames: Frame[] = [], lists = new Map<string, Item[]>(), loose: Item[] = [], fold = new Map<string, number>();
  for (const id in base.frames) { const x = base.frames[id]; if (x.board === vb) { frames.push({ ...x }); lists.set(id, []); fold.set(id, 0); } }
  for (const id in base.blocks) {
    const b = base.blocks[id]; if (b.board !== vb) continue;
    if (b.sec) { if (!lists.has(b.sec)) continue; if (b.fold) { fold.set(b.sec, fold.get(b.sec)! + 1); continue; } lists.get(b.sec)!.push({ ...b }); }
    else loose.push({ ...b });
  }
  const done = new Set<string>(), fixed = new Set<string>(o.fixed || []);
  const byId = (id: string) => frames.find(x => x.id === id)!;
  let baseRows: Map<string, number> | null = null;
  if (f && f.kind === 'card') {
    baseRows = new Map(frames.map(x => [x.id, x.type === 'sec' ? Math.max(1, rowsOf(lists.get(x.id)!)) : x.rows]));
    const movers = [f.item, ...(f.group || [])], ids = new Set(movers.map((m: Item) => m.id));
    for (const [sid, L] of lists) {
      const keep = L.filter(b => !ids.has(b.id) || (b.id === f.item.id && f.tgt.type === 'sec' && sid === f.tgt.id));
      if (keep.length !== L.length) { const fr = byId(sid); lists.set(sid, resolve(keep, fr.cols, null, [], !f.hold)); if (!(f.tgt.type === 'sec' && sid === f.tgt.id)) done.add(sid); }
    }
    for (let i = loose.length - 1; i >= 0; i--) if (ids.has(loose[i].id)) loose.splice(i, 1);
    if (f.tgt.type === 'sec') {
      const fr = byId(f.tgt.id), cols = fr.cols;
      let list = resolve(lists.get(fr.id)!, cols, { id: f.item.id, item: { ...f.item, sec: fr.id }, x: f.x, y: f.y, w: Math.min(f.w, cols), h: f.h }, [], false);
      const lead = list.find(b => b.id === f.item.id)!, pinned = [lead.id];
      for (const g of f.group || []) {
        const w = Math.min(g.w, cols), same = g.sec === f.item.sec && g.board === f.item.board;
        const x = clamp(same ? lead.x + (g.x - f.item.x) : lead.x, 0, cols - w), y = Math.max(0, same ? lead.y + (g.y - f.item.y) : lead.y + lead.h);
        list = resolve(list, cols, { id: g.id, item: { ...g, sec: fr.id }, x, y, w, h: g.h }, pinned, false);
        pinned.push(g.id);
      }
      list.forEach(b => { b.sec = fr.id; b.board = vb; });
      lists.set(fr.id, list); done.add(fr.id); fixed.add(fr.id);
    } else if (f.tgt.type === 'canvas') {
      loose.push({ ...f.item, sec: null, board: vb, x: f.x, y: f.y, w: f.w, h: f.h });
      (f.group || []).forEach((g: Item, i: number) => { const s = f.spots[i]; if (s) loose.push({ ...g, sec: null, board: vb, x: s.x, y: s.y }); });
      fixed.add(f.item.id);
    }
  }
  let room: { id: string; origin: Rect } | null = null;
  if (f && f.kind === 'frame') {
    const fr = byId(f.id);
    if (f.room) room = { id: fr.id, origin: fRect(fr) };
    if (f.gx != null) { fr.gx = f.gx; fr.gy = f.gy; }
    if (f.cols != null) { fr.cols = f.cols; if (fr.type !== 'sec') fr.rows = f.rows; }
    fixed.add(fr.id);
  }
  if (f && f.kind === 'cardsize') {
    const fr = f.sec && byId(f.sec);
    if (fr) { lists.set(fr.id, resolve(lists.get(fr.id)!, fr.cols, { id: f.item.id, item: f.item, x: f.item.x, y: f.item.y, w: f.w, h: f.h }, [], false)); done.add(fr.id); fixed.add(fr.id); }
    else { const b = loose.find(x => x.id === f.item.id); if (b) { b.w = f.w; b.h = f.h; fixed.add(b.id); } }
  }
  for (const fr of frames) {
    if (fr.type === 'sec' && !done.has(fr.id)) lists.set(fr.id, resolve(lists.get(fr.id)!, fr.cols, null, [], !!(o.compact && o.compact.has(fr.id))));
    if (fr.type === 'sec') {
      fr.rows = Math.max(1, rowsOf(lists.get(fr.id)!));
      if (baseRows && f.hold) fr.rows = Math.max(fr.rows, baseRows.get(fr.id)!);
      fr.foot = fold.get(fr.id)! > 0;
      fr.nfold = fold.get(fr.id);
    }
    if (fr.type === 'smart') fr.foot = true;
  }
  if (room) {
    const rects = [...frames.map(fRect), ...loose.map(cRect)];
    makeRoom(rects, room.id, room.origin);
    for (const r of rects) if (r.dx || r.dy) { if (r.t === 'f') { const t = frames.find(x => x.id === r.id)!; t.gx += r.dx || 0; t.gy += r.dy || 0; } else { const t = loose.find(x => x.id === r.id)!; t.x += r.dx || 0; t.y += r.dy || 0; } }
  } else if (!o.noSettle && !(f && f.hold)) {
    const rects = [...frames.map(fRect), ...loose.map(cRect)];
    settle(rects, fixed);
    for (const r of rects) if (r.dy) { if (r.t === 'f') { const t = frames.find(x => x.id === r.id)!; t.gy += r.dy; } else { const t = loose.find(x => x.id === r.id)!; t.y += r.dy; } }
  }
  return { view: vb, frames, lists, loose };
}
export function commit(lay: Layout) {
  for (const fr of lay.frames) {
    const real = S.frames[fr.id]; if (!real) continue;
    real.gx = fr.gx; real.gy = fr.gy; real.cols = fr.cols; real.rows = fr.rows; real.foot = fr.foot;
  }
  for (const [fid, list] of lay.lists) for (const b of list) {
    const real = S.blocks[b.id] || (S.blocks[b.id] = { ...b });
    Object.assign(real, { sec: fid, board: lay.view, x: b.x, y: b.y, w: b.w, h: b.h }); delete real.fold;
  }
  for (const b of lay.loose) {
    const real = S.blocks[b.id] || (S.blocks[b.id] = { ...b });
    Object.assign(real, { sec: null, board: lay.view, x: b.x, y: b.y, w: b.w, h: b.h }); delete real.fold;
  }
  ver++;
}
export const relayout = (bid?: string | null, fixed?: string[] | null, compact?: Set<string> | null) => commit(layoutFrom(S, null, { view: bid || V, fixed, compact }));
export const secsOf = (ids: string[]) => new Set(ids.map(id => S.blocks[id] && S.blocks[id].sec).filter(Boolean) as string[]);

/* ================= queries ================= */
export const framesOf = (bid: string) => Object.values(S.frames).filter(f => f.board === bid);
export const blocksIn = (fid: string) => Object.values(S.blocks).filter(b => b.sec === fid);
export const linksOfBlock = (b: Block) => (b.kind === 'card' ? [b.link!] : b.kind === 'list' ? b.rows || [] : []);
export function linksInBoard(bid: string): string[] {
  const out: string[] = [];
  for (const id in S.blocks) { const b = S.blocks[id]; if (b.board === bid) out.push(...linksOfBlock(b)); }
  for (const f of framesOf(bid)) if (f.type === 'cover' && f.target) out.push(...linksInBoard(f.target));
  return out;
}
export function countOf(f: Frame): number {
  if (f.type === 'cover') return linksInBoard(f.target!).length;
  if (f.type === 'smart') return ruleMatch(f.rule!).length;
  return blocksIn(f.id).reduce((n, b) => n + linksOfBlock(b).length, 0);
}
export const boardChain = (bid: string) => { const a: string[] = []; for (let b: string | null = bid; b; b = S.boards[b] && S.boards[b].parent) a.unshift(b); return a; };
export const coverOf = (bid: string) => Object.values(S.frames).find(f => f.type === 'cover' && f.target === bid);
export function pathOf(lid: string) {
  const loc = S.loc[lid];
  if (!loc || loc === 'inbox') return ['Inbox'];
  const b = S.blocks[loc]; if (!b) return [];
  const p = boardChain(b.board).map(x => S.boards[x].name);
  if (b.sec && S.frames[b.sec]) p.push(S.frames[b.sec].name);
  if (b.kind === 'list') p.push(b.title || '');
  return p;
}
/* smart Sections: a rule over everything already placed */
export const toks = (v: string) => (String(v || '').match(/"[^"]*"?|[^\s"]+/g) || []).map(t => t.replace(/"/g, '').trim()).filter(Boolean);
export const domOf = (v: string) => String(v || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
const placedLinks = () => Object.keys(S.loc).filter(id => S.loc[id] !== 'inbox' && S.loc[id] !== 'del' && LK[id]).map(id => LK[id]);
let rmCache = { v: -1, m: new Map<string, L[]>() };
export function ruleMatch(r: Rule): L[] {
  if (rmCache.v !== ver) rmCache = { v: ver, m: new Map() };
  const key = JSON.stringify(r); if (rmCache.m.has(key)) return rmCache.m.get(key)!;
  const pool = placedLinks();
  let out: L[] = [];
  if (r.type === 'recent') { const n = Math.max(1, parseInt(r.v, 10) || 7); out = pool.filter(l => l.added < n).sort((a, b) => a.added - b.added); }
  else if (r.type === 'domain') { const v = domOf(r.v); out = v ? pool.filter(l => l.host.includes(v) || siteName(l).toLowerCase().includes(v)).sort((a, b) => a.added - b.added) : []; }
  else if (r.type === 'kw') {
    const ts = toks(r.v).map(t => t.toLowerCase());
    out = ts.length ? pool.filter(l => { const h = (titleOf(l) + ' ' + (l.ex || '') + ' ' + siteName(l) + ' ' + l.host + ' ' + (l.by || '')).toLowerCase(); return ts.every(t => h.includes(t)); }).sort((a, b) => score(a) - score(b)) : [];
  } else out = pool.filter(l => cold(l)).sort((a, b) => idle(b) - idle(a));
  rmCache.m.set(key, out); return out;
}
export function ruleText(r: Rule) {
  if (r.type === 'recent') return `${Math.max(1, parseInt(r.v, 10) || 7)} 天内收藏`;
  if (r.type === 'domain') return domOf(r.v) ? `来自 ${domOf(r.v)}` : '来自 …';
  if (r.type === 'kw') { const t = toks(r.v); return t.length ? '含 ' + t.map(x => `「${x}」`).join('') : '含 …'; }
  return '不常用';
}
/* what a smart Section shows inside its fixed frame */
export function projOf(f: Frame) {
  const all = ruleMatch(f.rule!), out: Item[] = [], occ: number[][] = [];
  const free = (x: number, y: number, w: number, h: number) => { if (x + w > f.cols || y + h > f.rows) return false; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (occ[j] && occ[j][i]) return false; return true; };
  for (const l of all) {
    const media = (l.k === 'yt' || l.k === 'bili' || l.k === 'xhs') && l.img;
    const want: [number, number] = media && f.rows >= 2 && f.cols >= 4 && out.length < 2 ? [2, 2] : [2, 1];
    let ok = false;
    for (const [w, h] of [want, [2, 1], [1, 1]]) {
      for (let y = 0; !ok && y < f.rows; y++) for (let x = 0; x < f.cols; x++) if (free(x, y, w, h)) {
        for (let j = y; j < y + h; j++) { occ[j] = occ[j] || []; for (let i = x; i < x + w; i++) occ[j][i] = 1; }
        out.push({ id: `p:${f.id}:${l.id}`, kind: 'card', link: l.id, proj: f.id, board: f.board, sec: null, x, y, w, h }); ok = true; break;
      }
      if (ok) break;
    }
    if (!ok) break;
  }
  return { cards: out, total: all.length };
}
export function autoName(r: Rule) {
  if (r.type === 'recent') return `最近 ${Math.max(1, parseInt(r.v, 10) || 7)} 天`;
  if (r.type === 'domain') return domOf(r.v) || '未命名';
  if (r.type === 'kw') return toks(r.v).join(' · ') || '未命名';
  return '不常用';
}

/* ================= placing ================= */
export function freeCardSpot(gx: number, gy: number, w: number, h: number, obst: Rect[]) {
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const x = gx + i, y = gy + j, dd = i * i + j * j * 1.15; if (dd >= bd) continue;
    const r: Rect = { t: 'c', id: '', x: x * U, y: y * U, w: P(w), h: P(h) };
    if (!obst.some(o => collide(r, o))) { best = { x, y }; bd = dd; }
  }
  return best || { x: gx, y: gy };
}
export function contentBounds(lay: Layout) {
  const R = [...lay.frames.map(fRect), ...lay.loose.map(cRect)];
  if (!R.length) return null;
  return { x0: Math.min(...R.map(r => r.x)), y0: Math.min(...R.map(r => r.y)), x1: Math.max(...R.map(r => r.x + r.w)), y1: Math.max(...R.map(r => r.y + r.h)) };
}
export function placeIntoSec(ids: string[], fid: string) {
  const fr = S.frames[fid]; const list: Box[] = blocksIn(fid).filter(b => !b.fold && !ids.includes(b.id)).map(b => ({ ...b }));
  for (const id of ids) {
    const b = S.blocks[id]; b.w = Math.min(b.w, fr.cols);
    const s = firstFree(list, fr.cols, b.w, b.h); Object.assign(b, { sec: fid, board: fr.board, x: s.x, y: s.y }); delete b.fold; list.push({ ...b });
  }
}
export function placeLoose(ids: string[], bid: string) {
  const lay = layoutFrom(S, null, { view: bid, noSettle: true }), ob = [...lay.frames.map(fRect), ...lay.loose.filter(b => !ids.includes(b.id)).map(cRect)];
  const bb = contentBounds(lay) || { x0: 0, y0: 0, x1: 0, y1: 0 };
  let gy = Math.ceil((bb.y1 + 30) / U), gx = Math.round(bb.x0 / U);
  for (const id of ids) {
    const b = S.blocks[id], s = freeCardSpot(gx, gy, b.w, b.h, ob);
    Object.assign(b, { sec: null, board: bid, x: s.x, y: s.y }); delete b.fold;
    ob.push(cRect(b)); gx = s.x + b.w;
  }
}
export function moveFrameToBoard(fid: string, bid: string) {
  const f = S.frames[fid];
  const lay = layoutFrom(S, null, { view: bid, noSettle: true }), bb = contentBounds(lay);
  f.board = bid; for (const b of blocksIn(fid)) b.board = bid;
  f.gx = bb ? (bb.x0 + PAD) / U : 0; f.gy = bb ? (bb.y1 + SG + LBL + PAD) / U : 1;
  relayout(bid, [fid]);
  const cv = coverOf(bid); if (cv) cv.peekV = (cv.peekV || 0) + 1;
  ver++;
}
