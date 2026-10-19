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
function service(fetchWithDeadline, globals = {}, catalog) {
  return load(read('lib/viaggiaTrenoService.ts'), {
    './network': { ...network, fetchWithDeadline }, './stationSearch': stationSearch,
    './romeTime': rome, './eventTime': time,
    '../assets/stations': { stations: catalog || [{ id: 'S05043', n: 'Bologna Centrale' }, { id: 'S08409', n: 'Roma Termini' }] },
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
  const details = await s.getFutureItaloTrainSchedule('8944', 'Bologna Centrale', 'Roma Termini', Date.parse(rome.romeDay() + 'T10:30:00Z'));
  assert.equal(details.number, '8944');
  assert.equal(details.stops.length, 2);
  assert.equal(details.scheduledArrivalTime, Date.parse(time.romeToIso(rome.romeDay() + ' 15:30')));
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
function handler(name, globals, file = 'app/tools/train/train-status.tsx') {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(found);
  return load('export const ' + found.getText(tree), {}, { boardMode: undefined, boardPlatform: undefined, boardActualPlatform: undefined, ...globals })[name];
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

const fullCatalog = load(read('assets/stations.ts')).stations;
test('Italo station aliases resolve exact identities without choosing an arbitrary city stop', () => {
  const s = service(async () => { throw Error('not needed'); }, {}, fullCatalog);
  for (const [name, id] of [['VENEZIA S.LUCIA','S02593'],['Venezia Santa Lucia','S02593'],['FIRENZE S.M.N.','S06421'],['FIRENZE SMN','S06421'],['TORINO PORTA DI SUSA','S00222'],['bologna','S05043'],['BAZZANO (FER)','S05975']]) assert.equal(s.findStationIdByName(name),id,name);
  assert.equal(s.findStationIdByName('Roma'), null);
  assert.equal(s.findStationIdByName('Venezia'), null);
  assert.equal(s.findStationIdByName(''), null);
  assert.equal(s.findStationIdByName('nonexistent'), null);
  assert.equal(s.findStationIdByName('constructor'), null);
});

test('8910 uses Venezia arrival board when live details are empty, preserves known departure platform and marks partial data', async () => {
  const start = Date.parse(rome.romeDay()+'T11:21:00Z');
  const s=service(async url => {
    assert.match(url,/CodiceStazione=VSL&NomeStazione=venezia-santa-lucia/);
    return Response.json({ListaTreniArrivo:[{Numero:'8910',OraPassaggio:'14:55',DescrizioneLocalita:'SALERNO',Binario:'3'}]});
  },{},fullCatalog);
  const d=await s.getFutureItaloTrainSchedule('8910','bologna','VENEZIA S.LUCIA',start,'departures',{scheduledPlatform:'17'});
  assert.equal(d.detailLevel,'station-board');assert.equal(d.stops[0].stationId,'S05043');assert.equal(d.stops[1].stationId,'S02593');
  assert.equal(d.stops[0].scheduledPlatform,'17');assert.ok(d.scheduledArrivalTime>start);
  assert.equal(d.stops[0].actualDepartureTime,null);assert.equal(d.lastReportedTime,null);
});

test('missing or unavailable endpoint information retains only confirmed board times; arrivals are never treated as departures', async () => {
  const start = Date.parse(rome.romeDay()+'T11:21:00Z');
  const s=service(async()=>{throw new network.NetworkError('network','offline');},{},fullCatalog);
  const d=await s.getFutureItaloTrainSchedule('8910','Bologna Centrale','Venezia S.Lucia',start);
  assert.equal(d.scheduledDepartureTime,start);assert.equal(d.scheduledArrivalTime,0);assert.equal(d.stops[1].scheduledArrivalTime,null);
  const a=await s.getFutureItaloTrainSchedule('8910','Salerno','Bologna Centrale',start,'arrivals',{actualPlatform:'17'});
  assert.equal(a.scheduledDepartureTime,0);assert.equal(a.stops[0].scheduledDepartureTime,null);assert.equal(a.scheduledArrivalTime,start);assert.equal(a.stops[1].actualPlatform,'17');
  const unknown=await s.getFutureItaloTrainSchedule('8910','Unknown start','Unknown end',start);
  assert.equal(unknown,null);
});

test("saved past/future dates and invalid board timestamps never use today's Italo board", async () => {
  let calls=0;const s=service(async()=>{calls++;return Response.json({});},{},fullCatalog);
  for(const stamp of [0,NaN,Date.now()-48*3600000,Date.now()+48*3600000])assert.equal(await s.getFutureItaloTrainSchedule('8910','Bologna Centrale','Venezia S.Lucia',stamp),null);
  assert.equal(calls,0);
});

test('numeric display platform fields are preserved; null Tper platform fields stay unknown', async () => {
  for(const fields of [{binarioProgrammatoPartenza:'5',binarioEffettivoPartenza:'6'}, {binarioProgrammatoPartenzaDescrizione:null,binarioEffettivoPartenzaDescrizione:null,binarioProgrammatoPartenzaCodice:'internal-id'}]){
    const s=service(async()=>Response.json({numeroTreno:90041,codiceCliente:18,fermate:[{id:'S05043',stazione:'BOLOGNA CENTRALE',...fields}]}));
    const d=await s.getTrainStatus('S05043','90041');
    assert.equal(d.stops[0].scheduledPlatform,fields.binarioProgrammatoPartenza||'');
    assert.equal(d.stops[0].actualPlatform,fields.binarioEffettivoPartenza||'');
    assert.equal(s.getOperatorInfo(d.codiceCliente,d.category).name,'Trenitalia Tper');
  }
});

test('Italo stop codes match national station IDs and planned/actual platforms remain distinct', () => {
  const s=service(async()=>{throw Error('not needed');});
  const d=s.parseItaloTrainStatus({TrainSchedule:{TrainNumber:'8910',StazionePartenza:{LocationCode:'BC_',LocationDescription:'Bologna Centrale',BinaryProgrammed:'17',BinaryReal:'18'},StazioniFerme:[],StazioniNonFerme:[]}});
  assert.equal(d.stops[0].stationId,'S05043');assert.equal(d.stops[0].scheduledPlatform,'17');assert.equal(d.stops[0].actualPlatform,'18');
});

test('station platform backfill separates arrivals/departures and refresh updates a cached platform', async () => {
  const file='app/tools/train/station-board.tsx';
  const extraTimesKey=handler('extraTimesKey',{},file);
  const matchPlatformFromStatus=handler('matchPlatformFromStatus',{},file);
  const entry={trainNumber:'90041',originStationID:'S05043',timestamp:1,codiceCliente:18};
  const dep=extraTimesKey('S05043','departures',entry),arr=extraTimesKey('S05043','arrivals',entry);
  assert.notEqual(dep,arr);assert.notEqual(dep,extraTimesKey('S05100','departures',entry));
  let track='5',shown={};const cache={current:{}};
  const run=handler('triggerBackgroundTimeLoading',{
    stationID:'S05043',extraTimesKey,matchPlatformFromStatus,extraTimesCache:cache,boardRequestVersion:{current:{departures:0,arrivals:0}},
    getTrainStatus:async()=>({scheduledDepartureTime:1,scheduledArrivalTime:2,stops:[{stationId:'S05043',scheduledPlatform:track,actualPlatform:track}]}),
    setExtraTrainTimes:fn=>{shown=fn(shown);},
  },file);
  await run([entry],'departures');track='7';await run([entry],'arrivals');
  assert.equal(shown[dep].actualPlatform,'5');assert.equal(shown[arr].actualPlatform,'7');
  track='9';await run([entry],'departures',true);assert.equal(shown[dep].actualPlatform,'9');
});

test('partial detail screen keeps the selected board date and direction', async () => {
  let shown,called;
  const stamp=String(Date.now());const data={detailLevel:'station-board',number:'8910',stops:[],origin:'Salerno',destination:'Bologna',scheduledDepartureTime:0};
  const run=handler('fetchData',{
    trainNumber:'8910',activeStationID:'ITALO',activeTimestamp:stamp,departureStationID:'ITALO',category:'NTV',origin:'Salerno',destination:'Bologna',scheduledTime:stamp,boardMode:'arrivals',boardPlatform:'17',isFetchingRef:{current:false},
    searchTrain:async()=>[],getTrainStatus:async()=>null,getFutureItaloTrainSchedule:async(...args)=>{called=args;return data;},
    getRomeDateKey:val=>String(val),updateRecentTrainInHistory:async()=>{},getTrainAlerts:async()=>({alerts:[],available:false}),
    setLoading(){},setRefreshing(){},setAlerts(){},setAlertServiceAvailable(){},setErrorMsg(){},setStatus:d=>{shown=d;},networkErrorKey:network.networkErrorKey,
  });await run();assert.equal(shown,data);assert.equal(called[4],'arrivals');assert.equal(called[5].scheduledPlatform,'17');
});

test('late board requests and their background platform results cannot overwrite a newer refresh', async () => {
  const file='app/tools/train/station-board.tsx';let release,shown;const version={current:{departures:0,arrivals:0}};
  const first=new Promise(r=>{release=r;});let count=0;
  const run=handler('fetchBoardData',{
    stationID:'S05043',boardRequestVersion:version,getStationBoard:async()=>++count===1?first:[],
    setLoadingDep(){},setLoadingArr(){},setErrorDep(){},setErrorArr(){},setRefreshingDep(){},setRefreshingArr(){},
    setDepartures:x=>{shown=x;},setArrivals(){},getRomeTimestampFromLocalDate:()=>Date.now(),triggerBackgroundTimeLoading(){},triggerToast(){},t:k=>k,networkErrorKey:network.networkErrorKey,
  },file);
  const old=run('departures');await run('departures',true);release([{scheduledTime:Date.now()+3600000}]);await old;assert.equal(shown.length,0);
  const extraTimesKey=handler('extraTimesKey',{},file),matchPlatformFromStatus=handler('matchPlatformFromStatus',{},file);let releasePlatform;const waiting=new Promise(r=>{releasePlatform=r;});let writes=0;
  const backfill=handler('triggerBackgroundTimeLoading',{
    stationID:'S05043',boardRequestVersion:version,extraTimesKey,matchPlatformFromStatus,extraTimesCache:{current:{}},getTrainStatus:()=>waiting,setExtraTrainTimes:()=>{writes++;},
  },file);
  const pending=backfill([{trainNumber:'90041',originStationID:'S05043',timestamp:1}],'departures');version.current.departures++;
  releasePlatform({stops:[{stationId:'S05043',actualPlatform:'5'}]});await pending;assert.equal(writes,0);
});
