const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../student-app/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../../supabase/functions/_shared/wordpress-articles.ts'), 'utf8');
const original = 'https://mp.weixin.qq.com/s?__biz=abc%3D%3D&mid=10&idx=1&sn=hash';
function post(overrides = {}) { return { id: 10, status: 'publish', title: { rendered: 'Article &amp; title' }, excerpt: { rendered: '<p>Summary</p>' }, link: 'https://asscubo.it/article/', date_gmt: '2026-10-01T10:00:00', content: { protected: false }, boxue_source: { wechat_url: original, article_key: 'stable_0' }, _embedded: { 'wp:featuredmedia': [{ source_url: 'https://asscubo.it/cover.jpg' }] }, ...overrides }; }
function load(fetcher = async () => { throw new Error('unexpected fetch'); }) {
  const ctx = { exports: {}, URL, AbortSignal, Date, fetch: fetcher };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  return ctx.exports;
}
function api(posts, custom) { return async url => {
  const u = new URL(url); assert.equal(u.origin, 'https://asscubo.it');
  assert.ok(u.searchParams.get('_fields').includes('_links'));
  const page = Number(u.searchParams.get('page'));
  if (custom) return custom(page, u);
  return new Response(JSON.stringify(posts.slice((page-1)*100,page*100)), { headers: { 'x-wp-totalpages': String(Math.ceil(posts.length/100)), 'x-wp-total': String(posts.length) } });
}; }
function db(rows = [], options = {}) {
  const state = { rows: structuredClone(rows), writes: [], activations: 0 };
  const client = { ...state, async rpc(name, args) {
    assert.equal(name, 'activate_wordpress_articles'); state.activations++; client.activations++;
    const ids = new Set(args.p_post_ids); let archived=0, activated=0;
    for(const row of state.rows) { const publish=ids.has(row.wordpress_post_id); if(row.is_published&&!publish)archived++; if(!row.is_published&&publish)activated++; row.is_published=publish; }
    return {data:{archived,activated,visible:ids.size},error:null};
  }, from(table) {
    assert.ok(['articles', 'article_source_settings'].includes(table), `Unexpected table: ${table}`);
    let action = 'read', patch, offset = 0, end = 499; const predicates = [];
    const q = { select() { return q; }, order() { return q; }, range(a,b) {offset=a;end=b;return q;},
      eq(k,v) {predicates.push(r=>r[k]===v);return q;}, is(k,v){return q.eq(k,v);}, single(){return q;},
      update(p){action='update';patch=p;return q;},insert(p){action='insert';patch=p;return q;},
      then(resolve,reject) { try {
        if(table==='article_source_settings')return Promise.resolve({data:{wordpress_push_after:'2026-10-19T00:00:00Z'},error:null}).then(resolve,reject);
        let data;
        if(action==='update') {data=options.concurrent?[]:state.rows.filter(r=>predicates.every(p=>p(r)));state.writes.push({action,patch});data.forEach(r=>Object.assign(r,patch));}
        else if(action==='insert') {
          if(options.failInsert)return Promise.resolve({data:null,error:Error('insert failed')}).then(resolve,reject);
          assert.ok(Array.isArray(patch)); data=patch.map(p=>{assert.equal(p.is_published,false);const row={id:`new-${state.rows.length}`,...p};state.rows.push(row);return row;});state.writes.push({action,patch});
        } else data=state.rows.slice(offset,end+1).map(r=>({...r}));
        return Promise.resolve({data,error:null}).then(resolve,reject);
      }catch(e){return Promise.reject(e).then(resolve,reject);}}
    };return q;
  }};return client;
}
test('all public site posts qualify without WeChat metadata',()=>{
 const m=load();assert.equal(m.websiteArticles([post({boxue_source:null})]).length,1);
 for(const bad of [{status:'draft'},{content:{protected:true}},{link:'https://evil.test/a'},{date_gmt:'bad'}])assert.equal(m.websiteArticles([post(bad)]).length,0);
});
test('WordPress IDs distinguish same titles and same old WeChat links',()=>{
 const m=load(),posts=m.websiteArticles([post(),post({id:11,link:'https://asscubo.it/other/'})]);
 assert.equal(m.planWebsiteArticles([{id:'old',title:posts[0].title,link:original}],posts).inserts.length,2);
 assert.throws(()=>m.planWebsiteArticles([], [posts[0],posts[0]]),/duplicate/);
 assert.throws(()=>m.planWebsiteArticles([{wordpress_post_id:10},{wordpress_post_id:10}],posts),/Conflicting/);
 assert.equal(m.planWebsiteArticles([{id:'unrelated',original_link:null}],m.websiteArticles([post({boxue_source:null})])).inserts.length,1);
});
test('pagination fetches all 234 posts and fails on partial or inconsistent data',async()=>{
 const posts=Array.from({length:234},(_,i)=>post({id:i+1,boxue_source:null,link:`https://asscubo.it/post-${i}/`}));
 assert.equal((await load(api(posts)).fetchWebsiteArticles()).length,234);
 for(const mode of ['failure','inconsistent','missing','truncated']) {
  const client=db([{id:'legacy',is_published:true}]);
  const fetcher=api(posts,(page)=>{
   if(page===2&&mode==='failure')return new Response('error',{status:503});
   const headers={'x-wp-totalpages':'3','x-wp-total':page===2&&mode==='inconsistent'?'235':'234'};
   if(mode==='missing')delete headers['x-wp-total'];
   return new Response(JSON.stringify(mode==='truncated'?[]:posts.slice((page-1)*100,page*100)),{headers});
  });
  await assert.rejects(load(fetcher).syncWebsiteArticles(client));assert.equal(client.writes.length,0);assert.equal(client.activations,0);assert.equal(client.rows[0].is_published,true);
 }
});
test('site content mirrors website while category pins views IDs and notifications stay intact',async()=>{
 const m=load(api([post()]));const row={id:'old',wordpress_post_id:10,title:'Old title',summary:'Old summary',link:post().link,source:'wechat',source_id:'stable_0',original_link:original,category:'life',is_pinned:true,is_published:true,view_count:31,created_at:'2020-01-01',cover_image:null};
 const client=db([row,{id:'legacy',link:original,is_published:true},{id:'removed-site',wordpress_post_id:99,is_published:true}]);
 const r=await m.syncWebsiteArticles(client);assert.equal(r.updated,1);assert.equal(r.synced,0);assert.equal(r.archived,2);assert.equal(client.rows.length,3);
 const result=client.rows[0];for(const key of ['id','source','source_id','category','is_pinned','view_count','original_link'])assert.equal(result[key],row[key]);
 assert.equal(result.title,'Article & title');assert.equal(result.summary,'Summary');assert.equal(result.created_at,'2026-10-01T10:00:00.000Z');assert.equal(result.cover_image,'https://asscubo.it/cover.jpg');
 const again=await m.syncWebsiteArticles(client);assert.equal(again.updated,0);assert.equal(again.synced,0);assert.equal(again.archived,0);
});
test('preview is read only and insert/concurrent-edit failures never activate the visible set',async()=>{
 const m=load(api([post()]));const client=db([{id:'legacy',is_published:true}]);
 const preview=await m.syncWebsiteArticles(client,true);assert.equal(preview.would_insert,1);assert.equal(preview.would_archive,1);assert.equal(client.writes.length,0);assert.equal(client.activations,0);
 const failure=db(client.rows,{failInsert:true});await assert.rejects(m.syncWebsiteArticles(failure),/insert failed/);assert.equal(failure.activations,0);assert.equal(failure.rows[0].is_published,true);
 const concurrent=db([{id:'old',wordpress_post_id:10,link:post().link}],{concurrent:true});await assert.rejects(m.syncWebsiteArticles(concurrent),/changed during sync/);assert.equal(concurrent.activations,0);
});
test('full historical import batches are staged silently and repeated sync adds nothing',async()=>{
 const posts=Array.from({length:234},(_,i)=>post({id:i+1,boxue_source:null,link:`https://asscubo.it/post-${i}/`}));
 const m=load(api(posts)),client=db([{id:'legacy',is_published:true}]);const result=await m.syncWebsiteArticles(client);
 assert.equal(result.synced,234);assert.equal(result.pushEligible.length,0);assert.equal(result.visible,234);assert.equal(result.archived,1);assert.equal(client.rows.length,235);assert.equal(client.writes.filter(w=>w.action==='insert').length,3);
 assert.equal((await m.syncWebsiteArticles(client)).synced,0);
});
test('only new posts after the existing cutoff qualify for push',async()=>{
 const m=load(api([post(),post({id:11,link:'https://asscubo.it/fresh/',date_gmt:'2026-10-19T12:00:00'})]));const r=await m.syncWebsiteArticles(db());assert.equal(r.pushEligible.length,1);assert.equal(r.pushEligible[0].wordpress_post_id,11);
});
test('activation SQL is service-role-only and never deletes articles or changes notifications',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/047_wordpress_only_articles.sql'),'utf8');
 assert.match(sql,/REVOKE ALL[^;]+FROM PUBLIC, anon, authenticated/);assert.match(sql,/GRANT EXECUTE[^;]+TO service_role/);assert.doesNotMatch(sql,/DELETE FROM|public\.notifications/i);
});

