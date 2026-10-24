/* The Inbox: everything not on a board yet, newest first, by day or by site. Rows drag out onto the canvas. */
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js';
import { S, LK, groupBy, bucket, ago, cold, unimportant } from '../board/state';
import { markOf, siteName, titleOf, type L } from '../cards/render';
import { deleteInbox, inboxToBoard, pressExt, setUnimp } from '../board/engine';
import { rows } from '../data/store';
import { dropOn, inboxFlash, inboxOpen, modelVer, openMenu, setInboxOpen, setUnimpOpen, unimpOpen } from './bus';
import { ic } from './icons';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;
const store = { get: (k: string, d: string) => { try { return localStorage.getItem(k) || d; } catch { return d; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* fine */ } } };

export default function Inbox() {
  const [mode, setMode] = createSignal<'date' | 'site'>(store.get('links-imode', 'date') as 'date' | 'site');
  let body!: HTMLDivElement;
  const isUn = (l: L) => !S.keep[l.id] && (!!S.unimp[l.id] || unimportant(l));
  const data = createMemo(() => {
    modelVer(); if (!inboxOpen()) return null;
    const all = S.inbox.map(id => LK[id]).filter(Boolean) as L[];
    const un = all.filter(isUn), main = all.filter(l => !isUn(l));
    const groups = mode() === 'date'
      ? groupBy(main.slice().sort((a, b) => a.added - b.added), l => bucket(l.added)).sort((a, b) => a[1][0].added - b[1][0].added).map(([k, ls]) => ({ key: k, head: null as L | null, ls }))
      : groupBy(main, l => siteName(l)).map(([k, ls]) => ({ key: k, head: ls[0], ls: ls.sort((a, b) => a.added - b.added) }));
    return { groups, un: un.sort((a, b) => a.added - b.added), empty: !all.length };
  });
  /* recent rows say the time of day; older ones say how long ago */
  const when = (l: L) => {
    if (mode() !== 'date' || l.added >= 2) return ago(l.added);
    const r = rows[l.id], t = new Date(r?.inboxAt ?? r?.createdAt ?? Date.now());
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  };
  createEffect(on(inboxFlash, f => {
    if (!f.ids.length) return;
    requestAnimationFrame(() => f.ids.forEach(id => { const r = body.querySelector(`.irow[data-l="${id}"]`); if (r) { r.classList.remove('flash'); void (r as HTMLElement).offsetWidth; r.classList.add('flash'); r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }));
  }, { defer: true }));
  const more = (e: MouseEvent, l: L) => {
    e.stopPropagation();
    const un = isUn(l);
    openMenu(0, 0, [
      { t: '放到这块白板上', ic: 'board', act: () => inboxToBoard(l.id) },
      { t: un ? '移出不常用' : '标为不常用', ic: 'fold', act: () => setUnimp(l.id, !un) },
      '-',
      { t: '删除', ic: 'trash', danger: true, act: () => deleteInbox(l.id) },
    ], e.currentTarget as Element);
  };
  const Row = (p: { l: L }) => (
    <div class="irow" classList={{ cold: cold(p.l) }} data-l={p.l.id}
      onPointerDown={e => { if (e.button !== 0 || (e.target as HTMLElement).closest('.more')) return; pressExt(e, p.l.id, { type: 'inbox' }, e.currentTarget); }}>
      <Html h={markOf(p.l)} /><span class="t">{titleOf(p.l)}</span><span class="a num">{when(p.l)}</span>
      <button class="more" aria-label="更多" onClick={e => more(e, p.l)}><Html h={ic('more')} /></button>
    </div>
  );
  return (
    <aside class="panel right glass" classList={{ off: !inboxOpen() }} id="inbox" aria-label="Inbox">
      <div class="ph2">
        <b>Inbox</b><span class="grow" />
        <div class="seg2">
          <button classList={{ on: mode() === 'date' }} onClick={() => { setMode('date'); store.set('links-imode', 'date'); }}>日期</button>
          <button classList={{ on: mode() === 'site' }} onClick={() => { setMode('site'); store.set('links-imode', 'site'); }}>网站</button>
        </div>
        <button class="xb" aria-label="关闭" onClick={() => setInboxOpen(false)}><Html h={ic('x')} /></button>
      </div>
      <div ref={body} class="pbody scroll" classList={{ drop: dropOn()?.type === 'inbox' && !(dropOn() as any).btn }}>
        <Show when={data()}>{d => (
          <>
            <For each={d().groups}>{g => (
              <>
                <div class="gh"><Show when={g.head} fallback={g.key}>{h => <><Html h={markOf(h())} /><span>{g.key}</span></>}</Show></div>
                <For each={g.ls}>{l => <Row l={l} />}</For>
              </>
            )}</For>
            <Show when={d().empty}><div class="iempty"><Html h={ic('check')} /></div></Show>
            <Show when={d().un.length}>
              <button class="gh fold" classList={{ open: unimpOpen() }} onClick={() => setUnimpOpen(!unimpOpen())}>
                <span class="tw"><Html h={ic('chev')} /></span><span>不常用</span><span class="cnt num">{d().un.length}</span>
              </button>
              <Show when={unimpOpen()}><For each={d().un}>{l => <Row l={l} />}</For></Show>
            </Show>
          </>
        )}</Show>
      </div>
    </aside>
  );
}
