/* The map: every board and Section as a tree, for jumping anywhere. */
import { For, Show, createMemo, createSignal, type JSX } from 'solid-js';
import { S, framesOf, countOf, linksInBoard, type Frame } from '../board/state';
import { goBoard, revealFrame } from '../board/engine';
import { mapOpen, modelVer, setInboxOpen, setMapOpen, viewId } from './bus';
import { ic } from './icons';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;
const load = (): string[] => { try { return JSON.parse(localStorage.getItem('links-mapopen') || '[]'); } catch { return []; } };
const byPos = (a: Frame, b: Frame) => a.gy - b.gy || a.gx - b.gx;

export default function MapPanel() {
  const [open, setOpen] = createSignal(new Set(load()));
  const toggle = (b: string) => { const s = new Set(open()); s.has(b) ? s.delete(b) : s.add(b); setOpen(s); try { localStorage.setItem('links-mapopen', JSON.stringify([...s])); } catch { /* fine */ } };
  const narrow = () => innerWidth < 760;
  const Row = (p: { d: number; cls?: string; icon: JSX.Element; name: string; cnt: number; tw?: boolean | null; onTw?: () => void; onClick: () => void }) => (
    <div class={`tr ${p.cls || ''}`} style={{ '--d': p.d }} onClick={p.onClick}>
      <Show when={p.tw != null} fallback={<span class="tw" />}>
        <span class="tw" classList={{ open: !!p.tw }} onClick={e => { e.stopPropagation(); p.onTw && p.onTw(); }}><Html h={ic('chev')} /></span>
      </Show>
      {p.icon}<span class="nm">{p.name}</span><span class="cnt num">{p.cnt}</span>
    </div>
  );
  const Fr = (p: { f: Frame; d: number }): JSX.Element => {
    const f = p.f;
    if (f.type === 'cover') {
      return (
        <>
          <Row d={p.d} cls={(viewId() === f.target ? 'cur ' : '') + 'bd'} icon={<Html h={ic('board')} />} name={(modelVer(), f.name)} cnt={(modelVer(), countOf(f))} tw={open().has(f.target!)} onTw={() => toggle(f.target!)}
            onClick={() => { if (narrow()) setMapOpen(false); goBoard(f.target!); }} />
          <Show when={open().has(f.target!)}><For each={(modelVer(), framesOf(f.target!).sort(byPos))}>{k => <Fr f={k} d={p.d + 1} />}</For></Show>
        </>
      );
    }
    return <Row d={p.d} cls={f.type === 'smart' ? 'sm' : ''} icon={<Html h={ic(f.type === 'smart' ? 'smart' : 'sec')} />} name={(modelVer(), f.name)} cnt={(modelVer(), countOf(f))} onClick={() => { if (narrow()) setMapOpen(false); revealFrame(f.id); }} />;
  };
  const tree = createMemo(() => { modelVer(); return mapOpen() && S ? framesOf(S.home).sort(byPos) : []; });
  return (
    <aside class="panel left glass" classList={{ off: !mapOpen() }} id="map" aria-label="地图">
      <div class="ph2"><b>地图</b><span class="grow" /><button class="xb" aria-label="关闭" onClick={() => setMapOpen(false)}><Html h={ic('x')} /></button></div>
      <div class="tree scroll pbody">
        <Show when={mapOpen() && S}>
          <Row d={0} cls={(viewId() === S.home ? 'cur ' : '') + 'bd'} icon={<span class="mk0" />} name="首页" cnt={(modelVer(), linksInBoard(S.home).length)} onClick={() => { if (narrow()) setMapOpen(false); goBoard(S.home); }} />
          <For each={tree()}>{f => <Fr f={f} d={1} />}</For>
          <div class="tsep" />
          <div class="tr ibx" style={{ '--d': 0 }} onClick={() => setInboxOpen(true)}><span class="tw" /><Html h={ic('inbox')} /><span class="nm">Inbox</span><span class="cnt num">{(modelVer(), S.inbox.length)}</span></div>
        </Show>
      </div>
    </aside>
  );
}
