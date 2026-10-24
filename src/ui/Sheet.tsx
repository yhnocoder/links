/* Saving a link: paste an address, see the card, put it where it belongs with one key */
import { For, Show, createEffect, onMount } from 'solid-js';
import { LK, P } from '../board/state';
import { fit, render } from '../cards/render';
import { closeSheet, saveTo, sheetLink, sheetSuggest, sheetVer, startSave } from '../data/save';
import { sheet } from './bus';
import { ic } from './icons';
import { presence } from './float';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;

function Input(p: { out: boolean }) {
  let inp!: HTMLInputElement;
  onMount(() => setTimeout(() => inp.focus(), 30));
  return (
    <div class="sheet glass" classList={{ out: p.out }}>
      <label class="lp-q" style={{ height: '40px', margin: 0 }}><Html h={ic('link')} />
        <input ref={inp} placeholder="粘贴链接" spellcheck={false} style={{ 'font-size': '14px' }}
          onKeyDown={e => { if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); startSave(inp.value); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(true); } }} />
      </label>
    </div>
  );
}

function Save(p: { out: boolean }) {
  let prev!: HTMLDivElement;
  const card = () => {
    sheetVer(); const l = sheetLink(); if (!l) return '';
    const r = render({ kind: 'card', link: l.id }, 3, 1, LK);
    return `<div class="c ${r.cls}" style="width:${P(3)}px;height:${P(1)}px;${r.style || ''}">${r.html}</div>`;
  };
  createEffect(() => { card(); requestAnimationFrame(() => prev && fit(prev)); });
  const sg = () => sheetSuggest(), main = () => sg()[0];
  return (
    <div class="sheet glass" classList={{ out: p.out }}>
      <div ref={prev} class="cprev" innerHTML={card()} />
      <div class="cact">
        <Show when={main()} fallback={<button class="go" onClick={() => saveTo('inbox')}><Html h={ic('inbox')} /><span>放进 Inbox</span><kbd>↩</kbd></button>}>
          {m => <button class="go" onClick={() => saveTo(m().id)}><Html h={ic('sec')} /><span>放进「{m().name}」</span><kbd>↩</kbd></button>}
        </Show>
        <div class="alts">
          <For each={sg().slice(1)}>{f => <button onClick={() => saveTo(f.id)}>{f.name}</button>}</For>
          <Show when={main()}><button class="ib" onClick={() => saveTo('inbox')}><Html h={ic('inbox')} />Inbox</button></Show>
        </div>
      </div>
    </div>
  );
}

export default function Sheet() {
  const [shown, out] = presence(sheet, 140);
  return <Show when={shown()} keyed>{s => (s.mode === 'input' ? <Input out={out()} /> : <Save out={out()} />)}</Show>;
}
