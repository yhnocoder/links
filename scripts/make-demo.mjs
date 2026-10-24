// Builds the preview's sample libraries (十几条 / 两百多条 / 两千多条) from the full-product hi-fi:
// its sample generator, and its first-layout rules, so the preview opens on the same boards the hi-fi showed.
// usage: node scripts/make-demo.mjs <hi-fi folder>   → src/demo/{new,months,years}.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/make-demo.mjs <hi-fi folder>'); process.exit(1); }
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const app = read('app.js').split('\n');
/* the hi-fi's model and layout code: everything before it starts touching the page */
const end = app.findIndex(l => l.startsWith('/* ================= rendering'));
const core = app.slice(2, end).join('\n').replace('PAD = 10;', 'PAD = 6;');

const ctx = { window: {}, console, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: {} };
vm.createContext(ctx);
for (const f of ['imgmeta.js', 'si.js', 'data.js', 'cards.js']) vm.runInContext(read(f), ctx);
vm.runInContext('var D = window.D, C = window.C, IMGMETA = window.IMGMETA;', ctx);
const api = vm.runInContext(`(function(){ ${core}\n return { build, respace, get S(){ return S; }, get LK(){ return LK; } }; })()`, ctx);

const DAY = 86400000;
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const code = (s, n, abc) => { let h = hash(s), out = ''; for (let i = 0; i < n; i++) { h = Math.imul(h ^ (h >>> 13), 1597334677) >>> 0; out += abc[h % abc.length]; } return out; };
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_', HEX = '0123456789abcdef';
const IM = ctx.window.IMGMETA, SITES = ctx.window.D.SITES;

function urlOf(l) {
  const k = l.id + (l.t || '') + (l.q || '');
  switch (l.k) {
    case 'yt': return `https://www.youtube.com/watch?v=${code(k, 11, B64)}`;
    case 'bili': return `https://www.bilibili.com/video/BV1${code(k, 9, B58)}`;
    case 'xhs': return `https://www.xiaohongshu.com/explore/${code(k, 24, HEX)}`;
    case 'gh': return `https://github.com/${l.owner}/${l.repo}`;
    case 'ghpr': return `https://github.com/${l.owner}/${l.repo}/pull/${l.num}`;
    case 'paper': return `https://arxiv.org/abs/${l.aid}`;
    case 'chat': return `https://${l.host}/share/${code(k, 12, HEX)}`;
  }
  if (l.path) return 'https://' + l.path;
  return `https://${l.host}/${code(k, 8, HEX)}`;
}
function imageOf(l) {
  const m = l.img && IM[l.img]; if (!m) return null;
  const kind = l.k === 'yt' || l.k === 'bili' ? 'v' : l.k === 'xhs' ? (m.k.includes('x') ? 'x' : 'v') : 'o';
  if (!m.d[kind]) return null;
  return { key: `demo/i/${l.img}_${kind}.jpg`, w: m.d[kind][0], h: m.d[kind][1], fx: m.fx, fy: m.fy, t: m.t };
}
function metaOf(l) {
  switch (l.k) {
    case 'yt': return { by: l.by, durText: l.dur, viewsText: l.views, prog: l.prog };
    case 'bili': return { by: l.by, durText: l.dur, play: l.play, dm: l.dm, partText: l.part || undefined, prog: l.prog };
    case 'xhs': return { by: l.by, like: l.like, n: l.n, d: l.d };
    case 'gh': return { owner: l.owner, repo: l.repo, d: l.d, lang: l.lang, star: l.star, fork: l.fork, upText: l.up, topics: l.topics, readme: l.readme };
    case 'ghpr': return { owner: l.owner, repo: l.repo, num: l.num, state: l.state, diff: l.diff, cm: l.cm, upText: l.up, body: l.body };
    case 'paper': return { aid: l.aid, au: l.au, ab: l.ab };
    case 'chat': return { q: l.q, a: l.a };
  }
  return {};
}
const strip = (o, keys) => { const x = { ...o }; for (const k of keys) delete x[k]; for (const k in x) if (x[k] === undefined || (k === 'items' && x[k] == null)) delete x[k]; return x; };

fs.mkdirSync('src/demo', { recursive: true });
for (const tier of ['new', 'months', 'years']) {
  api.build(tier);
  const S = api.S, LK = api.LK;
  for (const bid in S.boards) api.respace(bid);
  const links = Object.values(LK).map(l => {
    if (l.k === 'paper') l.aid = `${2300 + (hash(l.id) % 30)}.${String(10000 + (hash(l.t || l.id) % 89999)).padStart(5, '0')}`;
    const img = imageOf(l), meta = strip(metaOf(l), []);
    const ago = l.added + (hash(l.id) % 997) / 1000;
    if (img) { meta.thumbPos = img.t; delete img.t; }
    /* times are kept as "days ago" and turned into dates when the preview opens */
    return {
      id: l.id, url: urlOf(l), host: l.host, kind: l.k, title: l.t || '', desc: l.ex || (l.k === 'gh' ? l.d : '') || '', siteName: l.sn || (SITES[l.site] || {}).n || '',
      image: img, meta, status: l.k === 'ghpr' ? 'ok' : l.state || 'ok', unimp: null, clicks: l.clicks || 0,
      ago, opened: l.opened >= 0 ? Math.min(ago, l.opened + (hash(l.id + 'o') % 997) / 1000) : null, inbox: S.loc[l.id] === 'inbox',
    };
  });
  const out = {
    links,
    boards: Object.values(S.boards).map(b => ({ id: b.id, name: b.name, parent: b.parent })),
    frames: Object.values(S.frames).map(f => strip(f, ['key', 'foot', 'nfold', 'peekV'])),
    blocks: Object.values(S.blocks).map(b => strip(b, ['proj'])),
  };
  fs.writeFileSync(`src/demo/${tier}.json`, JSON.stringify(out));
  console.log(tier, links.length, 'links', out.frames.length, 'frames', out.blocks.length, 'blocks', (fs.statSync(`src/demo/${tier}.json`).size / 1024).toFixed(0) + 'KB');
}
