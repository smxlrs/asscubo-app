const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const context = { exports: {}, AbortController, Date, Math, performance, ...globals, require: name => {
    if (name in mocks) return mocks[name]; throw Error('Unexpected import: ' + name);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  return context.exports;
}
const catalog = load('lib/toolUsageCatalog.ts');
const { createToolUsageTracker } = load('lib/toolUsageTracker.ts', { './toolUsageCatalog': catalog });
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(options = {}) {
  let time = Date.parse('2026-11-13T12:00:00Z'), seq = 0;
  const calls = [], statuses = [];
  const transport = { status: async (token, signal) => { statuses.push({ token, signal }); return true; },
    send: async (token, batch, signal) => { calls.push({ token, batch: clone(batch), signal }); return { enabled: true, accepted: batch.map(s => s.session_id) }; }, ...options.transport };
  const tracker = createToolUsageTracker({ enabled: options.enabled ?? true, now: () => time, monotonic: () => time,
    makeId: () => `visit-${++seq}`, transport });
  let ctx = { userId: 'alice', token: 'token-a', path: '/tools/bus', foreground: true };
  tracker.setContext(ctx);
  return { tracker, transport, calls, statuses, advance: ms => time += ms,
    context: changes => { ctx = { ...ctx, ...changes }; tracker.setContext(ctx); } };
}
test('catalog maps tool subpages and excludes unrelated routes and query contents', () => {
  assert.equal(catalog.usageToolForPath('/tools/train/station-board?station=secret'), 'train');
  assert.equal(catalog.usageToolForPath('/tools/rate-settings'), 'rate');
  assert.equal(catalog.usageToolForPath('/admin/usage-analytics'), null);
  assert.equal(catalog.usageToolForPath('/tools/bus-other'), null);
});
test('disabled and guest trackers do no networking', async () => {
  for (const f of [fixture({ enabled: false }), fixture()]) {
    f.context({ userId: null, token: null }); await f.tracker.tick();
    assert.equal(f.statuses.length, 0); assert.equal(f.calls.length, 0);
  }
});
test('cumulative snapshots retain one visit through same-tool subpages; leaving adds visit', async () => {
  const f = fixture(); await f.tracker.tick(); f.advance(30000);
  f.context({ path: '/tools/bus/alerts?foo=private' }); f.advance(30000); await f.tracker.tick();
  assert.equal(f.calls[1].batch[0].duration_ms, 60000);
  assert.equal(f.calls[1].batch[0].session_id, f.calls[0].batch[0].session_id);
  assert.equal(JSON.stringify(f.calls).includes('private'), false);
  f.context({ path: '/' }); f.context({ path: '/tools/bus' });
  f.advance(60000); await f.tracker.tick();
  assert.notEqual(f.calls.at(-1).batch.at(-1).session_id, f.calls[0].batch[0].session_id);
});
test('background pauses duration; long background resumes as a new visit', async () => {
  const f = fixture(); await f.tracker.tick(); f.advance(10000); f.context({ foreground: false });
  f.advance(600000); await f.tracker.tick(); assert.equal(f.calls.length, 1);
  f.context({ foreground: true }); f.advance(20000); await f.tracker.tick();
  assert.equal(f.calls.at(-1).batch[0].duration_ms, 30000);
  f.context({ foreground: false }); f.advance(31 * 60000); f.context({ foreground: true }); await f.tracker.tick();
  assert.notEqual(f.calls.at(-1).batch.at(-1).session_id, f.calls[0].batch[0].session_id);
});
test('runtime freeze caps duration and shutdown suppresses future work', async () => {
  const f = fixture(); await f.tracker.tick(); f.advance(3600000); await f.tracker.tick();
  assert.equal(f.calls.at(-1).batch[0].duration_ms, 90000);
  f.tracker.dispose(); f.advance(60000); await f.tracker.tick(); assert.equal(f.calls.length, 2);
});
test('remote disable never records a visit', async () => {
  const f = fixture({ transport: { status: async () => false } });
  await f.tracker.tick(); f.advance(60000); await f.tracker.tick(); assert.equal(f.calls.length, 0);
});
test('background transition during status request suppresses upload', async () => {
  let resolve;
  const f = fixture({ transport: { status: () => new Promise(r => resolve = r) } });
  const tick = f.tracker.tick(); f.context({ foreground: false }); resolve(true); await tick;
  assert.equal(f.calls.length, 0);
});
test('account switch aborts old request and ignores late response', async () => {
  let resolve, signal;
  const f = fixture({ transport: { status: (_token, s) => { signal = s; return new Promise(r => resolve = r); } } });
  const tick = f.tracker.tick(); f.context({ userId: 'bob', token: 'token-b' });
  assert.equal(signal.aborted, true); resolve(true); await tick; assert.equal(f.calls.length, 0);
  f.transport.status = async () => true; await f.tracker.tick(); assert.equal(f.calls[0].token, 'token-b');
});
test('failures stay isolated and back off instead of retrying every navigation', async () => {
  let failures = 0;
  const f = fixture({ transport: { status: async () => { failures++; throw Error('offline'); } } });
  await f.tracker.tick(); f.advance(59999); await f.tracker.tick(); assert.equal(failures, 1);
  f.advance(1); await f.tracker.tick(); assert.equal(failures, 2);
  f.advance(60000); await f.tracker.tick(); assert.equal(failures, 2);
  f.advance(60000); await f.tracker.tick(); assert.equal(failures, 3);
});
test('pending memory and network batches are bounded even offline', async () => {
  const batches = [];
  const f = fixture({ transport: { send: async (_token, batch) => { batches.push(clone(batch)); return { enabled: true, accepted: [] }; } } });
  await f.tracker.tick();
  for (let i = 0; i < 100; i++) { f.context({ path: '/' }); f.context({ path: '/tools/train' }); }
  f.advance(60000); await f.tracker.tick(); assert.equal(batches.at(-1).length, 20);
  assert.equal(batches.at(-1)[0].session_id, 'visit-70');
});
test('late ACK cannot discard a newer cumulative snapshot', async () => {
  let resolve;
  const f = fixture({ transport: { send: (_token, batch) => new Promise(r => resolve = () => r({ enabled: true, accepted: batch.map(s => s.session_id) })) } });
  const tick = f.tracker.tick(); await new Promise(r => setImmediate(r)); f.advance(10000); f.context({ path: '/tools/bus/alerts' });
  resolve(); await tick;
  const next = []; f.transport.send = async (_token, batch) => { next.push(clone(batch)); return { enabled: true, accepted: [] }; };
  f.advance(60000); await f.tracker.tick(); assert.equal(next[0][0].duration_ms, 70000);
});
test('transport bounds requests, uses captured JWT, and rejects malformed responses', async () => {
  const requests = []; let data = true;
  const { createToolUsageTransport } = load('lib/toolUsageTransport.ts', {
    './network': { fetchWithDeadline: async (...args) => { requests.push(args); return { ok: true, json: async () => data }; } },
  }, { process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://test.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key' } } });
  const transport = createToolUsageTransport(), signal = new AbortController().signal;
  assert.equal(await transport.status('captured', signal), true);
  assert.equal(requests[0][2], 1500); assert.equal(requests[0][1].headers.Authorization, 'Bearer captured');
  data = {}; await assert.rejects(transport.status('captured', signal));
  await assert.rejects(transport.send('captured', [], signal));
});
test('real transport deadline releases stalled connection and response body', async () => {
  for (const stage of ['connection', 'body']) {
    let timeout, deadline, cancelled = false;
    const network = load('lib/network.ts', {}, { Response, TextDecoder,
      setTimeout: (callback, ms) => { timeout = callback; deadline = ms; return 1; }, clearTimeout() {},
      fetch: async (_url, init) => {
        init.signal.addEventListener('abort', () => cancelled = true);
        if (stage === 'connection') return new Promise(() => {});
        return { arrayBuffer: () => new Promise(() => {}) };
      },
    });
    const { createToolUsageTransport } = load('lib/toolUsageTransport.ts', { './network': network },
      { process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://test.invalid', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-key' } } });
    const pending = createToolUsageTransport().status('captured', new AbortController().signal);
    await flush(); assert.equal(deadline, 1500); timeout();
    await assert.rejects(pending, /requestErrorTimeout/); assert.equal(cancelled, true);
  }
});
test('disabled observer renders null without invoking hooks, timers or collector imports', () => {
  class Component {}
  const unexpected = () => { throw Error('disabled observer ran'); };
  const observer = load('components/UsageAnalyticsObserver.tsx', { react: { Component, default: { Component }, useEffect: unexpected, useRef: unexpected },
    'react-native': {}, 'expo-router': { usePathname: unexpected }, '../context/AuthContext': { useAuth: unexpected } },
  { process: { env: { EXPO_PUBLIC_USAGE_ANALYTICS_ENABLED: 'false' } }, setTimeout: unexpected, setInterval: unexpected });
  assert.equal(observer.UsageAnalyticsObserver(), null);
});
test('new builds enable collection by default independently of administrator view permissions', () => {
  class Component {}
  const react = { Component, createElement: (type, props, ...children) => ({ type, props, children }) };
  const observer = load('components/UsageAnalyticsObserver.tsx', { react,
    'react-native': {}, 'expo-router': {}, '../context/AuthContext': {} }, { process: { env: {} } });
  assert.equal(observer.USAGE_ANALYTICS_ENABLED, true);
  assert.ok(observer.UsageAnalyticsObserver());
});

function adminHarness(permissions, props = {}) {
  const slots = [], effects = [], requests = [];
  let cursor = 0, focused = true;
  let prevention;
  const backListeners = new Set(), navigation = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(value) { const n = cursor++; if (!slots[n]) slots[n] = { value };
      return [slots[n].value, v => { slots[n].value = typeof v === 'function' ? v(slots[n].value) : v; }]; },
    useMemo(fn, deps) { const n = cursor++; const previous = slots[n];
      if (!previous || deps.some((v, i) => v !== previous.deps[i])) slots[n] = { value: fn(), deps };
      return slots[n].value; },
    useEffect(fn, deps) { const n = cursor++; const previous = slots[n];
      if (!previous || deps.some((v, i) => v !== previous.deps[i])) effects.push(() => { previous?.cleanup?.(); slots[n] = { deps, cleanup: fn() }; }); },
  };
  react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
  const auth = { user: { id: 'admin' }, hasAdminPermission: p => permissions.includes(p) };
  const screenModule = load('components/admin/UsageAnalyticsScreen.tsx', { react, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'react-native': { StyleSheet: { create: x => x }, Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', ActivityIndicator: 'ActivityIndicator', Image: 'Image', Keyboard: { dismiss() {} }, BackHandler: { addEventListener: (_name, fn) => { backListeners.add(fn); return { remove: () => backListeners.delete(fn) }; } } },
    'expo-router': { useIsFocused: () => focused, useFocusEffect: callback => react.useEffect(() => focused ? callback() : undefined, [callback, focused]), router: { canGoBack: () => true, back: () => navigation.push('back'), replace: route => navigation.push(route), push: route => navigation.push(route) } },
    'expo-router/react-navigation': { usePreventRemove: (enabled, callback) => { prevention = { enabled, callback }; } }, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../../context/AuthContext': { useAuth: () => auth }, '../../context/ThemeContext': { useTheme: () => ({ colors: {} }) },
    '../../lib/toolUsageCatalog': catalog,
    '../../lib/supabase': { supabase: { rpc: (name, params) => new Promise(resolve => requests.push({ name, params, resolve })) } },
  });
  const screen = screenModule.default;
  let tree;
  const all = node => !node || typeof node !== 'object' ? [] : [node, ...(node.children || []).flat(Infinity).flatMap(all)];
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : !node || typeof node !== 'object' ? '' : (node.children || []).flat(Infinity).map(text).join('');
  return { requests, auth, navigation,
    render() { cursor = 0; tree = screen(props); while (effects.length) effects.shift()(); return text(tree); },
    renderAvatar(uri) { cursor = 0; tree = screenModule.UsageAccountAvatar({ uri }); return tree; },
    nodes: () => all(tree),
    press(label) { const button = all(tree).find(n => n.type === 'Pressable' && (text(n) === label || n.props?.accessibilityLabel === label)); assert.ok(button, label); button.props.onPress(); },
    pressUser(id) { const button = all(tree).find(n => n.type === 'Pressable' && n.props?.key === id); assert.ok(button, id); button.props.onPress(); },
    type(value) { all(tree).find(n => n.type === 'TextInput').props.onChangeText(value); },
    input: () => all(tree).find(n => n.type === 'TextInput')?.props.value,
    systemBack() { return [...backListeners].reverse().some(fn => fn()); },
    attemptLeave() { if (prevention.enabled) { prevention.callback({ data: { action: { type: 'GO_BACK' } } }); return false; } return true; },
    blur() { focused = false; },
  };
}
const flush = () => new Promise(r => setImmediate(r));
test('admin summary displays overall deduplicated totals, eight tools and daily trend', async () => {
  const h = adminHarness(['analytics.summary']); h.render();
  assert.equal(h.requests[0].name, 'admin_tool_usage_summary');
  h.requests[0].resolve({ data: { collection_enabled: false, total_registered: 12, new_registered: 3,
    totals: { visits: 9, users: 2, duration_ms: 60000 }, tools: [{ tool: 'bus', visits: 6, users: 2, duration_ms: 30000 }],
    daily: [{ day: '2026-11-13', visits: 9, users: 2, duration_ms: 60000 }] } }); await flush();
  const text = h.render(); assert.match(text, /全部工具合计9 次/); assert.match(text, /去重使用人数2 人/);
  assert.match(text, /注册账号总数12/); assert.match(text, /火车0 次/); assert.match(text, /2026-11-13/);
  assert.equal(text.includes('用户明细'), false);
});
test('users-only permission fetches users without requesting summary or moderation', async () => {
  const h = adminHarness(['analytics.users']); h.render();
  assert.equal(h.requests[0].name, 'admin_tool_usage_users'); assert.equal(h.requests[0].params.p_limit, 25);
  h.requests[0].resolve({ data: { total: 0, users: [] } }); await flush();
  assert.equal(h.render().includes('总体与工具'), false);
});
test('unprivileged page performs no report requests; stale range responses are ignored', async () => {
  const denied = adminHarness([]); denied.render(); assert.equal(denied.requests.length, 0);
  const h = adminHarness(['analytics.summary']); h.render(); h.press('最近 30 天'); h.render();
  h.requests[0].resolve({ data: { total_registered: 999 } }); await flush();
  assert.equal(h.render().includes('999'), false);
  h.requests[1].resolve({ error: { message: 'not installed' } }); await flush();
  assert.match(h.render(), /暂时无法读取统计/);
});

test('active observer evaluates bundled collectors only after startup and cleans up', async () => {
  for (const failure of ['none', 'load', 'setup', 'tick']) {
    const effects = [], timeouts = new Map(), intervals = new Map();
    let loads = 0, removed = 0, disposed = 0, listener, context;
    class Component {}
    const react = { Component, createElement: (type, props, ...children) => ({ type, props, children }),
      useRef: value => ({ current: value }), useEffect: fn => effects.push(fn) };
    const mocks = { react, 'expo-router': { usePathname: () => '/tools/bus' },
      '../context/AuthContext': { useAuth: () => ({ user: { id: 'alice' }, session: { access_token: 'token' } }) },
      'react-native': { AppState: { currentState: 'active', addEventListener: (_event, fn) => {
        listener = fn; if (failure === 'setup') throw Error('native listener unavailable');
        return { remove: () => removed++ };
      } } },
      '../lib/toolUsageTransport': { createToolUsageTransport: () => ({}) } };
    Object.defineProperty(mocks, '../lib/toolUsageTracker', { enumerable: true, get() {
      loads++; if (failure === 'load') throw Error('collector unavailable');
      return { createToolUsageTracker: () => ({ setContext: value => context = value,
        tick: async () => { if (failure === 'tick') throw Error('offline'); }, dispose: () => disposed++ }) };
    } });
    const observer = load('components/UsageAnalyticsObserver.tsx', mocks, { process: { env: {} },
      setTimeout: (fn, ms) => { assert.equal(ms, 1500); timeouts.set(1, fn); return 1; }, clearTimeout: id => timeouts.delete(id),
      setInterval: (fn, ms) => { assert.equal(ms, 60000); intervals.set(2, fn); return 2; }, clearInterval: id => intervals.delete(id) });
    observer.UsageAnalyticsObserver().children[0].type();
    const cleanups = effects.map(fn => fn());
    assert.equal(loads, 0); assert.equal(intervals.size, 0);
    assert.doesNotThrow(() => timeouts.get(1)()); await flush();
    assert.equal(loads, 1);
    if (failure === 'none' || failure === 'tick') {
      assert.equal(context.userId, 'alice'); assert.equal(intervals.size, 1);
      listener('background'); assert.equal(context.foreground, false);
      intervals.get(2)(); await flush();
    } else assert.equal(intervals.size, 0);
    for (const cleanup of cleanups) cleanup?.();
    assert.equal(timeouts.size, 0); assert.equal(intervals.size, 0);
    assert.equal(disposed, failure === 'load' ? 0 : 1);
    assert.equal(removed, failure === 'none' || failure === 'tick' ? 1 : 0);
  }
});

const sampleAccount = { id: 'sample-user', name: '示例用户', email: 'sample@example.invalid',
  avatar_url: 'data:image/png;base64,sample', registered_at: '2026-11-01T12:00:00Z', last_sign_in_at: null,
  last_used_at: null, visits: 3, duration_ms: 30000 };

test('analytics avatar renders stored URI and falls back after an image error or absent avatar', () => {
  const h = adminHarness([]); h.renderAvatar(sampleAccount.avatar_url);
  const image = h.nodes().find(n => n.type === 'Image');
  assert.equal(image.props.source.uri, sampleAccount.avatar_url);
  image.props.onError(); h.renderAvatar(sampleAccount.avatar_url);
  assert.equal(h.nodes().some(n => n.type === 'Image'), false);
  assert.equal(h.nodes().some(n => n.type === 'Icon' && n.props.name === 'account'), true);
  const missing = adminHarness([]); missing.renderAvatar(null);
  assert.equal(missing.nodes().some(n => n.type === 'Image'), false);
});

test('user search has one magnifier as its trailing accessible submit button', () => {
  const h = adminHarness(['analytics.users']); h.render();
  const search = h.nodes().find(n => n.type === 'Pressable' && n.props.accessibilityLabel === '搜索');
  assert.ok(search); assert.equal(search.children[0].props.name, 'magnify');
  assert.equal(h.nodes().filter(n => n.type === 'Icon' && n.props.name === 'magnify').length, 1);
});

test('user rows push a separate detail route and retain the parent search and pagination', async () => {
  const h = adminHarness(['analytics.users']); h.render();
  h.type('sample'); h.render(); h.press('搜索'); h.render();
  h.requests.at(-1).resolve({ data: { total: 26, users: [sampleAccount] } }); await flush(); h.render();
  h.press('下一页'); h.render();
  h.requests.at(-1).resolve({ data: { total: 26, users: [sampleAccount] } }); await flush(); h.render();
  assert.equal(h.requests.at(-1).params.p_offset, 25);
  h.pressUser('sample-user');
  assert.equal(h.navigation.at(-1).pathname, '/admin/usage-analytics-user');
  assert.equal(h.navigation.at(-1).params.userId, 'sample-user');
  assert.equal(h.navigation.at(-1).params.days, '7');
  assert.equal(h.input(), 'sample');
  const requestCount = h.requests.length;
  h.blur(); h.render();
  assert.equal(h.systemBack(), false); assert.equal(h.attemptLeave(), true);
  assert.equal(h.requests.length, requestCount); assert.equal(h.input(), 'sample');
  const detail = adminHarness(['analytics.users'], { detailUserId: 'sample-user', initialDays: 30 }); detail.render();
  assert.equal(detail.requests[0].name, 'admin_tool_usage_user');
  assert.equal(detail.requests[0].params.p_user_id, 'sample-user');
  assert.equal(detail.requests[0].params.p_offset, 0);
  assert.equal(detail.requests[0].params.p_search, undefined);
  assert.equal(detail.input(), undefined);
  detail.press('返回用户列表'); assert.equal(detail.navigation.at(-1), 'back');
});

for (const method of ['header', 'hardware', 'gesture']) {
  test(`search back via ${method} clears query before leaving and rejects the old response`, async () => {
    const h = adminHarness(['analytics.users']); h.render();
    h.type('old-search'); h.render(); h.press('搜索'); h.render();
    const old = h.requests.at(-1);
    assert.equal(old.params.p_search, 'old-search');
    if (method === 'header') h.press('返回');
    if (method === 'hardware') assert.equal(h.systemBack(), true);
    if (method === 'gesture') assert.equal(h.attemptLeave(), false);
    h.render();
    assert.equal(h.input(), ''); assert.equal(h.navigation.length, 0);
    assert.equal(h.requests.at(-1).params.p_search, ''); assert.equal(h.requests.at(-1).params.p_offset, 0);
    old.resolve({ data: { total: 1, users: [{ ...sampleAccount, name: 'STALE RESULT' }] } }); await flush();
    assert.equal(h.render().includes('STALE RESULT'), false);
    assert.equal(h.systemBack(), false); assert.equal(h.attemptLeave(), true);
    h.press('返回'); assert.equal(h.navigation.at(-1), 'back');
  });
}

test('unsubmitted search text also clears on back; detail route still requires user analytics permission', () => {
  const h = adminHarness(['analytics.users']); h.render(); h.type('draft'); h.render();
  assert.equal(h.systemBack(), true); h.render(); assert.equal(h.input(), ''); assert.equal(h.navigation.length, 0);
  const denied = adminHarness(['analytics.summary'], { detailUserId: 'sample-user' });
  assert.match(denied.render(), /暂无查看统计的权限/); assert.equal(denied.requests.length, 0);
});
