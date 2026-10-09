const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}, globals = {}) {
  const context = { exports: {}, console, Promise, ArrayBuffer, Uint8Array, URL, Response,
    AbortController, setTimeout, clearTimeout,
    require: name => { assert.ok(name in modules, name); return modules[name]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}

function harness(reply) {
  const calls = [];
  const translation = load('lib/noticeTranslation.ts', {
    './network': { fetchWithDeadline: async url => {
      calls.push(url);
      return Response.json(typeof reply === 'function' ? await reply(url) : reply);
    } },
  });
  return { calls, ...translation };
}
const success = { responseStatus: 200, responseData: { translatedText: '公交改线' } };

test('all query parameters are encoded once, including iOS-sensitive language separator', async () => {
  const h = harness(success);
  const input = `🚎 mercoledì, giovedì: 50% & linea Q + 91
Bologna`;
  assert.equal(await h.translateItalianNotice(input), '公交改线');
  const url = new URL(h.calls[0]);
  assert.equal(url.searchParams.get('q'), input);
  assert.equal(url.searchParams.get('langpair'), 'it|zh-CN');
  assert.ok(!h.calls[0].includes('|'));
  assert.ok(!h.calls[0].includes('%2520'));
});

test('long sentences, accented characters and emoji stay below the UTF-8 query limit', async () => {
  for (const input of ['a'.repeat(1100), 'mercoledì giovedì 🚎 '.repeat(100), '🚎'.repeat(250)]) {
    const h = harness(success);
    await h.translateItalianNotice(input);
    assert.ok(h.calls.length > 1);
    const chunks = h.calls.map(url => new URL(url).searchParams.get('q'));
    for (const chunk of chunks) {
      assert.ok(Buffer.byteLength(chunk, 'utf8') <= 420);
      assert.ok(!chunk.includes('�'));
    }
    assert.equal(chunks.join('').replace(/\s/g, ''), input.replace(/\s/g, ''));
  }
});

test('HTTP 200 containing a provider error never becomes a successful translation', async () => {
  for (const reply of [
    { responseStatus: 403, responseData: { translatedText: 'QUERY LENGTH LIMIT EXCEEDED. MAX ALLOWED QUERY : 500 CHARS' } },
    { responseStatus: 429, responseData: { translatedText: 'Quota exceeded' } },
    { responseStatus: 200, responseData: { translatedText: 'QUERY LENGTH LIMIT EXCEEDED' } },
    { responseStatus: 200, responseData: { translatedText: ' ' } },
  ]) {
    await assert.rejects(harness(reply).translateItalianNotice('Bologna'));
  }
  const h = harness(() => { throw new Error('offline'); });
  await assert.rejects(h.translateItalianNotice('Bologna'));
});

test('translated chunks remain in source order and partial errors are rejected', async () => {
  let index = 0;
  const h = harness(async () => {
    const position = index++;
    await new Promise(resolve => setTimeout(resolve, position === 0 ? 10 : 0));
    return { responseStatus: 200, responseData: { translatedText: String(position) } };
  });
  assert.equal(await h.translateItalianNotice('a'.repeat(840)), '0 1');
  let count = 0;
  const failed = harness(() => count++ === 0 ? success : { responseStatus: 403, responseData: { translatedText: 'error' } });
  await assert.rejects(failed.translateItalianNotice('a'.repeat(840)));
});

test('React Native fetch polyfill preserves raw UTF-8 JSON and original binary bytes', async () => {
  // Exercise the installed mobile polyfill rather than Node's native Response,
  // whose correct ArrayBuffer decoding would hide the original regression.
  class FileReader {
    readAsText(blob) {
      blob.text().then(text => { this.result = text; this.onload(); }, error => { this.error = error; this.onerror(); });
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(bytes => { this.result = bytes; this.onload(); }, error => { this.error = error; this.onerror(); });
    }
  }
  const globals = { Blob, FileReader, Promise, ArrayBuffer, Uint8Array, URLSearchParams, setTimeout };
  globals.globalThis = globals;
  vm.createContext(globals);
  vm.runInContext(fs.readFileSync(require.resolve('whatwg-fetch/dist/fetch.umd.js'), 'utf8'), globals);
  const text = JSON.stringify({ responseData: { translatedText: '公交改线，罢工 🚎 mercoledì' } });
  const blob = new Blob([text], { type: 'application/json' });
  const network = load('lib/network.ts', {}, {
    Response: globals.Response, fetch: async () => new globals.Response(blob),
  });
  const response = await network.fetchWithDeadline('https://example.invalid');
  assert.equal((await response.json()).responseData.translatedText, JSON.parse(text).responseData.translatedText);
  const bytes = await (await network.fetchWithDeadline('https://example.invalid')).arrayBuffer();
  assert.deepEqual(Buffer.from(bytes), Buffer.from(text, 'utf8'));
});
