import { fetchWithDeadline } from './network';
import { supabase } from './supabase';

// A full website scan can exceed a normal API request (225 updates took 70s).
// Keep this exception local to the explicit administrator action.
export const WEBSITE_SYNC_TIMEOUT_MS = 120_000;

export async function requestWebsiteArticleSync() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token) throw new Error('Unauthorized');

  const response = await fetchWithDeadline(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/wechat-sync`,
    {
      method: 'POST',
      headers: {
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
        'X-Sync-Trigger': 'manual',
      },
      body: '{}',
    },
    WEBSITE_SYNC_TIMEOUT_MS,
  );
  if (!response.ok) throw Object.assign(new Error('网站文章同步失败'), { context: response });
  return response.json();
}
