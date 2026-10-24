/* ⌘K: find any link, Section or board by what it says */
import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { S, LK, V, boardChain, pathOf, score, type Frame } from '../board/state';
import { esc, markOf, siteName, titleOf, type L } from '../cards/render';
import { afterMorph, enterBoard, goBoard, revealFrame, revealLink } from '../board/engine';
import { paletteOpen, setPaletteOpen } from './bus';
import { ic } from './icons';
import { presence } from './float';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;
function hl(s: string, ts: string[]) {
  let out = esc(s);
  for (const t of ts) { if (!t) continue; const e = esc(t), i = out.toLowerCase().indexOf(e.toLowerCase()); if (i >= 0) out = out.slice(0, i) + '<mark>' + out.slice(i, i + e.length) + '</mark>' + out.slice(i + e.length); }
  return out;
}
type Res = { kind: 'link'; l: L } | { kind: 'frame'; f: Frame };

function Box(p: { out: boolean }) {
  let inp!: HTMLInputElement, pl!: HTMLDivElement;
  const [q, setQ] = createSignal(''), [on, setOn] = createSignal(0);
  const ts = createMemo(() => q().trim().toLowerCase().split(/\s+/).filter(Boolean));
  const res = createMemo(() => {
    const t = ts();
    if (!t.length) {
      const rec = Object.values(LK).filter(l => l.opened >= 0 && S.loc[l.id] && S.loc[l.id] !== 'del').sort((a, b) => a.opened - b.opened || b.clicks - a.clicks).slice(0, 8);
      return { frames: [] as Res[], links: rec.map(l => ({ kind: 'link', l }) as Res) };
    }
    const hay = (s: string) => t.every(x => s.toLowerCase().includes(x));
    const frames = Object.values(S.frames).filter(f => hay(f.name)).slice(0, 5).map(f => ({ kind: 'frame', f }) as Res);
    const ls: L[] = [];
    for (const id in LK) { const l = LK[id], loc = S.loc[id]; if (!loc || loc === 'del') continue; if (hay(titleOf(l) + ' ' + siteName(l) + ' ' + (l.by || '') + ' ' + l.host + ' ' + (l.ex || ''))) ls.push(l); if (ls.length > 400) break; }
    ls.sort((a, b) => (+titleOf(b).toLowerCase().startsWith(t[0]) - +titleOf(a).toLowerCase().startsWith(t[0])) || score(a) - score(b));
    return { frames, links: ls.slice(0, 40).map(l => ({ kind: 'link', l }) as Res) };
  });
  const all = () => [...res().frames, ...res().links];
  const mark = (i: number) => { setOn(i); requestAnimationFrame(() => pl.querySelector('.res.on')?.scrollIntoView({ block: 'nearest' })); };
  const go = (i: number) => {
    const r = all()[i]; if (!r) return;
    setPaletteOpen(false);
    if (r.kind === 'frame') { const f = r.f; if (f.type === 'cover') { if (f.board === V) enterBoard(f.id); else { goBoard(f.board); afterMorph(() => enterBoard(f.id)); } } else revealFrame(f.id); }
    else revealLink(r.l.id);
  };
  onMount(() => setTimeout(() => inp.focus(), 0));
  const Row = (x: { r: Res; i: number }) => x.r.kind === 'frame'
    ? <div class="res" classList={{ on: on() === x.i }} onPointerMove={() => on() !== x.i && setOn(x.i)} onClick={() => go(x.i)}><Html h={ic(x.r.f.type === 'cover' ? 'board' : x.r.f.type === 'smart' ? 'smart' : 'sec')} /><span class="rt" innerHTML={hl(x.r.f.name, ts())} /><span class="rp">{boardChain(x.r.f.board).map(b => S.boards[b].name).join(' › ')}</span></div>
    : <div class="res" classList={{ on: on() === x.i }} onPointerMove={() => on() !== x.i && setOn(x.i)} onClick={() => go(x.i)}><Html h={markOf(x.r.l)} /><span class="rt" innerHTML={hl(titleOf(x.r.l), ts())} /><span class="rp">{pathOf(x.r.l.id).join(' › ')}</span></div>;
  return (
    <div class="scrim" classList={{ out: p.out }} onPointerDown={e => { if (e.target === e.currentTarget) setPaletteOpen(false); }}>
      <div class="pal" role="dialog" aria-label="搜索">
        <label class="pi"><Html h={ic('search')} />
          <input ref={inp} placeholder="搜索链接、分组、白板" spellcheck={false} onInput={e => { setQ(e.currentTarget.value); setOn(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); mark(Math.min(all().length - 1, on() + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); mark(Math.max(0, on() - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(on()); }
              else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPaletteOpen(false); }
            }} />
        </label>
        <div ref={pl} class="pl scroll">
          <Show when={!ts().length && res().links.length}><div class="lh2">最近打开</div></Show>
          <Show when={ts().length && res().frames.length}><div class="lh2">分组与白板</div></Show>
          <For each={res().frames}>{(r, i) => <Row r={r} i={i()} />}</For>
          <Show when={ts().length && res().links.length}><div class="lh2">链接</div></Show>
          <For each={res().links}>{(r, i) => <Row r={r} i={i() + res().frames.length} />}</For>
          <Show when={ts().length && !all().length}><div class="pempty"><Html h={ic('search')} /></div></Show>
        </div>
      </div>
    </div>
  );
}

export default function Palette() {
  const [shown, out] = presence(() => (paletteOpen() ? true : null), 100);
  return <Show when={shown()}><Box out={out()} /></Show>;
}
