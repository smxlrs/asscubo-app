import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
let checks = 0;
const q = (sql, args = []) => db.query(sql, args);
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const deny = async (sql, args = []) => { await assert.rejects(q(sql, args)); checks++; };
const as = async (id, role = 'authenticated') => {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('test.user',$1,false)", [id || '']);
  await db.exec(`SET ROLE ${role}`);
};
const migration = name => readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8');
const root = async () => db.exec('RESET ROLE');
const from = new Date(Date.now() - 7 * 86400000).toISOString(), to = new Date(Date.now() + 60000).toISOString();
const report = async () => (await q('SELECT admin_tool_usage_summary($1,$2) value', [from, to])).rows[0].value;
const record = async items => (await q('SELECT record_tool_usage($1::jsonb) value', [JSON.stringify(items)])).rows[0].value;
const snapshot = (tool = 'bus', duration = 10000) => ({ session_id: randomUUID(), tool,
  started_at: new Date(Date.now() - 60000).toISOString(), last_seen_at: new Date().toISOString(), duration_ms: duration });
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,created_at timestamptz DEFAULT now(),last_sign_in_at timestamptz);
    CREATE TABLE profiles(id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,name text,role text,is_banned boolean DEFAULT false);
    CREATE TABLE admin_permissions(admin_id uuid REFERENCES profiles ON DELETE CASCADE,permission text,granted_by uuid REFERENCES profiles,PRIMARY KEY(admin_id,permission));`);
  const original = migration('012_admin_permissions.sql');
  await db.exec(original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.has_admin_permission'), original.indexOf('CREATE OR REPLACE FUNCTION public.get_my_admin_permissions')));
  await db.exec(migration('016_add_cssa_card_admin_permission.sql'));
  await db.exec(migration('051_tool_usage_analytics.sql'));
  await db.exec(migration('051_tool_usage_analytics.sql'));
  checks++;
  const [superId, admin, viewer, other, unused] = Array.from({ length: 5 }, randomUUID);
  for (const [i, id] of [superId, admin, viewer, other, unused].entries()) {
    await q("INSERT INTO auth.users(id,email,last_sign_in_at) VALUES($1,$2,now()-interval '1 hour')", [id, `user${i}@test.invalid`]);
    await q('INSERT INTO profiles(id,name,role) VALUES($1,$2,$3)', [id, `User ${i}`, i === 0 ? 'super_admin' : i === 1 ? 'admin' : 'student']);
  }
  await as(viewer);
  eq((await q('SELECT tool_usage_collection_status() value')).rows[0].value, true);
  await as(superId); await q('SELECT super_admin_set_tool_usage_collection(false)');
  await root(); await db.exec(migration('051_tool_usage_analytics.sql'));
  await as(viewer);
  eq((await q('SELECT tool_usage_collection_status() value')).rows[0].value, false);
  await as(admin);
  eq((await q('SELECT get_my_admin_permissions() p')).rows[0].p, []);
  await deny('SELECT admin_tool_usage_summary($1,$2)', [from, to]);
  await deny('SELECT admin_tool_usage_users($1,$2)', [from, to]);
  await deny('SELECT super_admin_set_tool_usage_collection(true)');
  await deny('SELECT super_admin_set_admin_access($1,true,$2)', [viewer, ['analytics.users']]);
  await as(viewer); eq((await record([snapshot()])).enabled, false);
  await deny('SELECT * FROM tool_usage_sessions'); await deny('UPDATE tool_usage_settings SET enabled=true');
  await as(null, 'anon'); await deny('SELECT tool_usage_collection_status()'); await deny('SELECT record_tool_usage($1)', ['[]']);
  await as(superId);
  eq((await q('SELECT get_my_admin_permissions() p')).rows[0].p.includes('analytics.summary'), true);
  await q('SELECT super_admin_set_admin_access($1,true,$2)', [admin, ['analytics.summary']]);
  await q('SELECT super_admin_set_tool_usage_collection(true)');
  await as(viewer);
  const a = snapshot(); a.user_id = other;
  eq((await record([a])).accepted, [a.session_id]);
  await record([a]); await record([{ ...a, duration_ms: 5000 }]);
  await record([{ ...a, duration_ms: 20000 }]);
  eq((await record([{ ...a, tool: 'train' }])).accepted, []);
  await record([snapshot('train')]);
  await deny('SELECT record_tool_usage($1)', [JSON.stringify(Array.from({ length: 21 }, () => snapshot()))]);
  for (const bad of [{ tool: 'unknown' }, { duration_ms: -1 }, { duration_ms: 21600001 }, { session_id: 'bad' }, { started_at: null }, { duration_ms: 1000000 }]) {
    await deny('SELECT record_tool_usage($1)', [JSON.stringify([{ ...snapshot(), ...bad }])]);
  }
  await as(other); await record([snapshot()]);
  await as(admin);
  const total = await report(); eq(total.totals, { visits: 3, users: 2, duration_ms: 40000 });
  eq(total.tools.find(t => t.tool === 'bus').users, 2);
  eq(total.total_registered, 5); eq(total.new_registered, 5);
  eq(JSON.stringify(total).includes(viewer), false); eq(JSON.stringify(total).includes('@'), false);
  await deny('SELECT admin_tool_usage_user($1,$2,$3)', [viewer, from, to]);
  await deny('SELECT admin_tool_usage_summary($1,$2)', [new Date(Date.now() - 100 * 86400000), to]);
  await root(); eq((await q('SELECT user_id,duration_ms FROM tool_usage_sessions WHERE session_id=$1', [a.session_id])).rows[0], { user_id: viewer, duration_ms: 20000 });
  await as(superId); await q('SELECT super_admin_set_admin_access($1,true,$2)', [admin, ['analytics.users']]);
  await as(admin); await deny('SELECT admin_tool_usage_summary($1,$2)', [from, to]);
  let people = (await q('SELECT admin_tool_usage_users($1,$2) value', [from, to])).rows[0].value;
  eq(people.total, 5); eq(people.users.find(u => u.id === unused).visits, 0);
  eq(people.users.find(u => u.id === viewer).last_sign_in_at !== null, true);
  eq((await q('SELECT admin_tool_usage_users($1,$2,$3,0,1) value', [from, to, 'user2@'])).rows[0].value.users.length, 1);
  const detail = (await q('SELECT admin_tool_usage_user($1,$2,$3,0,1) value', [viewer, from, to])).rows[0].value;
  eq(detail.totals.visits, 2); eq(detail.sessions.length, 1); eq(detail.user.id, viewer); eq(detail.tools.length, 2);
  await root(); await q('UPDATE profiles SET is_banned=true WHERE id=$1', [admin]);
  await as(admin); await deny('SELECT admin_tool_usage_users($1,$2)', [from, to]);
  await root(); await q('UPDATE profiles SET is_banned=false WHERE id=$1', [admin]);
  await as(superId); await q('SELECT super_admin_set_admin_access($1,true,$2)', [admin, []]);
  await as(admin); await deny('SELECT admin_tool_usage_users($1,$2)', [from, to]);
  await root();
  await q("INSERT INTO tool_usage_sessions(user_id,session_id,tool,started_at,last_seen_at,duration_ms) VALUES($1,$2,'bus',now()-interval '91 days',now()-interval '91 days',0)", [viewer, randomUUID()]);
  await as(viewer); await deny('SELECT prune_tool_usage()');
  await as(null, 'service_role'); eq((await q('SELECT prune_tool_usage() n')).rows[0].n, 1);
  await root(); await q('DELETE FROM auth.users WHERE id=$1', [viewer]);
  eq((await q('SELECT count(*)::int n FROM tool_usage_sessions WHERE user_id=$1', [viewer])).rows[0].n, 0);
  // Daily quota suppresses only new visits; existing cumulative snapshots remain writable.
  await q(`INSERT INTO tool_usage_sessions(user_id,session_id,tool,started_at,last_seen_at,duration_ms)
    SELECT $1,gen_random_uuid(),'bus',now(),now(),0 FROM generate_series(1,999)`, [other]);
  await as(other); eq((await record([snapshot()])).accepted.length, 0);
  await as(superId); await q('SELECT super_admin_set_tool_usage_collection(false)');
  await as(other); eq((await record([snapshot()])).enabled, false);
  console.log(`Tool usage PostgreSQL: ${checks} checks passed`);
} finally { await db.close(); }
