/* Shared bits for things that float over the canvas: keeping them inside the window, and letting them fade out before they go. */
import { createEffect, createSignal, on, onCleanup, type Accessor } from 'solid-js';

const appRect = () => (document.getElementById('app') || document.body).getBoundingClientRect();

/* put el at x,y (screen), flipping to the other side of the anchor when it would run off the edge */
export function placeIn(el: HTMLElement, x: number, y: number, anchorW = 0, anchorH = 0) {
  const AR = appRect(), w = el.offsetWidth, h = el.offsetHeight;
  let lx = x - AR.left, ly = y - AR.top, ox = 0, oy = 0;
  if (lx + w > AR.width - 8) { lx = Math.max(8, (anchorW ? lx + anchorW : lx) - w); ox = w; }
  if (ly + h > AR.height - 8) { ly = Math.max(8, (anchorH ? ly - anchorH : ly) - h); oy = h; }
  el.style.left = lx + 'px'; el.style.top = ly + 'px'; el.style.setProperty('--ox', ox + 'px'); el.style.setProperty('--oy', oy + 'px');
}
export function placeAt(el: HTMLElement, at: { x: number; y: number; anchor?: Element | null }) {
  if (at.anchor && at.anchor.isConnected) { const r = at.anchor.getBoundingClientRect(); placeIn(el, r.left, r.bottom + 6, r.width, r.height + 12); }
  else placeIn(el, at.x, at.y);
}

/* the last value stays on screen, marked `out`, for `ms` after the source clears, so it can animate away */
export function presence<T>(src: Accessor<T | null>, ms = 90): [Accessor<T | null>, Accessor<boolean>] {
  const [shown, setShown] = createSignal<T | null>(src());
  const [out, setOut] = createSignal(false);
  createEffect(on(src, v => {
    if (v) { setShown(() => v); setOut(false); return; }
    if (!shown()) return;
    setOut(true);
    const t = setTimeout(() => { setShown(null); setOut(false); }, ms);
    onCleanup(() => clearTimeout(t));
  }, { defer: true }));
  return [shown, out];
}
