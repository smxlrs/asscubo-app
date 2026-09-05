const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this admin script.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying all articles from database...');
  const { data, error } = await supabase
    .from('articles')
    .select('id, title, created_at, is_published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching articles:', error);
    return;
  }

  console.log(`Total articles in DB: ${data.length}`);
  data.forEach((art, index) => {
    console.log(`${index + 1}. [${art.created_at}] [Published: ${art.is_published}] - ${art.title}`);
  });
}

run().catch(console.error);
