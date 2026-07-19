import { useEffect, type DependencyList } from 'react';
import { BackHandler, Platform } from 'react-native';

type BackHandlerCallback = () => boolean | null | undefined;

export function useAndroidBackHandler(
  callback: BackHandlerCallback,
  deps: DependencyList = []
) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return callback() === true;
    });

    return () => subscription.remove();
  }, [callback, ...deps]);
}
