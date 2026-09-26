// Local PostgreSQL-compatible regression tests. No network or production data.
// EVENT_TEST_PGLITE_PATH can point at an existing @electric-sql/pglite install.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { testEventAudience } from './event-audience-suite.mjs';

const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH
  || '@electric-sql/pglite');
const db = new PGlite();
const migrations = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');
const sql = name => readFileSync(resolve(migrations, name), 'utf8');
const definition = (file, name) => {
  const match = sql(file).match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`));
  assert.ok(match, `Missing ${name} in ${file}`);
  return match[0];
};
const q = (statement, params = []) => db.query(statement, params);
const exec = statement => db.exec(statement);
let assertions = 0;
const fail = async (action, pattern) => {
  await assert.rejects(action, pattern); assertions++;
};
const equal = (actual, expected) => { assert.deepEqual(actual, expected); assertions++; };
const row = async id => (await q('SELECT * FROM public.event_registrations WHERE id=$1', [id])).rows[0];
const event = async id => (await q('SELECT * FROM public.events WHERE id=$1', [id])).rows[0];
const asUser = async (id = randomUUID()) => {
  await q('INSERT INTO auth.users(id,email) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, `${id}@example.org`]);
  await q('INSERT INTO public.profiles(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, `User ${id}`]);
  await q("SELECT set_config('app.user_id',$1,false)", [id]);
  return id;
};
const newEvent = async (overrides = {}, vehicles = []) => {
  const payload = { title: 'Test event', description: 'Test', start_time: '2030-01-01T00:00:00Z',
    end_time: '2030-01-02T00:00:00Z', is_published: true, registration_status: 'open',
    vehicle_selection_mode: 'none', allow_waitlist: true, registration_form: [], ...overrides };
  const result = await q('SELECT public.admin_save_event_config(NULL,$1::jsonb,$2::jsonb,NULL) AS id', [JSON.stringify(payload), JSON.stringify(vehicles)]);
  return result.rows[0].id;
};
const saveEvent = async (id, changes, expectedRevision, vehicles) => {
  const latest = await event(id);
  const buses = vehicles ?? (await q('SELECT * FROM public.event_vehicles WHERE event_id=$1 AND is_active', [id])).rows;
  return q('SELECT public.admin_save_event_config($1,$2::jsonb,$3::jsonb,$4)',
    [id, JSON.stringify({ ...latest, ...changes }), JSON.stringify(buses), expectedRevision ?? latest.revision]);
};
const submit = async (id, answers = {}, vehicleId = null, kind = 'self', note = null) => {
  const result = await q("SELECT * FROM public.submit_event_registration($1,$2,$3,1,$4::jsonb,$5::jsonb,$6,'app')",
    [id, kind, note, JSON.stringify(answers), JSON.stringify([{ name: 'Test participant' }]), vehicleId]);
  return result.rows[0];
};
const edit = async (registration, answers = registration.answers, expectedRevision = registration.revision) =>
  q('SELECT * FROM public.update_event_registration($1,$2,1,$3::jsonb,$4::jsonb,$5,$6)',
    [registration.id, registration.proxy_note, JSON.stringify(answers), JSON.stringify([{ name: 'Edited participant' }]),
      registration.vehicle_id || registration.requested_vehicle_id, expectedRevision]);

try {
  await exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    CREATE FUNCTION public.has_admin_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('app.admin',true)='yes' $$;
    CREATE TABLE public.events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL,
      location text, start_time timestamptz NOT NULL, end_time timestamptz NOT NULL,
      has_end_date boolean DEFAULT true, start_has_time boolean DEFAULT true, end_has_time boolean DEFAULT true,
      registration_deadline timestamptz, registration_start_at timestamptz,
      registration_start_notify_enabled boolean DEFAULT false, max_participants integer,
      is_published boolean DEFAULT false, registration_status text DEFAULT 'draft', registration_mode text DEFAULT 'authenticated',
      registration_form jsonb DEFAULT '[]', registration_form_version integer DEFAULT 1,
      vehicle_selection_mode text DEFAULT 'none', allow_proxy_registration boolean DEFAULT false,
      allow_waitlist boolean DEFAULT true, updated_at timestamptz DEFAULT now(), deleted_at timestamptz
    );
    CREATE TABLE public.event_vehicles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
      name text NOT NULL, capacity integer NOT NULL CHECK(capacity>0), reserved_seats integer DEFAULT 0,
      boarding_stop text, departure_time text, notes text, sort_order integer DEFAULT 0,
      is_active boolean DEFAULT true, updated_at timestamptz DEFAULT now(), CHECK(reserved_seats BETWEEN 0 AND capacity)
    );
    CREATE TABLE public.event_registrations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
      user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
      registered_at timestamptz DEFAULT now(), status text DEFAULT 'confirmed', registration_kind text DEFAULT 'self',
      proxy_note text, participant_count integer DEFAULT 1, answers jsonb DEFAULT '{}', form_version integer DEFAULT 1,
      vehicle_id uuid REFERENCES public.event_vehicles(id) ON DELETE SET NULL, source text DEFAULT 'app',
      registration_number text, updated_at timestamptz DEFAULT now(), cancelled_at timestamptz
    );
    CREATE UNIQUE INDEX event_registrations_one_self_per_event ON public.event_registrations(event_id,user_id)
      WHERE registration_kind='self' AND status <> 'cancelled';
    CREATE TABLE public.event_registration_attendees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_id uuid REFERENCES public.event_registrations(id) ON DELETE CASCADE,
      name text NOT NULL, phone text, email text, sort_order integer DEFAULT 0, answers jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.event_registration_audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
      registration_id uuid REFERENCES public.event_registrations(id) ON DELETE SET NULL,
      actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
      action text NOT NULL, details jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
    );
  `);
  for (const [file, names] of [
    ['027_event_attendee_answers.sql', ['sync_event_attendee_answers']],
    ['024_event_registration_module.sql', ['validate_event_registration_answers','submit_event_registration','update_event_registration','promote_event_waitlist','cancel_event_registration','admin_assign_event_registration']],
    ['028_event_group_registration.sql', ['submit_event_registration_group']],
    ['032_manual_event_waitlist_promotion.sql', ['promote_event_waitlist','admin_promote_event_registration']],
    ['034_event_push_notifications.sql', ['admin_update_event_registration','admin_cancel_event_registration']],
  ]) for (const name of names) await exec(definition(file, name));
  await exec(`CREATE TRIGGER event_attendee_answers_sync BEFORE INSERT OR UPDATE OF registration_id, sort_order
    ON public.event_registration_attendees FOR EACH ROW EXECUTE FUNCTION public.sync_event_attendee_answers()`);
  await exec(sql('039_event_registration_integrity.sql'));
  const legacyOwner = await asUser();
  const legacyInternalEvent = randomUUID();
  const legacyInternalRegistration = randomUUID();
  await q(`INSERT INTO public.events(id,title,description,start_time,end_time,is_published,registration_status,registration_form)
    VALUES($1,'Legacy internal answers','Test','2030-01-01','2030-01-02',true,'open',$2::jsonb)`,
    [legacyInternalEvent, JSON.stringify([{key:'name',type:'text',required:true}])]);
  await q(`INSERT INTO public.event_registrations(id,event_id,user_id,answers)
    VALUES($1,$2,$3,$4::jsonb)`,[legacyInternalRegistration,legacyInternalEvent,legacyOwner,
      JSON.stringify({name:'Old root',__attendee_answers:[{name:'Actual person'}]})]);
  await q("INSERT INTO public.event_registration_attendees(registration_id,name) VALUES($1,'Actual person')",[legacyInternalRegistration]);
  const dateFixtures = [
    {id:randomUUID(),start:'2030-03-30T23:00:00Z',end:'2030-03-30T23:00:00Z',hasEndDate:true,status:'open',expected:'2030-03-31T21:59:59.999Z'},
    {id:randomUUID(),start:'2030-10-26T22:00:00Z',end:'2030-10-29T00:00:00Z',hasEndDate:false,status:'open',expected:'2030-10-27T22:59:59.999Z'},
    {id:randomUUID(),start:'2030-03-30T23:00:00Z',end:'2030-03-30T23:00:00Z',hasEndDate:true,status:'archived',expected:'2030-03-30T23:00:00.000Z'},
  ];
  for(const item of dateFixtures) await q(`INSERT INTO public.events(id,title,description,start_time,end_time,has_end_date,end_has_time,registration_status)
    VALUES($1,'Date fixture','Test',$2,$3,$4,false,$5)`,[item.id,item.start,item.end,item.hasEndDate,item.status]);
  await exec(sql('040_event_registration_hardening.sql'));
  await exec(sql('040_event_registration_hardening.sql'));
  await exec("SELECT set_config('app.admin','yes',false)");
  equal((await row(legacyInternalRegistration)).answers,{name:'Actual person'});
  equal((await q("SELECT count(*)::int AS count FROM public.event_registration_audit_logs WHERE registration_id=$1 AND action='legacy_single_attendee_normalized'",[legacyInternalRegistration])).rows[0].count,1);
  await edit(await row(legacyInternalRegistration),{name:'Updated person'});
  equal((await q('SELECT answers FROM public.event_registration_attendees WHERE registration_id=$1',[legacyInternalRegistration])).rows[0].answers,{name:'Updated person'});
  for(const item of dateFixtures) equal(new Date((await event(item.id)).end_time).toISOString(),item.expected);
  await asUser();

  const bulkEvent = await newEvent({ max_participants: 200, vehicle_selection_mode: 'auto' },
    Array.from({ length: 4 }, (_, i) => ({ name: `Bus ${i + 1}`, capacity: 50, sort_order: i })));
  const people = [];
  for (let i = 0; i < 202; i++) {
    const user = await asUser();
    const result = await submit(bulkEvent);
    people.push({ user, ...result });
    equal(result.registration_status, i < 200 ? 'confirmed' : 'waitlist');
  }
  equal((await q("SELECT count(*)::int AS count FROM public.event_registrations WHERE event_id=$1 AND status='confirmed' GROUP BY vehicle_id", [bulkEvent])).rows.map(r => r.count), [50,50,50,50]);
  await asUser(people[0].user);
  await q('SELECT public.cancel_event_registration($1)', [people[0].registration_id]);
  equal((await row(people[200].registration_id)).status, 'confirmed');
  await asUser(people[2].user);
  await fail(() => submit(bulkEvent), /already have an active registration|This event is full/);
  // 200/4x50 plus sequential cancellation and reopening are real SQL calls in PGlite, not multi-connection contention tests.
  await saveEvent(bulkEvent, { registration_status: 'closed' });
  await q('SELECT public.admin_cancel_event_registration($1,false)', [people[1].registration_id]);
  equal((await row(people[201].registration_id)).status, 'waitlist');
  await saveEvent(bulkEvent, { registration_status: 'open' });
  equal((await row(people[201].registration_id)).status, 'confirmed');

  const single = await newEvent();
  await asUser();
  await fail(() => q("SELECT * FROM public.submit_event_registration($1,'self',NULL,2,'{}',$2::jsonb,NULL,'app')",
    [single, JSON.stringify([{name:'A'},{name:'B'}])]), /exactly one participant/);
  await fail(() => submit(single, {}, null, 'proxy', 'Friend'), /does not allow proxy/);
  const singleReg = await submit(single);
  await fail(() => submit(single), /already have an active registration/);
  await fail(async () => q("SELECT * FROM public.update_event_registration($1,NULL,2,'{}',$2::jsonb,NULL,$3)",
    [singleReg.registration_id, JSON.stringify([{name:'A'},{name:'B'}]), (await row(singleReg.registration_id)).revision]), /exactly one participant/);

  const grouped = await newEvent({ allow_proxy_registration: true, registration_form: [{ key:'name',type:'text',required:true }] });
  await fail(() => q("SELECT * FROM public.submit_event_registration_group($1,$2::jsonb,'app')", [grouped,
    JSON.stringify([{name:'A',answers:{name:'A'}},{name:'B',proxy_note:'Friend',answers:{}}])]), /Required registration field/);
  equal((await q('SELECT count(*)::int AS count FROM public.event_registrations WHERE event_id=$1',[grouped])).rows[0].count, 0);

  const checked = await newEvent({allow_proxy_registration:true,registration_form:[{key:'answer',type:'text',label:'Original question'}]});
  const originalFormVersion=(await event(checked)).registration_form_version;
  await saveEvent(checked,{registration_form:[{key:'answer',type:'text',label:'Different question with same key'}]});
  const currentFormVersion=(await event(checked)).registration_form_version;
  const checkedSingle = version=>q("SELECT * FROM public.submit_event_registration_checked($1,'self',NULL,1,$2::jsonb,$3::jsonb,NULL,'app',$4)",
    [checked,JSON.stringify({answer:'Answer'}),JSON.stringify([{name:'Versioned person'}]),version]);
  const checkedGroup = version=>q("SELECT * FROM public.submit_event_registration_group_checked($1,$2::jsonb,'app',$3)",
    [checked,JSON.stringify([{name:'Group self',answers:{answer:'Self answer'}},{name:'Group guest',proxy_note:'Friend',answers:{answer:'Guest answer'}}]),version]);
  await fail(()=>checkedSingle(originalFormVersion),/Event form changed; reload/);
  await fail(()=>checkedSingle(null),/Event form changed; reload/);
  await fail(()=>checkedGroup(originalFormVersion),/Event form changed; reload/);
  await fail(()=>checkedGroup(null),/Event form changed; reload/);
  equal((await q('SELECT count(*)::int AS count FROM public.event_registrations WHERE event_id=$1',[checked])).rows[0].count,0);
  const checkedResult=await checkedSingle(currentFormVersion);
  equal(checkedResult.rows[0].registration_status,'confirmed');
  equal((await row(checkedResult.rows[0].registration_id)).form_snapshot[0].label,'Different question with same key');
  await asUser(); equal((await checkedGroup(currentFormVersion)).rows.length,2);
  equal((await q('SELECT count(*)::int AS count FROM public.event_registrations WHERE event_id=$1',[checked])).rows[0].count,3);
  // Closing the event takes priority over the stale form-version message.
  await saveEvent(checked,{registration_status:'closed'});
  await fail(()=>checkedSingle(originalFormVersion),/Registration is not open/);
  await fail(()=>checkedGroup(originalFormVersion),/Registration is not open/);

  const editable = await newEvent({ registration_form: [{key:'email',type:'email',required:true}] });
  const editReg = await submit(editable, {email:'first@example.org'});
  const old = await row(editReg.registration_id);
  await edit(old, {email:'second@example.org'});
  await fail(() => edit(old, {email:'stale@example.org'}), /Registration changed; reload/);
  await fail(() => q('SELECT public.admin_update_event_registration_full($1,$2,NULL,NULL,$3::jsonb,NULL,NULL,false,$4)',
    [old.id,'Admin',JSON.stringify({email:'admin-stale@example.org'}),old.revision]), /Registration changed; reload/);
  const beforeAdminEdit = await row(old.id);
  await q('SELECT public.admin_update_event_registration_full($1,$2,NULL,NULL,$3::jsonb,NULL,NULL,false,$4)',
    [old.id,'Admin',JSON.stringify({email:'admin-current@example.org'}),beforeAdminEdit.revision]);
  await fail(() => edit(beforeAdminEdit, {email:'student-stale@example.org'}), /Registration changed; reload/);
  equal((await row(old.id)).answers.email, 'admin-current@example.org');
  await fail(async () => edit(await row(editReg.registration_id), {email:'1'}), /Invalid email/);
  const staleEvent = await event(editable);
  await saveEvent(editable, { location:'New location' });
  await fail(() => saveEvent(editable, { title:'Stale overwrite' }, staleEvent.revision), /Event changed; reload/);
  equal((await event(editable)).title, 'Test event');
  await saveEvent(editable, {registration_form:[{key:'newQuestion',type:'text',required:true}]});
  equal((await row(editReg.registration_id)).form_snapshot, [{key:'email',type:'email',required:true}]);
  await edit(await row(editReg.registration_id), {email:'historical@example.org'});
  await fail(() => submit(editable, {newQuestion:'test'}), /already have an active registration/);
  await saveEvent(editable, {is_published:false});
  await fail(async () => edit(await row(editReg.registration_id)), /not open/);
  await saveEvent(editable, {is_published:true,registration_start_at:'2029-12-31T12:00:00Z'});
  await fail(async () => edit(await row(editReg.registration_id)), /not opened yet/);

  const fair = await newEvent({max_participants:1});
  await asUser(); const occupied = await submit(fair);
  await asUser(); const firstWaiting = await submit(fair);
  await asUser(); const secondWaiting = await submit(fair);
  await saveEvent(fair,{max_participants:2});
  equal((await row(firstWaiting.registration_id)).status,'confirmed');
  equal((await row(secondWaiting.registration_id)).status,'waitlist');
  await asUser(); const newcomer = await submit(fair);
  equal(newcomer.registration_status,'waitlist');

  const adminTransport = await newEvent({max_participants:1,vehicle_selection_mode:'admin'},[{name:'Manual bus',capacity:10}]);
  await asUser(); const manualConfirmed = await submit(adminTransport);
  const manualWaitingUser = await asUser(); const manualWaiting = await submit(adminTransport);
  await q('SELECT public.admin_cancel_event_registration($1,false)',[manualConfirmed.registration_id]);
  await asUser(manualWaitingUser);
  await edit(await row(manualWaiting.registration_id));
  equal((await row(manualWaiting.registration_id)).status,'waitlist');
  await asUser(); equal((await submit(adminTransport)).registration_status,'waitlist');

  const reservedEvent = await newEvent({vehicle_selection_mode:'auto'},[{name:'Reserved bus',capacity:3,reserved_seats:1}]);
  for(const expected of ['confirmed','confirmed','waitlist']) {
    await asUser(); equal((await submit(reservedEvent)).registration_status,expected);
  }
  const reservedBus = (await q('SELECT * FROM public.event_vehicles WHERE event_id=$1',[reservedEvent])).rows[0];
  await fail(()=>saveEvent(reservedEvent,{title:'Must roll back'},undefined,[{...reservedBus,capacity:2}]),/capacity is below/);
  await fail(()=>saveEvent(reservedEvent,{title:'Must also roll back'},undefined,[{...reservedBus,reserved_seats:2}]),/capacity is below/);
  equal((await event(reservedEvent)).title,'Test event');
  equal((await q('SELECT capacity,reserved_seats FROM public.event_vehicles WHERE id=$1',[reservedBus.id])).rows[0],{capacity:3,reserved_seats:1});

  const chosenTransport = await newEvent({max_participants:1,vehicle_selection_mode:'self_select'},
    [{name:'Choice A',capacity:1},{name:'Choice B',capacity:1}]);
  const choiceBus = (await q('SELECT id FROM public.event_vehicles WHERE event_id=$1 ORDER BY name',[chosenTransport])).rows[0].id;
  await asUser(); await submit(chosenTransport,{},choiceBus);
  await asUser(); const chosenWaitlist = await submit(chosenTransport,{},choiceBus);
  await saveEvent(chosenTransport,{max_participants:2});
  await edit(await row(chosenWaitlist.registration_id));
  equal((await row(chosenWaitlist.registration_id)).status,'waitlist');

  const openingBoundary = await newEvent();
  await exec('BEGIN');
  await new Promise(resolve=>setTimeout(resolve,20));
  await q('UPDATE public.events SET registration_start_at=clock_timestamp() WHERE id=$1',[openingBoundary]);
  equal((await q('SELECT now() < registration_start_at AS old_clock_would_reject FROM public.events WHERE id=$1',[openingBoundary])).rows[0].old_clock_would_reject,true);
  equal((await submit(openingBoundary)).registration_status,'confirmed');
  await exec('ROLLBACK');

  const clockEvent = await newEvent({max_participants:1});
  await asUser(); await submit(clockEvent);
  await asUser(); const clockWaiting = await submit(clockEvent);
  await exec('BEGIN');
  await new Promise(resolve=>setTimeout(resolve,20));
  await q('UPDATE public.events SET max_participants=2,registration_deadline=clock_timestamp() WHERE id=$1',[clockEvent]);
  equal((await q('SELECT now() < registration_deadline AS old_clock_would_pass FROM public.events WHERE id=$1',[clockEvent])).rows[0].old_clock_would_pass,true);
  equal((await q('SELECT public.promote_event_waitlist($1) AS promoted',[clockEvent])).rows[0].promoted,0);
  equal((await row(clockWaiting.registration_id)).status,'waitlist');
  await fail(() => submit(clockEvent),/deadline has passed/);
  await exec('ROLLBACK');

  for(const item of dateFixtures.slice(0,2)) {
    const id = await newEvent({start_time:item.start,end_time:item.end,has_end_date:item.hasEndDate,end_has_time:false});
    equal(new Date((await event(id)).end_time).toISOString(),item.expected);
  }

  const accountEvent = await newEvent({max_participants:2,allow_proxy_registration:true});
  const deleting = await asUser(); await submit(accountEvent); await submit(accountEvent,{},null,'proxy','Friend');
  await asUser(); const survivor = await submit(accountEvent);
  await q('DELETE FROM auth.users WHERE id=$1',[deleting]);
  equal((await row(survivor.registration_id)).status,'confirmed');
  equal((await q('SELECT count(*)::int AS count FROM public.event_registrations WHERE user_id=$1',[deleting])).rows[0].count,0);
  await q('DELETE FROM auth.users WHERE id=$1',[legacyOwner]);
  equal((await q("SELECT count(*)::int AS count FROM public.event_registration_audit_logs WHERE action='legacy_single_attendee_normalized'",[])).rows[0].count,0);
  equal(await row(legacyInternalRegistration),undefined);

  const legacy = await newEvent();
  await asUser(); const legacyRegistration = await submit(legacy);
  await q('UPDATE public.event_registrations SET participant_count=2 WHERE id=$1',[legacyRegistration.registration_id]);
  await fail(async () => edit(await row(legacyRegistration.registration_id)), /Legacy multi-person registrations/);
  equal((await row(legacyRegistration.registration_id)).participant_count,2);

  await fail(() => newEvent({registration_form:[{key:'upload',type:'file'}]}), /File attachments are no longer supported/);
  // Create legacy metadata as a database fixture, then verify read-only compatibility.
  const legacyFile = await newEvent();
  await q('UPDATE public.events SET registration_form=$2::jsonb WHERE id=$1', [legacyFile, JSON.stringify([{key:'upload',type:'file',required:true},{key:'name',type:'text'}])]);
  await asUser(); const noFile = await submit(legacyFile,{name:'No new file required'});
  await fail(async () => edit(await row(noFile.registration_id),{upload:{path:'new-upload'}}), /File attachments/);
  const metadata = {name:'old.pdf',path:'legacy/path.pdf'};
  await q('UPDATE public.event_registrations SET answers=$2::jsonb WHERE id=$1',[noFile.registration_id,JSON.stringify({name:'Legacy',upload:metadata})]);
  await edit(await row(noFile.registration_id),{name:'Changed text',upload:metadata});
  await fail(async () => edit(await row(noFile.registration_id),{name:'Removed file'}), /read-only/);

  const fullSnapshot = (await q('SELECT public.admin_event_registration_snapshot($1) AS result',[bulkEvent])).rows[0].result;
  equal(fullSnapshot.registrations.length,202);
  equal(fullSnapshot.registrations.every(r=>typeof r.registered_by_email==='string' && Array.isArray(r.attendees) && Array.isArray(r.form_snapshot)),true);
  const pages=(await q('SELECT public.admin_event_registration_page($1,0,100,NULL,NULL) AS result',[bulkEvent])).rows[0].result;
  const firstPageIds = new Set(pages.map(item=>item.id));
  await asUser(); const concurrentNewcomer = await submit(bulkEvent);
  while(true) {
    const last = pages.at(-1);
    const next=(await q('SELECT public.admin_event_registration_page($1,0,100,$2,$3) AS result',
      [bulkEvent,last.registered_at,last.id])).rows[0].result;
    pages.push(...next);
    if(next.length<100) break;
  }
  equal(new Set(pages.map(r=>r.id)).size,202);
  equal(pages.length,202);
  equal(pages.some(item=>item.id===concurrentNewcomer.registration_id),false);
  equal(pages.slice(100).some(item=>firstPageIds.has(item.id)),false);
  const beforeDelete = await event(legacyFile);
  await q('SELECT public.admin_delete_event($1,$2)',[legacyFile,beforeDelete.revision]);
  equal((await event(legacyFile)).registration_status,'archived');
  equal((await row(noFile.registration_id)).answers.upload,metadata);
  equal((await q('SELECT public.admin_event_registration_snapshot($1) AS result',[legacyFile])).rows[0].result.registrations.length,1);
  for (const signature of [
    'public.submit_event_registration(uuid,text,text,integer,jsonb,jsonb,uuid,text)',
    'public.submit_event_registration_group(uuid,jsonb,text)',
    'public.update_event_registration_v039_impl(uuid,text,integer,jsonb,jsonb,uuid)',
    'public.admin_update_event_registration(uuid,text,text,text,jsonb,boolean)',
    'public.admin_assign_event_registration(uuid,uuid)',
    'public.admin_save_event_config_v039_impl(uuid,jsonb,jsonb)',
    'public.promote_event_waitlist(uuid)',
  ]) equal((await q("SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,false);
  for(const signature of [
    'public.submit_event_registration_checked(uuid,text,text,integer,jsonb,jsonb,uuid,text,integer)',
    'public.submit_event_registration_group_checked(uuid,jsonb,text,integer)',
  ]) {
    equal((await q("SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,true);
    equal((await q("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,false);
  }
  equal((await q("SELECT has_table_privilege('authenticated','public.events','UPDATE') AS allowed")).rows[0].allowed,false);

  // Install the real 041 after 040, using local-only implementations of the
  // Supabase extension APIs. No HTTP request leaves this process.
  await exec(`
    CREATE ROLE service_role;
    CREATE SCHEMA cron; CREATE SCHEMA net; CREATE SCHEMA vault;
    CREATE TABLE public.push_tokens(token text PRIMARY KEY);
    INSERT INTO public.push_tokens VALUES('ExpoPushToken[integration]');
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
  `);
  await exec(sql('041_event_notification_delivery.sql'));
  const integration = await newEvent({registration_start_notify_enabled:true,registration_start_at:new Date(Date.now()-60000).toISOString()});
  const integrationEvent = await event(integration);
  const job = (await q('SELECT * FROM public.event_registration_notification_jobs WHERE event_id=$1',[integration])).rows[0];
  equal(job.status,'pending');
  equal((await q('SELECT count(*)::int AS count FROM cron.job')).rows[0].count,1);
  await q('SELECT public.dispatch_event_notification_job($1)',[job.id]);
  const claim = (await q('SELECT public.claim_event_registration_notification($1) AS result',[job.id])).rows[0].result;
  equal(claim.claimed,true);
  await q('SELECT public.record_event_registration_notification_batch($1,$2,$3::jsonb)',[job.id,claim.lease_token,
    JSON.stringify([{token:claim.tokens[0],status:'sent',ticket_id:'local-ticket'}])]);
  await q('SELECT public.finish_event_registration_notification($1,$2,NULL)',[job.id,claim.lease_token]);
  equal((await event(integration)).revision,integrationEvent.revision);
  equal((await q('SELECT status FROM public.event_registration_notification_jobs WHERE id=$1',[job.id])).rows[0].status,'sent');
  equal((await q('SELECT count(*)::int AS count FROM cron.job')).rows[0].count,0);
  const scheduled = await newEvent({registration_start_notify_enabled:true,registration_start_at:new Date(Date.now()+3600000).toISOString()});
  const scheduledEvent = await event(scheduled);
  equal((await q('SELECT count(*)::int AS count FROM cron.job')).rows[0].count,1);
  await q('SELECT public.admin_delete_event($1,$2)',[scheduled,scheduledEvent.revision]);
  equal((await q('SELECT status FROM public.event_registration_notification_jobs WHERE event_id=$1',[scheduled])).rows[0].status,'cancelled');
  equal((await q('SELECT count(*)::int AS count FROM cron.job')).rows[0].count,0);
  await exec("SELECT set_config('app.admin','no',false)");
  await fail(() => q('SELECT public.admin_event_registration_page($1,0,100)',[bulkEvent]), /permission is required/);
  console.log(`PASS ${assertions} assertions: 040 twice + 041 integration, 200 people/4 buses, queue fairness, real-clock deadlines, Rome DST dates, legacy normalization, single-person security, atomic groups, optimistic conflicts, historical forms, account deletion, legacy files, cursor paging/export, private RPCs.`);
  await testEventAudience(db, sql);
} finally {
  await db.close();
}
