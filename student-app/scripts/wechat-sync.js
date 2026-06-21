const { createClient } = require('@supabase/supabase-js');

// Parse command line arguments manually (no dependency required)
const args = process.argv.slice(2);
const appid = getArg('appid');
const appsecret = getArg('appsecret');
const supabaseUrl = getArg('supabase-url');
const supabaseKey = getArg('supabase-key');
const apiBase = getArg('api-base') || 'https://api.weixin.qq.com';

function getArg(name) {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
}

if (!appid || !appsecret || !supabaseUrl || !supabaseKey) {
  console.error('Missing required arguments!');
  console.log('Usage: node scripts/wechat-sync.js --appid=<AppID> --appsecret=<AppSecret> --supabase-url=<SupabaseURL> --supabase-key=<SupabaseServiceRoleKey>');
  process.exit(1);
}

// HTML decoding helper
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

async function startSync() {
  console.log('Initializing Supabase client...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching WeChat access token...');
  const tokenUrl = `${apiBase}/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`;
  let accessToken;
  try {
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || tokenData.errcode) {
      throw new Error(tokenData.errmsg || 'HTTP failure');
    }
    accessToken = tokenData.access_token;
    console.log('WeChat access token successfully fetched.');
  } catch (err) {
    console.error('Failed to retrieve WeChat access token. Please check your AppID/AppSecret and ensure your IP is whitelisted on WeChat developer dashboard.', err);
    process.exit(1);
  }

  let offset = 0;
  const count = 20;
  let totalCount = 0;
  let successCount = 0;
  let skippedCount = 0;

  console.log('Starting batch fetch of WeChat articles...');
  while (true) {
    console.log(`Fetching articles offset=${offset}, count=${count}...`);
    const batchUrl = `${apiBase}/cgi-bin/freepublish/batchget?access_token=${accessToken}`;
    let batchData;
    try {
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          offset: offset,
          count: count,
          no_content: 1
        })
      });
      batchData = await batchRes.json();
      if (!batchRes.ok || batchData.errcode) {
        throw new Error(batchData.errmsg || 'HTTP failure');
      }
    } catch (err) {
      console.error(`Failed to fetch article batch at offset ${offset}:`, err);
      break;
    }

    const items = batchData.item || [];
    if (items.length === 0) {
      console.log('No more articles found.');
      break;
    }

    totalCount += items.length;
    console.log(`Fetched ${items.length} items. Processing...`);

    for (const item of items) {
      // WeChat Free Publish news items are grouped (multi-articles per publish)
      const newsItem = item.content?.news_item || [];
      const updateTime = item.update_time;

      for (const article of newsItem) {
        const title = decodeHtmlEntities(article.title);
        const summary = decodeHtmlEntities(article.digest || article.author || '微信公众号推文');
        const url = article.url;
        const coverImage = article.thumb_url || null;

        // Skip if url is empty
        if (!url) continue;

        try {
          // Check if article already exists by link
          const { data: existing, error: checkError } = await supabase
            .from('articles')
            .select('id')
            .eq('link', url)
            .maybeSingle();

          if (checkError) {
            console.error(`Error checking existing article:`, checkError);
            continue;
          }

          if (existing) {
            console.log(`[SKIPPED] Article already exists: "${title}"`);
            skippedCount++;
            continue;
          }

          // Insert into articles table
          const { data: insertedArticle, error: articleError } = await supabase
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
              created_at: new Date(updateTime * 1000).toISOString()
            }])
            .select();

          if (articleError) {
            console.error(`Failed to insert article: "${title}"`, articleError);
            continue;
          }

          const articleId = insertedArticle && insertedArticle[0]?.id;

          // [Removed insertion into notifications table to separate articles and notifications]

          console.log(`[SYNCED] Successfully synced article: "${title}"`);
          successCount++;
        } catch (dbErr) {
          console.error(`Database operation failed for article: "${title}"`, dbErr);
        }
      }
    }

    // Stop if we fetched fewer items than count (reached end)
    if (items.length < count) {
      break;
    }
    offset += count;
  }

  console.log('\n--- Sync Session Complete ---');
  console.log(`Total Published Items Fetched: ${totalCount}`);
  console.log(`Successfully Synced Articles: ${successCount}`);
  console.log(`Skipped (Already Exists): ${skippedCount}`);
}

startSync().catch(err => {
  console.error('Fatal error during sync process:', err);
  process.exit(1);
});
