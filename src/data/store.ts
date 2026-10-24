/* Keeping the board and the server in step.
   The board edits its own plain objects; after every change `persist()` compares them with what was last saved,
   stamps the rows that differ and sends only those. The newer edit of a row wins on the server. */
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { TABLES, type BlockRow, type BoardRow, type FrameRow, type LinkRow, type Row, type Snapshot, type Table } from '../../shared/types';
import type { L } from '../cards/render';
import { emptyState, type State } from '../board/state';
import { setSyncState } from '../ui/bus';
import { toL } from './links';

export type Mode = 'server' | 'local';
export let mode: Mode = 'server';
let CACHE = 'links-cache-v1';
/* the preview never looks for a server and keeps each sample library apart */
export const forceLocal = (key: string) => { mode = 'local'; CACHE = key; };

/* every link's stored row; the cards read the formatted copy in LK */
export const rows: Record<string, LinkRow> = {};
/* the last version of every row that the server has (or will have once the queue drains) */
const saved: Record<Table, Map<string, string>> = { links: new Map(), boards: new Map(), frames: new Map(), blocks: new Map() };
const savedRows: Record<Table, Map<string, Row>> = { links: new Map(), boards: new Map(), frames: new Map(), blocks: new Map() };
const pending: Record<Table, Map<string, Row>> = { links: new Map(), boards: new Map(), frames: new Map(), blocks: new Map() };
let rev = 0;

const strip = (r: Row) => { const { updatedAt, ...rest } = r as any; return JSON.stringify(rest); };

/* ---------- from rows to the board's model ---------- */
export function hydrate(snap: Snapshot): { S: State; LK: Record<string, L> } {
  const S = emptyState(), LK: Record<string, L> = {};
  for (const b of snap.boards) if (!b.deleted) S.boards[b.id] = { id: b.id, name: b.name, parent: b.parent };
  for (const f of snap.frames) if (!f.deleted) { const { updatedAt, deleted, ...x } = f as any; S.frames[f.id] = x; }
  for (const b of snap.blocks) if (!b.deleted) { const { updatedAt, deleted, ...x } = b as any; S.blocks[b.id] = x; }
  for (const l of snap.links) { rows[l.id] = l; LK[l.id] = toL(l); }
  /* nothing points at a board that is gone */
  for (const id in S.frames) { const f = S.frames[id]; if (!S.boards[f.board] || (f.type === 'cover' && (!f.target || !S.boards[f.target]))) delete S.frames[id]; }
  for (const id in S.blocks) { const b = S.blocks[id]; if (!S.boards[b.board] || (b.sec && !S.frames[b.sec]) || (b.kind === 'card' && !LK[b.link!])) delete S.blocks[id]; }
  for (const id in S.blocks) { const b = S.blocks[id]; if (b.kind === 'card') S.loc[b.link!] = id; if (b.kind === 'list') { b.rows = (b.rows || []).filter(r => LK[r]); b.rows.forEach(r => (S.loc[r] = id)); } }
  const inbox: LinkRow[] = [];
  for (const l of snap.links) {
    if (l.deleted) { S.loc[l.id] = 'del'; continue; }
    if (!S.loc[l.id]) { S.loc[l.id] = 'inbox'; inbox.push(l); }
    if (l.unimp === 1) S.unimp[l.id] = 1; else if (l.unimp === 0) S.keep[l.id] = 1;
  }
  S.inbox = inbox.sort((a, b) => (b.inboxAt ?? b.createdAt) - (a.inboxAt ?? a.createdAt)).map(l => l.id);
  try { S.cams = JSON.parse(localStorage.getItem('links-cams') || '{}'); } catch { S.cams = {}; }
  return { S, LK };
}

