const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, modules = {}, globals = {}) {
  const context = { exports: {}, console, Date, Intl, URL, Response, AbortController, setTimeout, clearTimeout,
    require: name => { assert.ok(name in modules, name); return modules[name]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const rome = load('lib/romeTime.ts');
const eventTime = load('lib/eventTime.ts');
const stationSearch = load('lib/stationSearch.ts');

test('Rome day and quiet hours do not depend on device timezone, including DST', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['Europe/Rome', 'Asia/Shanghai', 'America/Los_Angeles']) {
      process.env.TZ = zone;
      assert.equal(rome.romeDay('2026-06-30T22:30:00Z'), '2026-07-01');
      assert.equal(rome.romeMinutes('2026-06-30T22:30:00Z'), 30);
      for (const [iso, quiet] of [['2026-06-30T19:59:00Z', false], ['2026-06-30T20:00:00Z', true],
        ['2026-06-30T05:59:00Z', true], ['2026-06-30T06:00:00Z', false],
        ['2026-12-01T21:00:00Z', true], ['2026-12-01T07:00:00Z', false]]) {
        assert.equal(rome.isRomeQuietHours(new Date(iso)), quiet, iso);
      }
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('train wall times use Rome rather than the phone clock', () => {
  const service = load('lib/viaggiaTrenoService.ts', { './network': {}, './romeTime': rome,
    './stationSearch': stationSearch, './eventTime': eventTime, '../assets/stations': { stations: [] } }, { process, __DEV__: false });
  const original = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Shanghai';
    assert.equal(service.parseTimeStr('00:30', new Date('2026-06-30T22:00:00Z')), Date.parse('2026-06-30T22:30:00Z'));
    assert.equal(service.parseTimeStr('01:00', new Date('2026-06-30T22:00:00Z')), Date.parse('2026-06-30T23:00:00Z'));
    assert.equal(service.getRomeTimestampFromLocalDate(new Date('2026-06-30T22:00:00Z')), Date.parse('2026-06-30T22:00:00Z'));
    assert.equal(service.parseTimeStr('invalid', new Date()), null);
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('network deadline covers a stalled response body even when abort is ignored', async () => {
  const network = load('lib/network.ts', {}, { fetch: async () => ({ blob: () => new Promise(() => {}) }) });
  await assert.rejects(network.fetchWithDeadline('https://example.invalid', undefined, 20), e => e.kind === 'timeout');
});

test('missing train schedules never invent arrival times or foreign stops', async () => {
  const network = load('lib/network.ts', {}, { fetch: async () => Response.json([]) });
  const service = load('lib/viaggiaTrenoService.ts', { './network': network, './romeTime': rome,
    './stationSearch': stationSearch, './eventTime': eventTime, '../assets/stations': { stations: [] } }, { process, __DEV__: false });
  assert.equal(await service.getFutureItaloTrainSchedule('999', 'Unknown origin', 'Unknown destination', Date.now()), null);
  const original = { number: '294', category: 'NJ', stops: [], destination: 'Provided by API' };
  assert.equal(service.adjustInternationalTrainStatus(original), original);
  assert.equal(original.stops.length, 0);
  const offline = load('lib/network.ts', {}, { fetch: async () => { throw new Error('offline'); } });
  const offlineService = load('lib/viaggiaTrenoService.ts', { './network': offline, './romeTime': rome,
    './stationSearch': stationSearch, './eventTime': eventTime, '../assets/stations': { stations: [] } }, { process, __DEV__: false, console: { log() {}, warn() {} } });
  await assert.rejects(offlineService.searchTrain('123'), e => e.kind === 'network');
});
test('network cancellation, HTTP error bodies, and empty responses remain usable', async () => {
  let called = 0;
  const network = load('lib/network.ts', {}, { fetch: async () => { called++; return new Response('{"error":"full"}', { status: 409 }); } });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(network.fetchWithDeadline('https://example.invalid', { signal: controller.signal }), e => e.kind === 'network');
  assert.equal(called, 0);
  const response = await network.fetchWithDeadline('https://example.invalid');
  assert.equal(response.status, 409); assert.deepEqual(await response.json(), { error: 'full' });
  const empty = load('lib/network.ts', {}, { fetch: async () => new Response(null, { status: 204 }) });
  assert.equal((await empty.fetchWithDeadline('https://example.invalid')).status, 204);
});
test('studyroom network failure, invalid data, and real empty occupancy are distinct', async () => {
  let reply;
  const network = load('lib/network.ts', {}, { fetch: async () => { if (reply instanceof Error) throw reply; return Response.json(reply); } });
  const study = load('lib/studyroom.ts', { './network': network });
  const room = study.STUDY_ROOMS[0];
  reply = new Error('offline');
  let result = await study.fetchStudyRoomStatus(room);
  assert.equal(result.state, 'offline'); assert.equal(result.availableSeats, null); assert.equal(result.isOpen, null);
  reply = { data: { current_forecast: { opened: true } } };
  result = await study.fetchStudyRoomStatus(room);
  assert.equal(result.state, 'no_data'); assert.equal(result.occupancyPercent, null);
  reply = { data: { current_forecast: { occupancy: 0, opened: true } } };
  result = await study.fetchStudyRoomStatus(room);
  assert.equal(result.state, 'available'); assert.equal(result.availableSeats, room.capacity);
});

function pushHarness() {
  const saved = new Map([['@ag_push_device_token', 'ExpoPushToken[test]']]);
  const calls = []; let user = 'old', fail = false;
  const storage = { getItem: async key => saved.get(key) ?? null, setItem: async (key,value) => saved.set(key,value), removeItem: async key => saved.delete(key) };
  const device = load('lib/pushDevice.ts', { '@react-native-async-storage/async-storage': storage,
    './supabase': { supabase: { auth: { getSession: async () => ({ data: { session: user ? { user: { id: user } } : null } }) },
      rpc: async (name,args) => { calls.push({ name, args, user }); return { error: fail ? new Error('offline') : null }; } } } });
  return { device, calls, saved, setUser: value => { user = value; }, setFail: value => { fail = value; } };
}
test('device sync transmits master/quiet settings and rejects stale account setup', async () => {
  const h = pushHarness(); h.saved.set('@ag_notification_global', 'false'); h.saved.set('@ag_notification_dnd', 'true');
  await h.device.syncPushDevice(undefined, 'different'); assert.equal(h.calls.length, 0);
  await h.device.syncPushDevice(undefined, 'old');
  assert.equal(h.calls[0].args.p_enabled, false); assert.equal(h.calls[0].args.p_night_quiet, true);
});
test('logout prevents queued reattachment and offline unlink retries as guest', async () => {
  const h = pushHarness();
  const oldSync = h.device.syncPushDevice(); h.setFail(true);
  await h.device.detachPushDevice(); await oldSync;
  assert.ok(h.calls.every(c => c.args.p_detach)); assert.equal(h.saved.get('@ag_push_detach_pending'), 'ExpoPushToken[test]');
  h.setFail(false); h.setUser(null); await h.device.syncPushDevice();
  assert.equal(h.calls.at(-2).args.p_detach, true); assert.equal(h.calls.at(-1).user, null);
  assert.equal(h.saved.has('@ag_push_detach_pending'), false);
});
test('iOS app alerts use native alert presentation and preserve button actions', () => {
  const calls = []; let confirmed = false;
  const api = load('lib/customAlert.ts', { 'react-native': { Platform: { OS: 'ios' }, Alert: { alert: (...args) => calls.push(args) } } });
  let modalCalls = 0; api.customAlertManager.subscribe(() => modalCalls++);
  api.showCustomAlert('确认', '内容', [{ text: '继续', onPress: () => { confirmed = true; } }]);
  assert.equal(modalCalls, 0); assert.equal(calls.length, 1); calls[0][2][0].onPress(); assert.equal(confirmed, true);
});

test('a new login can bind after logout even if no guest setup ran', async () => {
  const h = pushHarness(); await h.device.detachPushDevice();
  h.device.finishPushLogout(); h.setUser('new');
  await h.device.syncPushDevice(undefined, 'new');
  assert.equal(h.calls.at(-1).user, 'new'); assert.equal(h.calls.at(-1).args.p_detach, false);
});
test('token rotation still reconciles the old offline logout token', async () => {
  const h = pushHarness(); h.setFail(true); await h.device.detachPushDevice();
  h.setFail(false); h.setUser(null); h.device.finishPushLogout();
  await h.device.syncPushDevice('ExpoPushToken[new]');
  assert.equal(h.calls.at(-2).args.device_token, 'ExpoPushToken[test]');
  assert.equal(h.calls.at(-1).args.device_token, 'ExpoPushToken[new]');
});

test('a late administrator profile cannot restore permissions after sign-out', async () => {
  const slots = [], effects = []; let cursor = 0, listener, resolveProfile;
  const useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; };
  const react = { useState, useRef: initial => useState({ current: initial })[0], useEffect: fn => effects.push(fn),
    createContext: () => ({ Provider: 'Provider' }), createElement: (type, props) => ({ type, props }) };
  const session = { user: { id: 'admin', email: 'admin@example.invalid', user_metadata: {} } };
  const chain = { select() { return this; }, eq() { return this; }, single: () => new Promise(resolve => { resolveProfile = resolve; }) };
  const api = load('context/AuthContext.tsx', {
    react, '../lib/supabase': { supabase: {
      auth: { getSession: async () => ({ data: { session } }), onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => { listener('SIGNED_OUT', null); return { error: null }; } },
      from: () => chain,
    } }, '../lib/logger': { recordDebugEvent() {} }, 'expo-linking': { addEventListener: () => ({ remove() {} }), getInitialURL: async () => null },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '../lib/adminPermissions': { ALL_ADMIN_PERMISSIONS: ['events.manage'] },
    '../lib/pushDevice': { detachPushDevice: async () => {}, finishPushLogout() {} },
  }, { setTimeout: () => 1, clearTimeout() {} });
  const render = () => { cursor = 0; effects.length = 0; return api.AuthProvider({ children: null }).props.value; };
  render(); effects[0](); await new Promise(resolve => setImmediate(resolve));
  await render().signOut();
  resolveProfile({ data: { id: 'admin', role: 'super_admin', name: 'Old admin' }, error: null });
  await new Promise(resolve => setImmediate(resolve));
  const state = render(); assert.equal(state.user, null); assert.equal(state.profile, null); assert.equal(state.hasAdminPermission('events.manage'), false);
});
