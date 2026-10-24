/* A stored link turned into what a card shows: names, counts and times already worded the way the cards read them. */
import type { LinkRow } from '../../shared/types';
import { siteFor } from '../cards/sites';
import { parseUrl } from '../../shared/url';
import type { L } from '../cards/render';

const DAY = 86400000;
export const daysSince = (ms: number) => Math.max(0, Math.floor((Date.now() - ms) / DAY));

/* 1,234 · 1.2万 · 12万 */
export const num = (n: unknown) => {
  if (typeof n !== 'number' || !isFinite(n)) return n == null ? undefined : String(n);
  return n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '万' : n >= 1000 ? n.toLocaleString('en-US') : String(n);
};
export const fmtDur = (s: unknown) => {
  if (typeof s !== 'number' || !isFinite(s) || s <= 0) return undefined;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60), p = (v: number) => String(v).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(x)}` : `${m}:${p(x)}`;
};
const agoWords = (ms: number) => { const d = daysSince(ms); return d < 1 ? '今天' : d < 2 ? '昨天' : d < 7 ? `${d} 天前` : d < 30 ? `${Math.floor(d / 7)} 周前` : d < 365 ? `${Math.floor(d / 30)} 个月前` : `${Math.floor(d / 365)} 年前`; };
const dateWords = (ms: number) => { const d = new Date(ms); return `${d.getMonth() + 1} 月 ${d.getDate()} 日`; };

const AV = ['#7a5a3c', '#2a7f9e', '#5b6b4a', '#d08a3a', '#e08f97', '#5f93b6', '#8a7a5c', '#9b5a7a', '#6d6ac4', '#3f8f7a'];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const avatar = (name?: unknown): [string, string] | undefined => (typeof name === 'string' && name ? [name.slice(0, 1), AV[hash(name) % AV.length]] : undefined);

/* where pictures are served from: the app's own store, or files shipped with the preview */
export const imgSrc = (key: string) => (key.startsWith('demo/') ? key.slice(5) : `/api/images/${encodeURIComponent(key)}`);

export function toL(r: LinkRow): L {
  const site = siteFor(r.host, r.siteName || undefined), m = r.meta || {};
  const l: L = {
    id: r.id, k: r.kind, site: site.key, sn: site.n, host: r.host, url: r.url, path: r.url.replace(/^https?:\/\/(www\.)?/, ''),
    t: r.title, ex: r.desc,
    img: r.image ? { src: imgSrc(r.image.key), w: r.image.w, h: r.image.h, fx: r.image.fx, fy: r.image.fy } : null,
    thumb: r.image ? imgSrc(r.image.key.startsWith('demo/') ? r.image.key : r.image.key + '.t') : null,
    state: r.status === 'ok' ? undefined : r.status,
    added: daysSince(r.createdAt), opened: r.openedAt ? daysSince(r.openedAt) : -1, clicks: r.clicks || 0,
  };
  /* the preview's sample pictures share one strip of thumbnails */
  if (m.thumbPos != null) { l.thumbPos = m.thumbPos; l.thumb = null; }
  /* what GitHub's address already says, for links read while its API refused */
  const gp = r.kind === 'gh' || r.kind === 'ghpr' ? parseUrl(r.url) : {} as ReturnType<typeof parseUrl>;
  const boiler = (d?: unknown) => (typeof d === 'string' && /^Contribute to .+ development by creating an account on GitHub\.$/.test(d) ? '' : d);
  switch (r.kind) {
    case 'yt': Object.assign(l, { by: m.by, dur: fmtDur(m.dur) ?? m.durText, views: m.views != null ? num(m.views) + '次观看' : m.viewsText, av: avatar(m.by), prog: m.prog }); break;
    case 'bili': Object.assign(l, { by: m.by, dur: fmtDur(m.dur) ?? m.durText, play: num(m.play), dm: num(m.dm), part: typeof m.parts === 'number' && m.parts > 1 ? `P${m.parts}` : m.partText, prog: m.prog }); break;
    case 'xhs': Object.assign(l, { by: m.by, like: num(m.like), n: m.n || 1, av: avatar(m.by), d: m.d }); break;
    case 'gh': if (!m.owner && gp.owner) l.t = `${gp.owner}/${gp.repo}`; Object.assign(l, { owner: m.owner || gp.owner, repo: m.repo || gp.repo, ghPath: m.path ?? gp.ghPath, d: boiler(m.d ?? r.desc), lang: m.lang, star: num(m.star), fork: num(m.fork), up: m.pushedAt ? agoWords(m.pushedAt as number) + '更新' : m.upText, topics: m.topics, readme: m.readme }); break;
    case 'ghpr': {
      const st = m.state as string | undefined, at = m.at as number | undefined;
      const up = !at ? m.upText : st === 'merged' ? dateWords(at) + '合并' : st === 'closed' ? dateWords(at) + '关闭' : agoWords(at) + '更新';
      if (!m.owner) l.t = l.t.replace(/ · (Pull Request|Issue|Discussion) #\d+ · .*$/, '').replace(/ by [\w-]+$/, '');
      Object.assign(l, { owner: m.owner || gp.owner, repo: m.repo || gp.repo, num: m.num || gp.num, prState: st, diff: m.add != null ? [`+${num(m.add)}`, `−${num(m.del)}`] : m.diff || null, cm: m.cm, up, body: m.body });
      break;
    }
    case 'paper': Object.assign(l, { aid: m.aid, au: m.au, ab: m.ab ?? r.desc }); break;
    case 'chat': Object.assign(l, { q: m.q || r.title, a: m.a || r.desc }); break;
  }
  return l;
}