/* ---------- from the board's model to rows ---------- */
function serialize(S: State): Record<Table, Map<string, Row>> {
  const out: Record<Table, Map<string, Row>> = { links: new Map(), boards: new Map(), frames: new Map(), blocks: new Map() };
  for (const id in S.boards) { const b = S.boards[id]; out.boards.set(id, { id, name: b.name, parent: b.parent, updatedAt: 0 } as BoardRow); }
  for (const id in S.frames) { const { foot, nfold, peekV, ...f } = S.frames[id] as any; out.frames.set(id, { ...f, updatedAt: 0 } as FrameRow); }
  for (const id in S.blocks) { const { proj, ...b } = S.blocks[id] as any; out.blocks.set(id, { ...b, updatedAt: 0 } as BlockRow); }
  /* the Inbox order is kept as times: each link keeps its own time unless that would put it out of order */
  const inboxAt = new Map<string, number>(); let prev = Infinity;
  const now = Date.now();
  for (const id of S.inbox) {
    const r = rows[id]; if (!r) continue;
    let t = r.inboxAt;
    if (t == null || t >= prev) t = prev === Infinity ? Math.max(now, (r.inboxAt ?? 0) + 1) : prev - 1;
    inboxAt.set(id, t); prev = t;
  }
  for (const id in rows) {
    const r = rows[id], loc = S.loc[id];
    const del = loc === 'del' || !loc;
    const row: LinkRow = { ...r, inboxAt: loc === 'inbox' ? inboxAt.get(id) ?? r.inboxAt ?? now : null, unimp: S.unimp[id] ? 1 : S.keep[id] ? 0 : null };
    if (del) row.deleted = true; else delete row.deleted;
    out.links.set(id, row);
  }
  return out;
}

let flushT = 0, cacheT = 0, retry = 0, flushing = false;
export function persist(S: State) {
  const cur = serialize(S), now = Date.now();
  let changed = false;
  for (const t of TABLES) {
    for (const [id, row] of cur[t]) {
      const j = strip(row);
      if (saved[t].get(id) === j) continue;
      row.updatedAt = now; saved[t].set(id, j); savedRows[t].set(id, row); pending[t].set(id, row); changed = true;
      if (t === 'links') rows[id] = row as LinkRow;
    }
    for (const [id, row] of savedRows[t]) {
      if (cur[t].has(id) || row.deleted) continue;
      const gone = { ...row, deleted: true, updatedAt: now };
      saved[t].set(id, strip(gone)); savedRows[t].set(id, gone); pending[t].set(id, gone); changed = true;
    }
  }
  try { localStorage.setItem('links-cams', JSON.stringify(S.cams)); } catch { /* cameras are a convenience */ }
  if (!changed) return;
  scheduleCache();
  if (mode === 'server') { clearTimeout(flushT); flushT = window.setTimeout(flush, 500); }
}

async function flush() {
  if (flushing) { clearTimeout(flushT); flushT = window.setTimeout(flush, 300); return; }
  const body: Partial<Snapshot> = {}; let n = 0;
  for (const t of TABLES) if (pending[t].size) { (body as any)[t] = [...pending[t].values()]; n += pending[t].size; }
  if (!n) return;
  const sent = TABLES.map(t => new Map(pending[t]));
  flushing = true;
  try {
    const r = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('push ' + r.status);
    const j = await r.json() as { rev: number };
    /* a row changed again while in flight stays queued */
    TABLES.forEach((t, i) => { for (const [id, row] of sent[i]) if (pending[t].get(id) === row) pending[t].delete(id); });
    rev = Math.max(rev, j.rev); retry = 0; setSyncState('ok'); scheduleCache();
  } catch {
    setSyncState(navigator.onLine === false ? 'offline' : 'error');
    retry = Math.min(retry + 1, 6); clearTimeout(flushT); flushT = window.setTimeout(flush, 1000 * 2 ** retry);
  } finally { flushing = false; }
}

function scheduleCache() { clearTimeout(cacheT); cacheT = window.setTimeout(writeCache, 800); }
async function writeCache() {
  const snap: any = { rev, mode };
  for (const t of TABLES) { snap[t] = [...savedRows[t].values()]; snap['p_' + t] = [...pending[t].keys()]; }
  try { await idbSet(CACHE, snap); } catch { /* private window: works, just not offline */ }
}

