/* Bringing links in and taking them out: browser bookmark files go to the Inbox; a backup restores everything it holds. */
import type { LinkRow, Snapshot } from '../../shared/types';
import { normalizeUrl } from '../../shared/url';
import { S, LK, setState } from '../board/state';
import { flashInbox, pushUndo, show, sync, undo } from '../board/engine';
import { setInboxOpen, toast } from '../ui/bus';
import { hydrate, mode, persist, putLinkRow, rows, snapOf } from './store';
import { findSaved, newRow, read } from './save';
import { toL } from './links';

export function pickFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.html,.htm,.json,text/html,application/json';
  inp.onchange = () => { const f = inp.files?.[0]; if (f) importFile(f); };
  inp.click();
}

export async function importFile(f: File) {
  const text = await f.text();
  if (/\.json$/i.test(f.name) || text.trimStart().startsWith('{')) return restore(text);
  bookmarks(text);
}

/* the bookmark file every browser exports: links with the folders they were in */
function bookmarks(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seen = new Set<string>(), add: LinkRow[] = [];
  let dups = 0;
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) continue;
    const url = normalizeUrl(href);
    if (seen.has(url)) continue; seen.add(url);
    if (findSaved(url)) { dups++; continue; }
    const folders: string[] = [];
    for (let dl = a.closest('dl'); dl; dl = dl.parentElement?.closest('dl') ?? null) {
      let h = dl.previousElementSibling; while (h && h.tagName !== 'H3' && h.tagName !== 'DT') h = h.previousElementSibling;
      const h3 = h?.tagName === 'H3' ? h : h?.querySelector(':scope > h3');
      if (h3?.textContent) folders.unshift(h3.textContent.trim());
    }
    const t = Number(a.getAttribute('add_date')) * 1000;
    /* it joins this library now; when it was bookmarked and where it was filed are kept alongside */
    const meta: Record<string, unknown> = {};
    if (t > 0 && t < Date.now()) meta.bookmarkedAt = t;
    if (folders.length) meta.folder = folders.join(' / ');
    add.push(newRow(url, { title: (a.textContent || '').trim(), inboxAt: Date.now() - add.length, status: mode === 'server' ? 'loading' : 'ok', meta }));
  }
  if (!add.length) { toast(dups ? '这些书签都已经在了' : '这个文件里没有书签'); return; }
  pushUndo();
  for (const r of add) { putLinkRow(r); LK[r.id] = toL(r); S.loc[r.id] = 'inbox'; }
  const at = (id: string) => rows[id]?.inboxAt ?? rows[id]?.createdAt ?? 0;
  S.inbox = [...S.inbox, ...add.map(r => r.id)].sort((a, b) => at(b) - at(a));
  sync(false);
  setInboxOpen(true); flashInbox(add.slice(0, 40).map(r => r.id));
  toast(`导入了 ${add.length} 条${dups ? `，${dups} 条已经在了` : ''}`, '撤销', undo);
  if (mode === 'server') readAll(add);
}

/* pictures and titles for a big import arrive a few at a time */
async function readAll(list: LinkRow[]) {
  const q = [...list];
  const worker = async () => { for (let r = q.shift(); r; r = q.shift()) await read(r); };
  await Promise.all([worker(), worker(), worker()]);
}

/* a backup made here: anything it has that this library does not gets added back */
function restore(text: string) {
  let b: Snapshot;
  try { b = JSON.parse(text); if (!Array.isArray(b.links)) throw 0; } catch { toast('这个文件打不开'); return; }
  const cur = snapOf(), merged: Snapshot = { links: [...cur.links], boards: [...cur.boards], frames: [...cur.frames], blocks: [...cur.blocks] };
  let n = 0;
  for (const t of ['links', 'boards', 'frames', 'blocks'] as const) {
    const have = new Set((cur[t] as { id: string; deleted?: boolean }[]).filter(r => !r.deleted).map(r => r.id));
    for (const r of (b[t] || []) as any[]) if (r && r.id && !r.deleted && !have.has(r.id)) { (merged[t] as any[]) = (merged[t] as any[]).filter(x => x.id !== r.id); (merged[t] as any[]).push(r); if (t === 'links') n++; }
  }
  if (!n) { toast('备份里的链接都已经在了'); return; }
  const h = hydrate(merged); setState(h.S, h.LK); show(); persist(h.S);
  toast(`恢复了 ${n} 条`);
}

export function exportBackup() {
  const s = snapOf(), live = <T extends { deleted?: boolean }>(a: T[]) => a.filter(r => !r.deleted);
  const data = { links: live(s.links), boards: live(s.boards), frames: live(s.frames), blocks: live(s.blocks) };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a'), d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `Links ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
