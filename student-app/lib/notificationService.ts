import { supabase } from './supabase';

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
  articleId?: string
) {
  try {
    // 1. Fetch all tokens from Supabase
    const { data: tokensData, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token');

    if (tokensError) {
      throw tokensError;
    }

    if (!tokensData || tokensData.length === 0) {
      console.log('No registered push tokens found.');
      return { success: true, sentCount: 0 };
    }

    // De-duplicate tokens
    const tokens = Array.from(new Set(tokensData.map((t) => t.token)));

    // 2. Construct payloads
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: { category, link, articleId },
    }));

    // 3. Batch payloads in chunks of 100 as required by Expo
    const chunkSize = 100;
    let sentCount = 0;

    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      if (result.errors) {
        console.warn('Expo push chunk error:', result.errors);
      } else {
        sentCount += chunk.length;
      }
    }

    console.log(`Successfully broadcasted notifications to ${sentCount} devices.`);
    return { success: true, sentCount };
  } catch (error) {
    console.error('Failed to broadcast push notification:', error);
    return { success: false, error };
  }
}
