const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const context = { exports: {}, Date, Intl, console, performance,
    require: name => { assert.ok(name in mocks, name); return mocks[name]; }, ...globals };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const rome = load('lib/romeTime.ts');
let deviceTime = Date.parse('2026-11-18T20:18:46Z'); // Seven hours wrong, independently of timezone.
class DeviceDate extends Date { static now() { return deviceTime; } }
const bus = load('lib/busTime.ts', { './romeTime': rome }, { Date: DeviceDate });

test('TPER server time drives Rome countdowns despite device timezone and clock errors', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['Asia/Shanghai', 'Europe/Rome', 'America/Los_Angeles']) {
      process.env.TZ = zone;
      for (const server of ['Wed, 18 Nov 2026 13:18:46 GMT', 'Thu, 18 Jun 2026 12:18:46 GMT']) {
        const clock = bus.createBusClock(server, 1000);
        assert.equal(bus.busMinutesUntil('14:20', clock, 1000), 2);
        assert.equal(bus.busMinutesUntil('14:22', clock, 1000), 4);
      }
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('countdown advances through minute boundaries using elapsed time, not later phone-clock changes', () => {
  const clock = bus.createBusClock('Wed, 18 Nov 2026 13:18:46 GMT', 1000);
  const previous = deviceTime;
  try {
    deviceTime += 10 * 3600000;
    assert.equal(bus.busMinutesUntil('14:20', clock, 14999), 2);
    assert.equal(bus.busMinutesUntil('14:20', clock, 15000), 1);
    deviceTime -= 20 * 3600000;
    assert.equal(bus.busMinutesUntil('14:20', clock, 75000), 0);
    assert.equal(bus.busMinutesUntil('14:20', clock, 135000), -1);
  } finally { deviceTime = previous; }
});

test('next-day arrivals and recently departed services retain their meaning as the response ages', () => {
  const clock = bus.createBusClock('Wed, 18 Nov 2026 22:58:00 GMT', 0);
  assert.equal(bus.busMinutesUntil('00:04', clock, 0), 6);
  assert.equal(bus.busMinutesUntil('23:57', clock, 0), -1);
  assert.equal(bus.busMinutesUntil('00:04', clock, 7 * 60000), -1);
  assert.equal(bus.busMinutesUntil('00:04', clock, 3 * 3600000), -174);
});

test('missing or invalid server Date preserves a working Rome-time fallback', () => {
  for (const header of [null, '', 'invalid']) {
    const clock = bus.createBusClock(header, 0);
    assert.equal(clock.timestamp, deviceTime);
    assert.equal(bus.busMinutesUntil('21:20', clock, 0), 2);
  }
});

test('HelloBus attaches the response server clock without changing query or arrival fields', async () => {
  let calls = 0;
  const service = load('lib/tperService.ts', {
    './busTime': bus, './supabase': { supabase: {} }, './network': {
      fetchWithDeadline: async (_url, init) => {
        calls++;
        assert(init.body.includes('<fermata>702</fermata>'));
        assert(init.body.includes('<oraHHMM></oraHHMM>'));
        return { headers: new Headers({ Date: 'Wed, 18 Nov 2026 13:18:46 GMT' }), text: async () =>
          '<QueryHellobusResult>TperHellobus: 11C DaSatellite 14:20 (Bus5753 CON PEDANA), 14A Previsto 14:22</QueryHellobusResult>' };
      }, requireSuccessfulResponse() {}, NetworkError: Error,
    },
  });
  const rows = await service.fetchBusArrivals('702');
  assert.equal(calls, 1); assert.equal(rows.length, 2);
  assert.equal(rows[0].line, '11C'); assert.equal(rows[0].type, 'satellite');
  assert.equal(rows[0].busNumber, '5753'); assert.equal(rows[0].hasRamp, true);
  assert.equal(rows[1].type, 'scheduled');
  assert.equal(rows[0].clock.timestamp, Date.parse('2026-11-18T13:18:46Z'));
  assert.equal(bus.busMinutesUntil(rows[0].time, rows[0].clock, rows[0].clock.monotonicAt), 2);
});
