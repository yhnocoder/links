import { Hono } from 'hono';
import { jwk } from 'hono/jwk';
import { getCookie, setCookie } from 'hono/cookie';
import * as v from 'valibot';
import { TABLES, type Snapshot } from '../shared/types';
import { normalizeUrl } from '../shared/url';
import { readAll, readSince, write, findByUrl } from './db';
import { unfurl } from './unfurl';

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_TOKEN?: string;
  /* the passphrase that opens the app (a Worker secret); without it the API stays shut */
  APP_TOKEN?: string;
  /* set both to require Cloudflare Access on the API (the browser and the extension's service token both pass it) */
  ACCESS_TEAM?: string; // e.g. "linda" for linda.cloudflareaccess.com
  ACCESS_AUD?: string;
}

const app = new Hono<{ Bindings: Env }>().basePath('/api');

/* ---------- passphrase: entered once per browser and kept as a cookie; the extension sends it as a bearer token ---------- */
const COOKIE = 'links_key';
const enc = new TextEncoder();
const same = (a: string, b: string) => {
  const x = enc.encode(a), y = enc.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
};
const local = (url: string) => ['localhost', '127.0.0.1'].includes(new URL(url).hostname);

const UNLOCK = (wrong: boolean) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Links</title>
<style>:root{color-scheme:light dark;--bg:#eceef2;--fg:#16181d;--card:#fff;--line:#d9dce3;--err:#d33}@media (prefers-color-scheme:dark){:root{--bg:#16181d;--fg:#eceef2;--card:#22252c;--line:#3a3e48}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.4 -apple-system,BlinkMacSystemFont,"PingFang SC",system-ui,sans-serif}
form{display:flex;gap:6px;padding:6px;border-radius:16px;background:var(--card);box-shadow:0 1px 2px #0001,0 8px 24px #0001}
input{width:240px;border:1px solid ${wrong ? 'var(--err)' : 'var(--line)'};border-radius:10px;padding:10px 12px;font:inherit;background:transparent;color:inherit;outline:none}
input:focus{border-color:var(--fg)}button{border:0;border-radius:10px;padding:0 16px;font:inherit;background:var(--fg);color:var(--bg);cursor:pointer}</style></head>
<body><form method="post" action="/api/unlock"><input type="password" name="key" placeholder="口令" autocomplete="current-password" autofocus required><button>进入</button></form></body></html>`;

app.get('/unlock', c => c.html(UNLOCK(false)));
app.post('/unlock', async c => {
  const key = String((await c.req.parseBody())['key'] || '');
  if (!c.env.APP_TOKEN || !same(key, c.env.APP_TOKEN)) return c.html(UNLOCK(true), 401);
  setCookie(c, COOKIE, key, { path: '/', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 400 * 86400 });
  return c.redirect('/', 303);
});

app.use('*', async (c, next) => {
  if (local(c.req.url)) return next();
  const key = getCookie(c, COOKIE) || c.req.header('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!c.env.APP_TOKEN || !same(key, c.env.APP_TOKEN)) return c.json({ error: 'locked' }, 401);
  return next();
});

/* Cloudflare Access sits in front of the whole site; the API checks the token it adds, so nothing else can reach the data */
app.use('*', async (c, next) => {
  if (!c.env.ACCESS_TEAM || !c.env.ACCESS_AUD) return next();
  return jwk({
    jwks_uri: `https://${c.env.ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`,
    headerName: 'Cf-Access-Jwt-Assertion',
    alg: ['RS256'],
    verification: { aud: c.env.ACCESS_AUD },
  })(c, next);
});

app.get('/state', async c => c.json(await readAll(c.env.DB)));

app.get('/changes', async c => c.json(await readSince(c.env.DB, Number(c.req.query('since')) || 0)));

const RowSchema = v.looseObject({ id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)), updatedAt: v.number(), deleted: v.optional(v.boolean()) });
const PushSchema = v.object(Object.fromEntries(TABLES.map(t => [t, v.optional(v.pipe(v.array(RowSchema), v.maxLength(5000)))])) as Record<keyof Snapshot, any>);

app.post('/push', async c => {
  const body = v.safeParse(PushSchema, await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: '数据格式不对' }, 400);
  const rev = await write(c.env.DB, body.output as Partial<Snapshot>);
  return c.json({ rev });
});

/* read a page; nothing is stored until the app pushes the link */
app.post('/unfurl', async c => {
  const { url } = await c.req.json<{ url: string }>().catch(() => ({ url: '' }));
  if (!url) return c.json({ error: '缺少网址' }, 400);
  const [u, existing] = await Promise.all([unfurl(url, c.env), findByUrl(c.env.DB, normalizeUrl(url))]);
  return c.json({ ...u, existing: existing ? existing.id : null });
});

/* pictures: fetched through here so the browser may crop them (other sites' images cannot be read by a page) */
app.get('/fetch-image', async c => {
  const src = c.req.query('url');
  if (!src || !/^https?:\/\//.test(src)) return c.text('bad url', 400);
  const host = new URL(src).hostname;
  /* image hosts that refuse requests from other sites */
  const referer = /hdslb\.com$|bilibili\.com$/.test(host) ? 'https://www.bilibili.com/' : /xhscdn\.com$/.test(host) ? 'https://www.xiaohongshu.com/' : undefined;
  const r = await fetch(src, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Mozilla/5.0 Links', ...(referer ? { referer } : {}) } });
  const type = r.headers.get('content-type') || '';
  const len = Number(r.headers.get('content-length') || 0);
  if (!r.ok || !type.startsWith('image/') || len > 12_000_000) { r.body?.cancel(); return c.text('not an image', 415); }
  return new Response(r.body, { headers: { 'content-type': type, 'cache-control': 'private, max-age=3600' } });
});

app.put('/images/:key', async c => {
  const key = c.req.param('key');
  if (!/^[\w.-]{1,80}$/.test(key)) return c.text('bad key', 400);
  const body = await c.req.arrayBuffer();
  if (body.byteLength > 2_000_000) return c.text('too large', 413);
  await c.env.IMAGES.put(key, body, { httpMetadata: { contentType: c.req.header('content-type') || 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
  return c.json({ key });
});

app.get('/images/:key', async c => {
  const obj = await c.env.IMAGES.get(c.req.param('key'));
  if (!obj) return c.text('not found', 404);
  const h = new Headers(); obj.writeHttpMetadata(h); h.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers: h });
});

app.notFound(c => c.json({ error: 'not found' }, 404));

export default app;
