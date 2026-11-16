// Real PostgreSQL semantics in PGlite. No server requests, email or push sends.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const db = new PGlite();
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const q = (sql, values = []) => db.query(sql, values);
let checks = 0;
const equal = (a, b) => { assert.deepEqual(a, b); checks++; };
const as = async (role, user = '', manager = false) => {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('test.user',$1,false),set_config('request.jwt.claim.role',$2,false),set_config('test.manager',$3,false)", [user, role, String(manager)]);
  await db.exec(`SET ROLE ${role}`);
};
const feed = async (kind = 'all', category = 'all', search = '', offset = 0, limit = 16) =>
  (await q('SELECT * FROM publication_feed($1,$2,$3,$4,$5)', [kind, category, search, offset, limit])).rows;
const activation = ids => q('SELECT activate_wordpress_articles($1::bigint[]) AS value', [ids]);
const remove = async nonce => (await q('SELECT delete_user_account($1::text) AS value', [nonce])).rows[0].value;

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE FUNCTION has_admin_permission(text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.manager',true)='true' $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz, reauthentication_token text, reauthentication_sent_at timestamptz);
    CREATE TABLE articles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,summary text,category text,cover_image text,
      created_at timestamptz NOT NULL DEFAULT now(),link text,is_pinned boolean DEFAULT false,is_published boolean DEFAULT true,wordpress_post_id bigint UNIQUE);
    CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text,content text,category text,cover_image text,
      created_at timestamptz NOT NULL DEFAULT now(),link text,is_pinned boolean DEFAULT false,target_type text DEFAULT 'all',target_value text,restricted boolean DEFAULT false);
    ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY articles_read ON articles FOR SELECT TO anon,authenticated USING(is_published OR has_admin_permission('articles.manage'));
    CREATE POLICY articles_update ON articles FOR UPDATE TO authenticated USING(has_admin_permission('articles.manage')) WITH CHECK(has_admin_permission('articles.manage'));
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    CREATE POLICY notifications_read ON notifications FOR SELECT TO anon,authenticated USING(
      (target_type <> 'user' OR target_value=auth.uid()::text) AND (NOT restricted OR has_admin_permission('events.manage')));
    GRANT SELECT ON articles,notifications TO anon,authenticated;
    GRANT UPDATE ON articles TO authenticated;
    GRANT ALL ON articles,notifications TO service_role;
  `);
  for (const file of ['049_publication_visibility_and_feed.sql', '050_verified_account_deletion.sql']) {
    const migration = readFileSync(resolve(root, 'supabase/migrations', file), 'utf8');
    await db.exec(migration); await db.exec(migration);
  }
  const viewer = randomUUID(), other = randomUUID();
  const articleIds = [];
  for (let n = 1; n <= 65; n++) {
    const article = (await q(`INSERT INTO articles(title,summary,category,created_at,link,wordpress_post_id,is_pinned)
      VALUES($1,$2,'event_news',now()-($3::int*interval '1 day'),$4,$3,$5) RETURNING id`,
      [`Article ${n}`, n === 60 ? 'search old 100%_(literal)' : '', n, `https://asscubo.it/${n}/`, n === 65])).rows[0];
    articleIds.push(article.id);
    await q("INSERT INTO notifications(title,content,category,created_at,is_pinned) VALUES($1,$2,'events',now()-($3::int*interval '1 day'),$4)",
      [`Notice ${n}`, n === 60 ? 'search old 100%_(literal)' : '', n, n === 65]);
  }
  await q("INSERT INTO notifications(title,target_type,target_value) VALUES('Private other','user',$1),('Private own','user',$2)", [other, viewer]);
  await q("INSERT INTO notifications(title,restricted) VALUES('Internal only',true)");
  await as('anon');
  let rows = await feed();
  equal(rows.slice(0,2).every(row => row.is_pinned && row.title.endsWith('65')), true);
  equal(rows.length,16);
  equal((await feed('all','events','100%_(literal)')).length,2);
  equal((await feed('articles','event_news','Article 64'))[0].title,'Article 64');
  equal((await feed('articles','news')).length,0);
  equal((await feed('all','all','Private')).length,0);
  equal((await feed('all','all','Internal')).length,0);
  const all = [];
  for (let offset=0;;offset+=15) { const page=await feed('all','all','',offset,15); all.push(...page); if(page.length<15)break; }
  equal(all.length,130); equal(new Set(all.map(row=>`${row.type}:${row.id}`)).size,130);
  await as('authenticated',viewer);
  equal((await feed('all','all','Private')).map(row=>row.title),['Private own']);
  await assert.rejects(activation([1]), /permission denied/); checks++;
  await as('authenticated',viewer,true);
  // Legacy client soft delete must also survive future syncs.
  await q('UPDATE articles SET is_published=false WHERE id=$1',[articleIds[0]]);
  equal((await q('SELECT admin_hidden FROM articles WHERE id=$1',[articleIds[0]])).rows[0].admin_hidden,true);
  await as('service_role'); await activation(Array.from({length:65},(_,n)=>n+1));
  equal((await q('SELECT is_published FROM articles WHERE id=$1',[articleIds[0]])).rows[0].is_published,false);
  await assert.rejects(q('DELETE FROM articles WHERE id=$1',[articleIds[0]]), /identities must be retained/); checks++;
  equal((await q('SELECT count(*)::int n FROM articles WHERE id=$1',[articleIds[0]])).rows[0].n,1);
  await as('authenticated',viewer,true);
  equal((await feed('articles','all','Article 1')).some(row=>row.id===articleIds[0]),false);
  await q('UPDATE articles SET is_published=true,admin_hidden=false WHERE id=$1',[articleIds[0]]);
  equal((await feed('articles','all','Article 1')).some(row=>row.id===articleIds[0]),true);
  await as('service_role'); await activation([1]);
  equal((await q('SELECT admin_hidden,is_published FROM articles WHERE id=$1',[articleIds[1]])).rows[0],{admin_hidden:false,is_published:false});
  await activation([1,2]);
  equal((await q('SELECT is_published FROM articles WHERE id=$1',[articleIds[1]])).rows[0].is_published,true);

  await db.exec('RESET ROLE');
  equal((await q("SELECT has_function_privilege('anon','public.delete_user_account(text)','EXECUTE') AS allowed")).rows[0].allowed,false);
  equal((await q("SELECT has_function_privilege('authenticated','public.delete_user_account()','EXECUTE') AS allowed")).rows[0].allowed,false);
  equal((await q("SELECT has_table_privilege('authenticated','public.account_deletion_attempts','SELECT') AS allowed")).rows[0].allowed,false);
  const makeUser = async (options = {}) => {
    await db.exec('RESET ROLE');
    const id=randomUUID(),email=`${id}@example.org`,nonce=options.nonce || '123456';
    const hash=createHash('sha224').update(email+nonce).digest('hex');
    await q(`INSERT INTO auth.users VALUES($1,$2,${options.unconfirmed?'NULL':'now()'},$3,now()-($4::int*interval '1 minute'))`,[id,email,options.missing?'':hash,options.age??0]);
    return {id,nonce};
  };
  let user=await makeUser(); await as('authenticated',user.id);
  equal(await remove(null),false); equal(await remove('000000'),false);
  equal(await remove(user.nonce),true); equal(await remove(user.nonce),false);
  await db.exec('RESET ROLE');
  equal((await q('SELECT count(*)::int n FROM account_deletion_attempts WHERE user_id=$1',[user.id])).rows[0].n,0);
  for(const options of [{age:11},{age:-1},{unconfirmed:true},{missing:true}]) {
    user=await makeUser(options); await as('authenticated',user.id); equal(await remove(user.nonce),false);
  }
  user=await makeUser(); await as('authenticated',user.id);
  for(let n=0;n<5;n++)equal(await remove('000000'),false);
  equal(await remove(user.nonce),false);
  await db.exec('RESET ROLE');
  equal((await q('SELECT failures FROM account_deletion_attempts WHERE user_id=$1',[user.id])).rows[0].failures,5);
  // Resending/changing the challenge does not reset the account's guess budget.
  await q("UPDATE auth.users SET reauthentication_sent_at=now() WHERE id=$1",[user.id]);
  await as('authenticated',user.id); equal(await remove(user.nonce),false);
  await db.exec('RESET ROLE');
  await q("UPDATE account_deletion_attempts SET window_started_at=now()-interval '16 minutes' WHERE user_id=$1",[user.id]);
  await as('authenticated',user.id); equal(await remove(user.nonce),true);
  const victim=await makeUser({nonce:'654321'}),attacker=await makeUser();
  await as('authenticated',attacker.id); equal(await remove(victim.nonce),false);
  equal(await remove(attacker.nonce),true);
  await db.exec('RESET ROLE');
  equal((await q('SELECT count(*)::int n FROM auth.users WHERE id=$1',[victim.id])).rows[0].n,1);
  console.log(`Publication visibility, feed RLS and verified deletion: ${checks} checks passed (local only).`);
} finally { await db.close(); }
