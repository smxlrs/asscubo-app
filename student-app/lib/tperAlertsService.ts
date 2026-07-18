import { supabase } from './supabase';

export type TperServiceAlert = {
  id: string;
  title: string;
  description: string;
  source_url: string;
  published_at: string | null;
  effective_period: string | null;
  affected_lines: string[];
  location: string | null;
  expires_at: string;
  synced_at: string;
};

export type TperAlertsResult = {
  alerts: TperServiceAlert[];
  available: boolean;
  lastSyncedAt: string | null;
};

export async function getTperServiceAlerts(): Promise<TperAlertsResult> {
  let lastSyncedAt: string | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('tper-alerts', { body: {} });
    if (!error && data?.lastSyncedAt) lastSyncedAt = data.lastSyncedAt;
  } catch {
    // Cached notices remain useful when the refresh endpoint is temporarily unavailable.
  }

  const { data, error } = await supabase
    .from('tper_service_alerts')
    .select('id, title, description, source_url, published_at, effective_period, affected_lines, location, expires_at, synced_at')
    .gt('expires_at', new Date().toISOString())
    .order('published_at', { ascending: false });

  if (error) return { alerts: [], available: false, lastSyncedAt };
  const alerts = (data || []) as TperServiceAlert[];
  return { alerts, available: true, lastSyncedAt: lastSyncedAt || alerts[0]?.synced_at || null };
}

function splitForTranslation(value: string): string[] {
  const pieces = value.match(/[^.!?]+[.!?]?/g) || [value];
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (`${current} ${piece}`.trim().length > 420 && current) {
      chunks.push(current.trim());
      current = piece;
    } else current += ` ${piece}`;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function translateItalianNotice(value: string): Promise<string> {
  const translated = await Promise.all(splitForTranslation(value).map(async (chunk) => {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=it|zh-CN`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation service is unavailable.');
    const payload = await response.json();
    const text = payload?.responseData?.translatedText;
    if (!text) throw new Error('Translation service returned no result.');
    return String(text).replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }));
  return translated.join(' ');
}
