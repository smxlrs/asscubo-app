// Local SQL + isolated worker tests. No requests to Supabase or Expo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const ts = require(resolve(root, 'student-app/node_modules/typescript'));
const db = new PGlite();
const q = (sql, values = []) => db.query(sql, values);
let checks = 0;
const equal = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const loadTs = (path, additions = {}) => {
  const source = readFileSync(resolve(root, path), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, Response, Request, AbortController, setTimeout, clearTimeout, console, ...additions };
  vm.runInNewContext(output, context, { filename: path });
  return context.exports;
};
const token = (n) => `ExpoPushToken[test_${n}]`;
const payload = (tokens, status = 'sent') => tokens.map((t, i) => ({ token: t, status, ticket_id: status === 'sent' ? `ticket-${i}` : undefined }));
const jobFor = async (eventId) => (await q('SELECT * FROM event_registration_notification_jobs WHERE event_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [eventId])).rows[0];
const call = async (name, values) => (await q(`SELECT public.${name}(${values.map((_, i) => `$${i + 1}`).join(',')}) AS value`, values)).rows[0].value;

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA cron; CREATE SCHEMA net; CREATE SCHEMA vault;
    CREATE FUNCTION public.has_admin_permission(text) RETURNS boolean LANGUAGE sql STABLE
      AS $$ SELECT current_setting('test.is_admin',true)='yes' $$;
    CREATE TABLE public.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text DEFAULT 'Event',
      is_published boolean DEFAULT true, deleted_at timestamptz, registration_status text DEFAULT 'open',
      registration_start_notify_enabled boolean DEFAULT false, registration_start_at timestamptz,
      registration_deadline timestamptz, end_time timestamptz DEFAULT now()+interval '30 days');
    CREATE TABLE public.push_tokens(token text PRIMARY KEY);
    CREATE TABLE cron.job(jobid bigserial PRIMARY KEY, jobname text UNIQUE, schedule text, command text);
    CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$
      INSERT INTO cron.job(jobname,schedule,command) VALUES($1,$2,$3)
      ON CONFLICT(jobname) DO UPDATE SET schedule=$2,command=$3 RETURNING jobid $$;
    CREATE FUNCTION cron.unschedule(bigint) RETURNS boolean LANGUAGE plpgsql AS $$
      BEGIN DELETE FROM cron.job WHERE jobid=$1; RETURN FOUND; END $$;
    CREATE TABLE net.calls(id bigserial PRIMARY KEY, body jsonb);
    CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
      RETURNS bigint LANGUAGE sql AS $$ INSERT INTO net.calls(body) VALUES($3) RETURNING id $$;
    CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
    INSERT INTO vault.decrypted_secrets VALUES('event_registration_start_secret_key','local-mock-only');
    SELECT set_config('test.is_admin','yes',false);
  `);
  const migration = readFileSync(resolve(root, 'supabase/migrations/041_event_notification_delivery.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  equal((await q('SELECT count(*)::int n FROM cron.job')).rows[0].n, 0);
  const future = (await q("INSERT INTO events(registration_start_notify_enabled,registration_start_at) VALUES(true,date_trunc('minute',now()+interval '1 day')) RETURNING *")).rows[0];
  let job = await jobFor(future.id);
  const schedule = (await q('SELECT schedule FROM cron.job')).rows[0].schedule;
  const instant = new Date(future.registration_start_at);
  equal(schedule, `${instant.getUTCMinutes()} ${instant.getUTCHours()} ${instant.getUTCDate()} ${instant.getUTCMonth() + 1} *`);
  await q('UPDATE events SET registration_start_notify_enabled=false WHERE id=$1', [future.id]);
  equal((await jobFor(future.id)).status, 'cancelled');
  equal((await q('SELECT count(*)::int n FROM cron.job')).rows[0].n, 0);

  const event = (await q("INSERT INTO events(registration_start_notify_enabled,registration_start_at) VALUES(true,now()-interval '1 minute') RETURNING id")).rows[0].id;
  job = await jobFor(event);
  for (let i = 0; i < 200; i++) await q('INSERT INTO push_tokens VALUES($1)', [token(i)]);
  await call('dispatch_event_notification_job', [job.id]);
  equal((await q('SELECT count(*)::int n FROM net.calls')).rows[0].n, 1);
  let claim = await call('claim_event_registration_notification', [job.id]);
  equal(claim.tokens.length, 200);
  equal((await call('claim_event_registration_notification', [job.id])).claimed, false);
  equal(await call('record_event_registration_notification_batch', [job.id, claim.lease_token, JSON.stringify(payload(claim.tokens.slice(0,100)))]), true);
  let finished = await call('finish_event_registration_notification', [job.id, claim.lease_token, 'Transient network failure']);
  equal(finished, { status: 'pending', sent: 100, failed: 0, pending: 100 });
  await call('dispatch_event_notification_job', [job.id]);
  claim = await call('claim_event_registration_notification', [job.id]);
  equal(claim.tokens.length, 100);
  const remaining = payload(claim.tokens);
  remaining[0] = { token: claim.tokens[0], status: 'failed', error: 'DeviceNotRegistered' };
  await call('record_event_registration_notification_batch', [job.id, claim.lease_token, JSON.stringify(remaining)]);
  finished = await call('finish_event_registration_notification', [job.id, claim.lease_token, null]);
  equal(finished, { status: 'partial', sent: 199, failed: 1, pending: 0 });
  equal((await q('SELECT count(*)::int n FROM cron.job')).rows[0].n, 0);
  await q('UPDATE events SET is_published=true WHERE id=$1', [event]);
  equal((await q('SELECT count(*)::int n FROM cron.job')).rows[0].n, 0);

  // A cancellation during the HTTP request must still record its known accepted ticket.
  const interrupted = (await q("INSERT INTO events(registration_start_notify_enabled,registration_start_at) VALUES(true,now()-interval '1 minute') RETURNING id")).rows[0].id;
  job = await jobFor(interrupted);
  await call('dispatch_event_notification_job', [job.id]);
  claim = await call('claim_event_registration_notification', [job.id]);
  await q('UPDATE events SET registration_start_notify_enabled=false WHERE id=$1', [interrupted]);
  equal(await call('record_event_registration_notification_batch', [job.id, claim.lease_token, JSON.stringify(payload(claim.tokens.slice(0, 1)))]), false);
  equal((await jobFor(interrupted)).sent_count, 1);
  await q('UPDATE events SET registration_start_notify_enabled=true WHERE id=$1', [interrupted]);
  equal((await call('claim_event_registration_notification', [job.id])).claimed, false);
  await q("UPDATE event_registration_notification_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [job.id]);
  await call('dispatch_event_notification_job', [job.id]);
  const reclaimed = await call('claim_event_registration_notification', [job.id]);
  equal(reclaimed.tokens.length, 199);
  equal(reclaimed.tokens.includes(claim.tokens[0]), false);
  await q('UPDATE events SET registration_start_notify_enabled=false WHERE id=$1', [interrupted]);

  const broken = (await q("INSERT INTO events(registration_start_notify_enabled,registration_start_at) VALUES(true,now()-interval '1 minute') RETURNING id")).rows[0].id;
  job = await jobFor(broken);
  for (let i = 0; i < 6; i++) await call('dispatch_event_notification_job', [job.id]);
  equal((await jobFor(broken)).attempts, 5);
  equal((await jobFor(broken)).status, 'failed');
  equal((await q('SELECT count(*)::int n FROM cron.job')).rows[0].n, 0);
  equal((await q("SELECT has_function_privilege('authenticated','public.claim_event_registration_notification(uuid)','EXECUTE') ok")).rows[0].ok, false);
  equal((await q("SELECT has_function_privilege('service_role','public.claim_event_registration_notification(uuid)','EXECUTE') ok")).rows[0].ok, true);

  const late = (await q("INSERT INTO events(registration_start_notify_enabled,registration_start_at) VALUES(true,now()-interval '1 minute') RETURNING id")).rows[0].id;
  job = await jobFor(late);
  await call('dispatch_event_notification_job', [job.id]);
  claim = await call('claim_event_registration_notification', [job.id]);
  await q("UPDATE event_registration_notification_jobs SET attempts=5,lease_until=now()-interval '1 second' WHERE id=$1", [job.id]);
  await call('dispatch_event_notification_job', [job.id]);
  equal((await jobFor(late)).status, 'failed');
  equal(await call('record_event_registration_notification_batch', [job.id, claim.lease_token, JSON.stringify(payload(claim.tokens.slice(0,100)))]), false);
  equal((await jobFor(late)).status, 'partial');
  await call('record_event_registration_notification_batch', [job.id, claim.lease_token, JSON.stringify(payload(claim.tokens.slice(100)))]);
  equal((await jobFor(late)).status, 'sent');
  equal((await jobFor(late)).last_error, null);

  const { sendEventPushBatch } = loadTs('supabase/functions/_shared/event-push-delivery.ts');
  const goodFetch = async (_url, options) => new Response(JSON.stringify({ data: JSON.parse(options.body).map((_, i) => ({ status: 'ok', id: `accepted-${i}` })) }));
  const result = await sendEventPushBatch([token(1), 'invalid'], 'Test', event, goodFetch);
  equal(result.map(item => item.status).join(','), 'sent,failed');
  equal((await sendEventPushBatch([token(1)], 'Test', event, async()=>new Response('{}',{status:503})))[0].status, 'pending');
  equal((await sendEventPushBatch([token(1)], 'Test', event, async()=>new Response(JSON.stringify({data:[{status:'error',details:{error:'DeviceNotRegistered'}}]}))))[0].status, 'failed');
  await assert.rejects(()=>sendEventPushBatch(Array.from({length:101},(_,i)=>token(i)), 'Test', event, goodFetch), /100 recipients/); checks++;

  const chunks = [];
  const { sendExpoPushMessages } = loadTs('student-app/lib/expoPush.ts', { fetch: async (url, options) => { chunks.push(JSON.parse(options.body).length); return goodFetch(url,options); } });
  const manual = await sendExpoPushMessages(Array.from({length:201},(_,i)=>({to:token(i),title:'Test',body:'Test'})));
  equal(chunks, [100,100,1]);
  equal(JSON.parse(JSON.stringify(manual)), {success:true,sentCount:201,failedCount:0});
  const failedManual = loadTs('student-app/lib/expoPush.ts', {fetch:async()=>new Response(JSON.stringify({data:[{status:'error',details:{error:'DeviceNotRegistered'}}]}))});
  equal((await failedManual.sendExpoPushMessages([{to:token(1),title:'Test',body:'Test'}])).success,false);

  // Load the real entry point with Deno and Supabase stubbed, then exercise 200 recipients.
  let handler;
  const workerBatches = [];
  const workerClient = {rpc:async(name,args)=> {
    if(name==='claim_event_registration_notification') return {data:{claimed:true,lease_token:'lease',event_id:event,title:'Test',tokens:Array.from({length:200},(_,i)=>token(i))},error:null};
    if(name==='record_event_registration_notification_batch') { if(args.p_results.length) workerBatches.push(args.p_results.length);return {data:true,error:null}; }
    if(name==='finish_event_registration_notification') return {data:{status:'sent',sent:200,failed:0},error:null};
    throw new Error('Unexpected RPC '+name);
  }};
  loadTs('supabase/functions/event-registration-start-notifications/index.ts', {
    Deno:{env:{get:()=> 'mock'},serve:fn=>{handler=fn;}},
    setTimeout:(fn,ms)=>setTimeout(fn,ms===200?0:ms),
    require:name=>name.includes('supabase-js')?{createClient:()=>workerClient}:name.includes('supabase-keys')?
      {getSupabaseAdminKey:()=> 'mock',isInternalSupabaseRequest:()=>true}:
      {sendEventPushBatch:(tokens,title,id)=>sendEventPushBatch(tokens,title,id,goodFetch)},
  });
  const response = await handler(new Request('https://local.invalid',{method:'POST',body:JSON.stringify({job_id:job.id})}));
  equal(response.status,200);
  equal(workerBatches,[100,100]);
  equal((await response.json()).sent,200);
  console.log(`Event notification delivery: ${checks} checks passed (local only).`);
} finally {
  await db.close();
}
