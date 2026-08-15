import React from 'react';
import { AccessibilityInfo, Platform, StyleSheet, UIManager, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LiquidGlassAndroidView } from './LiquidGlassAndroidView';

interface GlassBackgroundProps {
  borderRadius?: number;
  isDark?: boolean;
  blurStep?: number;
  chromaticBoost?: boolean;
  refractionEnabled?: boolean;
}

interface GlassFallbackProps {
  borderRadius: number;
  isDark: boolean;
}

// Expo Go's Android BlurView can retain an invalid backdrop after a system
// appearance change. Keeping it in a keyed subtree recreates its native view
// without remounting the tab navigator or interrupting its gesture state.
const GlassFallback: React.FC<GlassFallbackProps> = ({ borderRadius, isDark }) => (
  <View
    pointerEvents="none"
    style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
  >
    <BlurView
      style={StyleSheet.absoluteFill}
      tint={isDark ? 'dark' : Platform.OS === 'ios' ? 'extraLight' : 'light'}
      intensity={Platform.OS === 'ios' ? 90 : 65}
    />
    <LinearGradient
      colors={
        isDark
          ? ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.20)']
          : ['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.18)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  </View>
);

export const GlassBackground: React.FC<GlassBackgroundProps> = ({
  borderRadius = 34,
  isDark = false,
  blurStep = 1,
  chromaticBoost = false,
  refractionEnabled = true,
}) => {
  const [reduceTransparency, setReduceTransparency] = React.useState(false);

  React.useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
  }, []);

  if (reduceTransparency) {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor: isDark ? 'rgba(20, 20, 22, 0.76)' : 'rgba(255, 255, 255, 0.92)',
          },
        ]}
      />
    );
  }

  const nativeAvailable =
    Platform.OS === 'android' && UIManager.getViewManagerConfig('LiquidGlassView') != null;

  if (nativeAvailable) {
    return (
      <LiquidGlassAndroidView
        // Android can drop a View's RenderEffect during a system appearance
        // change. A new native view restores the shader without remounting
        // the surrounding dock, navigation state, or Reanimated gesture state.
        key={`native-${isDark ? 'dark' : 'light'}`}
        pointerEvents="none"
        borderRadius={borderRadius}
        isDark={isDark}
        blurStep={blurStep}
        chromaticBoost={chromaticBoost}
        refractionEnabled={refractionEnabled}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return <GlassFallback key={`fallback-${isDark ? 'dark' : 'light'}`} borderRadius={borderRadius} isDark={isDark} />;
};
