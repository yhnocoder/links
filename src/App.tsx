import { onCleanup, onMount } from 'solid-js';
import { setState } from './board/state';
import { busy, mount, show } from './board/engine';
import { boot, hydrate, pull, flushNow, forceLocal } from './data/store';
import { closeSheet, sheetEnter, startSave, openInput } from './data/save';
import { closeMenus, closePop, menu, pop } from './ui/bus';
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
    if (DEMO) forceLocal('links-demo-' + tierNow());
    const snap = await boot(DEMO ? () => import('./demo/seed').then(m => m.seed()) : undefined);
    const h = hydrate(snap); setState(h.S, h.LK);
    show({ fit: true });
    /* other devices: look for their changes now and then, and whenever the window comes back */
    const check = async () => { if (busy()) return; const s = await pull(); if (s && !busy()) { const x = hydrate(s); setState(x.S, x.LK); show(); } };
    const iv = setInterval(check, 30000);
    const vis = () => { if (document.visibilityState === 'visible') check(); else flushNow(); };
    document.addEventListener('visibilitychange', vis);
    addEventListener('focus', check);
    onCleanup(() => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); removeEventListener('focus', check); document.removeEventListener('pointerdown', outside, true); });
  });
  return (
    <div class="shell" id="shell">
      <div class="app" id="app" ref={app}>
        <div class="stage" id="stage" ref={stage}>
          <div class="dots" id="dots" ref={dots} />
          <div class="world" id="world" ref={world}><div class="layer" id="secs" ref={secs} /><div class="ph" id="ph" ref={ph} /><div class="layer" id="cards" ref={cards} /></div>
        </div>
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
