/* The preview's sample libraries. Times are stored as days ago and become dates when the preview opens. */
import type { BlockRow, BoardRow, FrameRow, LinkRow, Snapshot } from '../../shared/types';

export type Tier = 'new' | 'months' | 'years';
export const TIERS: [Tier, string][] = [['new', '十几条'], ['months', '两百多条'], ['years', '两千多条']];
/* for debugging only: #new, #months or #years opens a sample library; otherwise the preview starts empty like a new account */
export const tierNow = (): Tier | null => { const t = location.hash.slice(1) as Tier; return TIERS.some(x => x[0] === t) ? t : null; };

type Raw = { links: (Omit<LinkRow, 'updatedAt' | 'createdAt' | 'openedAt' | 'inboxAt'> & { ago: number; opened: number | null; inbox: boolean })[]; boards: Omit<BoardRow, 'updatedAt'>[]; frames: Omit<FrameRow, 'updatedAt'>[]; blocks: Omit<BlockRow, 'updatedAt'>[] };
const files: Record<Tier, () => Promise<{ default: Raw }>> = {
  new: () => import('./new.json') as any,
  months: () => import('./months.json') as any,
  years: () => import('./years.json') as any,
};
const DAY = 86400000;

export async function seed(): Promise<Snapshot> {
  const t = tierNow();
  if (!t) return { links: [], boards: [], frames: [], blocks: [] };
  const raw = (await files[t]()).default, now = Date.now();
  /* the sample pictures' small versions share one strip */
  document.documentElement.style.setProperty('--sprite', `url("${new URL('i/thumbs.jpg', location.href).href}")`);
  return {
    links: raw.links.map(({ ago, opened, inbox, ...l }) => {
      const createdAt = Math.round(now - ago * DAY);
      return { ...l, updatedAt: 0, createdAt, openedAt: opened == null ? null : Math.round(now - opened * DAY), inboxAt: inbox ? createdAt : null };
    }),
    boards: raw.boards.map(b => ({ ...b, updatedAt: 0 })),
    frames: raw.frames.map(f => ({ ...f, updatedAt: 0 })),
    blocks: raw.blocks.map(b => ({ ...b, sec: b.sec ?? null, updatedAt: 0 })),
  };
}
