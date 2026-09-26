// Read-only/permission-denied live probes. No login, signup, push, or data writes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(readFileSync(resolve(root, 'student-app/.env'), 'utf8')
  .split(/\r?\n/).map(line => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
  .filter(Boolean).map(([, name, value]) => [name, value.replace(/^['"]|['"]$/g, '')]));
const base = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!base || !key || new URL(base).hostname !== 'avxzgaozbfeqttmhmlld.supabase.co') {
  throw new Error('Expected project public client configuration is missing.');
}
const expected = [
  ['delete_user_account', {}],
  ['submit_event_registration_checked', { p_event_id:'00000000-0000-0000-0000-000000000000', p_expected_form_version:1 }],
  ['submit_event_registration_group_checked', { p_event_id:'00000000-0000-0000-0000-000000000000', p_participants:[], p_expected_form_version:1 }],
  ['admin_event_registration_page', { p_event_id:'00000000-0000-0000-0000-000000000000', p_limit:100 }],
];
const results = [];
for (const [name, body] of expected) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method:'POST', headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
    body:JSON.stringify(body), signal:AbortSignal.timeout(20000),
  });
  const json = await response.json();
  const pass = [401,403].includes(response.status) && json.code === '42501';
  results.push({check:`anonymous_blocked:${name}`,pass,http:response.status,code:json.code});
}
const startup = await fetch(`${base}/functions/v1/event-registration-start-notifications`, {
  method:'GET', signal:AbortSignal.timeout(20000),
});
results.push({check:'notification_worker_startup_method_guard',pass:startup.status===405,http:startup.status});
console.log(JSON.stringify({project:'avxzgaozbfeqttmhmlld',results},null,2));
if (results.some(result=>!result.pass)) process.exitCode=1;
