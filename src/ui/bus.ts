/* The signals the canvas engine and the Solid chrome share. The engine writes, the panels and menus read. */
import { createSignal } from 'solid-js';

export type MenuItem =
  | '-'
  | null
  | false
  | { lab: string }
  | { t: string; ic?: string; kbd?: string; act: () => void; danger?: boolean; off?: boolean }
  | { seg: string; opts: [string, string][]; cur: string; fn: (v: string) => void }
  | { sizes: { w: number; h: number; on: boolean }[]; fn: (w: number, h: number) => void };

export interface MenuState { x: number; y: number; items: MenuItem[]; anchor?: Element | null; id: number }
export const [menu, setMenu] = createSignal<MenuState | null>(null);
let menuN = 0;
export const openMenu = (x: number, y: number, items: MenuItem[], anchor?: Element | null) => { closePop(); setMenu({ x, y, items: items.filter(Boolean), anchor, id: ++menuN }); };
export const closeMenus = () => { const had = !!menu(); setMenu(null); return had; };

/* popovers: the full list of a Link List / fold / smart Section, and the smart Section rule editor */
export type ListSrc = { type: 'list'; id: string } | { type: 'fold'; fid: string } | { type: 'smart'; fid: string };
export type PopState =
  | { kind: 'list'; src: ListSrc; anchor: Element; flash?: string; id: number }
  | { kind: 'rule'; fid: string; anchor: Element | null; id: number };
export const [pop, setPop] = createSignal<PopState | null>(null);
let popN = 0;
export const openPop = (p: { kind: 'list'; src: ListSrc; anchor: Element; flash?: string } | { kind: 'rule'; fid: string; anchor: Element | null }) => { setMenu(null); setPop({ ...p, id: ++popN } as PopState); };
export const closePop = () => { const had = !!pop(); setPop(null); return had; };

export interface ToastState { msg: string; act?: string; fn?: () => void; id: number }
export const [toastSig, setToast] = createSignal<ToastState | null>(null);
let toastN = 0, toastT = 0;
export const toast = (msg: string, act?: string, fn?: () => void) => { clearTimeout(toastT); setToast({ msg, act, fn, id: ++toastN }); toastT = window.setTimeout(() => setToast(null), 4200); };
export const closeToast = () => { clearTimeout(toastT); setToast(null); };

/* where the user is */
export const [crumbs, setCrumbs] = createSignal<{ id: string; name: string }[]>([]);
export const [viewId, setViewId] = createSignal('home');
export const [zoomPct, setZoomPct] = createSignal(100);

/* the panels */
export const [inboxOpen, setInboxOpen] = createSignal(false);
export const [mapOpen, setMapOpen] = createSignal(false);
export const [paletteOpen, setPaletteOpen] = createSignal(false);
/* bumped whenever the model changes, so panels re-read it */
export const [modelVer, setModelVer] = createSignal(0);
export const bumpModel = () => setModelVer(v => v + 1);
/* rows to flash in the Inbox after something lands there */
export const [inboxFlash, setInboxFlash] = createSignal<{ ids: string[]; n: number }>({ ids: [], n: 0 });
export const [unimpOpen, setUnimpOpen] = createSignal(false);

/* while a card is held over the Inbox or a breadcrumb */
export type DropOn = { type: 'inbox'; btn?: boolean } | { type: 'crumb'; board: string } | null;
export const [dropOn, setDropOn] = createSignal<DropOn>(null);

/* saving a link */
export type SheetState = { mode: 'input' } | { mode: 'save'; linkId: string };
export const [sheet, setSheet] = createSignal<SheetState | null>(null);

/* the connection to the server: shown only when it matters */
export const [syncState, setSyncState] = createSignal<'ok' | 'offline' | 'local' | 'error'>('ok');
