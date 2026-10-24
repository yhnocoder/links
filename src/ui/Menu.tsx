import { For, Match, Show, Switch, onMount } from 'solid-js';
import { closeMenus, menu, type MenuItem, type MenuState } from './bus';
import { ic } from './icons';
import { placeAt, presence } from './float';

function Box(p: { m: MenuState; out: boolean }) {
  let el!: HTMLDivElement;
  onMount(() => placeAt(el, p.m));
  const run = (f: () => void) => { closeMenus(); f(); };
  return (
    <div ref={el} class="menu" classList={{ out: p.out }} role="menu" style={{ 'pointer-events': p.out ? 'none' : undefined }}>
      <For each={p.m.items}>{(it: MenuItem) => (
        <Switch>
          <Match when={it === '-'}><div class="msep" /></Match>
          <Match when={it && typeof it === 'object' && 'lab' in it && it}>{x => <div class="mlab">{x().lab}</div>}</Match>
          <Match when={it && typeof it === 'object' && 'seg' in it && it}>{x => (
            <>
              <div class="mlab">{x().seg}</div>
              <div class="mseg">
                <For each={x().opts}>{([v, n]) => <button classList={{ on: x().cur === v }} onClick={() => run(() => x().fn(v))}>{n}</button>}</For>
              </div>
            </>
          )}</Match>
          <Match when={it && typeof it === 'object' && 'sizes' in it && it}>{x => (
            <div class="msz">
              <For each={x().sizes}>{s => (
                <button classList={{ on: s.on }} data-tip={`${s.w} × ${s.h}`} id={`sz${s.w}${s.h}`} onClick={() => run(() => x().fn(s.w, s.h))}>
                  <i style={{ width: s.w * 6 + 2 + 'px', height: s.h * 6 + 2 + 'px' }} />
                </button>
              )}</For>
            </div>
          )}</Match>
          <Match when={it && typeof it === 'object' && 't' in it && it}>{x => (
            <button class="mi" classList={{ danger: !!x().danger }} role="menuitem" disabled={x().off} onClick={() => run(x().act)}>
              <Show when={x().ic}><span style={{ display: 'contents' }} innerHTML={ic(x().ic!)} /></Show>
              <span>{x().t}</span>
              <Show when={x().kbd}><kbd>{x().kbd}</kbd></Show>
            </button>
          )}</Match>
        </Switch>
      )}</For>
    </div>
  );
}

export default function Menu() {
  const [shown, out] = presence(menu);
  return <Show when={shown()} keyed>{m => <Box m={m} out={out()} />}</Show>;
}
