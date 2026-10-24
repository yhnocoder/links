import { Show } from 'solid-js';
import { closeToast, toastSig } from './bus';
import { presence } from './float';

export default function Toast() {
  const [shown, out] = presence(toastSig, 140);
  return (
    <Show when={shown()} keyed>{t => (
      <div class="toast" classList={{ out: out() }}>
        <span>{t.msg}</span>
        <Show when={t.act}><button onClick={() => { closeToast(); t.fn && t.fn(); }}>{t.act}</button></Show>
      </div>
    )}</Show>
  );
}
