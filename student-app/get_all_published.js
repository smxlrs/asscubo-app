const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://avxzgaozbfeqttmhmlld.supabase.co';
const supabaseKey = 'sb_publishable_ROyJRMFd8_hDw3YwRBUmHA_E61yNqqa';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('handbook_chapters')
    .select('*')
    .eq('is_published', true)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total published chapters:', data.length);
  
  // Roots
  const roots = data.filter(c => !c.parent_id);
  console.log('\n--- ROOT CHAPTERS ---');
  roots.forEach(root => {
    console.log(`[Root] ID: ${root.id}, Title: "${root.title}", Order: ${root.order_index}`);
    
    // Children
    const children = data.filter(c => c.parent_id === root.id);
    children.forEach(child => {
      console.log(`   [Child] ID: ${child.id}, Title: "${child.title}", Order: ${child.order_index}`);
    });
  });
  
  // Orphans or others
  const allIds = new Set(data.map(c => c.id));
  const others = data.filter(c => c.parent_id && !allIds.has(c.parent_id));
  if (others.length > 0) {
    console.log('\n--- OTHER / ORPHAN CHAPTERS ---');
    others.forEach(oth => {
      console.log(`[Orphan] ID: ${oth.id}, Title: "${oth.title}", Parent: ${oth.parent_id}, Order: ${oth.order_index}`);
    });
  }
}

main();
