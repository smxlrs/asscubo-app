const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://avxzgaozbfeqttmhmlld.supabase.co';
const supabaseKey = 'sb_publishable_ROyJRMFd8_hDw3YwRBUmHA_E61yNqqa';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('handbook_chapters')
    .select('id, title, order_index, parent_id')
    .eq('parent_id', '2f3f5f83-45a1-451c-81b7-e9bfd389d08f')
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  data.forEach(ch => {
    console.log(`title: "${ch.title}", length: ${ch.title.length}`);
    console.log('chars:', JSON.stringify(ch.title.split('').map(c => c.charCodeAt(0))));
  });
}

main();
