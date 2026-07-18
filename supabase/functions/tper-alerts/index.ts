import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const TPER_RSS_URL = "https://www.tper.it/taxonomy/term/33/all/rss.xml";
const TPER_TELEGRAM_URL = "https://t.me/s/TperInfoViabilita";
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const FALLBACK_RETENTION_DAYS = 14;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ParsedAlert = {
  source_id: string;
  title: string;
  description: string;
  source_url: string;
  published_at: string | null;
  effective_period: string | null;
  affected_lines: string[];
  location: string | null;
  expires_at: string;
  synced_at: string;
  updated_at: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, value) => String.fromCharCode(Number(value)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeTelegramText(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?\s*>/gi, " ___LINE_BREAK___ "))
    .replace(/\s*___LINE_BREAK___\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readTag(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function parseItalianDate(day: string, month: string, year?: string): Date | null {
  const months: Record<string, number> = {
    gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
    luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
  };
  const monthIndex = months[month.toLowerCase()];
  if (monthIndex === undefined) return null;
  const now = new Date();
  const fullYear = year ? Number(year.length === 2 ? `20${year}` : year) : now.getUTCFullYear();
  return new Date(Date.UTC(fullYear, monthIndex, Number(day)));
}

function extractDates(text: string): Date[] {
  const dates: Date[] = [];
  for (const match of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g)) {
    const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : new Date().getUTCFullYear();
    const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[1])));
    if (!Number.isNaN(date.getTime())) dates.push(date);
  }
  for (const match of text.matchAll(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{2,4}))?\b/gi)) {
    const date = parseItalianDate(match[1], match[2], match[3]);
    if (date) dates.push(date);
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

function extractEffectivePeriod(text: string): { period: string | null; end: Date | null } {
  const normalized = text.replace(/\s+/g, " ").trim();
  const periodMatch = /(?:dal(?:le)?|a partire dal|fino al|fino a|da\s+(?:inizio|\d))\s+/i.exec(normalized);
  const periodStart = periodMatch?.index;
  const remainder = periodStart === undefined ? "" : normalized.slice(periodStart);
  const sentenceEnd = remainder.search(/\.(?=\s+[A-ZÀ-Ö])/);
  const period = periodStart === undefined ? null : remainder.slice(0, sentenceEnd >= 0 ? sentenceEnd : 280).trim();
  const dates = extractDates(period || normalized);
  return { period, end: dates.length ? dates[dates.length - 1] : null };
}

function extractLines(text: string): string[] {
  const lines = new Set<string>();
  const candidates = text.match(/(?:linee?|linea)\s+([^\n]{1,120})/gi) || [];
  for (const candidate of candidates) {
    const body = candidate.replace(/^(?:linee?|linea)\s+/i, "");
    for (const token of body.matchAll(/\b(?:[A-Z]\d{1,3}|\d{1,3}[A-Z]?)\b/g)) {
      const value = token[0].toUpperCase();
      if (!/^20\d\d$/.test(value)) lines.add(value);
    }
  }
  return [...lines];
}

function nextDayAfter(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 2)).toISOString();
}

