/**
 * LiquidGlassDock.tsx
 *
 * Adaptive glass dock and slider pill:
 *
 *   iOS 26 + dev build  →  GlassView  (real UIKit Liquid Glass)
 *   iOS older / Expo Go →  BlurView   (expo-blur, tint-based frosted glass)
 *   Android             →  BlurView   (expo-blur, intensity controlled by caller)
 *
 * The previous Skia RuntimeShader approach was replaced because:
 *   1. RuntimeShader children (<Blur />) are not wired into the filter chain in
 *      @shopify/react-native-skia v2 — blur had no effect on the shader input.
 *   2. BackdropFilter in tabBarBackground cannot refract tab icons (they are
 *      drawn as foreground after the background layer).
 *   3. clip on BackdropFilter removed any outside-edge distortion entirely.
 */

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

// expo-glass-effect is iOS-only (UIKit UIVisualEffectView).
// We import lazily so Android bundler never tries to resolve native modules.
let GlassView: any = null;
let isGlassEffectAPIAvailable: (() => boolean) | null = null;
try {
  // This require will succeed on iOS dev builds; on Android the native module
  // is absent so we catch and stay on the BlurView path.
  const glassModule = require('expo-glass-effect');
  GlassView = glassModule.GlassView;
  isGlassEffectAPIAvailable = glassModule.isGlassEffectAPIAvailable;
} catch {
  // Android or unsupported environment — BlurView fallback is used below.
}

// ============================================================================
// Helpers
// ============================================================================

function glassAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  if (!isGlassEffectAPIAvailable) return false;
  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

// ============================================================================
// LiquidGlassDock — Dock bar background
// ============================================================================

interface LiquidGlassDockProps {
  width: number;
  height: number;
  cornerRadius?: number;
  isDark?: boolean;
  /**
   * Android-only: blur intensity (0–100).
   * On iOS the system controls glass appearance; this prop is ignored.
   * Default: 55
   */
  androidBlurIntensity?: number;
}

export function LiquidGlassDock({
  width,
  height,
  cornerRadius = 34,
  isDark = false,
  androidBlurIntensity = 55,
}: LiquidGlassDockProps) {
  const style = [
    StyleSheet.absoluteFill,
    { borderRadius: cornerRadius, overflow: 'hidden' as const },
  ];

  // ── iOS native Liquid Glass ─────────────────────────────────────────────
  if (glassAvailable() && GlassView) {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        // A very subtle white tint to give the capsule a slight frosted body.
        // Keep this low — the system material handles the actual glass look.
        tintColor={isDark ? '#FFFFFF10' : '#FFFFFF20'}
      />
    );
  }

  // ── iOS BlurView fallback (Expo Go / older iOS) ─────────────────────────
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        style={style}
        intensity={isDark ? 60 : 50}
        tint={isDark ? 'dark' : 'light'}
      />
    );
  }

  // ── Android BlurView ────────────────────────────────────────────────────
  const scrimColor = isDark
    ? 'rgba(30, 30, 30, 0.55)'
    : 'rgba(255, 255, 255, 0.45)';

  return (
    <BlurView
      style={style}
      intensity={androidBlurIntensity}
      tint={isDark ? 'dark' : 'light'}
    >
      {/* Scrim for legibility on Android where BlurView can be translucent */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: cornerRadius, backgroundColor: scrimColor },
        ]}
      />
    </BlurView>
  );
}

// ============================================================================
// LiquidGlassSlider — Sliding pill / active-tab indicator
// ============================================================================

interface LiquidGlassSliderProps {
  width: number;
  height: number;
  cornerRadius?: number;
  isDark?: boolean;
  /** Brand tint colour drawn on top of the glass surface */
  tintColor?: string;
  /**
   * Android-only: blur intensity (0–100).
   * Slightly lower than the dock to keep the pill visually distinct.
   * Default: 40
   */
  androidBlurIntensity?: number;
}

export function LiquidGlassSlider({
  width,
  height,
  cornerRadius = 28,
  isDark = false,
  tintColor,
  androidBlurIntensity = 40,
}: LiquidGlassSliderProps) {
  const style = [
    StyleSheet.absoluteFill,
    { borderRadius: cornerRadius, overflow: 'hidden' as const },
  ];

  const fillColor =
    tintColor ||
    (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(163, 22, 33, 0.18)');

  // ── iOS native Liquid Glass ─────────────────────────────────────────────
  if (glassAvailable() && GlassView) {
    return (
      <>
        <GlassView
          style={style}
          glassEffectStyle="regular"
          tintColor={fillColor}
        />
      </>
    );
  }

  // ── iOS BlurView fallback ───────────────────────────────────────────────
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        style={style}
        intensity={isDark ? 70 : 55}
        tint={isDark ? 'dark' : 'light'}
      >
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: fillColor, borderRadius: cornerRadius }]}
        />
      </BlurView>
    );
  }

  // ── Android BlurView ────────────────────────────────────────────────────
  return (
    <BlurView
      style={style}
      intensity={androidBlurIntensity}
      tint={isDark ? 'dark' : 'light'}
    >
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: fillColor, borderRadius: cornerRadius }]}
      />
    </BlurView>
  );
}
