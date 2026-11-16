import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = process.env.EVENT_TEST_SUPABASE_CLI;
if (!cli) throw Error('Set EVENT_TEST_SUPABASE_CLI to the authenticated official CLI.');
const exec = promisify(execFile);
async function query(args) {
  const { stdout } = await exec(cli, ['db','query','--linked',...args,'--output','json'], {
    cwd:root, timeout:150000, maxBuffer:2*1024*1024, windowsHide:true,
  });
  const result = JSON.parse(stdout);
  if (!Array.isArray(result.rows)) throw Error('Missing result rows');
  return result.rows;
}
let sql = readFileSync(resolve(root,'supabase/tests/publication-account-live-rollback.sql'),'utf8');
if (!/^BEGIN;/m.test(sql) || !/ROLLBACK;\s*$/.test(sql) || /^COMMIT;/m.test(sql)) throw Error('Rollback required');
if (process.argv.includes('--preview-migrations')) {
  const migrations = ['049_publication_visibility_and_feed.sql','050_verified_account_deletion.sql'].map(file => {
    const text = readFileSync(resolve(root,'supabase/migrations',file),'utf8').replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
    if (/^\s*(BEGIN|COMMIT)\s*;/im.test(text)) throw Error('Unexpected transaction boundary');
    return text;
  }).join('\n');
  sql = sql.replace('-- MIGRATION_PREVIEW', () => migrations);
}
mkdirSync(resolve(root,'.tmp/publication-review'),{recursive:true});
const path = resolve(root,'.tmp/publication-review/live-rollback.sql');
writeFileSync(path,sql);
const report = (await query(['--file',path]))[0]?.test_report;
if (!report?.passed) throw Error('Live rollback validation failed');
const ids = values => {
  if (!Array.isArray(values) || !values.length || values.some(value=>!/^[-a-f0-9]{36}$/i.test(value))) throw Error('Invalid fixture IDs');
  return `ARRAY[${values.map(value=>`'${value}'::uuid`).join(',')}]`;
};
const users = ids(report.fixture.user_ids), articles = ids(report.fixture.article_ids), notices = ids(report.fixture.notification_ids);
const attemptsTableExists = (await query(["SELECT to_regclass('public.account_deletion_attempts') IS NOT NULL AS present;"]))[0].present;
const accountAttempts = attemptsTableExists
  ? `(SELECT count(*)::int FROM public.account_deletion_attempts WHERE user_id=ANY(${users}))`
  : '0::int'; // Absence was checked explicitly, not inferred from preview mode.
const cleanup = (await query([`SELECT
  (SELECT count(*)::int FROM auth.users WHERE id=ANY(${users})) AS users,
  (SELECT count(*)::int FROM public.profiles WHERE id=ANY(${users})) AS profiles,
  (SELECT count(*)::int FROM public.articles WHERE id=ANY(${articles})) AS articles,
  (SELECT count(*)::int FROM public.notifications WHERE id=ANY(${notices})) AS notifications,
  ${accountAttempts} AS deletion_attempts;`]))[0];
if (!Object.values(cleanup).every(value=>value===0)) throw Error('Fixture residue after rollback');
const result = { ...report, cleanup, attempts_table_exists:attemptsTableExists,
  timestamp:new Date().toISOString(), preview:process.argv.includes('--preview-migrations') };
writeFileSync(resolve(root,'.tmp/publication-review',`${report.fixture.run_id}.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
