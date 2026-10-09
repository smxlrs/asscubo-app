const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function load(source, modules = {}, globals = {}) {
  const context = { exports: {}, console: { warn() {}, log() {} },
    require: name => { assert.ok(name in modules, name); return modules[name]; },
    ...globals };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
function ast(file) { return ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function handler(file, name, globals) {
  const tree = ast(file); let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found);
  return load('export const ' + found.getText(tree), {}, globals)[name];
}
const search = load(read('lib/stationSearch.ts'));
test('Rimini Chinese name never matches the one-letter Milan alias', () => {
  for (const input of ['里米尼', ' 里米尼 ', '里米尼火车站']) assert.equal(search.stationSearchKey(input), 'rimini');
  for (const input of ['米', '米兰', '米兰中央车站']) assert.equal(search.stationSearchKey(input), 'milano');
  assert.equal(search.stationSearchKey('大米'), '大米');
  assert.equal(search.stationSearchKey(' ROMA '), 'roma');
  assert.equal(search.stationSearchKey(''), '');
  assert.equal(search.stationSearchKey('constructor'), 'constructor');
});
const stations = [{ n: 'MILANO CENTRALE', id: 'm', p: 2 }, { n: 'RIMINI', id: 'r', p: 2 }];
test('actual homepage autocomplete and service station search use the same Chinese matching', async () => {
  const local = handler('app/tools/train/index.tsx', 'getStationMatchesForInput', { stations, ...search });
  assert.equal(local('里米尼')[0].id, 'r');
  assert.equal(local('米')[0].id, 'm');
  const service = load(read('lib/viaggiaTrenoService.ts'), {
    './stationSearch': search, './network': {}, './romeTime': {}, './eventTime': {},
    '../assets/stations': { stations },
  }, { process });
  assert.equal((await service.searchStations('里米尼'))[0].id, 'r');
});
test('station API fallback receives translated Italian name', async () => {
  let url;
  const service = load(read('lib/viaggiaTrenoService.ts'), {
    './stationSearch': search,
    './network': { fetchWithDeadline: async value => {
      url = value; return { ok: true, text: async () => 'RIMINI|S00001' };
    } },
    './romeTime': {}, './eventTime': {}, '../assets/stations': { stations: [] },
  }, { process });
  assert.equal((await service.searchStations('里米尼'))[0].name, 'RIMINI');
  assert.ok(url.endsWith('/autocompletaStazione/rimini'));
});
function cacheHarness(fail = {}) {
  const root = 'file:///cache/';
  const files = new Map([
    [root, { exists: true, isDirectory: true, size: 99999 }],
    [root + 'root.jpg', { exists: true, isDirectory: false, size: 10 }],
    [root + 'images', { exists: true, isDirectory: true, size: 99999 }],
    [root + 'images/a.jpg', { exists: true, isDirectory: false, size: 20 }],
    [root + 'images/nested', { exists: true, isDirectory: true, size: 99999 }],
    [root + 'images/nested/b.jpg', { exists: true, isDirectory: false, size: 30 }],
    ['file:///documents/dictionary.mdx', { exists: true, isDirectory: false, size: 1000 }],
  ]);
  const deleted = [];
  const fileSystem = {
    cacheDirectory: root, documentDirectory: 'file:///documents/',
    async getInfoAsync(uri) { return files.get(uri) || { exists: false }; },
    async readDirectoryAsync(uri) {
      if (fail.read === uri) throw new Error('read denied');
      const base = uri.endsWith('/') ? uri : uri + '/';
      const result = [...files.keys()].filter(p => p.startsWith(base) && p !== base)
        .map(p => p.slice(base.length)).filter(p => !p.includes('/'));
      if (uri === root) result.push('expired.jpg');
      return result;
    },
    async deleteAsync(uri) {
      deleted.push(uri);
      if (fail.delete === uri) throw new Error('delete denied');
      for (const file of files.keys()) if (file === uri || file.startsWith(uri + '/')) files.delete(file);
    },
  };
  return { files, deleted, fileSystem,
    api: load(read('lib/cacheStorage.ts'), { 'expo-file-system/legacy': fileSystem }) };
}
test('cache size recursively counts only file bytes without directory-size double counting', async () => {
  const h = cacheHarness(); assert.equal(await h.api.getCacheSize(), 60);
});
test('cache cleanup removes nested caches but preserves downloaded dictionaries', async () => {
  const h = cacheHarness(); await h.api.clearCacheDir();
  assert.equal(await h.api.getCacheSize(), 0);
  assert.ok(h.files.has('file:///documents/dictionary.mdx'));
  assert.ok(h.files.has('file:///cache/'));
  assert.ok(h.deleted.every(uri => uri.startsWith('file:///cache/')));
});
test('cache failures propagate and cleanup still attempts the remaining files', async () => {
  const unreadable = cacheHarness({ read: 'file:///cache/images' });
  await assert.rejects(unreadable.api.getCacheSize(), /read denied/);
  const partial = cacheHarness({ delete: 'file:///cache/root.jpg' });
  await assert.rejects(partial.api.clearCacheDir(), /could not be removed/);
  assert.ok(partial.deleted.includes('file:///cache/images'));
  assert.equal(await partial.api.getCacheSize(), 10);
  partial.fileSystem.cacheDirectory = null;
  await assert.rejects(partial.api.getCacheSize(), /unavailable/);
  await assert.rejects(partial.api.clearCacheDir(), /unavailable/);
});
test('actual settings cleanup displays failure instead of success and refreshes remaining size', async () => {
  const alerts = [], sizes = []; let confirm;
  const run = handler('app/settings/index.tsx', 'handleClearCache', {
    clearingRef: { current: false }, cacheRequest: { current: 0 },
    setClearingCache() {}, setCacheSize: value => sizes.push(value),
    clearCacheDir: async () => { throw new Error('partial'); },
    getCacheSize: async () => 123,
    formatBytes: value => String(value),
    t: key => key, localized: { cacheFailed: 'failure', cacheUnavailable: 'unavailable' },
    Alert: { alert(...args) { alerts.push(args);
      if (args[2]) confirm = args[2].find(button => button.onPress)?.onPress;
    } },
  });
  run(); await confirm();
  assert.equal(alerts.at(-1)[1], 'failure');
  assert.equal(sizes.at(-1), '123');
});
test('settings recalculates on each focus and rejects an old measurement', async () => {
  const tree = ast('app/settings/index.tsx'); let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useFocusEffect') {
      callback = node.arguments[0].arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(callback);
  let firstResolve, call = 0;
  const old = new Promise(resolve => { firstResolve = resolve; });
  const sizes = [];
  const effect = load('export const focus = ' + callback.getText(tree), {}, {
    cacheRequest: { current: 0 }, setCacheSize: x => sizes.push(x),
    getCacheSize: () => ++call === 1 ? old : Promise.resolve(25),
    formatBytes: value => String(value), localized: { cacheUnavailable: 'unavailable' },
  }).focus;
  const cleanup = effect(); cleanup(); effect();
  await new Promise(setImmediate);
  firstResolve(99); await new Promise(setImmediate);
  assert.equal(call, 2); assert.equal(sizes.at(-1), '25');
});
