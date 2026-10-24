/* Popovers over the canvas: the whole of a Link List / a fold of rarely used cards / everything a smart Section matches,
   and the smart Section's rule. */
import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import { S, LK, blocksIn, groupBy, ago, bump, autoName, ruleMatch, type Frame } from '../board/state';
import { markOf, oneSite, rowMeta, siteName, titleOf, type L } from '../cards/render';
import { openLink, pressExt, pushUndo, sync } from '../board/engine';
import type { Rule } from '../../shared/types';
import { closePop, pop, type ListSrc, type PopState } from './bus';
import { ic } from './icons';
import { placeAt, presence } from './float';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;

function listSource(src: ListSrc) {
  if (src.type === 'list') { const b = S.blocks[src.id]; return { title: b?.title || '', ids: (b?.rows || []).slice(), bmap: {} as Record<string, string>, drag: true }; }
  if (src.type === 'fold') { const f = S.frames[src.fid]; const bs = blocksIn(src.fid).filter(b => b.fold); return { title: `${f.name} · 不常用`, ids: bs.map(b => b.link!), bmap: Object.fromEntries(bs.map(b => [b.link!, b.id])), drag: true }; }
  const f = S.frames[src.fid]; return { title: f.name, ids: ruleMatch(f.rule!).map(l => l.id), bmap: {} as Record<string, string>, drag: false };
}

function ListPop(p: { s: Extract<PopState, { kind: 'list' }>; out: boolean }) {
  let el!: HTMLDivElement, rowsEl!: HTMLDivElement, inp!: HTMLInputElement;
  const Ls = listSource(p.s.src), ls = Ls.ids.map(id => LK[id]).filter(Boolean) as L[];
  const sites = groupBy(ls, l => siteName(l)).slice(0, 6), one = oneSite(ls);
  const [q, setQ] = createSignal(''), [site, setSite] = createSignal('');
  const shown = createMemo(() => { const qq = q().trim().toLowerCase(); return ls.filter(l => (!site() || siteName(l) === site()) && (!qq || (titleOf(l) + ' ' + siteName(l)).toLowerCase().includes(qq))); });
  onMount(() => {
    placeAt(el, { x: 0, y: 0, anchor: p.s.anchor });
    if (p.s.flash) { const r = rowsEl.querySelector(`[data-row="${p.s.flash}"]`); if (r) { r.scrollIntoView({ block: 'center' }); r.classList.add('flash'); } }
  });
  const down = (e: PointerEvent, id: string, row: HTMLElement) => {
    if (e.button !== 0) return;
    if (!Ls.drag) { const up = () => { removeEventListener('pointerup', up); openLink(LK[id]); }; addEventListener('pointerup', up); return; }
    pressExt(e, id, p.s.src.type === 'fold' ? { type: 'fold', fid: p.s.src.fid, bid: Ls.bmap[id] } : { type: 'list', id: (p.s.src as any).id }, row);
  };
  return (
    <div ref={el} class="pop lpop" classList={{ out: p.out }}>
      <div class="lp-h"><Show when={one}><Html h={markOf(one!)} /></Show><b>{Ls.title}</b><span class="n num">{ls.length}</span><button class="xb" aria-label="关闭" onClick={closePop}><Html h={ic('x')} /></button></div>
      <label class="lp-q"><Html h={ic('search')} /><input ref={inp} placeholder="筛选" spellcheck={false} onInput={e => setQ(e.currentTarget.value)} /></label>
      <Show when={sites.length > 1}>
        <div class="lp-f">
          <button classList={{ on: site() === '' }} onClick={() => setSite('')}>全部</button>
          <For each={sites}>{([n, g]) => <button classList={{ on: site() === n }} onClick={() => setSite(n)}><Html h={markOf(g[0], 'xs')} />{n}<span class="num">{g.length}</span></button>}</For>
        </div>
      </Show>
      <div ref={rowsEl} class="lp-rows scroll">
        <For each={shown()}>{l => (
          <a class="lr" data-row={l.id} onPointerDown={e => down(e, l.id, e.currentTarget)}>
            <Show when={!one}><Html h={markOf(l)} /></Show>
            <span class="t">{titleOf(l)}</span>
            <span class="s">{rowMeta(l) === siteName(l) ? ago(l.added) : rowMeta(l)}</span>
          </a>
        )}</For>
      </div>
    </div>
  );
}

const RT: [Rule['type'], string][] = [['kw', '关键词'], ['domain', '网站'], ['recent', '最近'], ['stale', '不常用']];
function RuleEditor(p: { s: Extract<PopState, { kind: 'rule' }>; out: boolean }) {
  let el!: HTMLDivElement, inp!: HTMLInputElement;
  const f: Frame = S.frames[p.s.fid];
  const [r, setR] = createSignal<Rule>({ ...(f.rule || { type: 'kw', v: '' }) });
  const n = createMemo(() => ruleMatch({ type: r().type, v: r().type === 'stale' ? '' : r().v }).length);
  onMount(() => { placeAt(el, { x: 0, y: 0, anchor: p.s.anchor }); setTimeout(() => r().type !== 'stale' && inp.focus(), 30); });
  const done = () => {
    pushUndo();
    const auto = !f.name || f.name === '未命名' || f.auto;
    f.rule = { type: r().type, v: r().type === 'stale' ? '' : inp.value.trim() };
    if (auto) { f.name = autoName(f.rule); f.auto = true; }
    bump(); closePop(); sync(false);
  };
  return (
    <div ref={el} class="pop rulee" classList={{ out: p.out }}>
      <div class="seg2">
        <For each={RT}>{([k, name]) => <button classList={{ on: r().type === k }} onClick={() => { const v = k === 'recent' && !/^\d+$/.test(inp.value) ? '7' : inp.value; inp.value = v; setR({ type: k, v }); inp.focus(); }}>{name}</button>}</For>
      </div>
      <div class="rv">
        <input ref={inp} spellcheck={false} value={r().v || ''} hidden={r().type === 'stale'} inputmode={r().type === 'recent' ? 'numeric' : 'text'}
          placeholder={({ kw: '京都 小红书', domain: 'youtube.com', recent: '7', stale: '' } as const)[r().type]}
          onInput={e => setR({ ...r(), v: e.currentTarget.value })}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') { e.stopPropagation(); closePop(); } }} />
        <span class="u num">{(r().type === 'recent' ? '天内 · ' : '') + n() + ' 条'}</span>
      </div>
      <button class="ok" onClick={done}>完成</button>
    </div>
  );
}

export default function Pops() {
  const [shown, out] = presence(pop);
  return (
    <Show when={shown()} keyed>{s => s.kind === 'list' ? <ListPop s={s} out={out()} /> : <RuleEditor s={s} out={out()} />}</Show>
  );
}
