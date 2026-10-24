import type { Kind, Unfurl } from '../shared/types';
import { hostOf, normalizeUrl, parseUrl, type Parsed } from '../shared/url';

/* Reading a page: platform APIs where they exist, the page's share tags otherwise.
   Pictures come back as remote URLs; the browser crops them and stores the result. */

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TIMEOUT = 8000;

export interface Env { GITHUB_TOKEN?: string }

const get = (url: string, init: RequestInit = {}) =>
  fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), ...init, headers: { 'user-agent': UA, 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8', ...(init.headers || {}) } });

const blank = (url: string, kind: Kind): Unfurl => ({ url, kind, title: '', desc: '', siteName: '', image: null, meta: {}, status: 'failed' });

export async function unfurl(input: string, env: Env): Promise<Unfurl> {
  let url = normalizeUrl(input), p = parseUrl(url);
  /* short links say nothing until they are followed */
  if (/^(b23\.tv|xhslink\.com|t\.co|bit\.ly|t\.cn|dwz\.cn|url\.cn|g\.co)$/.test(hostOf(url))) {
    try { const r = await get(url, { method: 'GET' }); url = normalizeUrl(r.url); p = parseUrl(url); r.body?.cancel(); } catch { /* keep the short form */ }
  }
  try {
    switch (p.kind) {
      case 'yt': return await youtube(url, p);
      case 'bili': return await bilibili(url, p);
      case 'gh': return await github(url, p, env);
      case 'ghpr': return await githubItem(url, p, env);
      case 'paper': return await arxiv(url, p);
      default: return await page(url, p.kind);
    }
  } catch {
    /* a platform API that refuses still leaves the page's own tags */
    try { return await page(url, p.kind); } catch { return blank(url, p.kind); }
  }
}

/* ---------- any page: Open Graph, Twitter cards, <title> ---------- */
export async function page(url: string, kind: Kind): Promise<Unfurl> {
  const res = await get(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !/html|xml/.test(type)) { res.body?.cancel(); return { ...blank(url, kind), siteName: hostOf(url) }; }
  const m: Record<string, string> = {};
  let title = '', inTitle = false;
  const rw = new HTMLRewriter()
    .on('meta', { element(e) { const k = (e.getAttribute('property') || e.getAttribute('name') || e.getAttribute('itemprop') || '').toLowerCase(), v = e.getAttribute('content'); if (k && v && !m[k]) m[k] = v.trim(); } })
    .on('title', { element() { inTitle = true; }, text(t) { if (inTitle) title += t.text; if (t.lastInTextNode) inTitle = false; } })
    .on('link[rel~="image_src"]', { element(e) { const h = e.getAttribute('href'); if (h && !m.image_src) m.image_src = h; } });
  await rw.transform(res).text();
  const abs = (s?: string) => { if (!s) return null; try { return new URL(s, res.url || url).toString(); } catch { return null; } };
  const t = clean(m['og:title'] || m['twitter:title'] || title || m['name'] || '');
  const siteName = clean(m['og:site_name'] || m['application-name'] || '') || hostOf(url);
  const desc = clean(m['og:description'] || m['twitter:description'] || m['description'] || '');
  const image = abs(m['og:image'] || m['og:image:url'] || m['twitter:image'] || m['twitter:image:src'] || m['image'] || m.image_src);
  const out: Unfurl = { url, kind, title: t, desc, siteName, image, meta: {}, status: t ? 'ok' : 'failed' };
  /* a title that only names the site says nothing about the page */
  if (t && (t === siteName || t.length < 3 || /^(home|首页|login|登录|sign in)$/i.test(t))) out.status = 'unclear';
  if (kind === 'xhs') { out.meta = { by: clean(m['og:xhs:note_author'] || '') || undefined, like: m['og:xhs:note_like'] || undefined }; out.title = out.title.replace(/\s*-\s*小红书$/, ''); }
  if (kind === 'chat') { out.meta = { q: out.title, a: out.desc }; }
  return out;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/* ---------- YouTube: oEmbed for the basics, the watch page for duration and views ---------- */
async function youtube(url: string, p: Parsed): Promise<Unfurl> {
  const id = p.ytId!;
  const oe = await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
  if (!oe.ok) throw new Error('oembed ' + oe.status);
  const o = await oe.json<{ title: string; author_name: string; thumbnail_url: string }>();
  const meta: Record<string, unknown> = { ytId: id, by: o.author_name };
  try {
    const html = await (await get(`https://www.youtube.com/watch?v=${id}&hl=zh-CN`)).text();
    const len = html.match(/"lengthSeconds":"(\d+)"/), views = html.match(/"viewCount":"(\d+)"/);
    if (len) meta.dur = +len[1];
    if (views) meta.views = +views[1];
  } catch { /* duration is a nice-to-have */ }
  return { url, kind: 'yt', title: o.title, desc: '', siteName: 'YouTube', image: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, meta, status: 'ok' };
}

/* ---------- Bilibili: the public view API ---------- */
async function bilibili(url: string, p: Parsed): Promise<Unfurl> {
  if (!p.bvid) return page(url, 'bili');
  const q = /^av\d+$/i.test(p.bvid) ? `aid=${p.bvid.slice(2)}` : `bvid=${p.bvid}`;
  const r = await get(`https://api.bilibili.com/x/web-interface/view?${q}`, { headers: { referer: 'https://www.bilibili.com/' } });
  const j = await r.json<any>();
  if (j.code !== 0 || !j.data) throw new Error('bili ' + j.code);
  const d = j.data, part = p.part && d.pages ? d.pages[p.part - 1] : null;
  return {
    url, kind: 'bili', title: d.title, desc: d.desc || '', siteName: '哔哩哔哩',
    image: String(d.pic || '').replace(/^http:/, 'https:') || null,
    meta: { bvid: d.bvid, by: d.owner?.name, dur: part ? part.duration : d.duration, play: d.stat?.view, dm: d.stat?.danmaku, parts: d.videos, part: p.part || null },
    status: 'ok',
  };
}

/* ---------- GitHub ---------- */
const LANG: Record<string, string> = { TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Rust: '#dea584', Go: '#00ADD8', Swift: '#F05138', Kotlin: '#A97BFF', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95', Lua: '#000080', Shell: '#89e051', HTML: '#e34c26', CSS: '#663399', Vue: '#41b883', Svelte: '#ff3e00', Dart: '#00B4AB', Zig: '#ec915c', Elixir: '#6e4a7e', Haskell: '#5e5086', Scala: '#c22d40', 'Objective-C': '#438eff', Astro: '#ff5a03', MDX: '#fcb32c', Jupyter: '#DA5B0B', 'Jupyter Notebook': '#DA5B0B' };
const gh = (path: string, env: Env) => get(`https://api.github.com${path}`, { headers: { accept: 'application/vnd.github+json', ...(env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) } });

async function github(url: string, p: Parsed, env: Env): Promise<Unfurl> {
  const [r, lr] = await Promise.all([gh(`/repos/${p.owner}/${p.repo}`, env), gh(`/repos/${p.owner}/${p.repo}/languages`, env)]);
  if (!r.ok) throw new Error('gh ' + r.status);
  const d = await r.json<any>(), langs = lr.ok ? await lr.json<Record<string, number>>() : {};
  const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
  let lang = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, b]) => [n, LANG[n] || '#8b949e', b / total] as [string, string, number]);
  if (!lang.length && d.language) lang = [[d.language, LANG[d.language] || '#8b949e', 1]];
  return {
    url, kind: 'gh', title: d.full_name, desc: d.description || '', siteName: 'GitHub', image: null,
    meta: { owner: d.owner?.login || p.owner, repo: d.name || p.repo, d: d.description || '', lang, star: d.stargazers_count, fork: d.forks_count, pushedAt: Date.parse(d.pushed_at) || null, topics: (d.topics || []).slice(0, 4) },
    status: 'ok',
  };
}