function remember(snap: Snapshot) {
  for (const t of TABLES) { saved[t].clear(); savedRows[t].clear(); for (const r of snap[t] as Row[]) { saved[t].set(r.id, strip(r)); savedRows[t].set(r.id, r); } }
}
export const snapOf = (): Snapshot => ({ links: [...savedRows.links.values()] as LinkRow[], boards: [...savedRows.boards.values()] as BoardRow[], frames: [...savedRows.frames.values()] as FrameRow[], blocks: [...savedRows.blocks.values()] as BlockRow[] });

/* ---------- start: the cached copy first, then the server's ---------- */
export async function boot(seed?: () => Snapshot | Promise<Snapshot>): Promise<Snapshot> {
  let cached: any = null;
  try { cached = await idbGet(CACHE); } catch { /* no cache */ }
  let server: (Snapshot & { rev: number }) | null = null, reachable = mode === 'server';
  if (reachable) try {
    const r = await fetch('/api/state', { headers: { accept: 'application/json' } });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) server = await r.json();
    else reachable = false;
  } catch { reachable = false; }
  if (!server && !reachable && !cached?.mode) mode = 'local';
  else if (!server && cached?.mode === 'local') mode = 'local';
  if (mode === 'local') setSyncState('local');
  if (server) {
    /* local edits the server has not seen yet are newer than its copy */
    const merged: Snapshot = { links: [], boards: [], frames: [], blocks: [] };
    for (const t of TABLES) {
      const m = new Map<string, Row>((server[t] as Row[]).map(r => [r.id, r]));
      if (cached) for (const id of cached['p_' + t] || []) { const r = (cached[t] as Row[]).find(x => x.id === id); if (r && (!m.has(id) || m.get(id)!.updatedAt < r.updatedAt)) { m.set(id, r); pending[t].set(id, r); } }
      (merged as any)[t] = [...m.values()];
    }
    rev = server.rev; remember(merged);
    if (TABLES.some(t => pending[t].size)) { clearTimeout(flushT); flushT = window.setTimeout(flush, 300); }
    return snapOf();
  }
  if (cached && TABLES.some(t => cached[t]?.length)) {
    const snap = { links: cached.links, boards: cached.boards, frames: cached.frames, blocks: cached.blocks } as Snapshot;
    rev = cached.rev || 0; remember(snap);
    for (const t of TABLES) for (const id of cached['p_' + t] || []) { const r = savedRows[t].get(id); if (r) pending[t].set(id, r); }
    if (mode === 'server') { setSyncState('offline'); clearTimeout(flushT); flushT = window.setTimeout(flush, 2000); }
    return snapOf();
  }
  /* nothing anywhere yet: the preview starts from sample boards, a real account from an empty one */
  return mode === 'local' && seed ? await seed() : { links: [], boards: [], frames: [], blocks: [] };
}

/* ---------- other devices: pull what changed since the last revision ---------- */
export async function pull(): Promise<Snapshot | null> {
  if (mode !== 'server') return null;
  try {
    const r = await fetch(`/api/changes?since=${rev}`);
    if (!r.ok) return null;
    const j = await r.json() as Snapshot & { rev: number };
    let n = 0;
    for (const t of TABLES) for (const row of j[t] as Row[]) {
      if (pending[t].has(row.id)) continue;
      const mine = savedRows[t].get(row.id);
      if (mine && mine.updatedAt > row.updatedAt) continue;
      saved[t].set(row.id, strip(row)); savedRows[t].set(row.id, row); n++;
    }
    rev = Math.max(rev, j.rev);
    if (!n) return null;
    setSyncState('ok'); scheduleCache();
    return snapOf();
  } catch { return null; }
}

/* links that changed outside the board (read from the page, picture uploaded) */
export function putLinkRow(r: LinkRow) { rows[r.id] = r; }
export const flushNow = () => { if (mode === 'server') { clearTimeout(flushT); return flush(); } };
