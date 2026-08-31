import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const WECHAT_APPID = Deno.env.get("WECHAT_APPID");
const WECHAT_APPSECRET = Deno.env.get("WECHAT_APPSECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_WECHAT_API_BASE = "https://api.weixin.qq.com";
const CONFIGURED_WECHAT_API_BASE = Deno.env.get("WECHAT_API_BASE")?.replace(/\/$/, "");
const WECHAT_PROXY_TOKEN = Deno.env.get("WECHAT_PROXY_TOKEN");
const WECHAT_API_BASES = [...new Set([CONFIGURED_WECHAT_API_BASE, DEFAULT_WECHAT_API_BASE].filter(Boolean))] as string[];
const PUBLICATIONS_PER_RUN = clampNumber(Deno.env.get("WECHAT_SYNC_COUNT"), 20, 1, 20);
const INTERNAL_REQUEST_TIMEOUT_MS = 10_000;
const PUSH_REQUEST_TIMEOUT_MS = 15_000;
const CONFIGURED_API_TIMEOUT_MS = 12_000;
const DEFAULT_API_TIMEOUT_MS = 25_000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const SYNC_LOCK_SECONDS = 180;
const EXPO_BATCH_SIZE = 100;
const PUSH_CONCURRENCY = 4;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WeChatNewsItem = {
  title?: string;
  digest?: string;
  author?: string;
  url?: string;
  thumb_url?: string;
};

type WeChatPublication = {
  article_id?: string;
  update_time?: number;
  content?: { news_item?: WeChatNewsItem[] };
};

type SyncCandidate = {
  source_id: string;
  title: string;
  summary: string;
  link: string;
  originalLink: string;
  cover_image: string | null;
  created_at: string;
};

type InsertedArticle = {
  id: string;
  title: string;
  summary: string | null;
  link: string;
  created_at: string;
};

function clampNumber(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), min), max) : fallback;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeHtmlEntities(value = ""): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeWechatUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.hostname !== "mp.weixin.qq.com") return value;

    const biz = parsed.searchParams.get("__biz");
    const mid = parsed.searchParams.get("mid");
    const idx = parsed.searchParams.get("idx");
    const sn = parsed.searchParams.get("sn");
    if (biz && mid && idx && sn) {
      const normalized = new URL("https://mp.weixin.qq.com/s");
      normalized.searchParams.set("__biz", biz);
      normalized.searchParams.set("mid", mid);
      normalized.searchParams.set("idx", idx);
      normalized.searchParams.set("sn", sn);
      return normalized.toString();
    }
  } catch {
    // Keep the original URL when WeChat returns an unexpected format.
  }
  return value;
}

function linkVariants(value: string): string[] {
  const variants = new Set<string>();
  const add = (candidate: string) => {
    if (candidate) variants.add(candidate);
  };

  add(value);
  add(normalizeWechatUrl(value));
  try {
    add(decodeURIComponent(value));
  } catch {
    // Keep the original value when it contains malformed escape sequences.
  }
  try {
    add(decodeURIComponent(normalizeWechatUrl(value)));
  } catch {
    // Keep the normalized value when it contains malformed escape sequences.
  }
  return [...variants];
}

async function fetchJson(url: string, timeoutMs: number, init?: RequestInit): Promise<{ response: Response; data: any }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json();
  return { response, data };
}

function timeoutForApiBase(apiBase: string): number {
  return apiBase === DEFAULT_WECHAT_API_BASE ? DEFAULT_API_TIMEOUT_MS : CONFIGURED_API_TIMEOUT_MS;
}

function apiHost(apiBase: string): string {
  try {
    return new URL(apiBase).host;
  } catch {
    return "configured-api";
  }
}

function headersForApiBase(apiBase: string, headers?: HeadersInit): Headers {
  const requestHeaders = new Headers(headers);
  if (apiBase === CONFIGURED_WECHAT_API_BASE && WECHAT_PROXY_TOKEN) {
    requestHeaders.set("X-WeChat-Proxy-Token", WECHAT_PROXY_TOKEN);
  }
  return requestHeaders;
}

async function isValidServiceRoleToken(authHeader: string): Promise<boolean> {
  try {
    const probeUrl = new URL(`${SUPABASE_URL}/rest/v1/wechat_sync_state`);
    probeUrl.searchParams.set("select", "singleton");
    probeUrl.searchParams.set("limit", "1");
    const response = await fetch(probeUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: authHeader,
      },
      signal: AbortSignal.timeout(INTERNAL_REQUEST_TIMEOUT_MS),
    });
    return response.ok;
  } catch (error) {
    console.warn("Unable to validate internal scheduler token:", error);
    return false;
  }
}

async function isAuthorized(req: Request, supabase: any): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  if (authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) return true;
  if (await isValidServiceRoleToken(authHeader)) return true;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: authData, error: userError } = await supabase.auth.getUser(token);
  const user = authData?.user;
  if (userError || !user) return false;

  const [{ data: profile, error: profileError }, { data: permission, error: permissionError }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("admin_permissions").select("permission").eq("admin_id", user.id).eq("permission", "articles.sync").maybeSingle(),
  ]);

  return !profileError
    && !permissionError
    && (profile?.role === "super_admin" || (profile?.role === "admin" && permission));
}

