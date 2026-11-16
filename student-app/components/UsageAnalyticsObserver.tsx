import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import type { createToolUsageTracker, UsageContext } from '../lib/toolUsageTracker';

// New builds collect by default. Explicit false remains an emergency build-time
// opt-out; report access is controlled separately by administrator permissions.
export const USAGE_ANALYTICS_ENABLED = process.env.EXPO_PUBLIC_USAGE_ANALYTICS_ENABLED !== 'false';
class AnalyticsBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

function ActiveObserver() {
  const path = usePathname();
  const { user, session } = useAuth();
  const tracker = useRef<ReturnType<typeof createToolUsageTracker> | null>(null);
  const latest = useRef<UsageContext>({ userId: null, token: null, path: '', foreground: false });
  latest.current = { userId: user?.id ?? null, token: session?.access_token ?? null,
    path, foreground: AppState.currentState === 'active' };

  useEffect(() => { tracker.current?.setContext(latest.current); }, [path, user?.id, session?.access_token]);
  useEffect(() => {
    let disposed = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let subscription: { remove(): void } | undefined;
    const initial = setTimeout(() => {
      if (disposed) return;
      try {
        // Keep modules in Metro's main graph; split imports can lose their IDs
        // in Expo Go. Evaluation still waits until after the initial render.
        const core: typeof import('../lib/toolUsageTracker') = require('../lib/toolUsageTracker');
        const network: typeof import('../lib/toolUsageTransport') = require('../lib/toolUsageTransport');
        const collector = core.createToolUsageTracker({ enabled: true, transport: network.createToolUsageTransport() });
        tracker.current = collector;
        collector.setContext(latest.current);
        subscription = AppState.addEventListener('change', state => {
          latest.current = { ...latest.current, foreground: state === 'active' };
          collector.setContext(latest.current);
        });
        interval = setInterval(() => { void collector.tick().catch(() => undefined); }, 60_000);
        void collector.tick().catch(() => undefined);
      } catch {
        clearInterval(interval);
        try { subscription?.remove(); } catch { /* Optional observer only. */ }
        tracker.current?.dispose(); tracker.current = null;
      }
    }, 1500);
    return () => {
      disposed = true; clearTimeout(initial); clearInterval(interval);
      try { subscription?.remove(); tracker.current?.dispose(); } catch { /* Isolated cleanup. */ }
      tracker.current = null;
    };
  }, []);
  return null;
}

export function UsageAnalyticsObserver() {
  return USAGE_ANALYTICS_ENABLED ? <AnalyticsBoundary><ActiveObserver /></AnalyticsBoundary> : null;
}
