import { notificationPreview } from './notificationContent';

export type Publication = {
  id: string; title: string; summary: string | null; category: string;
  cover_image: string | null; created_at: string; link: string | null;
  is_pinned: boolean; type: 'article' | 'notification';
};
export type PublicationFilter = { kind: 'all' | 'articles'; category: string; search: string };

export async function fetchPublicationPage(client: any, filter: PublicationFilter, offset = 0) {
  const pageSize = 15;
  const { data, error, status } = await client.rpc('publication_feed', {
    p_kind: filter.kind, p_category: filter.category, p_search: filter.search.trim(),
    p_offset: offset, p_limit: pageSize + 1,
  });
  if (error) throw { ...error, status };
  const rows = (data || []) as Publication[];
  return {
    items: rows.slice(0, pageSize).map(row => ({ ...row,
      summary: row.type === 'notification' ? notificationPreview(row.summary) : row.summary,
    })),
    hasMore: rows.length > pageSize,
    nextOffset: offset + Math.min(rows.length, pageSize),
  };
}

export function appendPublications(current: Publication[], incoming: Publication[]) {
  const seen = new Set(current.map(row => `${row.type}:${row.id}`));
  return [...current, ...incoming.filter(row => {
    const key = `${row.type}:${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  })];
}
