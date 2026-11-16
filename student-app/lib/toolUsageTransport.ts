import { fetchWithDeadline } from './network';
import type { UsageTransport } from './toolUsageTracker';

export function createToolUsageTransport(): UsageTransport {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  async function rpc(name: string, token: string, body: object, signal: AbortSignal) {
    if (!base || !key) throw new Error('Analytics is not configured');
    const response = await fetchWithDeadline(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST', signal,
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 1500);
    if (!response.ok) throw new Error('Analytics unavailable');
    return response.json();
  }
  return {
    async status(token, signal) {
      const result = await rpc('tool_usage_collection_status', token, {}, signal);
      if (typeof result !== 'boolean') throw new Error('Invalid analytics state');
      return result;
    },
    async send(token, snapshots, signal) {
      const result = await rpc('record_tool_usage', token, { p_sessions: snapshots }, signal);
      if (typeof result?.enabled !== 'boolean' || !Array.isArray(result.accepted)
        || result.accepted.length > 20 || result.accepted.some((id: unknown) => typeof id !== 'string')) {
        throw new Error('Invalid analytics acknowledgment');
      }
      return result;
    },
  };
}
