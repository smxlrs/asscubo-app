import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const WECHAT_APPID = Deno.env.get("WECHAT_APPID");
const WECHAT_APPSECRET = Deno.env.get("WECHAT_APPSECRET");
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WECHAT_API_BASE = Deno.env.get("WECHAT_API_BASE") || "https://api.weixin.qq.com";

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

// WeChat URL normalization to strip dynamic tracking / temp signature parameters
function normalizeWechatUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'mp.weixin.qq.com') {
      const biz = parsed.searchParams.get('__biz');
      const mid = parsed.searchParams.get('mid');
      const idx = parsed.searchParams.get('idx');
      const sn = parsed.searchParams.get('sn');
      if (biz && mid && idx && sn) {
        return `https://mp.weixin.qq.com/s?__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}`;
      }
    }
  } catch (e) {
    // fallback to original if parsing fails
  }
  return url;
}

// Save article and send Expo Push notification
async function saveAndPushArticle(
  supabase: any,
  title: string,
  summary: string,
  url: string,
  coverImage: string | null,
  publishTime: string
) {
  // 1. 插入微信文章数据到 articles 表
  const { data: articleData, error: articleError } = await supabase
    .from('articles')
    .insert([{
      title: title,
      summary: summary,
      content: '微信外链文章',
      category: 'general',
      cover_image: coverImage,
      link: url,
      is_published: true,
      view_count: 0,
      created_at: publishTime
    }])
    .select();

  if (articleError) {
    console.error(`Error inserting article "${title}" into Supabase:`, articleError);
    return false;
  }
  const articleId = articleData && articleData[0]?.id;

  // 2. [Removed insertion into notifications table to separate articles and notifications]

  // 3. 获取所有设备的 Push Token
  const { data: tokensData, error: tokensError } = await supabase
    .from('push_tokens')
    .select('token');

  if (tokensError || !tokensData || tokensData.length === 0) {
    console.log('No push tokens found or failed to query:', tokensError);
    return true;
  }

  const tokens = Array.from(new Set(tokensData.map((t: any) => t.token)));
  console.log(`Sending mass push to ${tokens.length} devices for article "${title}"...`);

  // 4. 构造 Expo 推送消息 Payload
  const pushTitle = `【综合通知】${title}`;
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: pushTitle,
    body: summary,
    data: { category: 'general', link: url, articleId },
  }));

  // 按照 Expo 每批 100 条的限制进行拆分发送
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const resData = await response.json();
      console.log(`Expo push batch result for chunk starting at index ${i}:`, resData);
    } catch (e) {
      console.error('Failed to send push notification chunk:', e);
    }
  }

  return true;
}

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. 安全校验 (仅允许带服务角色密钥的内部或授权请求触发，或管理员/超级管理员用户 JWT)
  const authHeader = req.headers.get("Authorization");
  const fallbackServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eHpnYW96YmZlcXR0bWhtbGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk1MTQxMCwiZXhwIjoyMDk2NTI3NDEwfQ.jamD65zd9C28tF_Wk7BC_98OYDMgQ4-zBg_st0InHfA";
  
  let authorized = false;
  if (authHeader) {
    const isServiceKey = authHeader === `Bearer ${supabaseServiceKey}` || authHeader === `Bearer ${fallbackServiceKey}`;
    if (isServiceKey) {
      authorized = true;
    } else {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (!userError && user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (!profileError && profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
            authorized = true;
            console.log(`User ${user.id} authorized as admin/super_admin for manual WeChat sync.`);
          } else {
            console.warn(`User ${user.id} role is: ${profile?.role}. Unauthorized for manual WeChat sync.`);
          }
        } else {
          console.warn("Manual WeChat sync: user token authentication failed:", userError);
        }
      } catch (err) {
        console.error("Manual WeChat sync auth check error:", err);
      }
    }
  }

  if (!authorized) {
    console.warn("Unauthorized access attempt detected.");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // 校验微信配置环境变量
  if (!WECHAT_APPID || !WECHAT_APPSECRET) {
    console.error("Missing WECHAT_APPID or WECHAT_APPSECRET environment variables.");
    return new Response(JSON.stringify({ error: "Server Configuration Error: Missing WeChat credentials in environment." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. 获取微信 Access Token
    console.log("Fetching WeChat Access Token...");
    const tokenUrl = `${WECHAT_API_BASE}/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APPID}&secret=${WECHAT_APPSECRET}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.errcode) {
      throw new Error(tokenData.errmsg || `Failed to fetch access token. Code: ${tokenData.errcode}`);
    }

    const accessToken = tokenData.access_token;
    console.log("WeChat Access Token successfully retrieved.");

    // 3. 拉取最新的公众号推文列表 (拉取第 1 页最新的 20 条)
    console.log("Fetching latest WeChat articles...");
    const batchUrl = `${WECHAT_API_BASE}/cgi-bin/freepublish/batchget?access_token=${accessToken}`;
    const batchRes = await fetch(batchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        offset: 0,
        count: 10,
        no_content: 0 // 设置为 0 确保获取到 content.news_item 列表
      })
    });

    const batchData = await batchRes.json();
    if (!batchRes.ok || batchData.errcode) {
      throw new Error(batchData.errmsg || `Failed to fetch publications. Code: ${batchData.errcode}`);
    }

    const items = batchData.item || [];
    console.log(`Retrieved ${items.length} publications. Checking for duplicates...`);

    let successCount = 0;
    let skippedCount = 0;

    // 4. 遍历处理每篇推文 (注意 items 排列是从新到旧，处理时我们可以倒序处理，先同步旧的，再同步新的)
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const newsItem = item.content?.news_item || [];
      const updateTime = item.update_time;
      const publishTime = new Date(updateTime * 1000).toISOString();

      for (const article of newsItem) {
        const title = decodeHtmlEntities(article.title);
        const summary = decodeHtmlEntities(article.digest || article.author || '微信公众号推文');
        const url = article.url;
        const coverImage = article.thumb_url || null;

        if (!url) continue;

        const normalizedUrl = normalizeWechatUrl(url);

        // 检查数据库中是否已存在该链接的文章 (兼容匹配原始链接和标准化链接)
        const { data: existing, error: checkError } = await supabase
          .from('articles')
          .select('id')
          .or(`link.eq.${url},link.eq.${normalizedUrl}`)
          .maybeSingle();

        if (checkError) {
          console.error(`Error checking duplicate for article "${title}":`, checkError);
          continue;
        }

        if (existing) {
          console.log(`[SKIPPED] Article already exists: "${title}"`);
          skippedCount++;
          continue;
        }

        // 保存文章到数据库，并给所有用户发送推送消息 (保存标准化链接)
        const saved = await saveAndPushArticle(supabase, title, summary, normalizedUrl, coverImage, publishTime);
        if (saved) {
          console.log(`[SYNCED] New article added: "${title}"`);
          successCount++;
        }
      }
    }

    console.log(`Sync complete. Synced: ${successCount}, Skipped: ${skippedCount}`);
    return new Response(
      JSON.stringify({
        status: "success",
        synced: successCount,
        skipped: skippedCount
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (err: any) {
    console.error("Fatal error during WeChat sync process:", err);
    return new Response(
      JSON.stringify({
        status: "error",
        message: err.message || "Internal Server Error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
