import AsyncStorage from '@react-native-async-storage/async-storage';

export type LogType = 'log' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  time: string;
  type: LogType;
  category: string;
  message: string;
  details?: string;
}

const DEBUG_MODE_KEY = '@ag_debug_mode';
const LOGS_KEY = '@ag_debug_logs';
const MAX_LOGS = 1000;

let logs: LogEntry[] = [];
let debugEnabled = false;
let initialized = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

function redact(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, (email) => `${email.slice(0, 2)}***@${email.split('@')[1]}`)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(access_token|refresh_token|token|password)[:=]\s*[^\s,}&]+/gi, '$1=[REDACTED]');
}

function serialize(value: unknown): string {
  if (value instanceof Error) return redact(`${value.name}: ${value.message}\n${value.stack || ''}`);
  if (typeof value === 'string') return redact(value);
  try {
    return redact(JSON.stringify(value));
  } catch {
    return redact(String(value));
  }
}

function schedulePersist() {
  if (!debugEnabled) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs)).catch(() => undefined);
  }, 600);
}

export function recordDebugEvent(category: string, message: string, details?: unknown, type: LogType = 'log') {
  if (!debugEnabled) return;
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: new Date().toISOString(),
    type,
    category,
    message: redact(message).slice(0, 1200),
    ...(details === undefined ? {} : { details: serialize(details).slice(0, 3000) }),
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS);
  schedulePersist();
}

export function getLogs(): LogEntry[] {
  return logs;
}

export async function loadLogs(): Promise<LogEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(LOGS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed)) logs = parsed.slice(-MAX_LOGS);
  } catch {
    logs = [];
  }
  return logs;
}

export async function clearLogs() {
  logs = [];
  await AsyncStorage.removeItem(LOGS_KEY);
}

export function isDebugLoggingEnabled() {
  return debugEnabled;
}

export async function setDebugLoggingEnabled(enabled: boolean) {
  debugEnabled = enabled;
  await AsyncStorage.setItem(DEBUG_MODE_KEY, String(enabled));
  if (enabled) {
    logs = [];
    recordDebugEvent('system', 'Debug logging enabled');
  }
}

export function buildLogFileContent() {
  const header = [
    'Boxue debug log',
    `Exported: ${new Date().toISOString()}`,
    `Entries: ${logs.length}`,
    'Sensitive values such as passwords, tokens, and full email addresses are redacted.',
    '',
  ].join('\n');
  const body = logs.map((entry) => {
    const details = entry.details ? ` | ${entry.details}` : '';
    return `[${entry.time}] [${entry.type.toUpperCase()}] [${entry.category}] ${entry.message}${details}`;
  }).join('\n');
  return `${header}${body}\n`;
}

function getRequestSummary(input: any, init?: any) {
  const rawUrl = typeof input === 'string' ? input : input?.url || String(input);
  const url = rawUrl.split('?')[0];
  return { method: init?.method || input?.method || 'GET', url };
}

export function initLogger() {
  if (initialized) return;
  initialized = true;

  AsyncStorage.getItem(DEBUG_MODE_KEY)
    .then(async (value) => {
      debugEnabled = value === 'true';
      if (debugEnabled) {
        await loadLogs();
        recordDebugEvent('system', 'Debug logging resumed');
      }
    })
    .catch(() => undefined);

  console.log = (...args) => {
    recordDebugEvent('console', args.map(serialize).join(' '));
    originalConsole.log.apply(console, args);
  };
  console.warn = (...args) => {
    recordDebugEvent('console', args.map(serialize).join(' '), undefined, 'warn');
    originalConsole.warn.apply(console, args);
  };
  console.error = (...args) => {
    recordDebugEvent('console', args.map(serialize).join(' '), undefined, 'error');
    originalConsole.error.apply(console, args);
  };

  const g = globalThis as any;
  if (typeof g.fetch === 'function') {
    const originalFetch = g.fetch.bind(g);
    g.fetch = async (input: any, init?: any) => {
      const request = getRequestSummary(input, init);
      const start = Date.now();
      recordDebugEvent('network', 'Request started', request);
      try {
        const response = await originalFetch(input, init);
        recordDebugEvent('network', 'Request completed', { ...request, status: response.status, ok: response.ok, durationMs: Date.now() - start }, response.ok ? 'log' : 'warn');
        return response;
      } catch (error) {
        recordDebugEvent('network', 'Request failed', { ...request, durationMs: Date.now() - start, error: serialize(error) }, 'error');
        throw error;
      }
    };
  }

  const errorUtils = g.ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      recordDebugEvent('runtime', isFatal ? 'Fatal uncaught exception' : 'Uncaught exception', error, 'error');
      previousHandler?.(error, isFatal);
    });
  }
}
