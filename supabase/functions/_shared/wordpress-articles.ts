const WEBSITE = 'https://asscubo.it';
export function decodeArticleText(value = ''): string {
  return value.replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => {
    const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '';
  }).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
export function wechatIdentity(value = ''): string {
  try {
    const u = new URL(decodeArticleText(value));
    if (u.hostname !== 'mp.weixin.qq.com' || !['http:', 'https:'].includes(u.protocol)) return '';
    const fields = ['__biz', 'mid', 'idx', 'sn'].map(k => u.searchParams.get(k));
    if (fields.every(Boolean)) return JSON.stringify(fields);
    return /^\/s\/[\w-]+\/?$/.test(u.pathname) ? u.pathname.replace(/\/$/, '') : '';
  } catch { return ''; }
}
function siteLink(value: string): string {
  try { const u = new URL(value); return u.origin === WEBSITE && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
function plainText(value = ''): string { return decodeArticleText(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
export type WebsiteArticle = { id: number; title: string; summary: string; link: string; original_link: string | null; article_key: string; cover_image: string | null; created_at: string };
export function websiteArticles(posts: any[]): WebsiteArticle[] {
  return posts.flatMap(p => {
    const link = siteLink(p.link || '');
    const original = String(p.boxue_source?.wechat_url || '');
    const rawDate = String(p.date_gmt || '');
    const date = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(rawDate) ? Date.parse(rawDate + 'Z') : NaN;
    if (!Number.isSafeInteger(p.id) || p.id <= 0 || !link || p.status !== 'publish' || p.content?.protected || !Number.isFinite(date)) return [];
    return [{ id: p.id, title: plainText(p.title?.rendered || '') || '无标题', summary: plainText(p.excerpt?.rendered || ''),
      link, original_link: wechatIdentity(original) ? original : null, article_key: String(p.boxue_source?.article_key || ''),
      cover_image: siteLink(p._embedded?.['wp:featuredmedia']?.[0]?.source_url || '') || null,
      created_at: new Date(date).toISOString() }];
  });
}
export function planWebsiteArticles(existing: any[], posts: WebsiteArticle[]) {
  const updates: { current: any; post: WebsiteArticle }[] = [];
  const inserts: WebsiteArticle[] = [];
  let skipped = 0;
  const seen = new Set<number>();
  for (const p of posts) {
    if (seen.has(p.id)) throw new Error('Website returned duplicate post IDs');
    seen.add(p.id);
    // WordPress ID, rather than title or old WeChat identity, defines an article.
    const byId = existing.filter(a => a.wordpress_post_id === p.id || (a.source === 'wordpress' && a.source_id === String(p.id)));
    if (byId.length > 1) throw new Error('Conflicting stored WordPress post IDs');
    const byLink = existing.filter(a => !a.wordpress_post_id && a.link === p.link);
    const current = byId[0] || (byLink.length === 1 ? byLink[0] : null);
    if (!current) { inserts.push(p); continue; }
    const same = current.wordpress_post_id === p.id && current.link === p.link && current.title === p.title &&
      (current.summary || '') === p.summary && current.cover_image === p.cover_image && Date.parse(current.created_at) === Date.parse(p.created_at);
    if (same) skipped++; else updates.push({ current, post: p });
  }
  return { updates, inserts, blocked: [], skipped };
}
export async function fetchWebsiteArticles(fetcher: typeof fetch = fetch): Promise<WebsiteArticle[]> {
  const all: any[] = [];
  let pages = 1;
  let total: number | null = null;
  for (let page = 1; page <= pages; page++) {
    const u = new URL(WEBSITE + '/wp-json/wp/v2/posts');
    u.searchParams.set('per_page', '100'); u.searchParams.set('page', String(page));
    u.searchParams.set('orderby', 'id'); u.searchParams.set('order', 'asc');
    u.searchParams.set('_embed', 'wp:featuredmedia');
    u.searchParams.set('_fields', 'id,status,title,excerpt,link,date_gmt,content.protected,boxue_source,_links,_embedded');
    const r = await fetcher(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Website articles request failed (HTTP ${r.status})`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('Website articles response is not a list');
    const pageHeader = r.headers.get('x-wp-totalpages');
    const countHeader = r.headers.get('x-wp-total');
    const totalPages = Number(pageHeader), count = Number(countHeader);
    if (pageHeader === null || countHeader === null || !Number.isSafeInteger(totalPages) || totalPages < 0 || !Number.isSafeInteger(count) || count < 0 || totalPages !== Math.ceil(count / 100)) throw new Error('Website article pagination is invalid');
    if (total !== null && (total !== count || pages !== totalPages)) throw new Error('Website changed during pagination; retry the complete sync');
    total = count; pages = totalPages; all.push(...data);
  }
  if (all.length !== total || new Set(all.map(p => p.id)).size !== all.length) throw new Error('Website article pagination is incomplete');
  const publicPosts = all.filter(p => p.status === 'publish' && !p.content?.protected);
  const parsed = websiteArticles(publicPosts);
  if (parsed.length !== publicPosts.length) throw new Error('Website returned an invalid public article; keeping the previous visible set');
  return parsed;
}
export async function syncWebsiteArticles(supabase: any, preview = false) {
  const [{ data: state, error: stateError }, posts] = await Promise.all([
    supabase.from('article_source_settings').select('wordpress_push_after').eq('singleton', true).single(),
    fetchWebsiteArticles(),
  ]);
  if (stateError || !state?.wordpress_push_after || !Number.isFinite(Date.parse(state.wordpress_push_after))) {
    throw new Error('Website sync database setup is missing; run migration 046 first');
  }
  const existing: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('articles')
      .select('id,title,summary,link,original_link,source,source_id,wordpress_post_id,cover_image,created_at,is_published').order('id').range(offset, offset + 499);
    if (error) throw error;
    existing.push(...data); if (data.length < 500) break;
  }
  const plan = planWebsiteArticles(existing, posts);
  const ids = posts.map(p => p.id), visible = new Set(ids);
  const result = { source: 'wordpress', fetched: posts.length, synced: 0, updated: 0, skipped: plan.skipped,
    archived: 0, activated: 0, visible: posts.length, blocked: [] as any[], pushEligible: [] as any[] };
  if (preview) return { ...result, preview: true, would_update: plan.updates.length, would_insert: plan.inserts.length,
    would_archive: existing.filter(a => a.is_published && !visible.has(a.wordpress_post_id)).length,
    updates: plan.updates.map(x => ({ id: x.current.id, title: x.post.title, from: x.current.link, to: x.post.link })) };
  for (const { current: a, post: p } of plan.updates) {
    // Website content and date are authoritative; retain App category, pins and view counts.
    const patch = { title: p.title, summary: p.summary, link: p.link, cover_image: p.cover_image,
      created_at: p.created_at, wordpress_post_id: p.id,
      original_link: a.original_link || (wechatIdentity(a.link || '') ? a.link : p.original_link) };
    let query = supabase.from('articles').update(patch).eq('id', a.id);
    query = a.link === null ? query.is('link', null) : query.eq('link', a.link);
    const { data, error } = await query.select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Article changed during sync; retry before activating website articles');
    result.updated++;
  }
  // Stage historical imports invisibly, then switch the whole visible set atomically.
  for (let offset = 0; offset < plan.inserts.length; offset += 100) {
    const batch = plan.inserts.slice(offset, offset + 100);
    const { data, error } = await supabase.from('articles').insert(batch.map(p => ({
      title: p.title, summary: p.summary, content: '网站外链文章', category: 'general', link: p.link,
      cover_image: p.cover_image, original_link: p.original_link, wordpress_post_id: p.id,
      source: 'wordpress', source_id: String(p.id), is_published: false, view_count: 0, created_at: p.created_at,
    }))).select('id,title,summary,link,created_at,wordpress_post_id');
    if (error) throw error;
    result.synced += data.length;
    result.pushEligible.push(...data.filter((a: any) => Date.parse(a.created_at) > Date.parse(state.wordpress_push_after)));
  }
  const { data: activation, error: activationError } = await supabase.rpc('activate_wordpress_articles', { p_post_ids: ids });
  if (activationError) throw activationError;
  result.archived = activation.archived;
  result.activated = activation.activated;
  result.visible = activation.visible;
  return result;
}
