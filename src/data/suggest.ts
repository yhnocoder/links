/* Where a new link probably goes: the Sections whose links look most like it.
   Three signals: the same site and path, shared words in the title, and where links like it were put before.
   When nothing is clearly close, the answer is the Inbox. */
import { S, LK, linksOfBlock, type Frame } from '../board/state';
import { siteName, titleOf, type L } from '../cards/render';

const seg = typeof Intl !== 'undefined' && (Intl as any).Segmenter ? new (Intl as any).Segmenter('zh', { granularity: 'word' }) : null;
const STOP = new Set(['the', 'and', 'for', 'with', 'how', 'what', 'you', 'your', 'are', 'from', 'this', 'that', 'into', 'about', '一个', '我们', '你们', '他们', '这个', '那个', '什么', '怎么', '如何', '以及', '还是', '就是', '没有', '可以', '自己', '视频', '笔记', '分享']);
export function words(s: string): string[] {
  const t = s.toLowerCase().replace(/【[^】]*】/g, ' ');
  const out: string[] = [];
  if (seg) { for (const x of seg.segment(t)) if (x.isWordLike) out.push(x.segment); }
  else out.push(...t.split(/[^\p{L}\p{N}]+/u));
  /* CJK runs also count as overlapping pairs, so 京都旅行 and 京都 meet even when split differently */
  const cjk = t.match(/[㐀-鿿]{2,}/g) || [];
  for (const run of cjk) for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  return out.filter(w => w.length >= 2 && !STOP.has(w) && !/^\d+$/.test(w));
}
const path1 = (l: L) => { try { return new URL(l.url).pathname.split('/').filter(Boolean)[0] || ''; } catch { return ''; } };
/* very common hosts say little about the topic on their own */
const BROAD = /^(youtube\.com|bilibili\.com|xiaohongshu\.com|github\.com|zhihu\.com|medium\.com|twitter\.com|x\.com|weixin\.qq\.com|mp\.weixin\.qq\.com)$/;

export function suggest(l: L, max = 3): Frame[] {
  const q = new Set(words(titleOf(l) + ' ' + (l.ex || '').slice(0, 200) + ' ' + (l.by || '')));
  const host = l.host, p1 = path1(l);
  /* how rare each word is across everything placed, so 京都 counts for more than 攻略 */
  const df = new Map<string, number>(); let N = 0;
  const per = new Map<string, { f: Frame; ws: Set<string>[]; links: L[] }>();
  for (const id in S.blocks) {
    const b = S.blocks[id]; if (!b.sec) continue;
    const f = S.frames[b.sec]; if (!f || f.type !== 'sec') continue;
    let e = per.get(f.id); if (!e) per.set(f.id, (e = { f, ws: [], links: [] }));
    for (const x of linksOfBlock(b)) {
      const o = LK[x]; if (!o || o.id === l.id) continue;
      const ws = new Set(words(titleOf(o) + ' ' + (o.by || '')));
      ws.forEach(w => df.set(w, (df.get(w) || 0) + 1)); N++;
      e.ws.push(ws); e.links.push(o);
    }
  }
  const idf = (w: string) => Math.log(1 + N / (1 + (df.get(w) || 0)));
  const scored: [Frame, number][] = [];
  for (const { f, ws, links } of per.values()) {
    if (!links.length) continue;
    let s = 0;
    links.forEach((o, i) => {
      let m = 0;
      for (const w of q) if (ws[i].has(w)) m += idf(w);
      if (o.host === host) m += BROAD.test(host) ? 0.4 : 2.2;
      if (o.host === host && p1 && path1(o) === p1) m += BROAD.test(host) ? 1.6 : 0.8;
      if (o.by && l.by && o.by === l.by) m += 2.5;
      s += m;
    });
    /* a big Section is not right just because it is big */
    s = s / Math.sqrt(links.length + 2);
    const nameHit = [...q].filter(w => f.name.toLowerCase().includes(w)).reduce((a, w) => a + idf(w), 0);
    s += nameHit * 1.2;
    if (s > 0) scored.push([f, s]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  const top = scored[0]?.[1] || 0;
  if (top < 1.6) return [];
  return scored.filter(x => x[1] >= top * 0.45).slice(0, max).map(x => x[0]);
}
export const siteOfLink = siteName;
