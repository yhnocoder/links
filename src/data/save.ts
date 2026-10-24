/* Saving a link: the sheet opens at once with a card that fills in as the page is read,
   offers the Section it most likely belongs in, and falls back to the Inbox. */
import { createSignal } from 'solid-js';
import type { LinkRow, Unfurl } from '../../shared/types';
import { hostOf, normalizeUrl, parseUrl } from '../../shared/url';
import { S, LK, bump, uid, pathOf, type Frame } from '../board/state';
import { refreshLink, revealLink, saveLinkTo } from '../board/engine';
import { closeMenus, closePop, closeToast, setSheet, sheet, toast } from '../ui/bus';
import { mode, persist, putLinkRow, rows } from './store';
import { toL } from './links';
import { storeImage } from './images';
import { suggest } from './suggest';

/* bumped when the link in the sheet learns more about itself */
export const [sheetVer, setSheetVer] = createSignal(0);
let draft: LinkRow | null = null;
export const sheetLink = () => (sheetVer(), draft && LK[draft.id]);
export const sheetSuggest = (): Frame[] => { sheetVer(); const l = draft && LK[draft.id]; return l && l.t ? suggest(l) : []; };

export function openInput() { closeMenus(); closePop(); closeToast(); draft = null; setSheet({ mode: 'input' }); }

export function startSave(text: string) {
  const raw = text.trim(); if (!raw) return;
  const url = normalizeUrl(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  closeMenus(); closePop(); closeToast();
  /* already saved: show where it is */
  const dup = Object.values(rows).find(r => r.url === url && !r.deleted && S.loc[r.id] && S.loc[r.id] !== 'del');
  if (dup) { setSheet(null); draft = null; revealLink(dup.id); toast(`已在「${pathOf(dup.id).join(' › ')}」`); return; }
  const p = parseUrl(url), now = Date.now();
  const row: LinkRow = { id: uid('l'), updatedAt: 0, url, host: hostOf(url), kind: p.kind, title: '', desc: '', siteName: '', image: null, meta: {}, status: 'loading', inboxAt: null, unimp: null, createdAt: now, openedAt: null, clicks: 0 };
  draft = row; LK[row.id] = toL(row);
  setSheet({ mode: 'save', linkId: row.id }); setSheetVer(v => v + 1);
  read(row);
}

/* the page is read in the background; whatever arrives later still lands on the card */
async function read(row: LinkRow) {
  let u: (Unfurl & { existing?: string | null }) | null = null;
  if (mode === 'server') {
    try {
      const r = await fetch('/api/unfurl', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: row.url }) });
      if (r.ok) u = await r.json();
    } catch { /* offline: the card keeps the address */ }
  }
  const cur = () => rows[row.id] || (draft && draft.id === row.id ? draft : null);
  const apply = (patch: Partial<LinkRow>) => {
    const base = cur(); if (!base) return;
    const next = { ...base, ...patch };
    if (rows[row.id]) { putLinkRow(next); LK[row.id] = toL(next); persist(S); refreshLink(row.id); }
    else { draft = next; LK[row.id] = toL(next); bump(); }
    setSheetVer(v => v + 1);
  };
  if (!u) { apply({ status: 'failed' }); return; }
  apply({ url: normalizeUrl(u.url || row.url), host: hostOf(u.url || row.url), kind: u.kind, title: u.title, desc: u.desc, siteName: u.siteName, meta: u.meta || {}, status: u.status });
  if (u.image) { const img = await storeImage(row.id, u.image); if (img) apply({ image: img }); }
}

export function saveTo(where: string) {
  const s = sheet(); if (!s || s.mode !== 'save' || !draft) { setSheet(null); return; }
  const row = draft; draft = null; setSheet(null);
  putLinkRow(row); LK[row.id] = toL(row);
  saveLinkTo(row.id, where);
}
/* leaving the sheet without choosing still keeps the link, in the Inbox; Escape on an empty field just closes */
export function closeSheet(silent: boolean) {
  const s = sheet(); if (!s) return;
  if (s.mode === 'save' && draft && !silent) return saveTo('inbox');
  if (draft) delete LK[draft.id];
  draft = null; setSheet(null);
}
export function sheetEnter() { const sg = sheetSuggest(); saveTo(sg[0] ? sg[0].id : 'inbox'); }
