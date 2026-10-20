const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(getSession, fetchWithDeadline) {
  const context = {
    exports: {},
    process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key' } },
    require(name) {
      if (name === './network') return { fetchWithDeadline };
      if (name === './supabase') return { supabase: { auth: { getSession } } };
      throw new Error(name);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../lib/websiteArticleSync.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
const session = async () => ({ data: { session: { access_token: 'admin-token' } }, error: null });

test('manual website sync has enough time for a 70-second scan and sends the administrator identity', async () => {
  const client = load(session, async (url, init, timeout) => {
    assert.equal(url, 'https://project.supabase.co/functions/v1/wechat-sync');
    assert.equal(timeout, 120000);
    assert.equal(init.headers.Authorization, 'Bearer admin-token');
    assert.equal(init.headers.apikey, 'public-key');
    assert.equal(init.headers['X-Sync-Trigger'], 'manual');
    assert.equal(init.method, 'POST');
    return new Response(JSON.stringify({ status: 'success', source: 'wordpress', synced: 5, updated: 225 }));
  });
  const result = await client.requestWebsiteArticleSync();
  assert.equal(result.synced, 5);
  assert.equal(result.updated, 225);
});

test('expired login does not submit an anonymous sync', async () => {
  const client = load(async () => ({ data: { session: null }, error: null }), () => assert.fail('unexpected sync'));
  await assert.rejects(client.requestWebsiteArticleSync(), /Unauthorized/);
});

test('server sync errors retain their response so the screen can display the actual cause', async () => {
  const response = new Response(JSON.stringify({ message: 'Website article pagination is incomplete' }), { status: 500 });
  const client = load(session, async () => response);
  await assert.rejects(client.requestWebsiteArticleSync(), error => error.context === response);
});
