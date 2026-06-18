import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const WECHAT_TOKEN = Deno.env.get("WECHAT_TOKEN") || "asscubo_token";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

async function saveAndPushArticle(title: string, summary: string, url: string, coverImage: string | null) {
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
      view_count: 0
    }])
    .select();

  if (articleError) {
    console.error('Error inserting article into Supabase:', articleError);
    return;
  }
  const articleId = articleData && articleData[0]?.id;

  // 2. 插入通知数据到 notifications 表
  const { error: notificationError } = await supabase
    .from('notifications')
    .insert([{
      title: title,
      content: summary,
      category: 'general',
      link: url
    }]);

  if (notificationError) {
    console.error('Error inserting notification into Supabase:', notificationError);
  }

  // 3. 获取所有设备的 Push Token
  const { data: tokensData, error: tokensError } = await supabase
    .from('push_tokens')
    .select('token');

  if (tokensError || !tokensData || tokensData.length === 0) {
    console.log('No push tokens found or failed to query:', tokensError);
    return;
  }

  const tokens = Array.from(new Set(tokensData.map(t => t.token)));
  console.log(`Sending mass push to ${tokens.length} devices...`);

  // 4. 构造 Expo 推送消息 Payload
  const pushTitle = `【综合公告】${title}`;
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
      console.log(`Expo push batch result:`, resData);
    } catch (e) {
      console.error('Failed to send push notification chunk:', e);
    }
  }
}

serve(async (req) => {
  const urlObj = new URL(req.url);
  
  // ==========================================
  // 1. 处理微信 Token 校验 GET 请求
  // ==========================================
  if (req.method === "GET") {
    const signature = urlObj.searchParams.get("signature");
    const timestamp = urlObj.searchParams.get("timestamp");
    const nonce = urlObj.searchParams.get("nonce");
    const echostr = urlObj.searchParams.get("echostr");

    if (signature && timestamp && nonce && echostr) {
      const arr = [WECHAT_TOKEN, timestamp, nonce].sort();
      const str = arr.join("");
      
      // 使用 Web Crypto API 计算 SHA1
      const hashBuffer = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(str));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (hashHex === signature) {
        console.log("WeChat verification succeeded!");
        return new Response(echostr, { headers: { "content-type": "text/plain" } });
      } else {
        console.warn("WeChat verification failed. Signatures mismatch.");
      }
    }
    return new Response("Invalid request", { status: 400 });
  }

  // ==========================================
  // 2. 处理微信事件推送 POST 请求
  // ==========================================
  if (req.method === "POST") {
    try {
      const xmlText = await req.text();
      console.log("Received WeChat POST request body:", xmlText);

      // 提取事件类型
      const eventMatch = xmlText.match(/<Event><!\[CDATA\[([^\]]+)\]\]><\/Event>/) || xmlText.match(/<Event>([^<]+)<\/Event>/);
      const event = eventMatch ? eventMatch[1] : "";
      console.log(`Parsed WeChat Event: "${event}"`);

      // 仅处理发布任务完成（PUBLISHJOBFINISH）或群发完成（MASSSENDJOBFINISH）
      if (event === "PUBLISHJOBFINISH" || event === "MASSSENDJOBFINISH") {
        // 匹配出所有的 article_url
        const urlRegex = /<article_url><!\[CDATA\[([^\]]+)\]\]><\/article_url>/g;
        const urls: string[] = [];
        let match;
        while ((match = urlRegex.exec(xmlText)) !== null) {
          urls.push(match[1]);
        }

        if (urls.length === 0) {
          const fallbackMatch = xmlText.match(/<article_url><!\[CDATA\[([^\]]+)\]\]><\/article_url>/);
          if (fallbackMatch) urls.push(fallbackMatch[1]);
        }

        console.log(`Found ${urls.length} articles to process.`);

        // 处理解析并同步
        for (const articleUrl of urls) {
          try {
            console.log(`Fetching WeChat article content from: ${articleUrl}`);
            const htmlRes = await fetch(articleUrl, {
              headers: {
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
              }
            });
            if (!htmlRes.ok) {
              console.error(`Failed to fetch article page. Status: ${htmlRes.status}`);
              continue;
            }
            const html = await htmlRes.text();

            // 正则提取标题、描述和封面图
            const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/) || html.match(/var\s+msg_title\s*=\s*"([^"]+)"/);
            const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/) || html.match(/var\s+msg_desc\s*=\s*"([^"]+)"/);
            const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/) || html.match(/var\s+msg_cdn_url\s*=\s*"([^"]+)"/);

            const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : "微信公众号推文";
            const summary = descMatch ? decodeHtmlEntities(descMatch[1]) : "您订阅的微信公众号发布了新文章，点击即可在 App 内直接浏览详情！";
            const coverImage = imageMatch ? imageMatch[1] : null;

            console.log(`Successfully parsed WeChat Article metadata:`, { title, summary, coverImage });

            // 存储至数据库并发送群发推送
            await saveAndPushArticle(title, summary, articleUrl, coverImage);
          } catch (e) {
            console.error(`Failed to process article URL: ${articleUrl}`, e);
          }
        }
      }

      // 按照微信开发要求，接收到推送事件后必须回复 success 或空字符串
      return new Response("success", { headers: { "content-type": "text/plain" } });
    } catch (err) {
      console.error("Error processing POST request:", err);
      return new Response("error", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
