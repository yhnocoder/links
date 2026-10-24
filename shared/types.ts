/* The data that lives in D1 and syncs between devices. Every row carries `updatedAt` (ms) and the newer write wins.
   A row is never removed, only marked `deleted`, so a deletion syncs like any other change. */

export type Kind = 'yt' | 'bili' | 'xhs' | 'web' | 'gh' | 'ghpr' | 'paper' | 'chat';
export type LinkStatus = 'loading' | 'ok' | 'failed' | 'unclear';

/* One master picture per link, stored once at its display size (2× pixels). Every card slot crops it, never scales it. */
export interface ImageRef {
  key: string; // R2 key of the master, also used for the 40px thumbnail at `${key}.t`
  w: number; // CSS px of the master
  h: number;
  fx: number; // focal point, 0..1
  fy: number;
}

export interface Row {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface LinkRow extends Row {
  url: string;
  host: string;
  kind: Kind;
  title: string;
  desc: string;
  siteName: string;
  image: ImageRef | null;
  /* what each kind of card shows beyond title and picture: channel, duration, stars, PR state … */
  meta: Record<string, unknown>;
  status: LinkStatus;
  /* in the Inbox when not on any board; the time it went there orders the Inbox */
  inboxAt: number | null;
  /* the user's own call on 不常用: 1 = unimportant, 0 = keep, null = decided by age */
  unimp: 0 | 1 | null;
  createdAt: number;
  openedAt: number | null;
  clicks: number;
}

export interface BoardRow extends Row {
  name: string;
  parent: string | null;
}

export type FrameType = 'sec' | 'smart' | 'cover';
export interface Rule {
  type: 'kw' | 'domain' | 'recent' | 'stale';
  v: string;
}
export interface FrameRow extends Row {
  board: string;
  type: FrameType;
  name: string;
  gx: number;
  gy: number;
  cols: number;
  rows: number;
  collapsed: boolean;
  capStyle?: 'one';
  rule?: Rule;
  target?: string; // the sub-board a cover opens
  auto?: boolean; // name follows the rule
}

export type BlockKind = 'card' | 'list' | 'note';
export interface BlockRow extends Row {
  board: string;
  sec: string | null;
  kind: BlockKind;
  link?: string;
  rows?: string[]; // a Link List's links
  title?: string;
  style?: 'a' | 'c';
  tint?: 'brand';
  text?: string;
  items?: [string, number][];
  x: number;
  y: number;
  w: number;
  h: number;
  fold?: boolean; // rarely used: tucked into the Section's foot
}

export interface Snapshot {
  links: LinkRow[];
  boards: BoardRow[];
  frames: FrameRow[];
  blocks: BlockRow[];
}
export type Table = keyof Snapshot;
export const TABLES: Table[] = ['links', 'boards', 'frames', 'blocks'];

/* what the server reads off a page */
export interface Unfurl {
  url: string;
  kind: Kind;
  title: string;
  desc: string;
  siteName: string;
  image: string | null; // remote URL; the browser crops and uploads it
  meta: Record<string, unknown>;
  status: LinkStatus;
}
