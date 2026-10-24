import { Hono } from 'hono';
import { jwk } from 'hono/jwk';
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
  /* required in production: without both the API answers 503 except on localhost (the browser and the extension's service token both pass Access) */
  ACCESS_TEAM?: string; // e.g. "linda" for linda.cloudflareaccess.com
  ACCESS_AUD?: string;
}

const app = new Hono<{ Bindings: Env }>().basePath('/api');

/* Cloudflare Access sits in front of the whole site; the API checks the token it adds, so nothing else can reach the data */
app.use('*', async (c, next) => {
  if (!c.env.ACCESS_TEAM || !c.env.ACCESS_AUD) return new URL(c.req.url).hostname === 'localhost' ? next() : c.text('Access not configured', 503);
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