async function githubItem(url: string, p: Parsed, env: Env): Promise<Unfurl> {
  const base = { url, kind: 'ghpr' as const, siteName: 'GitHub', image: null };
  if (p.ghType === 'discussions') {
    const u = await page(url, 'ghpr');
    return { ...u, ...base, title: u.title.replace(/ · .*$/, ''), meta: { owner: p.owner, repo: p.repo, num: p.num, state: 'disc', cm: 0 } };
  }
  const r = await gh(`/repos/${p.owner}/${p.repo}/${p.ghType === 'pull' ? 'pulls' : 'issues'}/${p.num}`, env);
  if (!r.ok) throw new Error('gh ' + r.status);
  const d = await r.json<any>();
  const state = p.ghType === 'pull' ? (d.merged_at ? 'merged' : d.state === 'closed' ? 'closed' : d.draft ? 'draft' : 'open') : d.state === 'closed' ? 'closed' : 'issue';
  return {
    ...base, title: d.title, desc: '',
    meta: { owner: p.owner, repo: p.repo, num: p.num, state, add: d.additions ?? null, del: d.deletions ?? null, cm: d.comments ?? 0, at: Date.parse(d.merged_at || d.closed_at || d.updated_at) || null, body: String(d.body || '').replace(/<!--[\s\S]*?-->/g, '').replace(/[#*`>_\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240) },
    status: 'ok',
  };
}

/* ---------- arXiv ---------- */
async function arxiv(url: string, p: Parsed): Promise<Unfurl> {
  const xml = await (await get(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(p.arxiv!)}`)).text();
  const entry = xml.split('<entry>')[1] || '';
  const tag = (t: string) => clean((entry.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '');
  const title = tag('title');
  if (!title) throw new Error('arxiv empty');
  const au = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(m => clean(m[1]));
  return { url, kind: 'paper', title, desc: tag('summary'), siteName: 'arXiv', image: null, meta: { aid: p.arxiv, au: au.length > 3 ? au.slice(0, 3).join(', ') + ' 等' : au.join(', '), ab: tag('summary') }, status: 'ok' };
}
