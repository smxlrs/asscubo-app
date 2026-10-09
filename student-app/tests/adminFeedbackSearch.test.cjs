const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(source, globals = {}) {
  const context = { exports: {}, console: { warn() {}, error() {}, log() {} }, ...globals };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function handler(file, name, globals) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, name);
  return load('export const ' + found.getText(ast), globals)[name];
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const media = load(source('lib/feedbackMedia.ts'));
test('feedback supports multiple image and video attachments and legacy URL', () => {
  const parsed = media.getFeedbackMedia(JSON.stringify([
    { url: 'https://example.invalid/a.jpg', type: 'image' },
    { url: 'https://example.invalid/b.mov?token=x' },
    { url: 'https://example.invalid/video', type: 'video' },
  ]));
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].type, 'image');
  assert.equal(parsed[1].type, 'video');
  assert.equal(parsed[2].type, 'video');
  assert.equal(media.getFeedbackMedia('https://example.invalid/a.jpg')[0].url, 'https://example.invalid/a.jpg');
});
test('feedback ignores malformed and empty attachments', () => {
  for (const value of [null, '', '[]', '[broken', '{"bad":"value"}', '[null,{"url":5},{"url":""},{"url":"javascript:bad"}]']) {
    assert.equal(media.getFeedbackMedia(value).length, 0);
  }
});
function cleaner(rows, options = {}) {
  const alerts = [], deleted = [], flags = [];
  let confirm;
  const db = {
    from(table) {
      assert.equal(table, 'articles');
      return {
        select() { return this; }, order() { return this; },
        async limit(n) { return { data: rows.slice(0, n), error: options.readError || null }; },
        delete() { return this; },
        eq(field, value) { assert.equal(field, 'is_published'); assert.equal(value, false); return this; },
        async not(field, op, ids) {
          assert.equal(field, 'id'); assert.equal(op, 'in');
          const keep = ids.slice(1, -1).split(',');
          if (options.deleteError) return { error: options.deleteError };
          deleted.push(...rows.filter(row => !row.is_published && !keep.includes(row.id)));
          return { error: null, count: deleted.length };
        },
      };
    },
  };
  const run = handler('app/admin/index.tsx', 'handleClearOldArticles', {
    setClearing: value => flags.push(value),
    supabase: db,
    Alert: { alert: (...args) => {
      alerts.push(args);
      if (Array.isArray(args[2])) confirm = args[2].find(button => button.onPress)?.onPress;
    } },
  });
  return { async run() { run(); await confirm(); }, deleted, alerts, flags };
}
const rows = Array.from({ length: 16 }, (_, i) => ({ id: String(i), is_published: i === 12 }));
test('real cleanup removes only old unpublished rows, preserving latest ten and published rows', async () => {
  const c = cleaner(rows); await c.run();
  assert.deepEqual(c.deleted.map(row => row.id), ['10', '11', '13', '14', '15']);
  assert.deepEqual(c.flags, [true, false]);
});
test('cleanup skips ten or fewer rows and surfaces database errors', async () => {
  for (const data of [[], rows.slice(0, 10)]) {
    const c = cleaner(data); await c.run(); assert.equal(c.deleted.length, 0);
    assert.equal(c.alerts.at(-1)[0], '提示');
  }
  for (const options of [{ readError: { message: 'denied' } }, { deleteError: { message: 'denied' } }]) {
    const c = cleaner(rows, options); await c.run(); assert.equal(c.deleted.length, 0);
    assert.equal(c.alerts.at(-1)[0], '清理失败');
    assert.equal(c.flags.at(-1), false);
  }
});
function suggestionEffect(file, marker, globals) {
  const text = source(file).slice(source(file).indexOf(marker));
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (!callback && ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') callback = node.arguments[0];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let timer;
  const fn = load('export const effect = ' + callback.getText(ast), {
    setTimeout: f => { timer = f; return 1; }, clearTimeout() {}, ...globals,
  }).effect;
  return { start: fn, fire: () => timer() };
}
for (const kind of ['bus', 'dictionary']) {
  test(kind + ' suggestions ignore stale success/finally after input change and clearing', async () => {
    const old = deferred(), newer = deferred();
    const values = [], loading = [];
    let call = 0;
    const globals = {
      stopNameInput: 'old', searchQuery: 'old', enabledDictIds: ['dict'],
      searchStopsByName: () => (++call === 1 ? old.promise : newer.promise),
      searchWords: () => (++call === 1 ? old.promise : newer.promise),
      setSuggestions: value => values.push(value),
      setSearchingStops: value => loading.push(value),
      setLoadingSuggestions: value => loading.push(value),
    };
    const file = 'app/tools/' + kind + '/index.tsx';
    const marker = kind === 'bus' ? '// Fuzzy stop name' : '// Handle prefix input';
    const effect = suggestionEffect(file, marker, globals);
    const cleanup = effect.start();
    const a = effect.fire(); cleanup();
    const cleanupNew = effect.start(); const b = effect.fire();
    old.resolve(['old']); await a;
    assert.equal(values.length, 0);
    assert.equal(loading.at(-1), true);
    newer.resolve(['new']); await b;
    assert.deepEqual(values.at(-1), ['new']);
    assert.equal(loading.at(-1), false);
    cleanupNew();
    const cleared = suggestionEffect(file, marker, { ...globals, stopNameInput: '', searchQuery: '' });
    cleared.start();
    assert.equal(values.at(-1).length, 0);
    assert.equal(loading.at(-1), false);
  });
}
test('dictionary same-word searches cannot overwrite each other', async () => {
  const old = deferred(), newer = deferred();
  let calls = 0; const definitions = [];
  const run = handler('app/tools/dictionary/index.tsx', 'handleSearch', {
    Keyboard: { dismiss() {} }, textInputRef: { current: null },
    setIsFocused() {}, setSearchQuery() {}, setActiveWord() {},
    currentSearchRef: { current: 0 }, setDefinitions: x => definitions.push(x),
    initialDefinitionsRef: { current: [] }, setWebViewHtml() {}, setSearching() {},
    setBackgroundSearching() {}, saveToHistory: async () => {},
    enabledDictIds: ['dict'], isMDXInstanceLoaded: () => true, hasBundledDictionaryIndex: () => true,
    getSingleDefinition: () => (++calls === 1 ? old.promise : newer.promise),
    buildHtmlString: () => '', dictionaries: [], collapsedDictsRef: { current: {} },
    colors: {}, isDark: false, ls: {},
  });
  const a = run('same'); await new Promise(setImmediate);
  const b = run('same'); await new Promise(setImmediate);
  newer.resolve({ dict_id: 'dict', definition: 'new' }); await b;
  old.resolve({ dict_id: 'dict', definition: 'old' }); await a;
  assert.equal(definitions.at(-1)[0].definition, 'new');
});
test('train search ignores an obsolete single-result navigation and error/loading changes', async () => {
  const old = deferred(), newer = deferred(); let calls = 0;
  const nav = [], loading = [], errors = [];
  const run = handler('app/tools/train/index.tsx', 'handleTrainSearch', {
    trainNo: '123', trainRequest: { current: 0 }, Keyboard: { dismiss() {} },
    setLoadingTrain: x => loading.push(x), setTrainError: x => errors.push(x), setTrainMatches() {},
    searchTrain: () => (++calls === 1 ? old.promise : newer.promise),
    getTrainStatus: async () => null, saveTrainToHistory() {}, router: { push: x => nav.push(x) },
    t: x => x, NetworkError: Error,
  });
  const a = run(), b = run();
  old.resolve([{ number: '123', departureStationID: 'old', timestamp: '1' }]); await a;
  assert.equal(nav.length, 0); assert.equal(loading.at(-1), true);
  newer.resolve([{ number: '123', departureStationID: 'new', timestamp: '2' }]); await b;
  assert.equal(nav[0].params.departureStationID, 'new'); assert.equal(loading.at(-1), false);
});
test('map late viewport response cannot replace current viewport or zoom-out empty results', async () => {
  const old = deferred(), newer = deferred(); let calls = 0; const scripts = [];
  const run = handler('app/tools/bus/index.tsx', 'handleMapMessage', {
    mapRequest: { current: 0 }, setMapCenter() {},
    fetchStopsInBoundingBox: () => (++calls === 1 ? old.promise : newer.promise),
    webViewRef: { current: { injectJavaScript: s => scripts.push(s) } },
  });
  const event = zoom => ({ nativeEvent: { data: JSON.stringify({ type: 'MAP_MOVED', lat: 1, lon: 1, zoom }) } });
  const a = run(event(15)), b = run(event(15));
  newer.resolve([{ code: 'new' }]); await b;
  old.resolve([{ code: 'old' }]); await a;
  assert.equal(scripts.length, 1); assert.match(scripts[0], /new/);
  await run(event(10)); assert.match(scripts.at(-1), /\[\]/);
});



test('train input clearing invalidates a request during status enrichment', async () => {
  const status = deferred(), ref = { current: 0 }, nav = [], errors = [];
  const globals = {
    trainNo: '123', trainRequest: ref, Keyboard: { dismiss() {} },
    setTrainNo() {}, setLoadingTrain() {}, setTrainError: x => errors.push(x), setTrainMatches() {},
    searchTrain: async () => [{ number: '123', departureStationID: 'station', timestamp: '1' }],
    getTrainStatus: () => status.promise, saveTrainToHistory() {},
    router: { push: x => nav.push(x) }, t: x => x, NetworkError: Error,
  };
  const run = handler('app/tools/train/index.tsx', 'handleTrainSearch', globals);
  const clear = handler('app/tools/train/index.tsx', 'changeTrainNo', globals);
  const pending = run(); await new Promise(setImmediate);
  clear(''); status.resolve(null); await pending;
  assert.equal(nav.length, 0); assert.equal(errors.at(-1), '');
});
test('train stale failures cannot clear a newer search spinner or set its error', async () => {
  const old = deferred(), newer = deferred(); let calls = 0;
  const loading = [], errors = [];
  const run = handler('app/tools/train/index.tsx', 'handleTrainSearch', {
    trainNo: '123', trainRequest: { current: 0 }, Keyboard: { dismiss() {} },
    setLoadingTrain: x => loading.push(x), setTrainError: x => errors.push(x), setTrainMatches() {},
    searchTrain: () => (++calls === 1 ? old.promise : newer.promise),
    t: x => x, NetworkError: Error,
  });
  const a = run(), b = run(); old.reject(new Error('old error')); await a;
  assert.equal(loading.at(-1), true); assert.equal(errors.at(-1), '');
  newer.resolve([]); await b;
  assert.equal(errors.at(-1), 'noTrainsFound'); assert.equal(loading.at(-1), false);
});
test('nearby location operations preserve the newer stop list when old lookup returns last', async () => {
  const old = deferred(), newer = deferred(); let calls = 0;
  const values = [], loading = [], ref = { current: 0 };
  const globals = {
    nearbyRequest: ref, setNearbyLoading: x => loading.push(x),
    setNearbyStops: x => values.push(x), setLocationPermission() {},
    Location: {
      getForegroundPermissionsAsync: async () => ({ status: 'granted' }),
      getCurrentPositionAsync: async () => ({ coords: { latitude: 44, longitude: 11 } }),
      Accuracy: { Balanced: 1 },
    },
    fetchStopsInBoundingBox: () => (++calls === 1 ? old.promise : newer.promise),
  };
  globals.loadNearbyStops = handler('app/tools/bus/index.tsx', 'loadNearbyStops', globals);
  const run = handler('app/tools/bus/index.tsx', 'refreshNearbyStops', globals);
  const a = run(); await new Promise(setImmediate);
  const b = run(); await new Promise(setImmediate);
  newer.resolve([{ code: 'new', latitude: 44, longitude: 11 }]); await b;
  old.resolve([{ code: 'old', latitude: 44, longitude: 11 }]); await a;
  assert.equal(values.length, 1); assert.equal(values[0][0].code, 'new');
  assert.equal(loading.at(-1), false);
});
test('handbook retry ignores the canceled request including its fallback and finally', async () => {
  const old = deferred(), newer = deferred(); let calls = 0;
  const chapters = [], current = [], loading = [];
  const globals = {
    supabase: { from() { return {
      select() { return this; }, eq() { return this; },
      order() { return ++calls === 1 ? old.promise : newer.promise; },
    }; } },
    sessionLastChapterId: null,
    setChapters: x => chapters.push(x), setCurrentChapter: x => current.push(x),
    setLoading: x => loading.push(x),
  };
  const effect = suggestionEffect('app/tools/handbook/index.tsx', '// 1. Fetch handbook chapters', globals);
  const cleanup = effect.start(); cleanup(); effect.start();
  old.reject(new Error('obsolete')); await new Promise(setImmediate);
  assert.equal(chapters.length, 0); assert.equal(loading.length, 0);
  newer.resolve({ data: [{ id: 'new', parent_id: null }], error: null });
  await new Promise(setImmediate);
  assert.equal(chapters.at(-1)[0].id, 'new');
  assert.equal(current.at(-1).id, 'new'); assert.equal(loading.at(-1), false);
});
