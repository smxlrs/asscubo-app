import { useEffect, type DependencyList } from 'react';
import { BackHandler, Platform } from 'react-native';
import { recordDebugEvent } from '../lib/logger';

type BackHandlerCallback = () => boolean | null | undefined;

export function useAndroidBackHandler(
  callback: BackHandlerCallback,
  deps: DependencyList = []
) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const handled = callback() === true;
      if (handled) recordDebugEvent('navigation', 'Android back handled by screen');
      return handled;
    });

    return () => subscription.remove();
  }, [callback, ...deps]);
}
