// Isolated local PostgreSQL-compatible test; never contacts Supabase or Expo.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
const student = '00000000-0000-0000-0000-000000000001';
const admin = '00000000-0000-0000-0000-000000000002';
const event = '00000000-0000-0000-0000-000000000003';
const q = (sql, args = []) => db.query(sql, args);
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role',true) $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY, name text, role text, push_token text, is_banned boolean DEFAULT false);
    CREATE TABLE push_tokens(token text UNIQUE, user_id uuid, updated_at timestamptz);
    CREATE TABLE events(id uuid PRIMARY KEY, audience text);
    CREATE FUNCTION has_admin_permission(text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM profiles WHERE id=auth.uid() AND role='admin') $$;
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Profiles are viewable by authenticated users" ON profiles FOR SELECT TO authenticated USING(true);
    GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
    GRANT SELECT ON profiles TO authenticated;
    INSERT INTO profiles(id,name,role) VALUES('${student}','Student','student'),('${admin}','Admin','admin');
    INSERT INTO events VALUES('${event}','admins');
  `);
  const migration = readFileSync(new URL('../migrations/044_app_privacy_push_controls.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  const actor = async (id, role = id ? 'authenticated' : 'anon') => {
    await db.exec('RESET ROLE');
    await q("SELECT set_config('test.uid',$1,false),set_config('test.role',$2,false)", [id || '', role]);
    await db.exec(`SET ROLE ${role}`);
  };
  await actor(student);
  assert.equal((await q('SELECT * FROM profiles')).rows.length, 1);
  assert.equal((await q('SELECT * FROM profiles WHERE id=$1',[admin])).rows.length, 0);
  await assert.rejects(q('SELECT * FROM push_delivery_tokens()'), /permission/i);
  await q("SELECT configure_push_device('ExpoPushToken[student]',false,false)");
  await actor(admin);
  await q("SELECT configure_push_device('ExpoPushToken[admin]',true,false)");
  assert.deepEqual((await q('SELECT * FROM push_delivery_tokens()')).rows.map(r=>r.token), ['ExpoPushToken[admin]']);
  await actor(null, 'service_role');
  assert.deepEqual((await q('SELECT * FROM event_push_recipients_internal($1)',[event])).rows.map(r=>r.token), ['ExpoPushToken[admin]']);
  await actor(admin);
  await q("SELECT configure_push_device('ExpoPushToken[admin]',true,false,true)");
  await actor(null, 'service_role');
  assert.equal((await q('SELECT * FROM event_push_recipients_internal($1)',[event])).rows.length, 0);
  await actor(null);
  await q("SELECT register_push_token('ExpoPushToken[student]')");
  await db.exec('RESET ROLE');
  assert.equal((await q("SELECT user_id FROM push_tokens WHERE token='ExpoPushToken[student]' ")).rows[0].user_id, null);
  assert.equal((await q("SELECT enabled FROM push_tokens WHERE token='ExpoPushToken[student]' ")).rows[0].enabled, false);
  assert.equal((await q('SELECT push_token FROM profiles WHERE id=$1',[admin])).rows[0].push_token, null);
  await assert.rejects(q("SELECT configure_push_device('invalid',true,false)"), /Invalid push token/);
  console.log('PASS: 044 idempotency, profile RLS, recipient permissions, opt-out, internal audience, guest unlink, token validation');
} finally { await db.close(); }
