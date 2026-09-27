import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const TOKEN_KEY = '@ag_push_device_token';
const DETACH_KEY = '@ag_push_detach_pending';
let epoch = 0;
let detaching = false;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job); queue = next.catch(() => undefined); return next;
}
export async function syncPushDevice(token?: string, expectedUserId?: string | null) {
  const generation = epoch;
  return serial(async () => {
    if (generation !== epoch) return;
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    const currentToken = token || await AsyncStorage.getItem(TOKEN_KEY);
    if (!currentToken) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (generation !== epoch) return;
    if (detaching && session) return;
    if (!session) detaching = false;
    if (expectedUserId !== undefined && (session?.user.id ?? null) !== expectedUserId) return;
    const enabled = await AsyncStorage.getItem('@ag_notification_global') !== 'false';
    const quiet = await AsyncStorage.getItem('@ag_notification_dnd') === 'true';
    const pendingToken = await AsyncStorage.getItem(DETACH_KEY);
    if (pendingToken) {
      const { error } = await supabase.rpc('configure_push_device', { device_token: pendingToken === 'true' ? currentToken : pendingToken, p_enabled: enabled, p_night_quiet: quiet, p_detach: true });
      if (error) throw error;
      await AsyncStorage.removeItem(DETACH_KEY);
    }
    const { error } = await supabase.rpc('configure_push_device', { device_token: currentToken, p_enabled: enabled, p_night_quiet: quiet, p_detach: false });
    if (error) throw error;
  });
}
export async function detachPushDevice() {
  epoch++; detaching = true;
  // Persist before network I/O: an offline logout must be reconciled next time.
  const pendingToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (pendingToken) await AsyncStorage.setItem(DETACH_KEY, pendingToken);
  await serial(async () => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const { error } = await supabase.rpc('configure_push_device', {
      device_token: token, p_enabled: await AsyncStorage.getItem('@ag_notification_global') !== 'false',
      p_night_quiet: await AsyncStorage.getItem('@ag_notification_dnd') === 'true', p_detach: true,
    });
    if (error) throw error;
    await AsyncStorage.removeItem(DETACH_KEY);
  }).catch(error => { console.warn('Push device unlink pending until connection is restored:', error); });
}

export function finishPushLogout() { epoch++; detaching = false; }
export async function retryPendingPushSync() {
  if (await AsyncStorage.getItem(DETACH_KEY)) await syncPushDevice();
}
