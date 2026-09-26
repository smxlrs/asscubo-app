const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function load(fetch) {
  const source = readFileSync(path.join(__dirname, '../lib/appStoreUpdate.ts'), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, fetch, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(code, context);
  return context.exports.fetchAppStoreVersion;
}
const response = (results) => ({ ok: true, json: async () => ({ resultCount: results.length, results }) });

test('returns the Italian listing without querying another storefront', async () => {
  const urls = [];
  const lookup = load(async (url) => { urls.push(url); return response([{ version: '1.0.96' }]); });
  const result = await lookup('123', 'app.bundle', new AbortController().signal);
  assert.equal(result.version, '1.0.96');
  assert.deepEqual(urls, ['https://itunes.apple.com/lookup?id=123&country=it']);
});

test('falls back to US by bundle ID and handles an unpublished app', async () => {
  const urls = [];
  const lookup = load(async (url) => { urls.push(url); return response([]); });
  assert.equal(await lookup(undefined, 'app.bundle', new AbortController().signal), null);
  assert.deepEqual(urls, [
    'https://itunes.apple.com/lookup?bundleId=app.bundle&country=it',
    'https://itunes.apple.com/lookup?bundleId=app.bundle&country=us',
  ]);
});

for (const stalledBody of [false, true]) {
  test(`timeout releases a stalled ${stalledBody ? 'response body' : 'request'} even if fetch ignores abort`, async () => {
    let signal;
    const lookup = load((_url, options) => {
      signal = options.signal;
      const pending = new Promise(() => {});
      return stalledBody ? Promise.resolve({ ok: true, json: () => pending }) : pending;
    });
    await assert.rejects(lookup(undefined, 'app.bundle', new AbortController().signal, 20), /timed out/);
    assert.equal(signal.aborted, true);
  });
}

test('leaving the screen cancels the request immediately', async () => {
  let signal;
  const lookup = load((_url, options) => { signal = options.signal; return new Promise(() => {}); });
  const controller = new AbortController();
  const result = lookup(undefined, 'app.bundle', controller.signal);
  controller.abort();
  await assert.rejects(result, /cancelled/);
  assert.equal(signal.aborted, true);
});

test('an already cancelled check never starts a network request', async () => {
  const lookup = load(() => { throw new Error('Must not fetch'); });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookup(undefined, 'app.bundle', controller.signal), /cancelled/);
});

test('network failures reach the screen error handler', async () => {
  const lookup = load(async () => { throw new Error('offline'); });
  await assert.rejects(lookup(undefined, 'app.bundle', new AbortController().signal), /offline/);
});
