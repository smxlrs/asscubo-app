import { usageToolForPath, type UsageTool } from './toolUsageCatalog';

export type UsageSnapshot = {
  session_id: string; tool: UsageTool; started_at: string; last_seen_at: string; duration_ms: number;
};
export type UsageContext = { userId: string | null; token: string | null; path: string; foreground: boolean };
export type UsageTransport = {
  status(token: string, signal: AbortSignal): Promise<boolean>;
  send(token: string, snapshots: UsageSnapshot[], signal: AbortSignal): Promise<{ enabled: boolean; accepted: string[] }>;
};
type Visit = { id: string; tool: UsageTool; started: number; seen: number; duration: number; tick: number; paused: number | null };
type Dependencies = { enabled: boolean; transport: UsageTransport; now?: () => number; monotonic?: () => number; makeId?: () => string };
const MAX_DURATION = 6 * 3600_000;

// These random IDs are for deduplication only, never authentication or device identity.
const randomId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
});

export function createToolUsageTracker(deps: Dependencies) {
  const now = deps.now || Date.now;
  const monotonic = deps.monotonic || (() => globalThis.performance?.now?.() ?? Date.now());
  const makeId = deps.makeId || randomId;
  let context: UsageContext = { userId: null, token: null, path: '', foreground: false };
  let active: Visit | null = null;
  const pending = new Map<string, { snapshot: UsageSnapshot; revision: number }>();
  let revision = 0, generation = 0, disposed = false, collecting = false;
  let checkedAt = -Infinity, attemptedAt = -Infinity, retryAt = 0, failures = 0;
  let request: { controller: AbortController; generation: number } | null = null;

  const snapshot = (visit: Visit) => {
    pending.set(visit.id, { revision: ++revision, snapshot: {
      session_id: visit.id, tool: visit.tool, started_at: new Date(visit.started).toISOString(),
      last_seen_at: new Date(visit.seen).toISOString(), duration_ms: Math.floor(visit.duration),
    } });
    while (pending.size > 32) pending.delete(pending.keys().next().value!);
  };
  const settle = () => {
    if (!active || !context.foreground) return;
    const tick = monotonic();
    // A frozen JS runtime or clock jump must not turn into hours of fake usage.
    active.duration = Math.min(MAX_DURATION, active.duration + Math.min(90_000, Math.max(0, tick - active.tick)));
    active.tick = tick; active.seen = Math.max(active.seen, now());
    snapshot(active);
  };
  const start = () => {
    const tool = usageToolForPath(context.path);
    if (!collecting || !context.userId || !context.token || !context.foreground || !tool || active) return;
    active = { id: makeId(), tool, started: now(), seen: now(), duration: 0, tick: monotonic(), paused: null };
    snapshot(active);
  };
  const stopCollection = () => { collecting = false; active = null; pending.clear(); };

  return {
    setContext(next: UsageContext) {
      try {
        if (disposed || !deps.enabled) return;
        if (next.userId !== context.userId) {
          generation++; request?.controller.abort(); request = null;
          stopCollection(); checkedAt = -Infinity; attemptedAt = -Infinity; retryAt = 0; failures = 0;
        } else settle();
        const tool = usageToolForPath(next.path);
        if (active && active.tool !== tool) active = null;
        if (active && !next.foreground && context.foreground) active.paused = now();
        if (active && next.foreground && !context.foreground) {
          if (active.paused !== null && now() - active.paused > 30 * 60_000) active = null;
          else { active.tick = monotonic(); active.paused = null; }
        }
        context = { ...next };
        if (!context.userId || !context.token) stopCollection();
        else start();
      } catch { /* Optional metrics may never propagate to navigation. */ }
    },
    async tick() {
      if (disposed || !deps.enabled || !context.foreground || !context.userId || !context.token || request || now() < retryAt) return;
      const current = { controller: new AbortController(), generation };
      request = current;
      const token = context.token;
      try {
        if (now() - checkedAt >= 5 * 60_000) {
          const enabled = await deps.transport.status(token, current.controller.signal);
          if (disposed || current.generation !== generation) return;
          checkedAt = now();
          if (!enabled) { stopCollection(); return; }
          collecting = true; start();
        }
        if (!context.foreground || !collecting || now() - attemptedAt < 60_000) return;
        settle();
        const batch = [...pending.values()].slice(0, 20);
        if (!batch.length) return;
        attemptedAt = now();
        const result = await deps.transport.send(token, batch.map(entry => entry.snapshot), current.controller.signal);
        if (disposed || current.generation !== generation) return;
        if (!result.enabled) { checkedAt = now(); stopCollection(); return; }
        const acknowledged = new Set(result.accepted);
        for (const entry of batch) {
          if (acknowledged.has(entry.snapshot.session_id) && pending.get(entry.snapshot.session_id)?.revision === entry.revision) {
            pending.delete(entry.snapshot.session_id);
          }
        }
        failures = 0; retryAt = 0;
      } catch {
        if (!disposed && current.generation === generation) {
          failures = Math.min(5, failures + 1);
          retryAt = now() + Math.min(600_000, 60_000 * 2 ** (failures - 1));
        }
      } finally { if (request === current) request = null; }
    },
    dispose() {
      disposed = true; generation++; request?.controller.abort(); request = null;
      stopCollection(); context = { userId: null, token: null, path: '', foreground: false };
    },
  };
}
