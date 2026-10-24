/* Outside the product: switch the preview between sample libraries of different sizes, or start it over. */
import { For } from 'solid-js';
import { TIERS, tierNow, type Tier } from './seed';
import './demo.css';

const restart = (t: Tier) => {
  try { localStorage.setItem('links-demo-tier', t); localStorage.removeItem('links-cams'); } catch { /* fine */ }
  indexedDB.deleteDatabase('keyval-store');
  setTimeout(() => location.reload(), 60);
};

export default function DemoBar() {
  const cur = tierNow();
  return (
    <div class="demo" aria-label="演示控制">
      <span class="tag">预览 · 示例数据</span>
      <div class="seg"><For each={TIERS}>{([t, n]) => <button classList={{ on: t === cur }} onClick={() => restart(t)}>{n}</button>}</For></div>
      <button onClick={() => restart(cur)}>重置</button>
      <span class="grow" />
    </div>
  );
}
