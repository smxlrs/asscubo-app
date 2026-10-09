import { useSyncExternalStore } from 'react';
import { getStoreUpdateAvailable, subscribeStoreUpdate } from '../lib/storeUpdate';

export function useStoreUpdateAvailable(): boolean {
  return useSyncExternalStore(subscribeStoreUpdate, getStoreUpdateAvailable, () => false);
}
