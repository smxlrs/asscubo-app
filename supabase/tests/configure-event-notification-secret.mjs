// Repair only this project's missing notification Vault entry and probe a
// nonexistent job. Never sends Expo messages, prints keys, or writes keys to disk.
// Requires an authenticated official CLI and explicit --configure-missing flag.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cli = process.env.EVENT_TEST_SUPABASE_CLI;
const project = 'avxzgaozbfeqttmhmlld';
const endpoint = `https://${project}.supabase.co/functions/v1/event-registration-start-notifications`;
const vaultName = 'event_registration_start_secret_key';
if (!cli || process.argv[2] !== '--configure-missing') {
  throw new Error('Set EVENT_TEST_SUPABASE_CLI and pass --configure-missing.');
}

// Do not propagate child-process errors: they may include secret SQL arguments.
async function command(args, label) {
  try {
    const { stdout } = await run(cli, [...args, '--output', 'json'], {
      cwd: root, windowsHide: true, timeout: 60000, maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label} failed; sensitive command output was suppressed.`);
  }
}
async function query(sql) {
  const result = await command(['db', 'query', '--linked', sql], 'Database operation');
  if (!Array.isArray(result.rows)) throw new Error('Unexpected database response.');
  return result.rows;
}
async function probe(body, key) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { apikey: key } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  let json;
  try { json = await response.json(); } catch { json = {}; }
  return { status: response.status, json };
}

try {
  const probeId = randomUUID();
  const [before] = await query(`SELECT
    EXISTS(SELECT 1 FROM public.event_registration_notification_jobs WHERE id='${probeId}'::uuid) AS probe_exists,
    (SELECT count(*)::int FROM vault.secrets WHERE name='${vaultName}') AS secret_count,
    (SELECT count(*)::int FROM public.event_registration_notification_jobs WHERE status IN ('pending','processing')) AS active_jobs,
    (SELECT count(*)::int FROM cron.job WHERE jobname LIKE 'event-registration-start-%' AND active) AS active_schedules;`);
  if (before.probe_exists || before.active_jobs || before.active_schedules) {
    throw new Error('Active jobs or schedules need review before provisioning. No configuration changed.');
  }
  if (before.secret_count !== 0) throw new Error('Vault entry already exists; refusing to overwrite it.');
  const keys = await command(['projects', 'api-keys', '--project-ref', project, '--reveal'], 'Project key lookup');
  if (!Array.isArray(keys)) throw new Error('Unexpected project key response.');
  const candidates = keys.filter(item => typeof item.api_key === 'string' && /^sb_secret_[A-Za-z0-9_-]+$/.test(item.api_key));
  candidates.sort((a, b) => Number(b.name === 'default') - Number(a.name === 'default'));
  if (!candidates.length) throw new Error('No active secret key is available; no configuration changed.');

  const denied = await probe({ job_id: probeId });
  if (denied.status !== 401) throw new Error('Unauthenticated worker request was not rejected.');
  let selectedKey;
  for (const candidate of candidates) {
    const accepted = await probe({ job_id: probeId }, candidate.api_key);
    if (accepted.status === 200 && accepted.json.processed === false && accepted.json.status === 'not_claimed') {
      selectedKey = candidate.api_key;
      break;
    }
  }
  if (!selectedKey) throw new Error('Worker did not accept any available key; Vault left unchanged.');

  // The strict key regex excludes quotes; never log this SQL or its error text.
  await query(`DO $provision$ BEGIN
    IF EXISTS(SELECT 1 FROM vault.secrets WHERE name='${vaultName}') THEN
      RAISE EXCEPTION 'Vault entry was created concurrently; aborting.';
    END IF;
    PERFORM vault.create_secret('${selectedKey}', '${vaultName}', 'Internal activity registration notification worker');
  END $provision$;`);
  selectedKey = undefined;
  candidates.length = 0;
  keys.length = 0;

  // Exercise the actual database -> pg_net -> worker -> RPC path with no job,
  // hence no recipients and no call to Expo. Secret stays inside the database.
  const [dispatch] = await query(`SELECT net.http_post(
    url := '${endpoint}',
    headers := jsonb_build_object('Content-Type','application/json','apikey',
      (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='${vaultName}')),
    body := jsonb_build_object('job_id','${probeId}'), timeout_milliseconds := 20000
  ) AS request_id;`);
  if (!/^\d+$/.test(String(dispatch.request_id))) throw new Error('Missing probe request ID.');
  let receipt;
  for (let attempt = 0; attempt < 20; attempt++) {
    [receipt] = await query(`SELECT status_code, timed_out,
      CASE WHEN status_code=200 THEN content::jsonb = '{"processed":false,"status":"not_claimed"}'::jsonb ELSE FALSE END AS safe_noop
      FROM net._http_response WHERE id=${dispatch.request_id};`);
    if (receipt) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (receipt?.status_code !== 200 || receipt?.timed_out || !receipt?.safe_noop) {
    throw new Error('Vault entry was created, but database-to-worker probe did not pass. Inspect request status without exposing headers.');
  }
  console.log(JSON.stringify({
    project, vault_entry_created: true, unauthenticated_rejected: true,
    authenticated_nonexistent_job: 'not_claimed', database_worker_http: receipt.status_code,
    database_worker_safe_noop: receipt.safe_noop, expo_messages_sent: 0,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Notification configuration failed.');
  process.exitCode = 1;
}
