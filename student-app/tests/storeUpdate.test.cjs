const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function load(text, modules = {}, globals = {}) {
  const context = { exports: {}, AbortController, setTimeout, clearTimeout,
    require: name => { assert.ok(name in modules, name); return modules[name]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(text, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  return context.exports;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function harness(os = 'android', globals = {}) {
  let status = 'available', listing = { version: '1.0.98', trackId: 123 }, fail = false, calls = 0;
  const platform = { OS: os };
  const native = { PlayStoreUpdate: { checkForUpdate: async () => { calls++; if (fail) throw new Error('offline'); return status; } } };
  const lookup = { fetchAppStoreVersion: async (...args) => { calls++; lookup.args = args; if (fail) throw new Error('offline'); return listing; } };
  const modules = {
    'react-native': { NativeModules: native, Platform: platform },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.97', ios: { bundleIdentifier: 'app.test' } } } },
    './appStoreUpdate': lookup, './logger': { recordDebugEvent() {} },
  };
  const api = load(source('lib/storeUpdate.ts'), modules, globals);
  return { api, native, lookup, platform, calls: () => calls,
    setStatus: value => { status = value; }, setListing: value => { listing = value; }, setFail: value => { fail = value; } };
}
test('automatic cold-start check runs once per process, including repeated layout mounting', async () => {
  const h = harness();
  const first = h.api.checkStoreUpdateOnColdStart();
  const second = h.api.checkStoreUpdateOnColdStart();
  assert.equal(first, second);
  await first; await h.api.checkStoreUpdateOnColdStart();
  assert.equal(h.calls(), 1);
  assert.equal(h.api.getStoreUpdateAvailable(), true);
  const nextProcess = harness();
  await nextProcess.api.checkStoreUpdateOnColdStart();
  assert.equal(nextProcess.calls(), 1);
});
test('iOS compares numeric store versions and uses the configured bundle identifier', async () => {
  const h = harness('ios');
  assert.equal((await h.api.checkStoreUpdate()).status, 'available');
  assert.equal(h.lookup.args[1], 'app.test');
  assert.equal(h.api.getStoreUpdateAvailable(), true);
  for (const version of ['1.0.97', '1.0.96']) {
    h.setListing({ version }); assert.equal((await h.api.checkStoreUpdate()).status, 'up_to_date');
    assert.equal(h.api.getStoreUpdateAvailable(), false);
  }
  assert.ok(h.api.compareVersions('1.0.100', '1.0.99') > 0);
  assert.equal(h.api.compareVersions('1.0', '1.0.0'), 0);
});
test('failed, unpublished or unavailable store checks do not create a dot or erase a confirmed update', async () => {
  for (const os of ['android', 'ios']) {
    const h = harness(os);
    h.setFail(true); assert.equal((await h.api.checkStoreUpdate()).status, 'unavailable');
    assert.equal(h.api.getStoreUpdateAvailable(), false);
    h.setFail(false); await h.api.checkStoreUpdate(); assert.equal(h.api.getStoreUpdateAvailable(), true);
    h.setFail(true); await h.api.checkStoreUpdate(); assert.equal(h.api.getStoreUpdateAvailable(), true);
    h.setFail(false); h.setStatus('unavailable'); h.setListing(null);
    await h.api.checkStoreUpdate(); assert.equal(h.api.getStoreUpdateAvailable(), true);
  }
});
test('Android without Play Store module and web cannot claim an update', async () => {
  const android = harness(); android.native.PlayStoreUpdate = undefined;
  assert.equal((await android.api.checkStoreUpdate()).status, 'unavailable');
  const web = harness('web'); assert.equal((await web.api.checkStoreUpdate()).status, 'unavailable');
  assert.equal(web.calls(), 0);
});
test('older automatic check cannot overwrite a newer manual confirmation', async () => {
  const h = harness(), old = deferred(), newer = deferred(); let calls = 0;
  h.native.PlayStoreUpdate.checkForUpdate = () => ++calls === 1 ? old.promise : newer.promise;
  const a = h.api.checkStoreUpdateOnColdStart(), b = h.api.checkStoreUpdate();
  newer.resolve('up_to_date'); await b;
  old.resolve('available'); await a;
  assert.equal(h.api.getStoreUpdateAvailable(), false);
});
test('aborting a manual check never changes a dot established by another confirmation', async () => {
  const h = harness(); await h.api.checkStoreUpdate();
  const pending = deferred();
  h.native.PlayStoreUpdate.checkForUpdate = () => pending.promise;
  const controller = new AbortController();
  const request = h.api.checkStoreUpdate(controller.signal);
  controller.abort();
  assert.equal((await request).status, 'unavailable');
  pending.resolve('up_to_date'); await new Promise(setImmediate);
  assert.equal(h.api.getStoreUpdateAvailable(), true);
});
test('a stalled native check times out and its eventual result cannot create a dot', async () => {
  let timeout, delay, cleared = 0;
  const h = harness('android', {
    setTimeout: (fn, ms) => { timeout = fn; delay = ms; return 1; },
    clearTimeout: () => { cleared++; },
  });
  const pending = deferred(); h.native.PlayStoreUpdate.checkForUpdate = () => pending.promise;
  const request = h.api.checkStoreUpdateOnColdStart();
  assert.equal(delay, 12000); timeout();
  assert.equal((await request).status, 'unavailable');
  assert.equal(cleared, 1);
  pending.resolve('available'); await new Promise(setImmediate);
  assert.equal(h.api.getStoreUpdateAvailable(), false);
});
test('badge subscribers follow confirmed changes and stop receiving updates after unmount', async () => {
  const h = harness(); let calls = 0;
  const unsubscribe = h.api.subscribeStoreUpdate(() => { calls++; });
  await h.api.checkStoreUpdate(); await h.api.checkStoreUpdate();
  assert.equal(calls, 1);
  h.setStatus('up_to_date'); await h.api.checkStoreUpdate(); assert.equal(calls, 2);
  unsubscribe(); h.setStatus('available'); await h.api.checkStoreUpdate(); assert.equal(calls, 2);
});
function extract(file, name) {
  const tree = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JS);
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found, name);
  return ts.isFunctionDeclaration(found) ? 'export ' + found.getText(tree).replace(/^export default /, '').replace(/^export /, '') : 'export const ' + found.getText(tree);
}
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) };
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return;
  if (predicate(tree)) return tree;
  for (const child of tree.children || []) {
    if (Array.isArray(child)) {
      for (const item of child) { const result = find(item, predicate); if (result) return result; }
    } else { const result = find(child, predicate); if (result) return result; }
  }
}
test('real iOS native badge follows availability and uses the installed router empty-badge behavior', () => {
  const NativeTabs = Object.assign(() => {}, { Trigger: Object.assign(() => {}, { Icon: 'icon', Label: 'label', Badge: 'badge' }) });
  const append = load(extract('node_modules/expo-router/build/native-tabs/NativeTabTrigger.js', 'appendBadgeOptions')).appendBadgeOptions;
  for (const value of [false, true]) {
    const render = load(extract('app/(tabs)/_layout.tsx', 'NativeIOSTabs'), {}, {
      React, NativeTabs, useStoreUpdateAvailable: () => value,
    }).NativeIOSTabs;
    const tree = render({ labels: { home: 'home', notifications: 'articles', tools: 'tools', profile: 'profile' }, isDark: false });
    const badge = find(tree, node => node.type === 'badge');
    const options = {}; append(options, badge.props);
    assert.equal(options.badgeValue, value ? ' ' : undefined);
  }
});
test('real custom tab icon shows an update dot only on the profile icon', () => {
  const render = load(extract('app/(tabs)/_layout.tsx', 'BootstrapTabIcon'), {}, {
    React, View: 'view', Svg: 'svg', Path: 'path',
    useStoreUpdateAvailable: () => true,
    BOOTSTRAP_TAB_ICONS: { profile: { fill: ['p'], outline: ['p'] }, home: { fill: ['h'], outline: ['h'] } },
  }).BootstrapTabIcon;
  for (const name of ['home', 'profile']) {
    const tree = render({ name, focused: false, color: 'black' });
    const dot = find(tree, node => node.props.style?.backgroundColor === '#EF4444');
    assert.equal(Boolean(dot), name === 'profile');
  }
});
test('real root layout requests only the silent cold-start checker when mounted', async () => {
  const h = harness(), effects = [];
  const render = load(extract('app/_layout.tsx', 'RootLayout'), {}, {
    React, useEffect: fn => effects.push(fn), checkStoreUpdateOnColdStart: h.api.checkStoreUpdateOnColdStart,
    ThemeProvider: 'theme', AuthProvider: 'auth', AppContent: 'app', CustomAlertModal: 'modal',
  }).RootLayout;
  render(); render();
  effects.forEach(fn => fn()); await h.api.checkStoreUpdateOnColdStart();
  assert.equal(h.calls(), 1); assert.equal(h.api.getStoreUpdateAvailable(), true);
});


