import { requireNativeComponent, ViewProps } from 'react-native';

interface LiquidGlassViewProps extends ViewProps {
  borderRadius?: number;
  isDark?: boolean;
  blurStep?: number;
}

export const LiquidGlassAndroidView = requireNativeComponent<LiquidGlassViewProps>('LiquidGlassView');
