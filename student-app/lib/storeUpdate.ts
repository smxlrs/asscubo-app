import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { fetchAppStoreVersion, type AppStoreLookupResult } from './appStoreUpdate';
import { recordDebugEvent } from './logger';

export type StoreUpdateResult = {
  status: 'available' | 'up_to_date' | 'unavailable';
  listing?: AppStoreLookupResult;
};

export function compareVersions(left: string, right: string): number {
  const a = left.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  const b = right.split(/[.-]/).map(part => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

let available = false;
let sequence = 0;
let confirmedSequence = 0;
let coldStartCheck: Promise<StoreUpdateResult> | undefined;
const listeners = new Set<() => void>();

export const getStoreUpdateAvailable = () => available;
export function subscribeStoreUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Native Play checks cannot be aborted, so bound the wait and ignore late results.
async function checkPlayStore(signal: AbortSignal): Promise<StoreUpdateResult> {
  const native = NativeModules.PlayStoreUpdate as {
    checkForUpdate?: () => Promise<string>;
  } | undefined;
  if (!native?.checkForUpdate) return { status: 'unavailable' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => reject(new Error('Store update check cancelled'));
    signal.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => reject(new Error('Store update check timed out')), 12_000);
  });
  try {
    if (signal.aborted) throw new Error('Store update check cancelled');
    const status = await Promise.race([native.checkForUpdate(), interrupted]);
    return { status: status === 'available' || status === 'up_to_date' ? status : 'unavailable' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export async function checkStoreUpdate(signal: AbortSignal = new AbortController().signal): Promise<StoreUpdateResult> {
  const request = ++sequence;
  let result: StoreUpdateResult;
  try {
    if (signal.aborted) return { status: 'unavailable' };
    if (Platform.OS === 'android') {
      result = await checkPlayStore(signal);
    } else if (Platform.OS === 'ios') {
      const listing = await fetchAppStoreVersion(
        Constants.expoConfig?.extra?.appStoreId as string | undefined,
        Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.asscuboxue.app',
        signal,
      );
      result = listing?.version ? {
        status: compareVersions(listing.version, Constants.expoConfig?.version ?? '0') > 0 ? 'available' : 'up_to_date',
        listing,
      } : { status: 'unavailable' };
    } else {
      result = { status: 'unavailable' };
    }
  } catch (error) {
    recordDebugEvent('update', 'Store update check unavailable', error, 'warn');
    return { status: 'unavailable' };
  }
  if (signal.aborted) return { status: 'unavailable' };
  // A failed check cannot erase a confirmed update. Newer confirmations win.
  if (result.status !== 'unavailable' && request >= confirmedSequence) {
    confirmedSequence = request;
    const next = result.status === 'available';
    if (next !== available) {
      available = next;
      listeners.forEach(listener => listener());
    }
  }
  recordDebugEvent('update', 'Store update check completed', { status: result.status, platform: Platform.OS });
  return result;
}

// Module state lasts for this process. Foregrounding or layout remounting does
// not trigger another automatic check; a true cold start creates fresh state.
export function checkStoreUpdateOnColdStart(): Promise<StoreUpdateResult> {
  if (!coldStartCheck) coldStartCheck = checkStoreUpdate();
  return coldStartCheck;
}
