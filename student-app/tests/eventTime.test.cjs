const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
const code = ts.transpileModule(readFileSync(path.join(__dirname, '../lib/eventTime.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, Intl, Date };
vm.runInNewContext(code, context);
const { romeToIso, localDateInput, normalizeEventTimes } = context.exports;

test('Rome conversion accepts real transition hours and rejects the missing hour', () => {
  assert.equal(romeToIso('2026-03-29 01:30'), '2026-03-29T00:30:00.000Z');
  assert.equal(romeToIso('2026-03-29 02:30'), null);
  assert.equal(romeToIso('2026-10-25 01:30'), '2026-10-24T23:30:00.000Z');
  assert.equal(romeToIso('2026-10-25 02:30'), '2026-10-25T01:30:00.000Z');
  for (const value of ['2026-02-30 12:00', '2026-09-25 24:00', '2026-09-25 10:60', '']) assert.equal(romeToIso(value), null);
});

test('date-only activities include the entire final day and ignore hidden clock values', () => {
  const result = normalizeEventTimes({ startTime: '2026-09-28 14:35', endTime: '2026-09-30 00:00', hasEndDate: true, startHasTime: false, endHasTime: false });
  assert.equal(localDateInput(result.start), '2026-09-28 00:00');
  assert.equal(result.end, '2026-09-30T21:59:59.999Z');
});

test('single-day activities retain an explicit end clock and use the start date', () => {
  const result = normalizeEventTimes({ startTime: '2026-09-28 10:00', endTime: '2026-09-29 16:00', hasEndDate: false, startHasTime: true, endHasTime: true });
  assert.equal(localDateInput(result.end), '2026-09-28 16:00');
});

test('Rome dates stay fixed across device zones and include the full DST transition day', () => {
  const previousZone = process.env.TZ;
  try {
    for (const deviceZone of ['Asia/Shanghai', 'Europe/Rome', 'America/Los_Angeles']) {
      process.env.TZ = deviceZone;
      assert.equal(romeToIso('2026-09-28 10:00'), '2026-09-28T08:00:00.000Z');
      for (const [date, expectedHours] of [['2026-03-29', 23], ['2026-10-25', 25]]) {
        const result = normalizeEventTimes({ startTime: `${date} 14:35`, endTime: '', hasEndDate: false, startHasTime: false, endHasTime: false });
        assert.equal(new Date(result.end).getTime() - new Date(result.start).getTime() + 1, expectedHours * 3600000);
      }
    }
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});