async function getAccessToken(supabase: any, forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const { data: cached, error } = await supabase
      .from("wechat_sync_state")
      .select("access_token, access_token_expires_at")
      .eq("singleton", true)
      .single();

    if (!error && cached?.access_token && cached.access_token_expires_at) {
      const expiresAt = new Date(cached.access_token_expires_at).getTime();
      if (expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()) return cached.access_token;
    }
  }

  const failures: string[] = [];
  let tokenData: any = null;
  for (const apiBase of WECHAT_API_BASES) {
    try {
      const tokenUrl = new URL(`${apiBase}/cgi-bin/token`);
      tokenUrl.searchParams.set("grant_type", "client_credential");
      tokenUrl.searchParams.set("appid", WECHAT_APPID!);
      tokenUrl.searchParams.set("secret", WECHAT_APPSECRET!);
      const { response, data } = await fetchJson(tokenUrl.toString(), timeoutForApiBase(apiBase), {
        headers: headersForApiBase(apiBase),
      });
      if (response.ok && !data.errcode && data.access_token) {
        tokenData = data;
        break;
      }
      failures.push(`${apiHost(apiBase)}: ${data.errmsg || `HTTP ${response.status}`}`);
    } catch (error: any) {
      failures.push(`${apiHost(apiBase)}: ${error?.message || "network error"}`);
    }
  }
  if (!tokenData) throw new Error(`Failed to fetch WeChat access token: ${failures.join("; ")}`);

  const expiresIn = clampNumber(String(tokenData.expires_in || 7200), 7200, 600, 7200);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const { error: cacheError } = await supabase
    .from("wechat_sync_state")
    .update({ access_token: tokenData.access_token, access_token_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("singleton", true);
  if (cacheError) console.warn("Unable to persist WeChat access token cache:", cacheError.message);

  return tokenData.access_token;
}

async function fetchPublications(supabase: any): Promise<WeChatPublication[]> {
  let accessToken = await getAccessToken(supabase);

  for (let attempt = 0; attempt < 2; attempt++) {
    const failures: string[] = [];
    let tokenExpired = false;
    for (const apiBase of WECHAT_API_BASES) {
      try {
        const batchUrl = `${apiBase}/cgi-bin/freepublish/batchget?access_token=${encodeURIComponent(accessToken)}`;
        const { response, data } = await fetchJson(batchUrl, timeoutForApiBase(apiBase), {
          method: "POST",
          headers: headersForApiBase(apiBase, { "Content-Type": "application/json" }),
          body: JSON.stringify({ offset: 0, count: PUBLICATIONS_PER_RUN, no_content: 0 }),
        });
        if (response.ok && !data.errcode) return data.item || [];
        tokenExpired ||= data.errcode === 40014 || data.errcode === 42001;
        failures.push(`${apiHost(apiBase)}: ${data.errmsg || `HTTP ${response.status}`}`);
      } catch (error: any) {
        failures.push(`${apiHost(apiBase)}: ${error?.message || "network error"}`);
      }
    }

    if (attempt === 0 && tokenExpired) {
      accessToken = await getAccessToken(supabase, true);
      continue;
    }
    throw new Error(`Failed to fetch WeChat publications: ${failures.join("; ")}`);
  }

  return [];
}

function toCandidates(publications: WeChatPublication[]): SyncCandidate[] {
  const candidates = new Map<string, SyncCandidate>();

  for (const publication of publications) {
    const newsItems = publication.content?.news_item || [];
    newsItems.forEach((article, index) => {
      const originalLink = article.url?.trim();
      if (!originalLink) return;

      const link = normalizeWechatUrl(originalLink);
      const sourceId = publication.article_id ? `${publication.article_id}_${index}` : link;
      const timestamp = Number(publication.update_time) > 0 ? Number(publication.update_time) * 1000 : Date.now();
      candidates.set(sourceId, {
        source_id: sourceId,
        title: decodeHtmlEntities(article.title || "无标题"),
        summary: decodeHtmlEntities(article.digest || article.author || "微信公众号推文"),
        link,
        originalLink,
        cover_image: article.thumb_url || null,
        created_at: new Date(timestamp).toISOString(),
      });
    });
  }

  return [...candidates.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function findNewCandidates(supabase: any, candidates: SyncCandidate[]): Promise<SyncCandidate[]> {
  if (candidates.length === 0) return [];

  const sourceIds = candidates.map((article) => article.source_id);
  const links = [...new Set(candidates.flatMap((article) => [
    ...linkVariants(article.link),
    ...linkVariants(article.originalLink),
  ]))];
  const [sourceResult, linkResult] = await Promise.all([
    supabase.from("articles").select("source_id").eq("source", "wechat").in("source_id", sourceIds),
    supabase.from("articles").select("link").in("link", links),
  ]);

  if (sourceResult.error) throw sourceResult.error;
  if (linkResult.error) throw linkResult.error;

  const existingSourceIds = new Set((sourceResult.data || []).map((row: any) => row.source_id));
  const existingLinks = new Set((linkResult.data || []).flatMap((row: any) => linkVariants(row.link || "")));
  return candidates.filter((article) =>
    !existingSourceIds.has(article.source_id)
    && !linkVariants(article.link).some((link) => existingLinks.has(link))
    && !linkVariants(article.originalLink).some((link) => existingLinks.has(link))
  );
}

async function insertArticles(supabase: any, candidates: SyncCandidate[]): Promise<InsertedArticle[]> {
  if (candidates.length === 0) return [];

  const rows = candidates.map((article) => ({
    title: article.title,
    summary: article.summary,
    content: "微信外链文章",
    category: "general",
    cover_image: article.cover_image,
    link: article.link,
    source: "wechat",
    source_id: article.source_id,
    is_published: true,
    view_count: 0,
    created_at: article.created_at,
  }));

  const { data, error } = await supabase
    .from("articles")
    .insert(rows)
    .select("id, title, summary, link, created_at");
  if (error) throw error;
  return (data || []) as InsertedArticle[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      try {
        results[index] = { status: "fulfilled", value: await tasks[index]() };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

async function sendPushNotifications(supabase: any, articles: InsertedArticle[]): Promise<{ batches: number; failures: number }> {
  if (articles.length === 0) return { batches: 0, failures: 0 };

  const { data: tokenRows, error } = await supabase.from("push_tokens").select("token");
  if (error) throw error;

  const tokens = [...new Set((tokenRows || []).map((row: any) => row.token).filter(Boolean))] as string[];
  if (tokens.length === 0) return { batches: 0, failures: 0 };

  const newest = [...articles].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const payloads = tokens.map((token) => articles.length === 1 ? {
    to: token,
    sound: "default",
    title: `【综合通知】${newest.title}`,
    body: newest.summary || "微信公众号发布了新文章",
    data: { category: "general", link: newest.link, articleId: newest.id },
  } : {
    to: token,
    sound: "default",
    title: `新增 ${articles.length} 篇微信公众号文章`,
    body: `最新：${newest.title}`,
    data: { category: "general", link: newest.link, articleId: newest.id },
  });

  const batches = chunk(payloads, EXPO_BATCH_SIZE);
  const results = await runWithConcurrency(batches.map((batch) => async () => {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Expo push failed (${response.status}).`);
    await response.text();
  }), PUSH_CONCURRENCY);

  return { batches: batches.length, failures: results.filter((result) => result.status === "rejected").length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (!(await isAuthorized(req, supabase))) return jsonResponse({ status: "error", message: "Unauthorized" }, 401);
  if (!WECHAT_APPID || !WECHAT_APPSECRET) {
    return jsonResponse({ status: "error", message: "Missing WeChat credentials." }, 500);
  }

  const { data: claimed, error: claimError } = await supabase.rpc("claim_wechat_sync_run", {
    lock_for_seconds: SYNC_LOCK_SECONDS,
  });
  if (claimError) return jsonResponse({ status: "error", message: claimError.message }, 500);
  if (!claimed) return jsonResponse({ status: "busy", synced: 0, skipped: 0, message: "A WeChat sync is already running." }, 202);

  const trigger = req.headers.get("X-Sync-Trigger") === "manual" ? "manual" : "automatic";
  let runId: string | null = null;
  const { data: run, error: runError } = await supabase
    .from("wechat_sync_runs")
    .insert({ trigger, status: "running" })
    .select("id")
    .single();
  if (runError) console.error("Unable to create WeChat sync history record:", runError.message);
  else runId = run?.id || null;

  let result: Record<string, unknown> = { status: "error", synced: 0, skipped: 0 };
  try {
    const publications = await fetchPublications(supabase);
    const candidates = toCandidates(publications);
    const newCandidates = await findNewCandidates(supabase, candidates);
    const inserted = await insertArticles(supabase, newCandidates);

    let push = { batches: 0, failures: 0 };
    try {
      push = await sendPushNotifications(supabase, inserted);
    } catch (pushError) {
      push = { batches: 0, failures: 1 };
      console.error("Articles were saved but push delivery failed:", pushError);
    }

    result = {
      status: "success",
      fetched: candidates.length,
      synced: inserted.length,
      skipped: candidates.length - newCandidates.length,
      push_batches: push.batches,
      push_failures: push.failures,
    };
    return jsonResponse(result);
  } catch (error: any) {
    console.error("Fatal WeChat sync error:", error);
    result = { ...result, message: error?.message || "Internal Server Error" };
    return jsonResponse(result, 500);
  } finally {
    const { error: finishError } = await supabase.rpc("finish_wechat_sync_run", { sync_result: result });
    if (finishError) console.error("Unable to release WeChat sync lock:", finishError.message);
    if (runId) {
      const status = result.status === "success" ? "success" : "error";
      const { error: historyError } = await supabase
        .from("wechat_sync_runs")
        .update({ completed_at: new Date().toISOString(), status, result })
        .eq("id", runId);
      if (historyError) console.error("Unable to update WeChat sync history record:", historyError.message);
    }
  }
});