for (const os of ['android', 'ios']) {
  test(os + ' manual update prompt preserves dot on cancellation and opens store only on explicit action', async () => {
    const h = harness(os), alerts = [], states = [];
    let opened = 0;
    h.native.PlayStoreUpdate.openGooglePlay = async () => { opened++; return true; };
    await h.api.checkStoreUpdateOnColdStart();
    assert.equal(h.api.getStoreUpdateAvailable(), true);
    const run = load(extract('app/about/index.tsx', 'handleCheckUpdate'), {}, {
      Platform: h.platform, NativeModules: h.native, AbortController,
      storeUpdateRequest: { current: null }, setIsCheckingUpdate: value => states.push(value),
      Date, setTimeout: fn => { fn(); }, checkStoreUpdate: h.api.checkStoreUpdate,
      ut: { updateAvailable: 'available', updateNow: 'update', cancel: 'cancel', upToDate: 'latest', confirm: 'ok' },
      showCustomAlert: (...args) => alerts.push(args), recordDebugEvent() {},
      openAppStoreListing: async listing => { assert.equal(listing.trackId, 123); opened++; return true; },
    }).handleCheckUpdate;
    await run();
    assert.equal(alerts.at(-1)[0], 'available');
    assert.equal(opened, 0);
    assert.equal(h.api.getStoreUpdateAvailable(), true);
    const buttons = alerts.at(-1)[2];
    assert.equal(buttons[0].style, 'cancel');
    assert.equal(buttons[0].onPress, undefined);
    await buttons[1].onPress();
    assert.equal(opened, 1);
    assert.equal(h.api.getStoreUpdateAvailable(), true);
    h.setStatus('up_to_date'); h.setListing({ version: '1.0.97' });
    await run();
    assert.equal(alerts.at(-1)[0], 'latest');
    assert.equal(h.api.getStoreUpdateAvailable(), false);
    assert.equal(states.at(-1), false);
  });
}
