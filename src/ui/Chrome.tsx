/* The floating chrome: map and where you are (top left), search, Inbox, settings (top right), zoom and "new" (bottom right) */
import { For, Show, createSignal } from 'solid-js';
import { S } from '../board/state';
import { createItems, fitAll, goBoard, isFs, toggleFs, zoomStep } from '../board/engine';
import { openInput } from '../data/save';
import { exportBackup, pickFile } from '../data/transfer';
import { crumbs, dropOn, inboxOpen, mapOpen, menu, modelVer, openMenu, closeMenus, setInboxOpen, setMapOpen, setPaletteOpen, syncState, viewId, zoomPct } from './bus';
import { ic } from './icons';
import { boardBare } from './Empty';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;
const fmt = (n: number) => n.toLocaleString('en-US');

export type Theme = '' | 'light' | 'dark';
const readTheme = (): Theme => { try { return (localStorage.getItem('links-theme') || '') as Theme; } catch { return ''; } };
export const applyTheme = (t: Theme) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
const [theme, setThemeSig] = createSignal<Theme>(readTheme());
const setTheme = (t: Theme) => { setThemeSig(t); try { localStorage.setItem('links-theme', t); } catch { /* fine */ } applyTheme(t); };

/* a menu button opens its menu, and closes it when pressed again */
const toggleMenu = (el: Element, items: Parameters<typeof openMenu>[2]) => { const m = menu(); if (m && m.anchor === el) { closeMenus(); return; } openMenu(0, 0, items, el); };

export default function Chrome() {
  const narrow = () => innerWidth < 760;
  const toggleMap = () => { const on = !mapOpen(); setMapOpen(on); if (on && narrow()) setInboxOpen(false); };
  const toggleInbox = () => { const on = !inboxOpen(); setInboxOpen(on); if (on && narrow()) setMapOpen(false); };
  const settings = (el: Element) => {
    const tick = (on: boolean) => (on ? 'check' : 'blank');
    toggleMenu(el, [
      { lab: '外观' },
      { t: '跟随系统', ic: tick(theme() === ''), act: () => setTheme('') },
      { t: '浅色', ic: tick(theme() === 'light'), act: () => setTheme('light') },
      { t: '深色', ic: tick(theme() === 'dark'), act: () => setTheme('dark') },
      '-',
      { t: isFs() ? '退出全屏' : '全屏', ic: 'expand', kbd: '⌃⌘F', act: toggleFs },
      '-',
      { t: '导入书签…', ic: 'upload', act: pickFile },
      { t: '导出备份', ic: 'download', act: exportBackup },
    ]);
  };
  const inboxN = () => (modelVer(), S ? S.inbox.length : 0);
  return (
    <>
      <div class="fl tl glass" id="tl">
        <button class="tb" id="mapBtn" classList={{ on: mapOpen() }} data-tip="地图" aria-label="地图" onClick={toggleMap}><span class="mark" /></button>
        <nav class="crumbs" id="crumbs" aria-label="位置">
          <For each={crumbs()}>{(c, i) => (
            <>
              <Show when={i() > 0}><svg class="ic sl" viewBox="0 0 16 16" innerHTML={'<path d="M6 4l4 4-4 4"/>'} /></Show>
              <button class="cr" classList={{ cur: c.id === viewId(), drop: dropOn()?.type === 'crumb' && (dropOn() as any).board === c.id }} data-b={c.id} onClick={() => c.id !== viewId() && goBoard(c.id)}><span>{c.name}</span></button>
            </>
          )}</For>
        </nav>
      </div>
      <div class="fl tbr glass" id="tr">
        <Show when={syncState() === 'offline' || syncState() === 'error'}>
          <span class="tb sync" data-tip={syncState() === 'offline' ? '离线，联网后会同步' : '同步出错，正在重试'}><Html h={ic('cloudoff')} /></span>
        </Show>
        <button class="tb" id="qBtn" data-tip="搜索" data-kbd="⌘K" aria-label="搜索" onClick={() => setPaletteOpen(true)}><Html h={ic('search')} /></button>
        <button class="tb ib" id="inboxBtn" classList={{ on: inboxOpen(), drop: dropOn()?.type === 'inbox' }} data-tip="Inbox" aria-label="Inbox" onClick={toggleInbox}>
          <Html h={ic('inbox')} /><span class="cnt num">{inboxN() ? fmt(inboxN()) : ''}</span>
        </button>
        <button class="tb" id="setBtn" data-tip="设置" aria-label="设置" onClick={e => settings(e.currentTarget)}><Html h={ic('sliders')} /></button>
      </div>
      <div class="fl br glass hud" classList={{ idle: boardBare() }} id="hud">
        <button class="tb" data-tip="缩小" data-kbd="⌘−" aria-label="缩小" onClick={() => zoomStep(-1)}><Html h={ic('minus')} /></button>
        <button class="tb z num" data-tip="显示全部" data-kbd="⌘0" onClick={() => fitAll()}>{zoomPct()}%</button>
        <button class="tb" data-tip="放大" data-kbd="⌘+" aria-label="放大" onClick={() => zoomStep(1)}><Html h={ic('zin')} /></button>
      </div>
      <button class="fab" id="addBtn" classList={{ on: !!menu() && menu()!.anchor?.id === 'addBtn' }} data-tip="新建" aria-label="新建"
        onClick={e => { (void viewId()); toggleMenu(e.currentTarget, createItems(openInput)); }}><Html h={ic('plus')} /></button>
    </>
  );
}
