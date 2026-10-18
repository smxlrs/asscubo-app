const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(source, modules = {}, globals = {}) {
  const context = { exports: {}, console: { log() {}, warn() {} }, Date, Intl, URL, Headers, Response,
    TextDecoder, AbortController, setTimeout, clearTimeout,
    require: name => { assert.ok(name in modules, name); return modules[name]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const network = load(read('lib/network.ts'));
const stationSearch = load(read('lib/stationSearch.ts'));
const rome = load(read('lib/romeTime.ts'));
const time = load(read('lib/eventTime.ts'));
const proxy = 'https://project.supabase.co/functions/v1/viaggia-treno-proxy';
const direct = 'https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno';
function service(fetchWithDeadline, globals = {}) {
  return load(read('lib/viaggiaTrenoService.ts'), {
    './network': { ...network, fetchWithDeadline }, './stationSearch': stationSearch,
    './romeTime': rome, './eventTime': time,
    '../assets/stations': { stations: [{ id: 'S05043', n: 'Bologna Centrale' }, { id: 'S01700', n: 'Roma Termini' }] },
  }, { __DEV__: false, process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-key' } }, ...globals });
}
test('proxy 403 recovers using HTTPS, keeps encoded path and never leaks Supabase credentials', async () => {
  const calls = [];
  const s = service(async (url, options, timeout) => {
    calls.push({ url, options, timeout });
    return calls.length === 1 ? new Response('Access Denied', { status: 403 }) : new Response('中文 Bologna mercoledì 🚆');
  });
  const endpoint = '/partenze/S05043/Sun%20Oct%2018%202026%2012%3A30%3A00';
  const response = await s.fetchWithTimeout(proxy + endpoint, { headers: { authorization: 'Bearer test', cookie: 'secret', 'X-Test': 'retained' } });
  assert.equal(await response.text(), '中文 Bologna mercoledì 🚆');
  assert.equal(calls[0].options.headers.get('apikey'), 'test-key');
  assert.equal(calls[1].url, direct + endpoint);
  for (const key of ['apikey', 'authorization', 'cookie']) assert.equal(calls[1].options.headers.get(key), null);
  assert.equal(calls[1].options.headers.get('X-Test'), 'retained');
  assert.equal(calls[1].options.credentials, 'omit');
  assert.match(calls[1].options.headers.get('User-Agent'), /Mozilla.*Chrome/);
  assert.equal(calls[1].options.headers.get('Referer'), 'https://www.viaggiatreno.it/');
  assert.ok(calls[1].timeout > 0 && calls[1].timeout <= 20000);
});
test('healthy and genuine empty proxy responses are preserved without extra requests', async () => {
  for (const status of [200, 204, 404]) {
    let count = 0;
    const s = service(async () => { count++; return new Response(status === 204 ? null : '[]', { status }); });
    assert.equal((await s.fetchWithTimeout(proxy + '/andamentoTreno/S1/1')).status, status);
    assert.equal(count, 1);
  }
});
test('proxy connection errors recover, but cancellation never starts a second request', async () => {
  let count = 0;
  const s = service(async () => {
    count++;
    if (count === 1) throw new network.NetworkError('network', 'offline');
    return new Response('ok');
  });
  assert.equal(await (await s.fetchWithTimeout(proxy + '/news/0/it')).text(), 'ok');
  assert.equal(count, 2);
  count = 0;
  const controller = new AbortController();
  const cancelled = service(async () => { count++; controller.abort(); throw new network.NetworkError('network', 'cancelled'); });
  await assert.rejects(cancelled.fetchWithTimeout(proxy + '/news/0/it', { signal: controller.signal }));
  assert.equal(count, 1);
});
test('fallback uses only remaining time within the original 20 second deadline', async () => {
  let now = 1000;
  const calls = [];
  class Clock extends Date { static now() { return now; } }
  const s = service(async (url, options, timeout) => {
    calls.push(timeout);
    if (calls.length === 1) { now += 7000; return new Response('denied', { status: 403 }); }
    return new Response('ok');
  }, { Date: Clock });
  await s.fetchWithTimeout(proxy + '/news/0/it');
  assert.deepEqual(calls, [20000, 13000]);
  let count = 0;
  const expired = service(async () => { count++; now += 20000; return new Response('denied', { status: 403 }); }, { Date: Clock });
  await assert.rejects(expired.fetchWithTimeout(proxy + '/news/0/it'), e => e.kind === 'timeout');
  assert.equal(count, 1);
});
test('Italo empty live search never contacts failing Trenitalia and timetable uses Italo only', async () => {
  const calls = [];
  const s = service(async url => {
    calls.push(url);
    assert.ok(url.startsWith('https://italoinviaggio.italotreno.it/'));
    if (url.includes('RicercaTrenoService')) return Response.json({ IsEmpty: true });
    return Response.json({ IsEmpty: false, ListaTreniArrivo: [{ Numero: '8944', OraPassaggio: '15:30', DescrizioneLocalita: 'Bologna Centrale', Binario: '5' }] });
  });
  assert.equal((await s.searchTrain('8944', 'italo')).length, 0);
  const details = await s.getFutureItaloTrainSchedule('8944', 'Bologna Centrale', 'Roma Termini', Date.parse('2026-10-18T10:30:00Z'));
  assert.equal(details.number, '8944');
  assert.equal(details.stops.length, 2);
  assert.equal(details.scheduledArrivalTime, Date.parse('2026-10-18T13:30:00Z'));
  assert.equal(calls.length, 2);
});
test('Trenitalia search and mixed station boards recover beyond a rejected proxy', async () => {
  const s = service(async url => {
    if (url.startsWith(proxy)) return new Response('denied', { status: 403 });
    if (url.startsWith(direct) && url.includes('cercaNumero')) return new Response('9406 - NAPOLI|9406-S09218-1792188000000');
    if (url.startsWith(direct)) return Response.json([{ numeroTreno: 9406, origine: 'Napoli', destinazione: 'Milano', orarioPartenza: 1792323000000 }]);
    if (url.includes('RicercaStazioneService')) return Response.json({ ListaTreniPartenza: [{ Numero: '8944', OraPassaggio: '15:30' }] });
    throw new Error('unexpected request');
  });
  const matches = await s.searchTrain('9406', 'trenitalia');
  assert.equal(matches[0].departureStationID, 'S09218');
  const board = await s.getStationBoard('S05043', 'departures', new Date('2026-10-18T10:00:00Z'));
  assert.equal(board.length, 2);
  assert.ok(board.some(entry => entry.trainNumber === '9406'));
  assert.ok(board.some(entry => entry.trainNumber === '8944'));
});
function handler(name, globals) {
  const file = 'app/tools/train/train-status.tsx';
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found);
  return load('export const ' + found.getText(tree), {}, globals)[name];
}
test('actual detail screen reaches future Italo timetable when live search is empty', async () => {
  let shown, error, fallback = 0;
  const data = { number: '8944', stops: [], origin: 'Bologna', destination: 'Roma' };
  const run = handler('fetchData', {
    trainNumber: '8944', activeStationID: 'ITALO', activeTimestamp: '1792323000000', departureStationID: 'ITALO',
    category: 'NTV', origin: 'Bologna', destination: 'Roma', scheduledTime: '1792323000000', isFetchingRef: { current: false },
    searchTrain: async (num, operator) => { assert.equal(operator, 'italo'); return []; },
    getTrainStatus: async () => null,
    getFutureItaloTrainSchedule: async () => { fallback++; return data; },
    getRomeDateKey: () => '', updateRecentTrainInHistory: async () => {}, getTrainAlerts: async () => ({ alerts: [], available: false }),
    setLoading() {}, setRefreshing() {}, setAlerts() {}, setAlertServiceAvailable() {},
    setStatus: value => { shown = value; }, setErrorMsg: value => { error = value; },
    networkErrorKey: network.networkErrorKey,
  });
  await run();
  assert.equal(fallback, 1);
  assert.equal(shown, data);
  assert.equal(error, '');
});

test('both routes failing remains a visible error; unrelated tools never use train fallback', async () => {
  const calls = [];
  const s = service(async (url, options) => { calls.push({url, options}); return new Response('denied', { status:403 }); });
  await assert.rejects(s.searchTrain('9406', 'trenitalia'), e => e.reason === 'requestErrorForbidden');
  await assert.rejects(s.getStationBoard('S05043', 'departures', new Date(), 'trenitalia'), e => e.reason === 'requestErrorForbidden');
  calls.length = 0;
  const options = { headers: { 'X-Custom': 'unchanged' } };
  assert.equal((await s.fetchWithTimeout('https://scioperi.mit.gov.it/feed', options)).status,403);
  assert.equal(calls.length,1);
  assert.equal(calls[0].options,options);
});
test('actual detail screen still opens a known run when autocomplete is unavailable', async () => {
  let shown, error, queried = 0;
  const data = { number: '9406', stops: [], origin: 'Napoli', destination: 'Milano' };
  const run = handler('fetchData', {
    trainNumber: '9406', activeStationID: 'S09218', activeTimestamp: '1792323000000', departureStationID: 'S09218',
    category: 'FR', isFetchingRef: { current: false },
    searchTrain: async (num, operator) => { assert.equal(operator, 'trenitalia'); throw new network.NetworkError('http', 'denied', 403); },
    getTrainStatus: async (station, num, timestamp) => {
      queried++; assert.equal(station,'S09218'); assert.equal(num,'9406'); assert.equal(timestamp,'1792323000000'); return data;
    },
    getRomeDateKey: () => '', updateRecentTrainInHistory: async () => {}, getTrainAlerts: async () => ({ alerts: [], available: false }),
    setLoading() {}, setRefreshing() {}, setAlerts() {}, setAlertServiceAvailable() {},
    setStatus: value => { shown = value; }, setErrorMsg: value => { error = value; }, networkErrorKey: network.networkErrorKey,
  });
  await run();
  assert.equal(queried,1); assert.equal(shown,data); assert.equal(error,'');
});

test('server proxy uses web request headers on initial board request and stale-time retry', async () => {
  let serve;
  const calls = [];
  const source = fs.readFileSync(path.join(root, '../supabase/functions/viaggia-treno-proxy/index.ts'), 'utf8');
  load(source, {}, {
    Deno: { serve: fn => { serve = fn; } },
    fetch: async (url, options) => {
      calls.push({url, options});
      return Response.json(calls.length === 1 ? [] : [{numeroTreno:9406}]);
    },
  });
  const request = {method:'GET', url:proxy+'/partenze/S05043/Sun%20Oct%2018%202026%2004%3A07%3A21'};
  const response = await serve(request);
  assert.equal(response.status,200);
  assert.equal((await response.json())[0].numeroTreno,9406);
  assert.equal(calls.length,2);
  for(const call of calls){
    assert.match(call.options.headers['User-Agent'], /Mozilla.*Chrome/);
    assert.equal(call.options.headers.Referer,'https://www.viaggiatreno.it/');
    assert.equal(call.options.headers.apikey,undefined);
  }
});
