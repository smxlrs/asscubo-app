export type FeedbackMedia = { url: string; type: 'image' | 'video' };
const isVideoUrl = (url: string) => /\.(mp4|mov|m4v|webm|avi)(?:[?#]|$)/i.test(url);
export function getFeedbackMedia(mediaUrl: string | null): FeedbackMedia[] {
  if (!mediaUrl?.trim()) return [];
  let entries: unknown[];
  try {
    const parsed: unknown = JSON.parse(mediaUrl);
    entries = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Older feedback records store one public URL.
    entries = [mediaUrl];
  }
  return entries.flatMap((entry): FeedbackMedia[] => {
    const value = typeof entry === 'string' ? { url: entry } : entry;
    if (!value || typeof value !== 'object' || !('url' in value) || typeof value.url !== 'string') return [];
    const url = value.url.trim();
    if (!/^https?:\/\//i.test(url)) return [];
    return [{ url, type: ('type' in value && value.type === 'video') || isVideoUrl(url) ? 'video' : 'image' }];
  });
}
