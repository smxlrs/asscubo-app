import { requireNativeComponent, ViewProps } from 'react-native';

interface LiquidGlassViewProps extends ViewProps {
  borderRadius?: number;
  isDark?: boolean;
  blurStep?: number;
  chromaticBoost?: boolean;
  refractionEnabled?: boolean;
  edgeReflection?: boolean;
  excludeNestedGlass?: boolean;
}

export const LiquidGlassAndroidView = requireNativeComponent<LiquidGlassViewProps>('LiquidGlassView');
