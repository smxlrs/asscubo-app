const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const context = { exports: {}, URL, Response, TextDecoder, AbortController, setTimeout, clearTimeout,
    require: key => { assert.ok(key in mocks, key); return mocks[key]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  return context.exports;
}
const network = load('lib/network.ts');
const service = load('lib/classroomService.ts', { './network': network });
const payload = { from: '2026-11-17T23:00:00Z', to: '2026-11-18T22:59:59.999Z' };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('classroom direct transport retains both POST payloads and refuses partial booking data', async () => {
  const calls = [];
  let replies = [[{ id: 'room' }], [{ id: 'booking' }]];
  const direct = load('lib/classroomService.ts', { './network': { ...network,
    fetchWithDeadline: async (url, init) => { calls.push({ url, init }); return Response.json(replies.shift()); },
  } });
  const result = await direct.fetchClassroomData(payload);
  assert.equal(result.classrooms[0].id, 'room'); assert.equal(result.bookings[0].id, 'booking');
  assert.equal(calls.length, 2); assert(calls.every(call => call.init.method === 'POST'));
  assert.equal(JSON.parse(calls[1].init.body).dataInizio, payload.from);
  assert.equal(JSON.parse(calls[1].init.body).dataFine, payload.to);
  assert.deepEqual(JSON.parse(calls[1].init.body).auleIds, ['room']);
  replies = [[{ id: 'room' }], { error: 'unexpected envelope' }];
  await assert.rejects(direct.fetchClassroomData(payload), error => error.reason === 'requestErrorData');
});

test('classroom challenge is detected before JSON parsing; genuine server errors stay distinct', async () => {
  for (const status of [202, 503, 403]) {
    const direct = load('lib/classroomService.ts', { './network': { ...network,
      fetchWithDeadline: async () => new Response('', { status, headers: status === 202 ? { 'x-amzn-waf-action': 'challenge' } : {} }),
    } });
    await assert.rejects(direct.fetchClassroomData(payload), error => status === 202
      ? error instanceof direct.ClassroomBrowserRequired
      : error.reason === (status === 503 ? 'requestErrorServer' : 'requestErrorForbidden'));
  }
});

test('booking scope never widens when the classroom list is empty or malformed', async () => {
  for (const rooms of [[], [{ description: 'missing ID' }]]) {
    let calls = 0;
    const direct = load('lib/classroomService.ts', { './network': { ...network,
      fetchWithDeadline: async () => { calls++; return Response.json(rooms); },
    } });
    if (rooms.length) await assert.rejects(direct.fetchClassroomData(payload), error => error.reason === 'requestErrorData');
    else assert.equal((await direct.fetchClassroomData(payload)).bookings.length, 0);
    assert.equal(calls, 1);
    const browser = await scriptHarness([Response.json(rooms)]);
    assert.equal(browser.calls.length, 1);
    if (rooms.length) assert.equal(browser.messages[0].invalid, true);
    else assert.equal(browser.messages[0].bookings.length, 0);
  }
});

test('browser bridge accepts only the official HTTPS origin', () => {
  assert(service.isClassroomOrigin(service.CLASSROOM_ORIGIN + '/'));
  for (const url of ['http://unibo.prod.up.cineca.it/', 'https://unibo.prod.up.cineca.it.evil.invalid/',
    'https://user@unibo.prod.up.cineca.it/', 'https://unibo.prod.up.cineca.it:444/', 'about:blank']) {
    assert.equal(service.isClassroomOrigin(url), false, url);
  }
});

async function scriptHarness(replies, origin = service.CLASSROOM_ORIGIN) {
  const messages = [], calls = [], timers = []; let reloads = 0;
  const context = { location: { origin, reload: () => reloads++ }, window: { ReactNativeWebView: { postMessage: s => messages.push(JSON.parse(s)) } },
    fetch: async (url, init) => { calls.push({ url, init }); return replies.shift(); }, setTimeout: fn => timers.push(fn) };
  vm.createContext(context);
  const script = service.classroomBrowserScript(7, payload);
  vm.runInContext(script, context); await flush();
  return { messages, calls, timers, context, script, reloads: () => reloads };
}

test('official-page script fetches same-origin complete datasets and suppresses duplicate injection', async () => {
  const h = await scriptHarness([Response.json([{ id: 'room' }]), Response.json([{ id: 'booking' }])]);
  assert.equal(h.messages[0].id, 7); assert.equal(h.messages[0].classrooms[0].id, 'room');
  assert.equal(h.messages[0].bookings[0].id, 'booking');
  assert(h.calls.every(call => call.url.startsWith('/api/') && call.init.credentials === 'same-origin'));
  assert.deepEqual(JSON.parse(h.calls[1].init.body).auleIds, ['room']);
  vm.runInContext(h.script, h.context); await flush(); assert.equal(h.calls.length, 2);
  const foreign = await scriptHarness([], 'https://example.invalid'); assert.equal(foreign.calls.length, 0);
});

test('browser bridge preserves all booking fields used by the tool without transferring unrelated resource trees', async () => {
  const booking = { id: 'booking', dataInizio: payload.from, dataFine: payload.to, nome: 'Lecture',
    aule: [{ id: 'room', codice: 'A1', descrizione: 'Room A1' }], tipoAttivita: { descrizione: 'Teaching' } };
  const h = await scriptHarness([Response.json([{ id: 'room' }]), Response.json([{ ...booking, risorse: [{ unused: 'large nested data' }] }])]);
  assert.deepEqual(h.messages[0].bookings, [booking]);
});

test('official-page script does not publish free rooms when bookings fail or verification is pending', async () => {
  const failed = await scriptHarness([Response.json([{ id: 'room' }]), new Response('', { status: 503 })]);
  assert.equal(failed.messages[0].status, 503); assert.equal(failed.messages[0].classrooms, undefined);
  const challenge = await scriptHarness([new Response('', { status: 202 }), Response.json([])]);
  assert.equal(challenge.messages.length, 0); assert.equal(challenge.timers.length, 1);
  assert.equal(challenge.reloads(), 0);
  challenge.context.fetch = async () => Response.json([]);
  challenge.timers[0](); await flush();
  assert.equal(challenge.messages[0].classrooms.length, 0);
  assert.equal(challenge.messages[0].bookings.length, 0);
  assert.equal(challenge.reloads(), 0);
});

function browserHookHarness() {
  let cursor = 0, timerId = 0; const slots = [], cleanups = [], timers = new Map();
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), useCallback: fn => fn,
    useState(initial) { const n = cursor++; slots[n] ??= { value: initial }; return [slots[n].value, value => slots[n].value = value]; },
    useRef(initial) { const n = cursor++; slots[n] ??= { current: initial }; return slots[n]; },
    useEffect(fn) { const n = cursor++; if (!slots[n]) { slots[n] = {}; cleanups.push(fn()); } },
  };
  const { useClassroomBrowser } = load('hooks/useClassroomBrowser.tsx', { react, 'react-native': { View: 'View' },
    'react-native-webview': { WebView: 'WebView' }, '../lib/classroomService': service, '../lib/network': network }, {
    setTimeout: (fn, delay) => { assert.equal(delay, 20000); timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  let hook;
  return { timers,
    render() { cursor = 0; hook = useClassroomBrowser(); return hook; },
    webview() { cursor = 0; hook = useClassroomBrowser(); return hook.browser.children[0]; },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}

test('native bridge validates source and request ID, cleans up on success, and ignores failed subresources', async () => {
  const h = browserHookHarness(); const request = h.render().loadInBrowser(payload); const web = h.webview();
  const data = { id: web.props.key, classrooms: [], bookings: [] };
  web.props.onMessage({ nativeEvent: { url: 'https://evil.invalid/', data: JSON.stringify(data) } });
  assert.equal(h.timers.size, 1);
  web.props.onMessage({ nativeEvent: { url: service.CLASSROOM_ORIGIN, data: JSON.stringify({ ...data, id: 999 }) } });
  assert.equal(h.timers.size, 1);
  web.props.onHttpError({ nativeEvent: { url: service.CLASSROOM_ORIGIN + '/missing.png', statusCode: 404 } });
  assert.equal(h.timers.size, 1);
  web.props.onMessage({ nativeEvent: { url: service.CLASSROOM_ORIGIN, data: JSON.stringify(data) } });
  assert.equal((await request).bookings.length, 0); assert.equal(h.timers.size, 0); assert.equal(h.render().browser, null);
});

test('native verification has a deadline and cancels pending work on replacement or unmount', async () => {
  const h = browserHookHarness(); const first = h.render().loadInBrowser(payload);
  const second = h.render().loadInBrowser(payload);
  await assert.rejects(first, error => error.reason === 'requestErrorCancelled');
  assert.equal(h.timers.size, 1); [...h.timers.values()][0]();
  await assert.rejects(second, error => error.reason === 'requestErrorTimeout'); assert.equal(h.timers.size, 0);
  const third = h.render().loadInBrowser(payload); h.unmount();
  await assert.rejects(third, error => error.reason === 'requestErrorCancelled'); assert.equal(h.timers.size, 0);
});

test('studyroom uses v4 live data, preserves missing attendance and accepts real zero occupancy', async () => {
  let reply; const calls = [];
  const study = load('lib/studyroom.ts', { './network': { ...network, fetchWithDeadline: async (...args) => { calls.push(args); return Response.json(reply); } } });
  const room = study.STUDY_ROOMS[0];
  reply = { data: { status: { isOpen: true }, liveAttendance: { occupancy: 0 } } };
  let result = await study.fetchStudyRoomStatus(room);
  assert.equal(result.state, 'available'); assert.equal(result.availableSeats, room.capacity);
  assert.equal(calls[0][0], `https://api.affluences.com/app/v4/sites/${room.id}/live-data`);
  assert.equal(calls[0][1].headers['x-service-name'], 'website');
  for (const occupancy of [null, '0', -1, 101]) {
    reply = { data: { status: { isOpen: true }, liveAttendance: { occupancy } } };
    result = await study.fetchStudyRoomStatus(room);
    assert.equal(result.state, 'no_data'); assert.equal(result.isOpen, true); assert.equal(result.availableSeats, null);
  }
  reply = { data: { status: { isOpen: false }, liveAttendance: { occupancy: null } } };
  result = await study.fetchStudyRoomStatus(room); assert.equal(result.isOpen, false); assert.equal(result.availableSeats, null);
});
