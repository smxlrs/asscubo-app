// Runs on the isolated PostgreSQL-compatible DB prepared by the hardening suite.
// Uses real RLS roles; all cron/HTTP APIs are local mocks. No external requests.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function testEventAudience(db, sql) {
  const q = (text, values = []) => db.query(text, values);
  let checks = 0;
  const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
  const fails = async (run, pattern) => { await assert.rejects(run, pattern); checks++; };
  const manager = randomUUID(), admin = randomUUID(), superAdmin = randomUUID(), student = randomUUID();
  await db.exec(`
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'student';
    ALTER TABLE push_tokens ADD COLUMN user_id uuid;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT SELECT ON events, event_vehicles, event_registrations, event_registration_attendees TO anon, authenticated;
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE event_vehicles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE event_registration_attendees ENABLE ROW LEVEL SECURITY;
    CREATE OR REPLACE FUNCTION public.has_admin_permission(text) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
      SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid()
        AND (role='super_admin' OR (role='admin' AND id='${manager}'::uuid))) $$;
  `);
  const policies = sql('024_event_registration_module.sql');
  await db.exec(policies.slice(policies.indexOf('DROP POLICY IF EXISTS "Published events'), policies.indexOf('CREATE OR REPLACE FUNCTION public.validate_event_registration_answers')));
  await db.exec(sql('043_event_audience.sql'));
  await db.exec(sql('043_event_audience.sql')); // idempotent, no nested wrappers
  for (const [id, role] of [[manager,'admin'],[admin,'admin'],[superAdmin,'super_admin'],[student,'student']]) {
    await q('INSERT INTO auth.users(id,email) VALUES($1,$2)', [id,`${id}@example.invalid`]);
    await q('INSERT INTO profiles(id,name,role) VALUES($1,$2,$3)', [id,role,role]);
    await q('INSERT INTO push_tokens(token,user_id) VALUES($1,$2)', [`ExpoPushToken[${id}]`, id]);
  }
  const actor = async (id) => {
    await db.exec('RESET ROLE');
    await q("SELECT set_config('app.user_id',$1,false)", [id || '']);
    await db.exec(id ? 'SET ROLE authenticated' : 'SET ROLE anon');
  };
  const row = async (id) => (await q('SELECT * FROM events WHERE id=$1',[id])).rows[0];
  const save = async (id, changes) => {
    const old = id ? await row(id) : null;
    const payload = {title:'Audience fixture',description:'Local only',start_time:'2030-01-01T00:00:00Z',end_time:'2030-01-02T00:00:00Z',
      is_published:true,registration_status:'open',registration_form:[],vehicle_selection_mode:'none',allow_waitlist:true,
      ...(old || {}),...changes};
    return (await q('SELECT admin_save_event_config($1,$2::jsonb,$3::jsonb,$4) id',[id,JSON.stringify(payload),'[]',old?.revision])).rows[0].id;
  };
  const submit = async (id) => (await q("SELECT * FROM submit_event_registration_checked($1,'self',NULL,1,'{}','[{\"name\":\"Fixture\"}]',NULL,'app',$2)",
    [id,(await row(id))?.registration_form_version || 1])).rows[0];
  const recipients = async (id) => (await q('SELECT * FROM admin_event_push_tokens($1)',[id])).rows.map(r=>r.token).sort();

  await actor(manager);
  const open = await save(null, {}), internal = await save(null, {audience:'admins'});
  const draft = await save(null, {audience:'admins',is_published:false});
  eq((await row(open)).audience,'all');
  eq((await row(internal)).audience,'admins');
  await fails(()=>save(null,{audience:'invalid'}),/Invalid event audience/);
  await fails(()=>save(null,{audience:null}),/Invalid event audience/);
  const oldPayload = {...await row(internal)};
  delete oldPayload.audience;
  await q('SELECT admin_save_event_config($1,$2::jsonb,\'[]\',$3)',[internal,JSON.stringify(oldPayload),oldPayload.revision]);
  eq((await row(internal)).audience,'admins');
  await fails(()=>q('SELECT admin_save_event_config($1,$2::jsonb,\'[]\',$3)',[internal,JSON.stringify({...oldPayload,audience:'all'}),oldPayload.revision]),/Event changed/);

  await actor(null);
  eq(Boolean(await row(open)),true);
  eq(await row(internal),undefined);
  await fails(()=>submit(open),/permission denied/);
  await actor(student);
  eq(Boolean(await row(open)),true);
  eq(await row(internal),undefined);
  eq((await submit(open)).registration_status,'confirmed');
  await fails(()=>submit(internal),/only available to administrators/);
  await fails(()=>q("SELECT * FROM submit_event_registration_group_checked($1,'[]','app',1)",[internal]),/only available to administrators/);
  await fails(()=>recipients(internal),/permission is required/);
  await fails(()=>save(null,{audience:'admins'}),/permission is required/);

  await actor(admin); // deliberately no events.manage permission
  eq(Boolean(await row(internal)),true);
  eq(await row(draft),undefined);
  const adminRegistration = await submit(internal);
  eq(adminRegistration.registration_status,'confirmed');
  await fails(()=>recipients(internal),/permission is required/);
  await actor(superAdmin);
  eq(Boolean(await row(internal)),true);
  eq((await submit(internal)).registration_status,'confirmed');
  await actor(manager);
  eq(await recipients(internal),[manager,admin,superAdmin].map(id=>`ExpoPushToken[${id}]`).sort());
  eq((await q('SELECT * FROM admin_event_push_tokens($1,0,500,$2)',[internal,admin])).rows.map(r=>r.token),[`ExpoPushToken[${admin}]`]);
  eq((await q('SELECT * FROM admin_event_push_tokens($1,0,500,$2)',[internal,student])).rows,[]);
  eq((await recipients(open)).includes(`ExpoPushToken[${student}]`),true);

  const queue = await save(null,{max_participants:1});
  const queuedOwner = await submit(queue);
  await actor(student);
  eq((await submit(queue)).registration_status,'waitlist');
  await actor(admin);
  const queuedAdmin = await submit(queue);
  eq(queuedAdmin.registration_status,'waitlist');
  await actor(manager);
  await save(queue,{audience:'admins'});
  await q('SELECT cancel_event_registration($1)',[queuedOwner.registration_id]);
  eq((await q('SELECT status FROM event_registrations WHERE id=$1',[queuedAdmin.registration_id])).rows[0].status,'confirmed');
  eq((await q('SELECT status FROM event_registrations WHERE event_id=$1 AND user_id=$2',[queue,student])).rows[0].status,'waitlist');

  // Changing a public activity hides former students' answers as well as the event.
  await save(open,{audience:'admins'});
  await actor(student);
  eq(await row(open),undefined);
  eq((await q('SELECT count(*)::int n FROM event_registrations WHERE event_id=$1',[open])).rows[0].n,0);
  eq((await q('SELECT count(*)::int n FROM event_registration_attendees a JOIN event_registrations r ON r.id=a.registration_id WHERE r.event_id=$1',[open])).rows[0].n,0);
  await actor(manager);
  const ownRegistration = (await q('SELECT * FROM event_registrations WHERE event_id=$1 AND user_id=$2',[open,student])).rows[0];
  eq(Boolean(ownRegistration),true); // managers retain historical data
  await actor(student);
  await fails(()=>q("SELECT * FROM update_event_registration($1,NULL,1,'{}','[{\"name\":\"Fixture\"}]',NULL,$2)",[ownRegistration.id,ownRegistration.revision]),/only available to administrators/);

  // Role loss immediately affects access, registration and push recipients.
  await db.exec('RESET ROLE');
  await q("UPDATE profiles SET role='student' WHERE id=$1",[admin]);
  await actor(admin);
  eq(await row(internal),undefined);
  eq((await q('SELECT count(*)::int n FROM event_registrations WHERE id=$1',[adminRegistration.registration_id])).rows[0].n,0);
  await actor(manager);
  eq(await recipients(internal),[manager,superAdmin].map(id=>`ExpoPushToken[${id}]`).sort());

  // An in-flight public notification cannot keep sending its old broad snapshot
  // after the event is restricted. Claim/record are exercised locally only.
  const notify = await save(null,{registration_start_notify_enabled:true,registration_start_at:new Date(Date.now()-60000).toISOString()});
  await db.exec('RESET ROLE');
  const job = (await q('SELECT id FROM event_registration_notification_jobs WHERE event_id=$1',[notify])).rows[0].id;
  const claim = async () => (await q('SELECT claim_event_registration_notification($1) value',[job])).rows[0].value;
  const broad = await claim();
  eq(broad.tokens.includes(`ExpoPushToken[${student}]`),true);
  await actor(manager);
  await save(notify,{audience:'admins'});
  await db.exec('RESET ROLE');
  eq((await q("SELECT record_event_registration_notification_batch($1,$2,'[]') value",[job,broad.lease_token])).rows[0].value,false);
  const narrow = await claim();
  eq(narrow.tokens.sort(),[manager,superAdmin].map(id=>`ExpoPushToken[${id}]`).sort());
  // Disabling and immediately re-enabling a job must not revive a worker that
  // captured the broader audience before cancellation.
  await actor(manager);
  const toggled = await save(null,{registration_start_notify_enabled:true,registration_start_at:new Date(Date.now()-60000).toISOString()});
  await db.exec('RESET ROLE');
  const toggleJob = (await q('SELECT id FROM event_registration_notification_jobs WHERE event_id=$1',[toggled])).rows[0].id;
  const toggleClaim = (await q('SELECT claim_event_registration_notification($1) value',[toggleJob])).rows[0].value;
  await actor(manager);
  await save(toggled,{registration_start_notify_enabled:false});
  await save(toggled,{audience:'admins',registration_start_notify_enabled:true});
  await db.exec('RESET ROLE');
  eq((await q("SELECT record_event_registration_notification_batch($1,$2,'[]') value",[toggleJob,toggleClaim.lease_token])).rows[0].value,false);
  eq((await q('SELECT claim_event_registration_notification($1) value',[toggleJob])).rows[0].value.tokens.sort(),[manager,superAdmin].map(id=>`ExpoPushToken[${id}]`).sort());
  await q("UPDATE profiles SET role='student' WHERE id=$1",[superAdmin]);
  await q("SELECT finish_event_registration_notification($1,$2,'Retry')",[job,narrow.lease_token]);
  eq((await claim()).tokens,[`ExpoPushToken[${manager}]`]);
  for (const signature of ['public.admin_save_event_config_v040_impl(uuid,jsonb,jsonb,bigint)','public.event_push_recipients_internal(uuid)']) {
    eq((await q("SELECT has_function_privilege('authenticated',$1,'EXECUTE') value",[signature])).rows[0].value,false);
  }
  console.log(`Event audience: ${checks} checks passed (real local RLS; no network).`);
}
