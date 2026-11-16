const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const context = { exports: {}, console, ...globals, require: name => {
    if (name in mocks) return mocks[name];
    throw Error('Unexpected import: ' + name);
  } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const content = load('lib/notificationContent.ts');
const feed = load('lib/publicationFeed.ts', { './notificationContent': content });
const row = (n, type = 'article') => ({ id: `id-${n}`, title: `Title ${n}`, summary: `Summary ${n}`, type });

test('publication paging sends search/category to server, retains lookahead for next page and renders notification previews', async () => {
  let args;
  const client = { rpc: async (name, params) => {
    assert.equal(name, 'publication_feed'); args = params;
    return { data: Array.from({ length: 16 }, (_, n) => ({ ...row(n, 'notification'), summary: '<p>Old announcement</p>' })) };
  } };
  const page = await feed.fetchPublicationPage(client, { kind: 'all', category: 'events', search: '  older  ' }, 30);
  assert.equal(args.p_search, 'older'); assert.equal(args.p_offset, 30); assert.equal(args.p_limit, 16);
  assert.equal(args.p_category, 'events'); assert.equal(page.items.length, 15);
  assert.equal(page.hasMore, true); assert.equal(page.nextOffset, 45);
  assert.equal(page.items[0].summary, 'Old announcement');
});

test('same UUID in different sources remains visible; duplicate page items do not repeat', () => {
  const merged = feed.appendPublications([row(1)], [row(1), row(1, 'notification'), row(2), row(2)]);
  assert.equal(merged.length, 3); assert.equal(merged[1].type, 'notification');
});

function harness() {
  const slots = [], effects = [], requests = [], timers = new Map();
  let cursor = 0, timerId = 0;
  const react = {
    useState(value) { const i = cursor++; if (!slots[i]) slots[i] = { value };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
    useRef(value) { const i = cursor++; if (!slots[i]) slots[i] = { current: value }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; const prev = slots[i];
      if (!prev || deps.some((value, n) => value !== prev.deps[n])) {
        effects.push(() => { prev?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const hook = load('hooks/usePublicationFeed.ts', {
    react, '../lib/supabase': { supabase: {} }, '../lib/network': { networkErrorKey: () => 'requestErrorUnknown' },
    '../lib/publicationFeed': { ...feed, fetchPublicationPage: (_client, filter, offset) =>
      new Promise((resolve, reject) => requests.push({ filter, offset, resolve, reject })) },
  }, { setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  return { requests,
    render(filter, identity = null) { cursor = 0; const result = hook.usePublicationFeed(filter, identity); while (effects.length) effects.shift()(); return result; },
    runTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
  };
}
const filter = (search = '') => ({ kind: 'all', category: 'all', search });
const page = n => ({ items: [row(n)], hasMore: true, nextOffset: 15 });
const settle = () => new Promise(resolve => setImmediate(resolve));

test('old search response cannot replace new results or clear the current request busy state', async () => {
  const h = harness(); h.render(filter()); h.runTimers();
  h.render(filter('new')); h.runTimers();
  h.requests[0].resolve(page('old')); await settle();
  const pending = h.render(filter('new')); assert.equal(pending.items.length, 0); assert.equal(pending.loading, true);
  h.requests[1].resolve(page('new')); await settle();
  const latest = h.render(filter('new')); assert.equal(latest.items[0].id, 'id-new');
  assert.equal(latest.loading, false);
});

test('account switch invalidates private results and stale refresh; load-more is single flight with correct offset', async () => {
  const h = harness(); h.render(filter(), 'user-a'); h.runTimers();
  h.requests[0].resolve(page(1)); await settle();
  let state = h.render(filter(), 'user-a');
  const oldRefresh = state.refresh();
  const switched = h.render(filter(), 'user-b');
  assert.equal(switched.items.length, 0);
  h.runTimers();
  h.requests[1].resolve(page('private-a')); await oldRefresh;
  h.requests[2].resolve(page('public-b')); await settle();
  state = h.render(filter(), 'user-b'); assert.equal(state.items[0].id, 'id-public-b');
  const loading = state.loadMore(); await state.loadMore();
  assert.equal(h.requests.length, 4); assert.equal(h.requests[3].offset, 15);
  h.requests[3].reject(Error('offline')); await loading;
  state = h.render(filter(), 'user-b'); assert.equal(state.items[0].id, 'id-public-b'); assert.equal(state.hasError, true);
});
