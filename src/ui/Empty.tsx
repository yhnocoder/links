/* A board with nothing on it yet: the place to paste the first link, and, for a new library, to bring bookmarks over */
import { Show } from 'solid-js';
import { S } from '../board/state';
import { startSave } from '../data/save';
import { pickFile } from '../data/transfer';
import { modelVer, sheet, viewId } from './bus';
import { ic } from './icons';

const Html = (p: { h: string }) => <span style={{ display: 'contents' }} innerHTML={p.h} />;
const isUrl = (t: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(t.trim());

/* nothing on the board in view: zooming and the new-item button have nothing to act on yet */
export const boardBare = () => {
  modelVer(); const v = viewId();
  return !!S && !Object.values(S.frames).some(f => f.board === v) && !Object.values(S.blocks).some(b => b.board === v);
};

export default function Empty() {
  const bare = () => boardBare() && !sheet();
  const fresh = () => (modelVer(), !Object.values(S.loc).some(l => l !== 'del'));
  return (
    <Show when={bare()}>
      <div class="empty">
        <label class="ein glass"><Html h={ic('link')} />
          <input placeholder="粘贴链接" spellcheck={false} aria-label="粘贴链接"
            onPaste={e => { const t = e.clipboardData?.getData('text') || ''; if (isUrl(t)) { e.preventDefault(); e.stopPropagation(); startSave(t); } }}
            onKeyDown={e => { const v = e.currentTarget.value; if (e.key === 'Enter' && v.trim()) { e.preventDefault(); startSave(v); e.currentTarget.value = ''; } }} />
        </label>
        <Show when={fresh()}>
          <button class="eimp" onClick={pickFile}><Html h={ic('upload')} />导入浏览器书签</button>
        </Show>
      </div>
    </Show>
  );
}
