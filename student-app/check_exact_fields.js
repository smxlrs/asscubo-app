const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://avxzgaozbfeqttmhmlld.supabase.co';
const supabaseKey = 'sb_publishable_ROyJRMFd8_hDw3YwRBUmHA_E61yNqqa';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const ids = [
    'd8d679f6-2f53-4acf-a040-76323ce8da30', // 居留
    '1aa53972-61b4-408b-986a-bf7b898239d8'  // 银行账户
  ];
  
  for (const id of ids) {
    const { data, error } = await supabase
      .from('handbook_chapters')
      .select('id, title, order_index, parent_id, is_published')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error(`Error for ${id}:`, error);
      continue;
    }
    
    console.log(`ID: ${data.id}`);
    console.log(`Title: "${data.title}"`);
    console.log(`Title JSON chars:`, JSON.stringify(data.title.split('').map(c => ({ char: c, code: c.charCodeAt(0) }))));
    console.log(`Order: ${data.order_index}`);
    console.log(`-----------------------------`);
  }
}

main();
