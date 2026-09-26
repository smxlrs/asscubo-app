import { supabase } from './supabase';
import { sendExpoPushMessages, type PushSendResult } from './expoPush';

export { sendExpoPushMessages } from './expoPush';
export type { ExpoPushMessage, PushSendResult } from './expoPush';

/**
 * Broadcasts a push notification to all registered Expo Push Tokens.
 * 
 * @param title The title of the push notification
 * @param body The text content of the push notification banner
 * @param category The subscription category (events, academic, life, general)
 * @param link Optional external link to redirect to when tapped (e.g. WeChat article)
 * @param articleId Optional internal article ID for deep linking
 */
export async function broadcastPushNotification(
  title: string,
  body: string,
  category: 'events' | 'academic' | 'life' | 'general',
  link?: string,
  articleId?: string,
  eventId?: string
): Promise<PushSendResult> {
  try {
    const tokens = new Set<string>();
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const { data, error, count } = await supabase.from('push_tokens')
        .select('token', { count: 'exact' }).order('token')
        .range(offset, offset + 499);
      if (error) throw error;
      if (!data?.length) break;
      data.forEach((row) => { if (row.token) tokens.add(row.token); });
      offset += data.length;
      total = count ?? (data.length < 500 ? offset : Infinity);
    }
    return await sendExpoPushMessages([...tokens].map((token) => ({
      to: token,
      sound: 'default' as const,
      title,
      body,
      data: { category, link, articleId, eventId },
    })));
  } catch (error) {
    console.warn('Failed to load push recipients:', error);
    return { success: false, sentCount: 0, failedCount: 0, error: '无法读取推送设备，请检查网络后重试。' };
  }
}