test('existing sync endpoint keeps authentication, lock release and website preview without WeChat credentials', async () => {
  const index = fs.readFileSync(path.join(__dirname, '../../supabase/functions/wechat-sync/index.ts'), 'utf8');
  let handler, called = 0; const rpc = [];
  const client = {
    rpc: async name => { rpc.push(name); return { data: name === 'claim_wechat_sync_run' ? true : null, error: null }; },
    from: table => { assert.equal(table, 'wechat_sync_runs'); const q = { insert: () => q, select: () => q, update: () => q,
      eq: () => q, single: async () => ({ data: { id: 'run' }, error: null }),
      then: resolve => Promise.resolve({ error: null }).then(resolve) }; return q; },
  };
  const modules = {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: h => { handler = h; } },
    'https://esm.sh/@supabase/supabase-js@2.39.0': { createClient: () => client },
    '../_shared/push-recipients.ts': { getDeliveryTokens: () => { throw new Error('preview must not push'); } },
    '../_shared/supabase-keys.ts': { getSupabaseAdminKey: () => 'test-only', isInternalSupabaseRequest: req => req.headers.get('apikey') === 'test-only' },
    '../_shared/wordpress-articles.ts': { syncWebsiteArticles: async (_, preview) => { called++; assert.equal(preview, true); return { preview, source: 'wordpress', would_update: 6, pushEligible: [] }; } },
  };
  const ctx = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; },
    Deno: { env: { get: key => key === 'SUPABASE_URL' ? 'https://project.supabase.co' : undefined } },
    Response, Request, Headers, URL, AbortSignal, TextEncoder, console, Date };
  vm.runInNewContext(ts.transpileModule(index, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, ctx);
  const denied = await handler(new Request('https://project/sync', { method: 'POST', body: '{"preview":true}' }));
  assert.equal(denied.status, 401); assert.equal(called, 0);
  const allowed = await handler(new Request('https://project/sync', { method: 'POST', headers: { apikey: 'test-only' }, body: '{"preview":true}' }));
  assert.equal(allowed.status, 200); const body = await allowed.json();
  assert.equal(body.source, 'wordpress'); assert.equal(body.preview, true); assert.equal(body.would_update, 6);
  assert.deepEqual(rpc, ['claim_wechat_sync_run', 'finish_wechat_sync_run']);
});
