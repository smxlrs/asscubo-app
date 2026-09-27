// Isolated tests: no production requests or writes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('../../student-app/node_modules/typescript');
const { PGlite } = require(process.env.EVENT_TEST_PGLITE_PATH || '@electric-sql/pglite');
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
function load(path, imports, extra = {}) {
  const context = { exports: {}, require: imports, console, Request, Response, URL, URLSearchParams,
    TextEncoder, ...extra };
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, context);
  return context.exports;
}
const zones = load('../functions/_shared/tper-stop-zones.ts').stopZones;
assert.equal(zones([{ codice: ' 1 ', codice_zona: ' 500 ' }]).get('1'), '500');
for (const value of ['', '0', '-1', 'unknown']) {
  assert.equal(zones([{ codice: '1', codice_zona: value }]).get('1'), null);
}
assert.equal(zones(['500', '501', '500'].map(codice_zona => ({ codice: '1', codice_zona }))).get('1'), null);

const stops = Array.from({ length: 5000 }, (_, i) => ({ stop_code: String(i + 1),
  stop_name: `Stop ${i + 1}`, latitude: 44.5, longitude: 11.3, city: 'Bologna', lines: '25', zone_code: '500' }));
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('test.role', true) $$;
    SELECT set_config('test.role','service_role',false);
    CREATE TABLE bus_stops(id bigserial PRIMARY KEY,stop_code text UNIQUE,stop_name text,
      latitude double precision,longitude double precision,city text,lines text);`);
  await db.exec(read('../migrations/022_tper_stops_sync.sql').split('CREATE EXTENSION')[0]);
  await db.exec(read('../migrations/045_bus_stop_zones.sql'));
  await db.exec(read('../migrations/045_bus_stop_zones.sql'));
  const sync = (rows, version) => db.query('SELECT replace_bus_stops_with_zones($1::jsonb,$2,$3,$4)',
    [JSON.stringify(rows), '1', '1', version]);
  const zone = async () => (await db.query("SELECT zone_code FROM bus_stops WHERE stop_code='1'")).rows[0].zone_code;
  await sync(stops, '1');
  assert.equal(await zone(), '500');
  stops[0].zone_code = '501';
  await sync(stops, '2');
  assert.equal(await zone(), '501');
  stops[0].zone_code = null;
  await sync(stops, '3');
  assert.equal(await zone(), null);
  await assert.rejects(sync(stops.slice(0, 10), '4'), /Unexpected stop count/);
  assert.equal((await db.query('SELECT stop_details_version FROM tper_stop_sync_state')).rows[0].stop_details_version, '3');
  assert.equal((await db.query('SELECT count(*)::int n FROM bus_stops')).rows[0].n, 5000);
  const missing = stops.map(({ zone_code, ...row }) => row);
  await assert.rejects(sync(missing, '4'), /Each stop/);
  await db.exec("SELECT set_config('test.role','authenticated',false)");
  await assert.rejects(sync(stops, '4'), /service_role/);
} finally { await db.close(); }

// Run the actual Edge handler with controlled official versions and CSV/GTFS fixtures.
for (const previous of ['2', '1', null]) {
  let handler, rpcPayload, downloads = 0;
  const client = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
      gtfs_version: '1', line_stops_version: '1', stop_details_version: previous,
    } }) }) }), upsert: async () => ({}) }),
    rpc: async (name, payload) => { assert.equal(name, 'replace_bus_stops_with_zones'); rpcPayload = payload; return { data: {} }; },
  };
  const gtfs = 'stop_id,stop_name,stop_lat,stop_lon\n' + stops.map(s => `${s.stop_code},${s.stop_name},44.5,11.3`).join('\n');
  load('../functions/tper-stops-sync/index.ts', name => {
    if (name.includes('/http/server')) return { serve: fn => { handler = fn; } };
    if (name.includes('supabase-js')) return { createClient: () => client };
    if (name.includes('fflate')) return { unzipSync: () => ({ 'stops.txt': new TextEncoder().encode(gtfs) }), strFromU8: bytes => new TextDecoder().decode(bytes) };
    if (name.includes('tper-stop-zones')) return { stopZones: zones };
    throw new Error(name);
  }, {
    Deno: { env: { get: key => key === 'SUPABASE_SECRET_KEYS' ? '{"test":"test-key"}' : 'https://local.invalid' } },
    fetch: async url => {
      const file = new URL(url).searchParams.get('filename');
      if (!file) return new Response('filename=gommagtfsbo&version=1 filename=lineefermate&version=1 filename=fermate&version=2');
      downloads++;
      return new Response(file === 'fermate' ? 'codice;codice_zona\n1;501' : file === 'lineefermate' ? 'codice_fermata;codice_linea\n1;25' : 'mock zip');
    },
  });
  const response = await handler(new Request('https://local.invalid', { method: 'POST', headers: { apikey: 'test-key' } }));
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.refreshed, previous !== '2');
  assert.equal(downloads, previous === '2' ? 0 : 3);
  if (rpcPayload) {
    assert.equal(rpcPayload.p_stop_details_version, '2');
    assert.equal(rpcPayload.p_stops[0].zone_code, '501');
    assert.equal(rpcPayload.p_stops[1].zone_code, null);
  }
}
console.log('PASS: zone parsing, 5000-stop SQL refresh/rollback/permissions, zone-only version changes, initial backfill and unchanged-version skip.');
