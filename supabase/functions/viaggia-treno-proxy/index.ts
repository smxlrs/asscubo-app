const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const UPSTREAM_BASE = 'http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno';

// Keep this proxy read-only and limited to the public ViaggiaTreno endpoints used by the app.
const ALLOWED_PATH = /^(?:autocompletaStazione|cercaNumeroTrenoTrenoAutocomplete|andamentoTreno|partenze|arrivi|news)\/[A-Za-z0-9._~+%: '\-]+(?:\/[A-Za-z0-9._~+%: '\-]+){0,3}$/;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function formatRomeDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${value('weekday')} ${value('month')} ${value('day')} ${value('year')} ${value('hour') === '24' ? '00' : value('hour')}:${value('minute')}:${value('second')}`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'GET') return json({ error: 'Only GET is supported' }, 405);

  const pathname = new URL(request.url).pathname;
  const endpointNames = [
    'autocompletaStazione',
    'cercaNumeroTrenoTrenoAutocomplete',
    'andamentoTreno',
    'partenze',
    'arrivi',
    'news',
  ];
  const endpointIndex = endpointNames
    .map((name) => pathname.indexOf(`/${name}/`))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const incoming = endpointIndex === undefined ? '' : pathname.slice(endpointIndex + 1);
  if (!ALLOWED_PATH.test(decodeURIComponent(incoming))) return json({ error: 'Endpoint not allowed' }, 404);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    let upstream = await fetch(`${UPSTREAM_BASE}/${incoming}`, {
      headers: { Accept: 'application/json, text/plain, */*' },
      redirect: 'manual',
      signal: controller.signal,
    });
    let body = await upstream.arrayBuffer();

    // ViaggiaTreno returns [] for a midnight/stale board timestamp. Retry
    // station boards once with the server's current Rome time so clients with
    // an incorrect device clock still receive the live board.
    const isBoard = /^(?:partenze|arrivi)\//.test(decodeURIComponent(incoming));
    if (isBoard && upstream.ok) {
      const text = new TextDecoder().decode(body).trim();
      if (text === '[]') {
        const segments = incoming.split('/');
        segments[segments.length - 1] = encodeURIComponent(formatRomeDateTime(new Date()));
        upstream = await fetch(`${UPSTREAM_BASE}/${segments.join('/')}`, {
          headers: { Accept: 'application/json, text/plain, */*' },
          redirect: 'manual',
          signal: controller.signal,
        });
        body = await upstream.arrayBuffer();
      }
    }
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', upstream.headers.get('content-type') || 'text/plain; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    return new Response(body, { status: upstream.status, headers });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Upstream timeout' : 'Upstream request failed';
    return json({ error: message }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
