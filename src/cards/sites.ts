/* Sites the cards know by name. n = name, h = host, g/c = letter mark and colour, si = Simple Icons slug when the site has a logo.
   Any other host gets a letter mark in a colour picked from its name. */
export interface Site { key: string; n: string; h: string; g?: string; c?: string; si?: string; dot?: string }

const KNOWN: Record<string, Omit<Site, 'key'>> = {
    youtube: { n: 'YouTube', h: 'youtube.com', si: 'youtube' }, bilibili: { n: '哔哩哔哩', h: 'bilibili.com', si: 'bilibili' }, xhs: { n: '小红书', h: 'xiaohongshu.com', si: 'xiaohongshu' },
    github: { n: 'GitHub', h: 'github.com', si: 'github' }, arxiv: { n: 'arXiv', h: 'arxiv.org', si: 'arxiv' },
    chatgpt: { n: 'ChatGPT', h: 'chatgpt.com', g: 'G', c: '#10A37F', dot: '#10A37F' }, claude: { n: 'Claude', h: 'claude.ai', si: 'claude', dot: '#D97757' }, gemini: { n: 'Gemini', h: 'gemini.google.com', si: 'googlegemini', dot: '#8E75B2' },
    nextjs: { n: 'Next.js', h: 'nextjs.org', si: 'nextdotjs' }, mdn: { n: 'MDN', h: 'developer.mozilla.org', si: 'mdnwebdocs' }, react: { n: 'React', h: 'react.dev', si: 'react' },
    vercel: { n: 'Vercel', h: 'vercel.com', si: 'vercel' }, linear: { n: 'Linear', h: 'linear.app', si: 'linear' }, notion: { n: 'Notion', h: 'notion.so', si: 'notion' },
    sentry: { n: 'Sentry', h: 'sentry.io', si: 'sentry' }, cloudflare: { n: 'Cloudflare Docs', h: 'developers.cloudflare.com', si: 'cloudflare' }, tailwind: { n: 'Tailwind CSS', h: 'tailwindcss.com', si: 'tailwindcss' },
    ts: { n: 'TypeScript', h: 'typescriptlang.org', si: 'typescript' }, vite: { n: 'Vite', h: 'vite.dev', si: 'vite' }, so: { n: 'Stack Overflow', h: 'stackoverflow.com', si: 'stackoverflow' },
    stripe: { n: 'Stripe Docs', h: 'docs.stripe.com', si: 'stripe' }, figma: { n: 'Figma', h: 'figma.com', si: 'figma' }, framer: { n: 'Framer', h: 'framer.com', si: 'framer' },
    readcv: { n: 'Read.cv', h: 'read.cv', si: 'readdotcv' }, dribbble: { n: 'Dribbble', h: 'dribbble.com', si: 'dribbble' }, rauno: { n: 'rauno.me', h: 'rauno.me', g: 'R', c: '#1f1f1f' },
    emil: { n: 'emilkowal.ski', h: 'emilkowal.ski', g: 'E', c: '#2b2b2b' }, joshw: { n: 'Josh W. Comeau', h: 'joshwcomeau.com', g: 'J', c: '#6b4fd8' }, apple: { n: 'Apple Developer', h: 'developer.apple.com', si: 'apple' },
    hf: { n: 'Hugging Face', h: 'huggingface.co', si: 'huggingface' }, anthropic: { n: 'Anthropic', h: 'anthropic.com', si: 'anthropic' }, perplexity: { n: 'Perplexity', h: 'perplexity.ai', si: 'perplexity' },
    substack: { n: 'Substack', h: 'substack.com', si: 'substack' }, medium: { n: 'Medium', h: 'medium.com', si: 'medium' }, zhihu: { n: '知乎', h: 'zhihu.com', si: 'zhihu' },
    douban: { n: '豆瓣', h: 'douban.com', si: 'douban' }, wechat: { n: '微信公众号', h: 'mp.weixin.qq.com', si: 'wechat' }, pg: { n: 'Paul Graham', h: 'paulgraham.com', g: 'P', c: '#7a6a52' },
    sspai: { n: '少数派', h: 'sspai.com', g: '派', c: '#D71A1B' }, wiki: { n: 'Wikipedia', h: 'wikipedia.org', si: 'wikipedia' }, hn: { n: 'Hacker News', h: 'news.ycombinator.com', si: 'ycombinator' },
    x: { n: 'X', h: 'x.com', si: 'x' }, jg: { n: 'japan-guide', h: 'japan-guide.com', g: 'J', c: '#6b4f9e' }, gmap: { n: 'Google 地图', h: 'maps.google.com', si: 'googlemaps' },
    airbnb: { n: 'Airbnb', h: 'airbnb.com', si: 'airbnb' }, trip: { n: 'Tripadvisor', h: 'tripadvisor.com', si: 'tripadvisor' }, ikea: { n: 'IKEA', h: 'ikea.cn', si: 'ikea' },
    taobao: { n: '淘宝', h: 'taobao.com', si: 'taobao' }, xcf: { n: '下厨房', h: 'xiachufang.com', g: '厨', c: '#E3594B' }, guardian: { n: 'The Guardian', h: 'theguardian.com', si: 'theguardian' },
    kinfolk: { n: 'Kinfolk', h: 'kinfolk.com', g: 'K', c: '#3a3a3a' }, archdaily: { n: 'ArchDaily', h: 'archdaily.cn', g: 'A', c: '#1f1f1f' }, raycast: { n: 'Raycast', h: 'raycast.com', si: 'raycast' },
    obsidian: { n: 'Obsidian', h: 'obsidian.md', si: 'obsidian' }, spotify: { n: 'Spotify', h: 'open.spotify.com', si: 'spotify' }, gdocs: { n: 'Google 文档', h: 'docs.google.com', si: 'googledocs' },
    feishu: { n: '飞书', h: 'feishu.cn', g: '飞', c: '#3370ff' }, xq: { n: '雪球', h: 'xueqiu.com', g: '雪', c: '#1f6feb' }, geek: { n: '极客时间', h: 'time.geekbang.org', g: '极', c: '#F08A24' },
    python: { n: 'Python Docs', h: 'docs.python.org', si: 'python' }, docker: { n: 'Docker Docs', h: 'docs.docker.com', si: 'docker' }, fuji: { n: 'Fujifilm X Weekly', h: 'fujixweekly.com', g: 'F', c: '#2b6e4f' },
  };

export const SITES: Record<string, Site> = {};
for (const k in KNOWN) SITES[k] = { key: k, ...KNOWN[k] };

const byHost = Object.values(SITES).sort((a, b) => b.h.length - a.h.length);
const PALETTE = ['#6b7280', '#7a5a3c', '#2a7f9e', '#5b6b4a', '#b4690e', '#9b5a7a', '#6d6ac4', '#3f8f7a', '#a0522d', '#4b6584'];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/* the site a host belongs to; unknown hosts are remembered so the mark stays the same */
export function siteFor(host: string, name?: string): Site {
  const h = host.replace(/^www\./, '').toLowerCase();
  const k = byHost.find(s => h === s.h || h.endsWith('.' + s.h));
  if (k) return k;
  const key = 'h:' + h;
  if (!SITES[key]) {
    const label = (name || h).replace(/^(the|www)\s*/i, '');
    SITES[key] = { key, n: name || h, h, g: (label.match(/[\p{L}\p{N}]/u)?.[0] || '?').toUpperCase(), c: PALETTE[hash(h) % PALETTE.length] };
  } else if (name && SITES[key].n === h) SITES[key].n = name;
  return SITES[key];
}
