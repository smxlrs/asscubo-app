import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
    CREATE TABLE profiles(id uuid PRIMARY KEY, name text, avatar_url text, role text,
      is_banned boolean, created_at timestamptz DEFAULT now(), push_token text);
  `);
  const ids = {};
  for (const [name, role, banned] of [['owner', 'super_admin', false], ['reader', 'admin', false], ['student', 'student', false], ['banned', 'admin', true]]) {
    ids[name] = randomUUID();
    await db.query('INSERT INTO auth.users VALUES($1,$2)', [ids[name], `${name}@example.invalid`]);
    await db.query('INSERT INTO profiles(id,name,role,is_banned,push_token) VALUES($1,$2,$3,$4,$5)', [ids[name], name, role, banned, name === 'reader' ? 'secret-push-token' : null]);
  }
  const migration = readFileSync(new URL('../migrations/052_admin_registered_users_read.sql', import.meta.url), 'utf8');
  await db.exec(migration); await db.exec(migration);
  async function as(id, role = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('test.user',$1,false)", [id || '']);
    await db.exec(`SET ROLE ${role}`);
  }
  for (const name of ['owner', 'reader']) {
    await as(ids[name]);
    const { rows } = await db.query('SELECT * FROM admin_get_registered_users()');
    assert.equal(rows.length, 4);
    assert.equal(rows[0].role, 'super_admin');
    assert.equal(rows.find(row => row.id === ids.reader).has_push_token, true);
    assert.equal(rows.find(row => row.id === ids.student).has_push_token, false);
    assert(rows.every(row => row.created_at && !('push_token' in row) && !('permissions' in row)));
    await assert.rejects(db.query('SELECT * FROM profiles'));
    await assert.rejects(db.query("UPDATE profiles SET role='super_admin'"));
  }
  for (const name of ['student', 'banned', 'missing']) {
    await as(ids[name] || randomUUID());
    await assert.rejects(db.query('SELECT * FROM admin_get_registered_users()'), /Administrator access/);
  }
  await as(null);
  await assert.rejects(db.query('SELECT * FROM admin_get_registered_users()'), /Administrator access/);
  await as(null, 'anon');
  await assert.rejects(db.query('SELECT * FROM admin_get_registered_users()'), /permission denied/);
  console.log('Administrator read access, role denials, data minimization and idempotent installation passed.');
} finally { await db.close(); }
