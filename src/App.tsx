import { onCleanup, onMount } from 'solid-js';
import { setState } from './board/state';
import { busy, dropHint, mount, show } from './board/engine';
import { boot, hydrate, pull, flushNow, forceLocal } from './data/store';
import { closeSheet, dropLinks, sheetEnter, startSave, openInput } from './data/save';
import { importFile } from './data/transfer';
import Empty from './ui/Empty';
import { closeMenus, closePop, menu, pop, setDropOn } from './ui/bus';
import Chrome from './ui/Chrome';
import Inbox from './ui/Inbox';
import MapPanel from './ui/MapPanel';
import Menu from './ui/Menu';
import Pops from './ui/Pops';
import Palette from './ui/Palette';
import Sheet from './ui/Sheet';
import Toast from './ui/Toast';
import Tooltip from './ui/Tooltip';
import { tierNow } from './demo/seed';

const DEMO = import.meta.env.VITE_DEMO === '1';

export default function App() {
  let app!: HTMLDivElement, stage!: HTMLDivElement, world!: HTMLDivElement, secs!: HTMLDivElement, cards!: HTMLDivElement, ph!: HTMLDivElement, dots!: HTMLDivElement;
  onMount(async () => {
    mount({ app, stage, world, secs, cards, ph, dots }, { pasteLink: t => (t ? startSave(t) : openInput()), closeSheet, sheetEnter });
    /* a press outside a menu or popover closes it; the button that opened a menu toggles it itself */
    const outside = (e: PointerEvent) => {
      const t = e.target as HTMLElement, m = menu(), p = pop();
      if (m && !t.closest('.menu') && !(m.anchor && m.anchor.contains(t))) closeMenus();
      if (p && !t.closest('.pop') && !t.closest('.rule,[data-more],.foot')) closePop();
    };
    document.addEventListener('pointerdown', outside, true);
    /* links dragged in from another tab, or a bookmark file dropped on the window */
    const overInbox = (x: number, y: number) => ['#inbox', '#inboxBtn'].some(s => { const el = document.querySelector(s); if (!el) return false; const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    const carries = (d: DataTransfer | null) => !!d && (d.types.includes('text/uri-list') || d.types.includes('Files'));
    const over = (e: DragEvent) => {
      if (!carries(e.dataTransfer) || busy()) return;
      e.preventDefault(); e.dataTransfer!.dropEffect = 'copy';
      const ib = overInbox(e.clientX, e.clientY);
      setDropOn(ib ? { type: 'inbox', btn: true } : null); dropHint(ib ? -1e6 : e.clientX, ib ? -1e6 : e.clientY);
    };
    const clear = () => { setDropOn(null); dropHint(-1e6, -1e6); };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) clear(); };
    const dropped = (e: DragEvent) => {
      const d = e.dataTransfer; if (!carries(d) || busy()) return;
      e.preventDefault(); clear();
      const f = d!.files?.[0];
      if (f) { if (/\.(html?|json)$/i.test(f.name)) importFile(f); return; }
      const urls = (d!.getData('text/uri-list') || d!.getData('text/plain') || '').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#') && /^https?:\/\//i.test(x));
      if (urls.length) dropLinks(urls, e.clientX, e.clientY, overInbox(e.clientX, e.clientY));
    };
    document.addEventListener('dragover', over); document.addEventListener('dragleave', leave); document.addEventListener('drop', dropped);
    if (DEMO) forceLocal('links-demo-' + (tierNow() ?? 'mine'));
    const snap = await boot(DEMO ? () => import('./demo/seed').then(m => m.seed()) : undefined);
    const h = hydrate(snap); setState(h.S, h.LK);
    show({ fit: true });
    /* other devices: look for their changes now and then, and whenever the window comes back */
    const check = async () => { if (busy()) return; const s = await pull(); if (s && !busy()) { const x = hydrate(s); setState(x.S, x.LK); show(); } };
    const iv = setInterval(check, 30000);
    const vis = () => { if (document.visibilityState === 'visible') check(); else flushNow(); };
    document.addEventListener('visibilitychange', vis);
    addEventListener('focus', check);
    onCleanup(() => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); removeEventListener('focus', check); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('dragover', over); document.removeEventListener('dragleave', leave); document.removeEventListener('drop', dropped); });
  });
  return (
    <div class="shell" id="shell">
      <div class="app" id="app" ref={app}>
        <div class="stage" id="stage" ref={stage}>
          <div class="dots" id="dots" ref={dots} />
          <div class="world" id="world" ref={world}><div class="layer" id="secs" ref={secs} /><div class="ph" id="ph" ref={ph} /><div class="layer" id="cards" ref={cards} /></div>
        </div>
        <Empty />
        <Chrome />
        <MapPanel />
        <Inbox />
        <Sheet />
        <Pops />
        <Menu />
        <Palette />
        <Toast />
        <Tooltip />
      </div>
    </div>
  );
}