function fallbackExpiry(publishedAt: string | null): string {
  const base = publishedAt ? new Date(publishedAt) : new Date();
  return new Date(base.getTime() + FALLBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function parseRss(xml: string): ParsedAlert[] {
  const now = new Date().toISOString();
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  return items.flatMap((item) => {
    const title = readTag(item, "title");
    const description = readTag(item, "description");
    const sourceUrl = readTag(item, "link");
    const guid = readTag(item, "guid");
    const rawDate = readTag(item, "pubDate");
    const published = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).toISOString() : null;
    if (!title || !description || !(guid || sourceUrl)) return [];
    const effective = extractEffectivePeriod(`${title}. ${description}`);
    const location = title.match(/(?:^|\s)[#-]\s*([^:–—-]{3,80})/i)?.[1]?.trim() || null;
    return [{
      source_id: guid || sourceUrl,
      title,
      description,
      source_url: sourceUrl || TPER_RSS_URL,
      published_at: published,
      effective_period: effective.period,
      affected_lines: extractLines(`${title}. ${description}`),
      location,
      expires_at: effective.end ? nextDayAfter(effective.end) : fallbackExpiry(published),
      synced_at: now,
      updated_at: now,
    }];
  });
}

function parseTelegramChannel(html: string): ParsedAlert[] {
  const now = new Date().toISOString();
  const chunks = html.split(/<div class="tgme_widget_message_wrap[^>]*">/i).slice(1);
  return chunks.flatMap((chunk) => {
    const post = chunk.match(/data-post="TperInfoViabilita\/(\d+)"/i)?.[1];
    const textHtml = chunk.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const dateTime = chunk.match(/<time datetime="([^"]+)"/i)?.[1];
    if (!post || !textHtml) return [];

    const description = decodeTelegramText(textHtml);
    const title = (description.split("\n").find(Boolean) || "")
      .replace(/[ℹ🚌🚎*\uFE0F]/g, "")
      .trim()
      .slice(0, 220);
    if (!title || !description) return [];

    const published = dateTime && !Number.isNaN(new Date(dateTime).getTime()) ? new Date(dateTime).toISOString() : null;
    const effective = extractEffectivePeriod(`${title}. ${description}`);
    return [{
      source_id: `telegram:${post}`,
      title,
      description,
      source_url: `https://t.me/TperInfoViabilita/${post}`,
      published_at: published,
      effective_period: effective.period,
      affected_lines: extractLines(`${title}. ${description}`),
      location: title.match(/#\s*([^–—-]{3,80})/i)?.[1]?.trim() || null,
      expires_at: effective.end ? nextDayAfter(effective.end) : fallbackExpiry(published),
      synced_at: now,
      updated_at: now,
    }];
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Supabase server configuration is missing." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();
  const { data: state } = await supabase.from("tper_alert_sync_state").select("last_success_at").eq("id", 1).maybeSingle();
  if (state?.last_success_at && now.getTime() - new Date(state.last_success_at).getTime() < MIN_SYNC_INTERVAL_MS) {
    return new Response(JSON.stringify({ refreshed: false, lastSyncedAt: state.last_success_at }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const headers = { "User-Agent": "ASSCUBO-Boxue/1.0 (+https://asscubo.it)" };
    const telegramResponse = await fetch(TPER_TELEGRAM_URL, { headers });
    let parsedAlerts = telegramResponse.ok ? parseTelegramChannel(await telegramResponse.text()) : [];
    if (parsedAlerts.length === 0) {
      const rssResponse = await fetch(TPER_RSS_URL, { headers });
      if (!rssResponse.ok) throw new Error(`TPER Telegram and RSS sources are unavailable (RSS HTTP ${rssResponse.status})`);
      parsedAlerts = parseRss(await rssResponse.text());
    }
    const alerts = [...new Map(parsedAlerts.map((alert) => [alert.source_id, alert])).values()];
    const { error: upsertError } = await supabase.from("tper_service_alerts").upsert(alerts, { onConflict: "source_id" });
    if (upsertError) throw upsertError;
    const { error: cleanupError } = await supabase.from("tper_service_alerts").delete().lt("expires_at", now.toISOString());
    if (cleanupError) throw cleanupError;
    const { error: stateError } = await supabase.from("tper_alert_sync_state").upsert({ id: 1, last_success_at: now.toISOString(), last_error: null, updated_at: now.toISOString() });
    if (stateError) throw stateError;
    return new Response(JSON.stringify({ refreshed: true, count: alerts.length, lastSyncedAt: now.toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : JSON.stringify(error, Object.getOwnPropertyNames(error));
    await supabase.from("tper_alert_sync_state").upsert({ id: 1, last_error: message, updated_at: now.toISOString() });
    return new Response(JSON.stringify({ error: "Unable to refresh TPER notices.", detail: message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
