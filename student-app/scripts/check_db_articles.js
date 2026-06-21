const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://avxzgaozbfeqttmhmlld.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2eHpnYW96YmZlcXR0bWhtbGxkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk1MTQxMCwiZXhwIjoyMDk2NTI3NDEwfQ.jamD65zd9C28tF_Wk7BC_98OYDMgQ4-zBg_st0InHfA';
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
