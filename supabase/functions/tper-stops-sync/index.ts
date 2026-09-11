import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";

const OPEN_DATA_INDEX_URL = "https://solweb.tper.it/web/tools/open-data/open-data.aspx";
const OPEN_DATA_DOWNLOAD_URL = "https://solweb.tper.it/web/tools/open-data/open-data-download.aspx";
const MIN_STOP_COUNT = 5_000;
const MAX_STOP_COUNT = 10_000;

const jsonHeaders = { "Content-Type": "application/json" };

type StopRow = {
  stop_code: string;
  stop_name: string;
  latitude: number;
  longitude: number;
  city: string;
  lines: string | null;
};

function getSecretKeys(): string[] {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return Object.values(parsed).filter((value): value is string => typeof value === "string" && value.length > 0);
}

function getAdminKey(): string {
  const key = getSecretKeys()[0];
  if (!key) throw new Error("No Supabase secret key is available.");
  return key;
}

function securelyEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

function isInternalRequest(request: Request): boolean {
  const apiKey = request.headers.get("apikey")?.trim();
  return Boolean(apiKey && getSecretKeys().some((key) => securelyEqual(apiKey, key)));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function parseDelimited(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === separator && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function recordsFromDelimited(text: string, separator: string): Record<string, string>[] {
  const rows = parseDelimited(text.replace(/^\uFEFF/, ""), separator);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])));
}

function readVersion(indexHtml: string, filename: string): string {
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = indexHtml.match(new RegExp("filename=" + escaped + "(?:&amp;|&)version=(\\d+)", "i"));
  if (!match) throw new Error("Unable to find the current " + filename + " version.");
  return match[1];
}

function downloadUrl(filename: string, version: string, format: string): string {
  const params = new URLSearchParams({ source: "solweb.tper.it", filename, version, format });
  return OPEN_DATA_DOWNLOAD_URL + "?" + params.toString();
}

async function fetchRequired(url: string): Promise<Response> {
  const response = await fetch(url, { headers: { "User-Agent": "ASSCUBO-Boxue/1.0 (+https://asscubo.it)" } });
  if (!response.ok) throw new Error("TPER request failed with HTTP " + response.status + ".");
  return response;
}

function naturalLineSort(left: string, right: string): number {
  return left.localeCompare(right, "it", { numeric: true, sensitivity: "base" });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: jsonHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!isInternalRequest(request)) return jsonResponse({ error: "Unauthorized." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return jsonResponse({ error: "Supabase server configuration is missing." }, 500);

  const supabase = createClient(supabaseUrl, getAdminKey());
  const startedAt = new Date().toISOString();

  try {
    const indexHtml = await (await fetchRequired(OPEN_DATA_INDEX_URL)).text();
    const gtfsVersion = readVersion(indexHtml, "gommagtfsbo");
    const lineStopsVersion = readVersion(indexHtml, "lineefermate");
    const force = new URL(request.url).searchParams.get("force") === "true";

    const { data: state } = await supabase
      .from("tper_stop_sync_state")
      .select("gtfs_version, line_stops_version, last_success_at")
      .eq("id", 1)
      .maybeSingle();
    if (!force && state?.gtfs_version === gtfsVersion && state?.line_stops_version === lineStopsVersion) {
      return jsonResponse({ refreshed: false, gtfsVersion, lineStopsVersion, lastSyncedAt: state.last_success_at });
    }

    const [gtfsResponse, lineStopsResponse] = await Promise.all([
      fetchRequired(downloadUrl("gommagtfsbo", gtfsVersion, "zip")),
      fetchRequired(downloadUrl("lineefermate", lineStopsVersion, "csv")),
    ]);

    const archive = new Uint8Array(await gtfsResponse.arrayBuffer());
    const files = unzipSync(archive, { filter: (file) => file.name.toLowerCase() === "stops.txt" });
    const stopsFile = Object.entries(files).find(([name]) => name.toLowerCase() === "stops.txt")?.[1];
    if (!stopsFile) throw new Error("The TPER GTFS archive does not contain stops.txt.");

    const gtfsStops = recordsFromDelimited(strFromU8(stopsFile), ",");
    const activeCodes = new Set(gtfsStops.map((row) => row.stop_id));
    if (activeCodes.size < MIN_STOP_COUNT || activeCodes.size > MAX_STOP_COUNT) {
      throw new Error("Unexpected active stop count: " + activeCodes.size + ".");
    }

    const linesByStop = new Map<string, Set<string>>();
    const cityByStop = new Map<string, string>();
    const lineStopRows = recordsFromDelimited(await lineStopsResponse.text(), ";");
    for (const row of lineStopRows) {
      const stopCode = row.codice_fermata;
      if (!activeCodes.has(stopCode)) continue;
      const line = row.codice_linea?.trim();
      if (line) {
        const lines = linesByStop.get(stopCode) ?? new Set<string>();
        lines.add(line);
        linesByStop.set(stopCode, lines);
      }
      if (row.comune) cityByStop.set(stopCode, row.comune.trim());
    }

    const stops: StopRow[] = gtfsStops.map((row) => {
      const latitude = Number(row.stop_lat);
      const longitude = Number(row.stop_lon);
      if (!row.stop_id || !row.stop_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Invalid GTFS stop row for " + (row.stop_id || "unknown stop") + ".");
      }
      const lines = [...(linesByStop.get(row.stop_id) ?? [])].sort(naturalLineSort);
      return {
        stop_code: row.stop_id,
        stop_name: row.stop_name,
        latitude,
        longitude,
        city: cityByStop.get(row.stop_id) || "Bologna",
        lines: lines.length > 0 ? lines.join(",") : null,
      };
    });

    const { data: result, error } = await supabase.rpc("replace_bus_stops_from_tper", {
      p_stops: stops,
      p_gtfs_version: gtfsVersion,
      p_line_stops_version: lineStopsVersion,
    });
    if (error) throw error;

    return jsonResponse({ refreshed: true, gtfsVersion, lineStopsVersion, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("tper_stop_sync_state").upsert({ id: 1, last_attempt_at: startedAt, last_error: message });
    return jsonResponse({ error: "Unable to refresh TPER bus stops.", detail: message }, 502);
  }
});
