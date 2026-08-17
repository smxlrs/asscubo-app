import { Tabs, router } from 'expo-router';
import { View, Text, Animated, StyleSheet, Easing, Pressable, Platform, Dimensions, LayoutChangeEvent } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import React, { useRef, useEffect, useState } from 'react';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import Reanimated, { runOnJS, useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { GlassBackground } from '../../components/GlassBackground';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_SCALE = 0.9;
const TAB_BAR_WIDTH_SCALE = 0.80;
const TAB_BAR_BASE_INSET = 25;
const TAB_BAR_HORIZONTAL_INSET = TAB_BAR_BASE_INSET + (SCREEN_WIDTH - TAB_BAR_BASE_INSET * 2) * ((1 - TAB_BAR_WIDTH_SCALE) / 2);
const TAB_BAR_HEIGHT = 68 * TAB_BAR_SCALE;
const TAB_BAR_RADIUS = TAB_BAR_HEIGHT / 2;
const SLIDER_TAB_INSET = 7 * TAB_BAR_SCALE;
const SLIDER_TOP_INSET = 3 * TAB_BAR_SCALE;
const SLIDER_HEIGHT = TAB_BAR_HEIGHT - SLIDER_TOP_INSET * 2;
const SLIDER_RADIUS = SLIDER_HEIGHT / 2;
const SLIDER_PRESS_GROWTH = 0.2;
const DOCK_CONTENT_HORIZONTAL_PADDING = 8;
const DOCK_VISUAL_SIDE_INSET = DOCK_CONTENT_HORIZONTAL_PADDING;
const INITIAL_TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_HORIZONTAL_INSET * 2;
const INITIAL_DOCK_CONTENT_WIDTH = INITIAL_TAB_BAR_WIDTH - DOCK_CONTENT_HORIZONTAL_PADDING * 2;
const TAB_HIT_SLOP = { top: 12, bottom: 12, left: 0, right: 0 };

const BOOTSTRAP_TAB_ICONS = {
  home: {
    outline: [
      'M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z',
    ],
    fill: [
      'M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z',
      'm8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z',
    ],
  },
  articles: {
    outline: [
      'M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5',
      'M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z',
    ],
    fill: [
      'M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1M4.5 9a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM4 10.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 1 0-1h4a.5.5 0 0 1 0 1z',
    ],
  },
  tools: {
    outline: [
      'M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zM2.5 2a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5zm6.5.5A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5zm1.5-.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z',
    ],
    fill: [
      'M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5z',
    ],
  },
  profile: {
    outline: [
      'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z',
    ],
    fill: [
      'M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    ],
  },
} as const;

type BootstrapTabIconName = keyof typeof BOOTSTRAP_TAB_ICONS;

function BootstrapTabIcon({ name, focused, color, size = 22 }: { name: BootstrapTabIconName; focused: boolean; color: string; size?: number }) {
  const paths = BOOTSTRAP_TAB_ICONS[name][focused ? 'fill' : 'outline'];
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {paths.map((d, index) => (
        <Path key={`${name}-${focused ? 'fill' : 'outline'}-${index}`} d={d} fill={color} />
      ))}
    </Svg>
  );
}

function GlassRimHighlight({
  borderRadius,
  isDark,
  compact = false,
  activeBoost = false,
  surfaceWidth,
}: {
  borderRadius: number;
  isDark: boolean;
  compact?: boolean;
  activeBoost?: boolean;
  surfaceWidth?: number;
}) {
  const boost = activeBoost ? 1.35 : 1;
  const topOpacity = (compact ? (isDark ? 0.14 : 0.48) : (isDark ? 0.20 : 0.72)) * boost;
  const sideOpacity = compact ? (isDark ? 0.035 : 0.18) : (isDark ? 0.025 : 0.28);
  const leftGlintOpacity = compact ? (isDark ? 0.07 : 0.36) : (isDark ? 0.045 : 0.20);
  const leftGlintWidth = compact ? (isDark ? 16 : 28) : (isDark ? 18 : 32);
  const bottomHighlightColor = compact
    ? (isDark ? `rgba(255,255,255,${activeBoost ? 0.32 : 0.21})` : `rgba(255,255,255,${activeBoost ? 0.72 : 0.54})`)
    : (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.50)');
  const rimColor = isDark
    ? `rgba(255,255,255,${activeBoost ? 0.22 : 0.14})`
    : `rgba(60,60,67,${activeBoost ? 0.20 : 0.13})`;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
    >
      {compact ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: rimColor,
            },
          ]}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[
          `rgba(255,255,255,${topOpacity})`,
          `rgba(255,255,255,${sideOpacity})`,
          'rgba(255,255,255,0.00)',
        ]}
        locations={isDark ? [0, 0.18, 1] : [0, 0.28, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.glassTopSheen,
          {
            height: compact ? (isDark ? 7 : 19) : (isDark ? 6 : 5),
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
          },
        ]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          `rgba(255,255,255,${leftGlintOpacity})`,
          'rgba(255,255,255,0.00)',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.glassLeftGlint,
          {
            width: leftGlintWidth,
            borderTopLeftRadius: borderRadius,
            borderBottomLeftRadius: borderRadius,
          },
        ]}
      />
      {!compact && surfaceWidth ? (
        <Svg
          pointerEvents="none"
          width={surfaceWidth}
          height={TAB_BAR_HEIGHT}
          viewBox={`0 0 ${surfaceWidth} ${TAB_BAR_HEIGHT}`}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <SvgLinearGradient id="dock-rim" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor={isDark ? '#FFFFFF' : '#3C3C43'} stopOpacity={isDark ? 0.24 : 0.24} />
              <Stop offset="0.42" stopColor={isDark ? '#FFFFFF' : '#3C3C43'} stopOpacity={isDark ? 0.08 : 0.18} />
              <Stop offset="0.70" stopColor={isDark ? '#FFFFFF' : '#3C3C43'} stopOpacity={isDark ? 0.10 : 0.22} />
              <Stop offset="1" stopColor={isDark ? '#FFFFFF' : '#3C3C43'} stopOpacity={isDark ? 0.22 : 0.30} />
            </SvgLinearGradient>
          </Defs>
          <Rect
            x={0.5}
            y={0.5}
            width={Math.max(0, surfaceWidth - 1)}
            height={TAB_BAR_HEIGHT - 1}
            rx={Math.max(0, borderRadius - 0.5)}
            ry={Math.max(0, borderRadius - 0.5)}
            fill="none"
            stroke="url(#dock-rim)"
            strokeWidth={1.05}
          />
        </Svg>
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(255,255,255,0.00)',
          `rgba(255,255,255,${sideOpacity})`,
          bottomHighlightColor,
        ]}
        locations={isDark ? [0, 0.82, 1] : [0, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.glassBottomSheen,
          {
            height: compact ? (isDark ? 8 : 19) : (isDark ? 4 : 10),
            borderBottomLeftRadius: borderRadius,
            borderBottomRightRadius: borderRadius,
          },
        ]}
      />
    </View>
  );
}

