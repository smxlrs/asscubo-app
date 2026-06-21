const { createClient } = require('@supabase/supabase-js');

// Parse command line arguments
const args = process.argv.slice(2);
const supabaseUrl = getArg('supabase-url');
const supabaseKey = getArg('supabase-key');

function getArg(name) {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required arguments!');
  console.log('Usage: node scripts/clear-categories.js --supabase-url=<SupabaseURL> --supabase-key=<SupabaseServiceRoleKey>');
  process.exit(1);
}

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Connecting to Supabase...');

  console.log('Updating notifications table...');
  const { error: notificationError } = await supabase
    .from('notifications')
    .update({ category: 'general' })
    .neq('category', 'general'); // update any that are not already general

  if (notificationError) {
    console.error('Failed to update notifications:', notificationError);
  } else {
    console.log('Successfully set all notifications categories to "general".');
  }

  console.log('Updating articles table...');
  const { error: articleError } = await supabase
    .from('articles')
    .update({ category: 'general' })
    .neq('category', 'general');

  if (articleError) {
    console.error('Failed to update articles:', articleError);
  } else {
    console.log('Successfully set all articles categories to "general".');
  }

  console.log('Done!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
