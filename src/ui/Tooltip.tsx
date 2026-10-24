/* our own tooltips: 500ms the first time, then instant while the pointer slides across neighbours */
import { Show, createSignal, onCleanup, onMount } from 'solid-js';

type Tip = { el: HTMLElement; text: string; kbd?: string };
const [tip, setTip] = createSignal<Tip | null>(null);
let tipT = 0, warmUntil = 0;
export function hideTip() { clearTimeout(tipT); if (tip()) { setTip(null); warmUntil = performance.now() + 700; } }

function Bubble(p: { t: Tip }) {
  let el!: HTMLDivElement;
  onMount(() => {
    const app = document.getElementById('app')!, AR = app.getBoundingClientRect(), r = p.t.el.getBoundingClientRect();
    const below = r.top - AR.top < AR.height / 2;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - el.offsetWidth / 2 - AR.left, AR.width - el.offsetWidth - 8));
    el.style.left = x + 'px'; el.style.top = (below ? r.bottom + 8 - AR.top : r.top - 8 - el.offsetHeight - AR.top) + 'px';
  });
  return <div ref={el} class="tip"><span>{p.t.text}</span><Show when={p.t.kbd}><kbd>{p.t.kbd}</kbd></Show></div>;
}

export default function Tooltip() {
  onMount(() => {
    const app = document.getElementById('app')!;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null; if (!el) return;
      if (tip()?.el === el) return;
      clearTimeout(tipT);
      const warm = performance.now() < warmUntil || !!tip();
      tipT = window.setTimeout(() => { if (el.isConnected) setTip({ el, text: el.dataset.tip!, kbd: el.dataset.kbd }); }, warm ? 0 : 500);
    };
    const outH = (e: PointerEvent) => { const el = (e.target as HTMLElement).closest('[data-tip]'); if (el && !el.contains(e.relatedTarget as Node)) hideTip(); };
    app.addEventListener('pointerover', over); app.addEventListener('pointerout', outH); app.addEventListener('pointerdown', hideTip, true);
    onCleanup(() => { app.removeEventListener('pointerover', over); app.removeEventListener('pointerout', outH); app.removeEventListener('pointerdown', hideTip, true); });
  });
  return <Show when={tip()} keyed>{t => <Bubble t={t} />}</Show>;
}
