import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// HTML decoding helper
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

// Category Mapping
const CATEGORY_MAP: Record<string, { article: string; notification: string | null; label: string; color: string }> = {
  event_news: { article: 'event_news', notification: 'events', label: '学联活动', color: '#EF4444' },
  notice: { article: 'notice', notification: 'academic', label: '学术资讯', color: '#3B82F6' },
  news: { article: 'news', notification: 'life', label: '生活辅助', color: '#10B981' },
  column: { article: 'column', notification: 'general', label: '原创专栏', color: '#F59E0B' },
  reprint: { article: 'reprint', notification: 'general', label: '转载', color: '#6B7280' },
  general: { article: 'general', notification: 'general', label: '综合公告', color: '#8B5CF6' }
};

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Authorization check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.warn("Invalid user token authentication attempt.");
      return new Response(JSON.stringify({ error: "Unauthorized session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify role is admin or super_admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      console.warn(`User ${user.id} tried to access admin feature but role is: ${profile?.role}`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { url, category, sendPush } = await req.json();

    if (!url || !url.startsWith("http")) {
      return new Response(JSON.stringify({ error: "Invalid WeChat URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Fetch WeChat public webpage
    console.log(`Scraping WeChat article page: ${url}`);
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
      }
    });

    if (!fetchRes.ok) {
      throw new Error(`Failed to fetch WeChat page. HTTP status: ${fetchRes.status}`);
    }

    const html = await fetchRes.text();

    // 3. Parse HTML metadata with Cheerio
    const $ = cheerio.load(html);

    const rawTitle = $("#activity-name").text().trim() || $("meta[property='og:title']").attr("content") || "未命名微信文章";
    const title = decodeHtmlEntities(rawTitle);

    const rawSummary = $("meta[property='og:description']").attr("content") || $("meta[name='description']").attr("content") || "";
    const summary = decodeHtmlEntities(rawSummary).slice(0, 150) || "查看微信公众号文章详情";

    const coverImage = $("meta[property='og:image']").attr("content") || null;
    const author = $("#js_name").text().trim() || "微信公众号";

    // Extract publish time from script ct variable
    let publishTime = new Date().toISOString();
    const ctMatch = html.match(/var\s+ct\s*=\s*"(\d+)"/) || html.match(/var\s+ct\s*=\s*'(\d+)'/) || html.match(/"publish_time"\s*:\s*(\d+)/);
    if (ctMatch && ctMatch[1]) {
      publishTime = new Date(parseInt(ctMatch[1]) * 1000).toISOString();
    }

    console.log(`Parsed article: "${title}" by ${author}, Published: ${publishTime}`);

    // 4. Check if article already exists by link
    const { data: existing, error: checkError } = await supabase
      .from('articles')
      .select('id')
      .eq('link', url)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existing) {
      return new Response(JSON.stringify({ 
        status: "skipped", 
        message: "Article already exists in database", 
        articleId: existing.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 5. Insert into articles table
    const mappedCategory = category ? (CATEGORY_MAP[category] || CATEGORY_MAP.general) : CATEGORY_MAP.general;
    const notificationCategory = category ? mappedCategory.notification : null;
    const { data: articleData, error: articleError } = await supabase
      .from('articles')
      .insert([{
        title,
        summary,
        content: '微信外链文章',
        category: mappedCategory.article,
        cover_image: coverImage,
        link: url,
        is_published: true,
        view_count: 0,
        created_at: publishTime
      }])
      .select();

    if (articleError) throw articleError;
    const articleId = articleData && articleData[0]?.id;

    // 6. [Removed insertion into notifications table to separate articles and notifications]

    // 7. Send Expo push notification if checked
    let pushSentCount = 0;
    if (sendPush) {
      const { data: tokensData, error: tokensError } = await supabase
        .from('push_tokens')
        .select('token');

      if (!tokensError && tokensData && tokensData.length > 0) {
        const tokens = Array.from(new Set(tokensData.map((t: any) => t.token)));
        const pushTitle = category ? `【${mappedCategory.label}】${title}` : title;
        const messages = tokens.map(token => ({
          to: token,
          sound: 'default',
          title: pushTitle,
          body: summary,
          data: { category: notificationCategory, link: url, articleId }
        }));

        // Split into chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < messages.length; i += chunkSize) {
          const chunk = messages.slice(i, i + chunkSize);
          try {
            const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(chunk)
            });
            if (pushRes.ok) {
              pushSentCount += chunk.length;
            }
          } catch (pushErr) {
            console.error("Failed to send push chunk:", pushErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({
      status: "success",
      articleId,
      title,
      coverImage,
      pushSentCount
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Fatal error during WeChat single import:", err);
    return new Response(JSON.stringify({
      error: err.message || "Internal Server Error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