function TabIcon({ label, iconName, focused, activeColor, inactiveColor }: { label: string; iconName: BootstrapTabIconName; focused: boolean; activeColor: string; inactiveColor: string }) {
  const { tabBarStyle } = useTheme();
  const USE_GLASSMORPHISM = tabBarStyle === 'glassmorphism';
  const tabColor = focused ? activeColor : inactiveColor;
  
  // Animation values
  const widthAnim = useRef(new Animated.Value(focused ? 50 : 26)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(focused ? 1.05 : 1.0)).current;
  const [iconColor, setIconColor] = useState(tabColor);

  useEffect(() => {
    // Keep colorState in sync if theme colors change
    setIconColor(tabColor);
  }, [focused, activeColor, inactiveColor]);

  useEffect(() => {
    // Sync animation values
    Animated.parallel([
      Animated.timing(widthAnim, {
        toValue: focused ? 50 : 26,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
      Animated.timing(iconScaleAnim, {
        toValue: focused ? 1.08 : 1.0,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  return (
    <View style={[
      styles.tabIconContainer,
      USE_GLASSMORPHISM ? { height: TAB_BAR_HEIGHT, paddingTop: 12 } : { height: 76, paddingTop: 20 }
    ]}>
      <View style={styles.iconWrapper}>
        {/* Capsule Highlight Pill Background - only visible when not in glassmorphism mode */}
        {!USE_GLASSMORPHISM && (
          <Animated.View 
            style={[
              styles.pillBg, 
              { 
                backgroundColor: activeColor + '1D', // ~11% opacity primary tint
                opacity: opacityAnim,
                width: widthAnim,
                alignSelf: 'center',
              }
            ]} 
          />
        )}
        {/* Icon */}
        <Animated.View style={{ transform: [{ scale: iconScaleAnim }] }}>
          <BootstrapTabIcon name={iconName} focused={focused} size={22} color={iconColor} />
        </Animated.View>
      </View>
      <Text 
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.tabLabel, 
          { 
          color: tabColor,
            fontWeight: focused ? '600' : 'normal',
            fontSize: label.length > 4 ? 9 : 10,
            paddingHorizontal: 2,
          }
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function DockMorphIcon({
  name,
  color,
  focused,
  size = 21,
}: {
  name: BootstrapTabIconName;
  color: string;
  focused: boolean;
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <BootstrapTabIcon name={name} focused={focused} size={size} color={color} />
    </View>
  );
}

function DockMorphTabItem({
  label,
  iconName,
  isDark,
  focused,
  hideLabel = false,
  hideIcon = false,
}: {
  label: string;
  iconName: BootstrapTabIconName;
  isDark: boolean;
  focused: boolean;
  hideLabel?: boolean;
  hideIcon?: boolean;
}) {
  const itemColor = isDark ? '#FFFFFF' : '#000000';
  const iconSize = 21;

  return (
    <View style={styles.dockOpticalTabItem}>
      <View style={{ opacity: hideIcon ? 0 : 1 }}>
        <DockMorphIcon
          name={iconName}
          color={itemColor}
          focused={focused}
          size={iconSize}
        />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.dockOpticalTabLabel,
          { color: itemColor, fontWeight: '500', opacity: hideLabel ? 0 : 1 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, t, isDark, tabBarStyle, glassOpacityLevel, tabOpacities, setTabGestureActive } = useTheme();
  const insets = useSafeAreaInsets();

  // Handle quick actions routing safely after tabs layout has mounted
  useQuickActionRouting();

  const USE_GLASSMORPHISM = tabBarStyle === 'glassmorphism';
  const ExpoTabs = Tabs as any;

  // Liquid glass animations state
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabBarWidth, setTabBarWidth] = useState(INITIAL_TAB_BAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [isSliderPressed, setIsSliderPressed] = useState(false);

  // Math variables for concentric capsule alignment
  const tabWidthVal = INITIAL_DOCK_CONTENT_WIDTH / 4;
  const initialSliderWidth = tabWidthVal - SLIDER_TAB_INSET;
  const initialHalfWidth = initialSliderWidth / 2;
  const initialSliderCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + (0.5 * tabWidthVal);

  // Reanimated shared values
  const leftPosition = useSharedValue(initialSliderCenterX - initialHalfWidth);
  const rightPosition = useSharedValue(initialSliderCenterX + initialHalfWidth);
  const glowColorProgress = useSharedValue(0);
  const sliderPressProgress = useSharedValue(0);
  const tabBarWidthShared = useSharedValue(INITIAL_TAB_BAR_WIDTH);
  const activeIndexShared = useSharedValue(0);
  const dragStartCenterX = useSharedValue(initialSliderCenterX);
  const dragTargetIndex = useSharedValue(0);

  const prevIndexRef = useRef(0);
  const isDraggingRef = useRef(false);

  const setSliderPressed = (pressed: boolean) => {
    setIsSliderPressed(pressed);
    sliderPressProgress.value = withSpring(pressed ? 1 : 0, {
      damping: pressed ? 15 : 18,
      stiffness: pressed ? 240 : 180,
      mass: 0.75,
    });
  };

  const beginDockDrag = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
    setSliderPressed(true);
    setTabGestureActive(true);
  };

  const finishDockDrag = (targetIndex: number) => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setSliderPressed(false);
    setTabGestureActive(false);
    setActiveIndex(targetIndex);
    router.navigate(['/(tabs)', '/(tabs)/notifications', '/(tabs)/tools', '/(tabs)/profile'][targetIndex]);
  };

  const cancelDockDrag = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
    setSliderPressed(false);
    setTabGestureActive(false);
  };

  const createDockPanGesture = (tabIndex: number) =>
    Gesture.Pan()
      .enabled(USE_GLASSMORPHISM && activeIndex === tabIndex)
      .activeOffsetX([-6, 6])
      .failOffsetY([-18, 18])
      .onBegin(() => {
        const dockContentWidth = Math.max(0, tabBarWidthShared.value - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
        const tabWidth = dockContentWidth / 4;
        const startIndex = activeIndexShared.value;
        dragStartCenterX.value = DOCK_CONTENT_HORIZONTAL_PADDING + (startIndex + 0.5) * tabWidth;
        dragTargetIndex.value = startIndex;
        sliderPressProgress.value = withSpring(1, { damping: 15, stiffness: 240, mass: 0.75 });
        runOnJS(beginDockDrag)();
      })
      .onUpdate((event) => {
        const dockContentWidth = Math.max(0, tabBarWidthShared.value - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
        const tabWidth = dockContentWidth / 4;
        const minCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + 0.5 * tabWidth;
        const maxCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + 3.5 * tabWidth;
        const dragCenterX = Math.max(minCenterX, Math.min(maxCenterX, dragStartCenterX.value + event.translationX));
        const halfWidth = (tabWidth - SLIDER_TAB_INSET) / 2;

        // Keep the glass directly under the finger. Springs are reserved for the release snap.
        leftPosition.value = dragCenterX - halfWidth;
        rightPosition.value = dragCenterX + halfWidth;
        glowColorProgress.value = (dragCenterX - DOCK_CONTENT_HORIZONTAL_PADDING) / tabWidth - 0.5;
        dragTargetIndex.value = Math.min(3, Math.max(0, Math.round((dragCenterX - DOCK_CONTENT_HORIZONTAL_PADDING) / tabWidth - 0.5)));
      })
      .onEnd(() => {
        const dockContentWidth = Math.max(0, tabBarWidthShared.value - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
        const tabWidth = dockContentWidth / 4;
        const targetIndex = dragTargetIndex.value;
        const finalCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + (targetIndex + 0.5) * tabWidth;
        const finalLeft = finalCenterX - (tabWidth - SLIDER_TAB_INSET) / 2;

        leftPosition.value = withSpring(finalLeft, { damping: 22, stiffness: 180 });
        rightPosition.value = withSpring(finalLeft + tabWidth - SLIDER_TAB_INSET, { damping: 22, stiffness: 180 });
        glowColorProgress.value = withSpring(targetIndex, { damping: 24, stiffness: 160 });
        sliderPressProgress.value = withSpring(0, { damping: 18, stiffness: 180, mass: 0.75 });
        runOnJS(finishDockDrag)(targetIndex);
      })
      .onFinalize((_, success) => {
        if (!success) {
          sliderPressProgress.value = withSpring(0, { damping: 18, stiffness: 180, mass: 0.75 });
          runOnJS(cancelDockDrag)();
        }
      });

  const dockPanGestures = [
    createDockPanGesture(0),
    createDockPanGesture(1),
    createDockPanGesture(2),
    createDockPanGesture(3),
  ];

  // Page content stays stable while the Dock is dragged; only the navigation chrome animates.
  useEffect(() => {
    tabOpacities.forEach((opacity) => opacity.setValue(1));
  }, [tabOpacities]);

  // Trigger liquid stretch and sliding animation when index or width changes
  useEffect(() => {
    activeIndexShared.value = activeIndex;
    if (isDraggingRef.current) return;

    const dockContentWidth = Math.max(0, tabBarWidth - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
    const tabWidth = dockContentWidth / 4;
    const i = activeIndex;
    const centerX = DOCK_CONTENT_HORIZONTAL_PADDING + (i + 0.5) * tabWidth;
    const sliderW = tabWidth - SLIDER_TAB_INSET;
    const halfWidth = sliderW / 2;

    const targetLeft = centerX - halfWidth;
    const targetRight = centerX + halfWidth;

    const movingRight = i > prevIndexRef.current;

    if (movingRight) {
      rightPosition.value = withSpring(targetRight, { damping: 22, stiffness: 180 });
      leftPosition.value = withSpring(targetLeft, { damping: 25, stiffness: 150 });
    } else if (i < prevIndexRef.current) {
      leftPosition.value = withSpring(targetLeft, { damping: 22, stiffness: 180 });
      rightPosition.value = withSpring(targetRight, { damping: 25, stiffness: 150 });
    } else {
      leftPosition.value = withSpring(targetLeft, { damping: 24, stiffness: 160 });
      rightPosition.value = withSpring(targetRight, { damping: 24, stiffness: 160 });
    }

    glowColorProgress.value = withSpring(i, { damping: 24, stiffness: 160 });

    prevIndexRef.current = i;
  }, [activeIndex, tabBarWidth]);

  // Tab colors mapping
  const homeColor = isDark ? '#FFFFFF' : '#000000';
  const articlesColor = homeColor;
  const toolsColor = homeColor;
  const profileColor = homeColor;
  const inactiveTabColor = isDark ? '#FFFFFF' : '#6E6E73';

  // Animated styles for sliding highlight and inner bubble content
  const sliderStyle = useAnimatedStyle(() => {
    const baseLeft = leftPosition.value;
    const baseRight = rightPosition.value;
    const baseWidth = Math.max(28, baseRight - baseLeft);
    const press = sliderPressProgress.value;
    const expansion = baseWidth * SLIDER_PRESS_GROWTH * press;
    const visualLeft = baseLeft - expansion / 2;
    const visualWidth = baseWidth + expansion;
    const visualHeight = SLIDER_HEIGHT * (1 + press * SLIDER_PRESS_GROWTH);
    const visualTop = SLIDER_TOP_INSET - (visualHeight - SLIDER_HEIGHT) / 2;

    const activeShadowColor = interpolateColor(
      glowColorProgress.value,
      [0, 1, 2, 3],
      isDark ? [
        'rgba(255, 255, 255, 0.04)',
        'rgba(255, 255, 255, 0.04)',
        'rgba(255, 255, 255, 0.04)',
        'rgba(255, 255, 255, 0.04)'
      ] : [
        'rgba(120, 120, 128, 0.20)',
        'rgba(120, 120, 128, 0.20)',
        'rgba(120, 120, 128, 0.20)',
        'rgba(120, 120, 128, 0.20)'
      ]
    );

    return {
      left: visualLeft,
      top: visualTop,
      width: visualWidth,
      height: visualHeight,
      borderRadius: visualHeight / 2,
      shadowColor: activeShadowColor,
    };
  });

  const focusedIconClipStyle = useAnimatedStyle(() => {
    const baseWidth = Math.max(28, rightPosition.value - leftPosition.value);
    const press = sliderPressProgress.value;
    const expansionX = baseWidth * SLIDER_PRESS_GROWTH * press;
    const scaleY = 1 + SLIDER_PRESS_GROWTH * press;
    const visualHeight = SLIDER_HEIGHT * scaleY;

    return {
      left: leftPosition.value - expansionX / 2,
      top: SLIDER_TOP_INSET - (visualHeight - SLIDER_HEIGHT) / 2,
      width: baseWidth + expansionX,
      height: visualHeight,
      borderRadius: visualHeight / 2,
    };
  });

  const focusedIconContentStyle = useAnimatedStyle(() => {
    const baseWidth = Math.max(28, rightPosition.value - leftPosition.value);
    const press = sliderPressProgress.value;
    const expansionX = baseWidth * SLIDER_PRESS_GROWTH * press;
    const scaleY = 1 + SLIDER_PRESS_GROWTH * press;
    const visualHeight = SLIDER_HEIGHT * scaleY;
    const visualLeft = leftPosition.value - expansionX / 2;
    const visualTop = SLIDER_TOP_INSET - (visualHeight - SLIDER_HEIGHT) / 2;

    return {
      left: -visualLeft,
      top: -visualTop,
      width: tabBarWidthShared.value,
      height: TAB_BAR_HEIGHT,
    };
  });

  const innerSliderStyle = useAnimatedStyle(() => {
    const activeColorHex = interpolateColor(
      glowColorProgress.value,
      [0, 1, 2, 3],
      isDark ? [
        'rgba(0, 0, 0, 0.38)',  // Home Dark
        'rgba(0, 0, 0, 0.38)',  // Articles Dark
        'rgba(0, 0, 0, 0.38)',  // Tools Dark
        'rgba(0, 0, 0, 0.38)'   // Profile Dark
      ] : [
        'rgba(242, 242, 247, 0.46)',
        'rgba(242, 242, 247, 0.46)',
        'rgba(242, 242, 247, 0.46)',
        'rgba(242, 242, 247, 0.46)'
      ]
    );

    const pressedColor = isDark ? 'rgba(255, 255, 255, 0.012)' : 'rgba(255, 255, 255, 0.025)';

    return {
      backgroundColor: interpolateColor(
        sliderPressProgress.value,
        [0, 1],
        [activeColorHex, pressedColor]
      ),
    };
  }, [isDark]);

  const standardTabBarHeight =
    76 + (Platform.OS === 'android' && insets.bottom >= 40 ? insets.bottom : 0);

  const tabStyle = USE_GLASSMORPHISM ? {
    position: 'absolute' as const,
    bottom: Platform.OS === 'ios' ? 24 : Math.max(8, insets.bottom),
    left: TAB_BAR_HORIZONTAL_INSET,
    right: TAB_BAR_HORIZONTAL_INSET,
    borderRadius: TAB_BAR_RADIUS,
    height: TAB_BAR_HEIGHT,
    backgroundColor: 'transparent',
    elevation: 0,
    paddingBottom: 0,
    borderTopWidth: 0,
    borderWidth: 0,
  } : {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: standardTabBarHeight,
    paddingBottom: 0,
  };

  const sliderBoostActive = isSliderPressed || isDragging;
  // At rest the slider is one blur level above the Dock; pressing clears it for refraction.
  const sliderGlassBlurStep = sliderBoostActive
    ? 0
    : Math.min(6, glassOpacityLevel + 1);

  const onTabBarLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setTabBarWidth(width);
    tabBarWidthShared.value = width;
  };

  const dockTabs: Array<{ label: string; iconName: BootstrapTabIconName }> = [
    { label: t('home'), iconName: 'home' },
    { label: t('notifications'), iconName: 'articles' },
    { label: t('tools'), iconName: 'tools' },
    { label: t('profile'), iconName: 'profile' },
  ];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ExpoTabs
        key={tabBarStyle}
        safeAreaInsets={USE_GLASSMORPHISM ? { bottom: 0, top: 0, left: 0, right: 0 } : undefined}
        sceneContainerStyle={{ backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
        screenOptions={{
          headerShown: false,
          tabBarStyle: tabStyle,
          tabBarShowLabel: false,
          tabBarBackground: USE_GLASSMORPHISM ? () => (
            <View style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
              <View
                onLayout={onTabBarLayout}
                style={[
                  styles.dockSurfaceFrame,
                  {
                    left: 0,
                    right: 0,
                    borderRadius: TAB_BAR_RADIUS,
                    transform: [{ translateY: -8 }],
                  },
                ]}
              >
              <View
                style={[
                  styles.dockVisualSurface,
                  { left: DOCK_VISUAL_SIDE_INSET, right: DOCK_VISUAL_SIDE_INSET },
                ]}
              >
                <View style={styles.dockVisualClip}>
                  <GlassBackground
                    borderRadius={TAB_BAR_RADIUS}
                    isDark={isDark}
                    blurStep={glassOpacityLevel}
                    edgeReflection
                  />
                  {isDark ? <View pointerEvents="none" style={styles.darkDockBaseTint} /> : null}
                </View>
              </View>

              {sliderBoostActive ? (
                <>
                  {/* These remain optical sources for the pressed lens. */}
                  <View
                    pointerEvents="none"
                    style={[
                      styles.dockRimSource,
                      {
                        left: DOCK_VISUAL_SIDE_INSET,
                        right: DOCK_VISUAL_SIDE_INSET,
                      },
                    ]}
                  >
                    <GlassRimHighlight
                      borderRadius={TAB_BAR_RADIUS}
                      isDark={isDark}
                      surfaceWidth={Math.max(0, tabBarWidth - DOCK_VISUAL_SIDE_INSET * 2)}
                    />
                  </View>

                  <View pointerEvents="none" style={styles.dockOpticalLayer}>
                    {dockTabs.map((item) => (
                      <DockMorphTabItem
                        key={`dock-source-icon-${item.iconName}`}
                        label={item.label}
                        iconName={item.iconName}
                        isDark={isDark}
                        focused={false}
                        hideLabel
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {/* The pressed slider clears the page backdrop but still refracts the Dock sources above. */}
              <Reanimated.View 
                style={[
                  styles.sliderPill,
                  {
                    backgroundColor: 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    elevation: 0,
                    overflow: 'hidden',
                  },
                  sliderStyle
                ]} 
              >
                <GlassBackground
                  borderRadius={TAB_BAR_HEIGHT}
                  isDark={isDark}
                  blurStep={sliderGlassBlurStep}
                  chromaticBoost={sliderBoostActive}
                  refractionEnabled
                  edgeReflection={!sliderBoostActive}
                  excludeNestedGlass={sliderBoostActive}
                />
                <Reanimated.View style={[StyleSheet.absoluteFill, innerSliderStyle]} />
              </Reanimated.View>

              {!sliderBoostActive ? (
                <>
                  <View
                    pointerEvents="none"
                    style={[
                      styles.dockRimSource,
                      { left: DOCK_VISUAL_SIDE_INSET, right: DOCK_VISUAL_SIDE_INSET },
                    ]}
                  >
                    <GlassRimHighlight
                      borderRadius={TAB_BAR_RADIUS}
                      isDark={isDark}
                      surfaceWidth={Math.max(0, tabBarWidth - DOCK_VISUAL_SIDE_INSET * 2)}
                    />
                  </View>
                  <View pointerEvents="none" style={styles.dockOpticalLayer}>
                    {dockTabs.map((item) => (
                      <DockMorphTabItem
                        key={`dock-rest-icon-${item.iconName}`}
                        label={item.label}
                        iconName={item.iconName}
                        isDark={isDark}
                        focused={false}
                        hideLabel
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {/* Filled icons use the slider's complete capsule as one continuous mask. */}
              <Reanimated.View
                pointerEvents="none"
                style={[styles.dockFocusedIconClip, focusedIconClipStyle]}
              >
                <Reanimated.View style={[styles.dockFocusedIconContent, focusedIconContentStyle]}>
                  {dockTabs.map((item) => (
                    <DockMorphTabItem
                      key={`dock-filled-icon-${item.iconName}`}
                      label={item.label}
                      iconName={item.iconName}
                      isDark={isDark}
                      focused
                      hideLabel
                    />
                  ))}
                </Reanimated.View>
              </Reanimated.View>

              {/* Labels stay crisp and single-sourced; only icons participate in optical morphing. */}
              <View pointerEvents="none" style={styles.dockOpticalLayer}>
                {dockTabs.map((item) => (
                  <DockMorphTabItem
                    key={`dock-label-${item.iconName}`}
                    label={item.label}
                    iconName={item.iconName}
                    isDark={isDark}
                    focused={false}
                    hideIcon
                  />
                ))}
              </View>

              {/* Foreground rim keeps the slider visually above the controls without re-sampling them. */}
              <Reanimated.View
                pointerEvents="none"
                style={[
                  styles.sliderPill,
                  { backgroundColor: 'transparent', overflow: 'hidden' },
                  sliderStyle,
                ]}
              >
                <GlassRimHighlight
                  borderRadius={TAB_BAR_HEIGHT}
                  isDark={isDark}
                  compact
                  activeBoost={sliderBoostActive}
                />
              </Reanimated.View>
              </View>
            </View>
          ) : undefined,
          tabBarButton: (props: any) => {
            const { ref, style, ...rest } = props as any;
            const flatStyle = StyleSheet.flatten(style) || {};
            const { backgroundColor, ...cleanStyle } = flatStyle;
            return (
              <Pressable 
                {...rest} 
                ref={ref as any}
                android_ripple={null} 
                hitSlop={TAB_HIT_SLOP}
                style={[
                  cleanStyle,
                  { opacity: 1 }
                ]} 
              />
            );
          },
        }}
      >
        <Tabs.Screen
          name="index"
          listeners={{
            focus: () => setActiveIndex(0)
          }}
          options={{
            tabBarIcon: () => USE_GLASSMORPHISM
              ? <View style={styles.hiddenTabIconSlot} />
              : <TabIcon label={t('home')} iconName="home" focused={activeIndex === 0} activeColor={homeColor} inactiveColor={inactiveTabColor} />,
            tabBarButton: (props: any) => {
              const { ref, style, ...rest } = props as any;
              const flatStyle = StyleSheet.flatten(style) || {};
              const { backgroundColor, ...cleanStyle } = flatStyle;
              return (
                <GestureDetector gesture={dockPanGestures[0]}>
                <View style={cleanStyle}>
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    hitSlop={TAB_HIT_SLOP}
                    style={[styles.tabPressable, !USE_GLASSMORPHISM && styles.standardTabTouchPressable]}
                  />
                </View>
                </GestureDetector>
              );
            }
          }}
        />
        <Tabs.Screen
          name="notifications"
          listeners={{
            focus: () => setActiveIndex(1)
          }}
          options={{
            tabBarIcon: () => USE_GLASSMORPHISM
              ? <View style={styles.hiddenTabIconSlot} />
              : <TabIcon label={t('notifications')} iconName="articles" focused={activeIndex === 1} activeColor={articlesColor} inactiveColor={inactiveTabColor} />,
            tabBarButton: (props: any) => {
              const { ref, style, ...rest } = props as any;
              const flatStyle = StyleSheet.flatten(style) || {};
              const { backgroundColor, ...cleanStyle } = flatStyle;
              return (
                <GestureDetector gesture={dockPanGestures[1]}>
                <View style={cleanStyle}>
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    hitSlop={TAB_HIT_SLOP}
                    style={[styles.tabPressable, !USE_GLASSMORPHISM && styles.standardTabTouchPressable]}
                  />
                </View>
                </GestureDetector>
              );
            }
          }}
        />
        <Tabs.Screen
          name="tools"
          listeners={{
            focus: () => setActiveIndex(2)
          }}
          options={{
            tabBarIcon: () => USE_GLASSMORPHISM
              ? <View style={styles.hiddenTabIconSlot} />
              : <TabIcon label={t('tools')} iconName="tools" focused={activeIndex === 2} activeColor={toolsColor} inactiveColor={inactiveTabColor} />,
            tabBarButton: (props: any) => {
              const { ref, style, ...rest } = props as any;
              const flatStyle = StyleSheet.flatten(style) || {};
              const { backgroundColor, ...cleanStyle } = flatStyle;
              return (
                <GestureDetector gesture={dockPanGestures[2]}>
                <View style={cleanStyle}>
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    hitSlop={TAB_HIT_SLOP}
                    style={[styles.tabPressable, !USE_GLASSMORPHISM && styles.standardTabTouchPressable]}
                  />
                </View>
                </GestureDetector>
              );
            }
          }}
        />
        <Tabs.Screen
          name="profile"
          listeners={{
            focus: () => setActiveIndex(3)
          }}
          options={{
            tabBarIcon: () => USE_GLASSMORPHISM
              ? <View style={styles.hiddenTabIconSlot} />
              : <TabIcon label={t('profile')} iconName="profile" focused={activeIndex === 3} activeColor={profileColor} inactiveColor={inactiveTabColor} />,
            tabBarButton: (props: any) => {
              const { ref, style, ...rest } = props as any;
              const flatStyle = StyleSheet.flatten(style) || {};
              const { backgroundColor, ...cleanStyle } = flatStyle;
              return (
                <GestureDetector gesture={dockPanGestures[3]}>
                <View style={cleanStyle}>
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    hitSlop={TAB_HIT_SLOP}
                    style={[styles.tabPressable, !USE_GLASSMORPHISM && styles.standardTabTouchPressable]}
                  />
                </View>
                </GestureDetector>
              );
            }
          }}
        />
        <Tabs.Screen
          name="announcements"
          listeners={{
            focus: () => setActiveIndex(0)
          }}
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="events"
          listeners={{
            focus: () => setActiveIndex(0)
          }}
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            href: null,
          }}
        />
      </ExpoTabs>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenTabIconSlot: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  dockSurfaceFrame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'visible',
  },
  dockVisualSurface: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  dockVisualClip: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'hidden',
  },
  dockRimSource: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  dockOpticalLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: DOCK_CONTENT_HORIZONTAL_PADDING,
  },
  dockFocusedIconClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  dockFocusedIconContent: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: DOCK_CONTENT_HORIZONTAL_PADDING,
  },
  darkDockBaseTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(104, 110, 122, 0.09)',
  },
  dockOpticalTabItem: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  dockOpticalTabLabel: {
    color: '#000000',
    fontSize: 9.5,
    marginTop: 3,
    textAlign: 'center',
  },
  iconWrapper: {
    width: 56,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pillBg: {
    position: 'absolute',
    height: 28,
    borderRadius: 14,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  tabPressable: {
    flex: 1,
    opacity: 1,
  },
  standardTabTouchPressable: {
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  glassContainerBorder: {
    borderRadius: TAB_BAR_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  glassContainerInner: {
    position: 'absolute',
    top: 1.0,
    left: 1.0,
    right: 1.0,
    bottom: 1.0,
    borderRadius: 33.0,
    overflow: 'hidden',
  },
  glassTopSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  glassLeftGlint: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  glassBottomSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sliderPill: {
    position: 'absolute',
    top: SLIDER_TOP_INSET,
    height: SLIDER_HEIGHT,
    borderRadius: SLIDER_RADIUS,
  },
  sliderPillInner: {
    position: 'absolute',
    top: 0.8,
    left: 0.8,
    right: 0.8,
    bottom: 0.8,
    borderRadius: 29.2,
    overflow: 'hidden',
  },
});
