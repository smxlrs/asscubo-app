const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
function decode(s = '') {
  return s.replace(/&(?:amp|#0*38|#x0*26);/gi, '&').replace(/&quot;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
}
function key(value) {
  try {
    const u = new URL(decode(value));
    if (u.hostname !== 'mp.weixin.qq.com' || !['http:', 'https:'].includes(u.protocol)) return '';
    const q = ['__biz', 'mid', 'idx', 'sn'].map(k => u.searchParams.get(k));
    if (q.every(Boolean)) return JSON.stringify(q);
    return /^\/s\/[\w-]+\/?$/.test(u.pathname) ? u.pathname.replace(/\/$/, '') : '';
  } catch { return ''; }
}
function sourceKeys(post) {
  const exact = key(post.boxue_source?.wechat_url);
  if (exact) return [exact];
  // Only inspect the plugin's explicit source block, never links inside the article.
  const blocks = (post.content?.rendered || '').match(/<p\b[^>]*class=["'][^"']*\bwxsync-source\b[^"']*["'][^>]*>[\s\S]*?<\/p>/gi) || [];
  const keys = blocks.flatMap(b => [...b.matchAll(/href=["']([^"']+)["']/gi)].map(m => key(m[1]))).filter(Boolean);
  return [...new Set(keys)];
}
function title(s) { return decode(s).normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }
function audit(articles, posts) {
  return articles.map(a => {
    const k = key(a.link);
    const matches = posts.filter(p => p.link === a.link || (k && sourceKeys(p).includes(k)) || (a.source === 'wechat' && a.source_id && p.boxue_source?.article_key === a.source_id));
    const review = posts.filter(p => title(p.title?.rendered || '') === title(a.title || ''));
    return { id: a.id, title: a.title, original_link: a.link, created_at: a.created_at,
      status: matches.length === 1 ? 'exact' : matches.length > 1 ? 'ambiguous' : review.length ? 'title_review' : 'unmatched',
      websites: (matches.length ? matches : review).map(p => ({ id: p.id, title: p.title.rendered, link: p.link, date_gmt: p.date_gmt })) };
  });
}
async function json(url, options) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${new URL(url).hostname}`);
  return { data: await r.json(), headers: r.headers };
}
async function main() {
  const env = JSON.parse(fs.readFileSync(path.join(__dirname, '../../student-app/eas.json'), 'utf8')).build.production.env;
  const articles = [];
  for (let offset = 0; ; offset += 500) {
    const { data } = await json(`${env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/articles?select=id,title,link,created_at,source,source_id&order=created_at.desc,id.asc&limit=500&offset=${offset}`, { headers: { apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY } });
    articles.push(...data); if (data.length < 500) break;
  }
  const posts = [];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const { data, headers } = await json(`https://asscubo.it/wp-json/wp/v2/posts?per_page=30&page=${page}&_fields=id,title,link,date_gmt,boxue_source`);
    pages = Number(headers.get('x-wp-totalpages') || 1); posts.push(...data);
  }
  const rows = audit(articles, posts);
  const counts = rows.reduce((r, x) => { r[x.status] = (r[x.status] || 0) + 1; return r; }, {});
  const report = { generated_at: new Date().toISOString(), mode: 'read-only', articles: articles.length, posts: posts.length,
    bridge_posts: posts.filter(p => p.boxue_source?.wechat_url).length, counts, rows };
  const out = path.join(__dirname, '../../.tmp/wordpress-migration'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(report, null, 2));
  const lines = ['# 网站文章匹配检查', '', `App 可见文章：${articles.length}；网站已发布文章：${posts.length}。`, '',
    ...Object.entries(counts).map(([k, n]) => `- ${k}：${n}`), '', 'exact：原始链接相同；title_review：仅标题相同，需要核对；ambiguous：多篇匹配；unmatched：未匹配。', '',
    ...rows.flatMap(x => [`## ${x.title}`, `状态：${x.status}`, ...x.websites.map(w => `- [网站文章 ${w.id}](${w.link})`), ''])];
  fs.writeFileSync(path.join(out, 'audit.md'), lines.join('\n'));
  console.log(JSON.stringify({ articles: articles.length, posts: posts.length, bridge_posts: report.bridge_posts, counts, report: out }, null, 2));
}
module.exports = { key, sourceKeys, audit };
if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
