import { useEffect, type DependencyList } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type BackHandlerCallback = () => boolean | null | undefined;

export function useAndroidBackHandler(
  callback: BackHandlerCallback,
  deps: DependencyList = []
) {
  const { predictiveBack } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android' || predictiveBack) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return callback() === true;
    });

    return () => subscription.remove();
  }, [callback, predictiveBack, ...deps]);
}
