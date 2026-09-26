// Runs a reviewed, transaction-only fixture script and verifies exact-ID cleanup.
// Uses the already authenticated official CLI. Never prints or reads credentials.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = process.env.EVENT_TEST_SUPABASE_CLI;
if (!cli) throw new Error('Set EVENT_TEST_SUPABASE_CLI to the installed Supabase CLI.');
const filename = process.argv[2] || 'event-registration-live-rollback.sql';
if (!/^event-registration-live-(rollback|vehicles)\.sql$/.test(filename)) throw new Error('Unexpected test script.');
const path = resolve(root, 'supabase/tests', filename);
const source = readFileSync(path, 'utf8');
if (!/\bBEGIN;/i.test(source) || !/\bROLLBACK;\s*$/.test(source) || /^\s*COMMIT\s*;/im.test(source)) {
  throw new Error('The test must run as one transaction ending in ROLLBACK.');
}
async function query(args) {
  const { stdout } = await run(cli, ['db','query','--linked',...args,'--output','json'], {
    cwd:root, timeout:240000, maxBuffer:4*1024*1024, windowsHide:true,
  });
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed.rows)) throw new Error('Missing query rows.');
  return parsed.rows;
}
const rows = await query(['--file', path]);
const report = rows[0]?.test_report;
if (typeof report?.passed !== 'boolean' || !Array.isArray(report.results)) throw new Error('Live test did not return a test report.');
const fixture = report.results.find(item=>item.details?.run_id && item.details?.event_ids)?.details;
if (!fixture) throw new Error('Test must return exact fixture IDs for cleanup verification.');
const ids = value => {
  if (!Array.isArray(value) || !value.length || value.some(id=>!/^[-a-f0-9]{36}$/i.test(id))) throw new Error('Invalid fixture IDs.');
  return `ARRAY[${value.map(id=>`'${id}'::uuid`).join(',')}]`;
};
const eventIds = ids(fixture.event_ids);
const userIds = ids(fixture.user_ids);
const cleanup = (await query([`SELECT
  (SELECT count(*) FROM auth.users WHERE id=ANY(${userIds}))::int AS users,
  (SELECT count(*) FROM public.profiles WHERE id=ANY(${userIds}))::int AS profiles,
  (SELECT count(*) FROM public.events WHERE id=ANY(${eventIds}))::int AS events,
  (SELECT count(*) FROM public.event_registrations WHERE event_id=ANY(${eventIds}))::int AS registrations,
  (SELECT count(*) FROM public.event_vehicles WHERE event_id=ANY(${eventIds}))::int AS vehicles,
  (SELECT count(*) FROM public.event_registration_audit_logs WHERE event_id=ANY(${eventIds}))::int AS audit_entries,
  (SELECT count(*) FROM public.event_registration_notification_jobs WHERE event_id=ANY(${eventIds}))::int AS notification_jobs;`]))[0];
const clean = Object.values(cleanup).every(value=>value===0);
const summary = {timestamp:new Date().toISOString(),script:filename,passed:report.passed && clean,
  checks:report.checks,run_id:fixture.run_id,fixture_users:fixture.user_ids.length,fixture_events:fixture.event_ids.length,
  cleanup,results:report.results.filter(item=>item.details!==fixture),scope:report.scope};
const outputDirectory = resolve(root,'.tmp/event-live-results');
mkdirSync(outputDirectory,{recursive:true});
const outputPath = resolve(outputDirectory,`${fixture.run_id}.json`);
writeFileSync(outputPath,JSON.stringify({...summary,fixture_ids:fixture},null,2));
console.log(JSON.stringify({...summary,report_file:outputPath},null,2));
if (!clean) throw new Error('Rollback cleanup verification failed; inspect the exact fixture IDs in the report.');
if (!report.passed) process.exitCode=1;
