const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, globals = {}, modules = {}) {
  const context = { exports: {}, console, Response, TextDecoder, AbortController, setTimeout, clearTimeout,
    require: name => { assert.ok(name in modules, name); return modules[name]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const network = load('lib/network.ts');
const messages = load('lib/networkMessages.ts');

test('native evidence is classified without inventing a DNS failure', () => {
  for (const [error, reason] of [
    [new Error('Network request failed'), 'Connection'],
    [new Error('java.net.UnknownHostException'), 'Dns'],
    [new Error('SSLHandshakeException'), 'Secure'],
    [new Error('ETIMEDOUT'), 'Timeout'],
    [new SyntaxError('Unexpected token'), 'Data'],
    [new Error('unrecognized problem'), 'Unknown'],
    [{ status: 503 }, 'Server'], [{ status: 429 }, 'Busy'],
    [{ status: 401 }, 'Auth'], [{ status: 403 }, 'Forbidden'], [{ status: 404 }, 'Missing'],
    [{ code: '42501' }, 'Forbidden'],
    [{ cause: { code: 'ENOTFOUND' } }, 'Dns'],
  ]) assert.equal(network.networkErrorKey(error), 'requestError' + reason);
});

test('deadline is 20 seconds, aborts the request and survives Supabase error wrapping', async () => {
  let expire, delay, signal;
  const api = load('lib/network.ts', {
    fetch: (_, init) => { signal = init.signal; return new Promise(() => {}); },
    setTimeout: (fn, ms) => { expire = fn; delay = ms; return 1; }, clearTimeout() {},
  });
  const request = api.fetchWithDeadline('https://example.invalid');
  assert.equal(delay, 20000);
  expire();
  await assert.rejects(request, error => {
    assert.equal(error.kind, 'timeout');
    assert.equal(api.networkErrorKey({ message: 'NetworkError: ' + error.message, details: '', code: '' }), 'requestErrorTimeout');
    return true;
  });
  assert.equal(signal.aborted, true);
});

test('transport and response-read failures retain their original cause without displaying secrets', async () => {
  const original = new Error('secret-token-password');
  for (const body of [false, true]) {
    const api = load('lib/network.ts', { fetch: async () => {
      if (!body) throw original;
      return { arrayBuffer: async () => { throw original; } };
    } });
    await assert.rejects(api.fetchWithDeadline('https://example.invalid'), error => {
      assert.equal(error.cause, original);
      assert.equal(error.reason, body ? 'requestErrorData' : 'requestErrorConnection');
      for (const lang of ['zh', 'zh-Hant', 'en', 'it']) {
        assert.ok(!messages.networkErrorText(error.reason, lang).includes('secret'));
      }
      return true;
    });
  }
});

test('HTTP bodies stay available to Supabase, while tools classify the status before parsing', async () => {
  const api = load('lib/network.ts', { fetch: async () => new Response('<html>maintenance</html>', { status: 503 }) });
  const response = await api.fetchWithDeadline('https://example.invalid');
  assert.equal(response.status, 503);
  assert.throws(() => api.requireSuccessfulResponse(response), error => error.reason === 'requestErrorServer');
  assert.equal(await response.text(), '<html>maintenance</html>');
});

test('every reason has all four translations, and changing language translates an existing key', () => {
  const keys = Object.keys(messages.networkMessages.zh);
  for (const lang of ['zh', 'zh-Hant', 'en', 'it']) {
    assert.deepEqual(Object.keys(messages.networkMessages[lang]).sort(), [...keys].sort());
    for (const key of keys) assert.notEqual(messages.networkErrorText(key, lang), key);
  }
  const key = network.networkErrorKey({ status: 429 });
  assert.match(messages.networkErrorText(key, 'en'), /Too many requests/);
  assert.match(messages.networkErrorText(key, 'it'), /Troppe richieste/);
});

test('login keeps credential errors distinct and translates wrapped timeouts in all languages', () => {
  const auth = load('lib/supabase.ts', { process: { env: {} } }, {
    '@supabase/supabase-js': { createClient: () => ({}) }, 'expo-secure-store': {},
    './network': network, './networkMessages': messages,
  });
  assert.equal(auth.translateAuthError('Invalid login credentials', 'en'), 'Invalid email or password');
  const timeout = new network.NetworkError('timeout', 'Request timed out');
  for (const lang of ['zh', 'zh-Hant', 'en', 'it']) {
    assert.equal(auth.translateAuthError(timeout.message, lang), messages.networkErrorText('requestErrorTimeout', lang));
  }
});


test('exchange-rate screen shows the HTTP reason instead of claiming an empty result', async () => {
  const file = path.join(__dirname, '../app/tools/rate.tsx');
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'fetchRates') handler = node;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(handler);
  const errors = [], loading = [], notices = [];
  const context = { exports: {}, console: { log() {} },
    rateRequest: { current: 0 }, setLoading: value => loading.push(value),
    fetchWithDeadline: async () => new Response('<html>maintenance</html>', { status: 503 }),
    requireSuccessfulResponse: network.requireSuccessfulResponse, networkErrorKey: network.networkErrorKey,
    networkErrorText: messages.networkErrorText, language: 'it',
    setRates() {}, setLastUpdated: value => errors.push(value), setInputValues() {},
    showToast: value => notices.push(value),
  };
  vm.runInNewContext(ts.transpileModule('export const ' + handler.getText(ast), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  await context.exports.fetchRates(true);
  assert.equal(errors.at(-1), 'requestErrorServer');
  assert.equal(loading.at(-1), false);
  assert.equal(notices.at(-1), messages.networkErrorText('requestErrorServer', 'it'));
});
