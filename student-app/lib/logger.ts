export interface LogEntry {
  time: string;
  type: 'log' | 'warn' | 'error';
  message: string;
}

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

export function getLogs(): LogEntry[] {
  const g = globalThis as any;
  if (!g.__appLogs) {
    g.__appLogs = [];
  }
  return g.__appLogs;
}

function formatMessage(args: any[]): string {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

export function initLogger() {
  const g = globalThis as any;
  if (g.__loggerInitialized) return;
  g.__loggerInitialized = true;

  console.log = (...args) => {
    const msg = formatMessage(args);
    const logs = getLogs();
    logs.push({ time: new Date().toISOString(), type: 'log', message: msg });
    if (logs.length > 300) {
      logs.shift();
    }
    originalLog.apply(console, args);
  };

  console.warn = (...args) => {
    const msg = formatMessage(args);
    const logs = getLogs();
    logs.push({ time: new Date().toISOString(), type: 'warn', message: msg });
    if (logs.length > 300) {
      logs.shift();
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    const msg = formatMessage(args);
    const logs = getLogs();
    logs.push({ time: new Date().toISOString(), type: 'error', message: msg });
    if (logs.length > 300) {
      logs.shift();
    }
    originalError.apply(console, args);
  };
}
