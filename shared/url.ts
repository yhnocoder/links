import type { Kind } from './types';

/* tracking parameters that never change what a page is */
const JUNK = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_[ce]id|igshid|spm|spm_id_from|share_source|share_medium|share_plat|share_session_id|share_tag|share_from|vd_source|unique_k|timestamp|bbid|ts|from_spmid|si|feature|xsec_source|xsec_token|apptime|appuid|shareRedId|share_id|author_share|xhsshare|ref_src|ref_url)$/i;

/* one spelling per page, so the same link saved twice is recognised */
export function normalizeUrl(input: string): string {
  let s = input.trim();
  if (!/^[a-z][\w+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u: URL;
  try { u = new URL(s); } catch { return input.trim(); }
  u.hash = /^#\/|^#!/.test(u.hash) ? u.hash : '';
  u.hostname = u.hostname.toLowerCase();
  if (u.hostname === 'youtu.be') { const id = u.pathname.slice(1); u = new URL('https://www.youtube.com/watch'); u.searchParams.set('v', id); }
  if (/(^|\.)youtube\.com$/.test(u.hostname) && u.pathname.startsWith('/shorts/')) { const id = u.pathname.split('/')[2]; u = new URL('https://www.youtube.com/watch'); u.searchParams.set('v', id); }
  if (u.hostname === 'm.youtube.com') u.hostname = 'www.youtube.com';
  if (u.hostname === 'm.bilibili.com') u.hostname = 'www.bilibili.com';
  for (const k of [...u.searchParams.keys()]) if (JUNK.test(k)) u.searchParams.delete(k);
  if (/(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/watch') for (const k of [...u.searchParams.keys()]) if (k !== 'v' && k !== 't' && k !== 'list') u.searchParams.delete(k);
  let out = u.toString();
  if (u.pathname !== '/' && out.endsWith('/') && !u.search) out = out.slice(0, -1);
  return out;
}

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, ''); } };

export interface Parsed {
  kind: Kind;
  ytId?: string;
  bvid?: string;
  part?: number;
  owner?: string;
  repo?: string;
  num?: number;
  ghType?: 'pull' | 'issues' | 'discussions';
  arxiv?: string;
}

const GH_RESERVED = new Set(['settings', 'orgs', 'marketplace', 'explore', 'topics', 'trending', 'collections', 'sponsors', 'features', 'about', 'pricing', 'login', 'notifications', 'new', 'search']);

/* what kind of card a link becomes is decided by its address alone */
export function parseUrl(url: string): Parsed {
  let u: URL;
  try { u = new URL(url); } catch { return { kind: 'web' }; }
  const h = u.hostname.replace(/^www\./, ''), seg = u.pathname.split('/').filter(Boolean);
  if (h === 'youtube.com' && u.pathname === '/watch' && u.searchParams.get('v')) return { kind: 'yt', ytId: u.searchParams.get('v')! };
  if (h === 'bilibili.com' && seg[0] === 'video' && seg[1]) {
    const p = parseInt(u.searchParams.get('p') || '', 10);
    return { kind: 'bili', bvid: seg[1], part: p > 0 ? p : undefined };
  }
  if (h === 'b23.tv') return { kind: 'bili' };
  if ((h === 'xiaohongshu.com' || h === 'xhslink.com') && (seg[0] === 'explore' || seg[0] === 'discovery' || h === 'xhslink.com')) return { kind: 'xhs' };
  if (h === 'github.com' && seg.length >= 2 && !GH_RESERVED.has(seg[0])) {
    const [owner, repo] = seg;
    if ((seg[2] === 'pull' || seg[2] === 'issues' || seg[2] === 'discussions') && /^\d+$/.test(seg[3] || '')) return { kind: 'ghpr', owner, repo, num: +seg[3], ghType: seg[2] as Parsed['ghType'] };
    if (seg.length === 2 || seg[2] === 'tree' || seg[2] === 'blob') return { kind: 'gh', owner, repo };
  }
  if (h === 'arxiv.org' && (seg[0] === 'abs' || seg[0] === 'pdf') && seg[1]) return { kind: 'paper', arxiv: seg[1].replace(/\.pdf$/, '').replace(/v\d+$/, '') };
  if ((h === 'chatgpt.com' || h === 'chat.openai.com' || h === 'claude.ai' || h === 'gemini.google.com' || h === 'g.co') && seg.includes('share')) return { kind: 'chat' };
  return { kind: 'web' };
}

export const looksLikeUrl = (t: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/i.test(t.trim());
