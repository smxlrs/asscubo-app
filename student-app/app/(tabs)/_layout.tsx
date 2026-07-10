import { Tabs, router } from 'expo-router';
import { View, Text, Animated, StyleSheet, Easing, Pressable, Platform, Dimensions, LayoutChangeEvent, PanResponder } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import React, { useRef, useEffect, useState } from 'react';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassBackground } from '../../components/GlassBackground';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

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
const DOCK_CONTENT_HORIZONTAL_PADDING = 8;
const DOCK_VISUAL_SIDE_INSET = DOCK_CONTENT_HORIZONTAL_PADDING;
const INITIAL_TAB_BAR_WIDTH = SCREEN_WIDTH - TAB_BAR_HORIZONTAL_INSET * 2;
const INITIAL_DOCK_CONTENT_WIDTH = INITIAL_TAB_BAR_WIDTH - DOCK_CONTENT_HORIZONTAL_PADDING * 2;

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
}: {
  borderRadius: number;
  isDark: boolean;
  compact?: boolean;
  activeBoost?: boolean;
}) {
  const boost = activeBoost ? 1.35 : 1;
  const dockVerticalGlowScale = compact ? 1 : 0.34;
  const dockTopGlowScale = compact ? 1 : 0.38;
  const topOpacity = (compact ? (isDark ? 0.11 : 0.48) : (isDark ? 0.14 : 0.72)) * boost * dockVerticalGlowScale * dockTopGlowScale;
  const sideOpacity = (compact ? (isDark ? 0.045 : 0.18) : (isDark ? 0.065 : 0.28)) * boost * dockVerticalGlowScale;
  const leftGlintOpacity = compact ? (isDark ? 0.10 : 0.36) : (isDark ? 0.055 : 0.20);
  const leftGlintWidth = compact ? (isDark ? 22 : 28) : (isDark ? 24 : 32);
  const edgeHighlightColor = compact
    ? (isDark ? `rgba(255,255,255,${activeBoost ? 0.30 : 0.19})` : `rgba(255,255,255,${activeBoost ? 0.66 : 0.48})`)
    : (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.72)');
  const bottomHighlightColor = compact
    ? (isDark ? `rgba(255,255,255,${activeBoost ? 0.32 : 0.21})` : `rgba(255,255,255,${activeBoost ? 0.72 : 0.54})`)
    : (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.28)');
  const rimColor = compact
    ? (isDark ? `rgba(255,255,255,${activeBoost ? 0.22 : 0.14})` : `rgba(60,60,67,${activeBoost ? 0.20 : 0.13})`)
    : (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(60,60,67,0.22)');

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: compact ? StyleSheet.hairlineWidth : isDark ? 1.25 : 0.75,
            borderColor: rimColor,
          },
        ]}
      />
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
            height: compact ? (isDark ? 8 : 19) : (isDark ? 2 : 5),
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
      <View
        style={styles.glassBottomRim}
      />
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

function DockOpticalTabItem({
  label,
  iconName,
  focused,
  isDark,
}: {
  label: string;
  iconName: BootstrapTabIconName;
  focused: boolean;
  isDark: boolean;
}) {
  const itemColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <View style={styles.dockOpticalTabItem}>
      <BootstrapTabIcon name={iconName} focused={focused} size={21} color={itemColor} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          styles.dockOpticalTabLabel,
          { color: itemColor, fontWeight: focused ? '600' : '400' },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function DockTabSlot({
  item,
  focused,
  empty = false,
  isDark,
}: {
  item: { label: string; iconName: BootstrapTabIconName };
  focused: boolean;
  empty?: boolean;
  isDark: boolean;
}) {
  if (empty) {
    return <View style={styles.dockOpticalTabItem} />;
  }

  return (
    <DockOpticalTabItem
      label={item.label}
      iconName={item.iconName}
      focused={focused}
      isDark={isDark}
    />
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
  const staticWidth = useSharedValue(initialSliderWidth);
  const glowColorProgress = useSharedValue(0);
  const sliderPressProgress = useSharedValue(0);

  const prevIndexRef = useRef(0);

  // Drag gesture tracking state & PanResponder factory
  const stateRef = useRef({ activeIndex, tabBarWidth });
  useEffect(() => {
    stateRef.current = { activeIndex, tabBarWidth };
  }, [activeIndex, tabBarWidth]);

  const isDraggingRef = useRef(false);
  const isReleasingRef = useRef(false);
  const startTabRef = useRef(3);
  const lastDraggedIndexRef = useRef(0);
  // Tracks the intended tab route during a continuous gesture (updates immediately)
  const navigatedTabRef = useRef(0);

  const setSliderPressed = (pressed: boolean) => {
    setIsSliderPressed(pressed);
    sliderPressProgress.value = withSpring(pressed ? 1 : 0, {
      damping: pressed ? 15 : 18,
      stiffness: pressed ? 240 : 180,
      mass: 0.75,
    });
  };

  const createPanResponder = (k: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only trigger if horizontal movement is dominant (prevents accidentally intercepting vertical scrolls)
        return stateRef.current.activeIndex === k && 
               Math.abs(gestureState.dx) > 5 && 
               Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        setIsDragging(true);
        setSliderPressed(true);
        startTabRef.current = stateRef.current.activeIndex;
        lastDraggedIndexRef.current = stateRef.current.activeIndex;
        navigatedTabRef.current = stateRef.current.activeIndex;
        setTabGestureActive(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { tabBarWidth: currentTabBarWidth } = stateRef.current;
        const dockContentWidth = Math.max(0, currentTabBarWidth - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
        const tabWidth = dockContentWidth / 4;
        const startTab = startTabRef.current;
        const startCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + (startTab + 0.5) * tabWidth;
        let dragCenterX = startCenterX + gestureState.dx;

        const minCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + 0.5 * tabWidth;
        const maxCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + 3.5 * tabWidth;
        dragCenterX = Math.max(minCenterX, Math.min(maxCenterX, dragCenterX));

        const sliderW = tabWidth - SLIDER_TAB_INSET;
        const halfWidth = sliderW / 2;

        // Wrap the real-time slider position in a tight spring.
        // This acts as a shock absorber: if the JS thread drops a frame due to router.navigate,
        // the UI thread will gracefully interpolate the position rather than freezing and jumping!
        leftPosition.value = withSpring(dragCenterX - halfWidth, { damping: 28, stiffness: 260, mass: 0.8 });
        rightPosition.value = withSpring(dragCenterX + halfWidth, { damping: 28, stiffness: 260, mass: 0.8 });

        // Smooth real-time background color transition as we drag!
        glowColorProgress.value = withSpring((dragCenterX - DOCK_CONTENT_HORIZONTAL_PADDING) / tabWidth - 0.5, { damping: 28, stiffness: 260, mass: 0.8 });

        const nearestTab = Math.round((dragCenterX - DOCK_CONTENT_HORIZONTAL_PADDING) / tabWidth - 0.5);
        const nearestTabConstrained = Math.min(3, Math.max(0, nearestTab));

        lastDraggedIndexRef.current = nearestTabConstrained;

        // If we cross a midpoint into a new tab zone, navigate to it immediately.
        if (nearestTabConstrained !== navigatedTabRef.current) {
          const targetPath = ['/(tabs)', '/(tabs)/notifications', '/(tabs)/tools', '/(tabs)/profile'][nearestTabConstrained];
          navigatedTabRef.current = nearestTabConstrained;
          
          // Defer the heavy React Navigation (unmount/mount) to the next JS tick.
          setTimeout(() => {
            router.navigate(targetPath);
          }, 16); 
        }

        // Calculate and set the opacity for EVERY tab based on its physical distance from the slider!
        // This is a revolutionary fix: because each tab has its own independent opacity value,
        // the old tab naturally fades out while the new tab naturally fades in, completely independent of
        // React Navigation's delayed render cycle. This prevents ANY possibility of flashing.
        for (let i = 0; i < 4; i++) {
          const tabCenter = DOCK_CONTENT_HORIZONTAL_PADDING + (i + 0.5) * tabWidth;
          const distFromActive = Math.abs(dragCenterX - tabCenter);
          // By dividing by 0.55 * tabWidth, at exactly the midpoint (0.5W), the opacity doesn't drop
          // completely to 0, ensuring a smoother visual handover between the old and new pages.
          const normalizedDist = Math.min(1, distFromActive / (0.55 * tabWidth));
          // Use quadratic curve for buttery smooth visual fading (1 - x^2)
          const opacityVal = Math.max(0, 1.0 - Math.pow(normalizedDist, 2));
          tabOpacities[i].setValue(opacityVal);
        }

        if (nearestTabConstrained !== stateRef.current.activeIndex) {
          setActiveIndex(nearestTabConstrained);
        }
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        isReleasingRef.current = true;
        setIsDragging(false);
        setSliderPressed(false);
        const { tabBarWidth: currentTabBarWidth } = stateRef.current;
        const dockContentWidth = Math.max(0, currentTabBarWidth - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
        const tabWidth = dockContentWidth / 4;
        const sliderW = tabWidth - SLIDER_TAB_INSET;

        const targetIndex = lastDraggedIndexRef.current;
        const tabPaths = ['/(tabs)', '/(tabs)/notifications', '/(tabs)/tools', '/(tabs)/profile'];

        // Failsafe: if we somehow released before triggering the final navigate
        if (targetIndex !== navigatedTabRef.current) {
          navigatedTabRef.current = targetIndex;
          router.navigate(tabPaths[targetIndex]);
        }

        const finalCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + (targetIndex + 0.5) * tabWidth;
        const finalLeft = finalCenterX - (sliderW / 2);
        leftPosition.value = withSpring(finalLeft, { damping: 22, stiffness: 180 });
        rightPosition.value = withSpring(finalLeft + sliderW, { damping: 22, stiffness: 180 });
        glowColorProgress.value = withSpring(targetIndex, { damping: 24, stiffness: 160 });

        // Fade all tabs to their resting states
        const animations = [];
        for (let i = 0; i < 4; i++) {
          animations.push(
            Animated.timing(tabOpacities[i], {
              toValue: i === targetIndex ? 1.0 : 0.0,
              duration: 220,
              useNativeDriver: false,
            })
          );
        }
        
        Animated.parallel(animations).start(() => {
          setTabGestureActive(false);
          isReleasingRef.current = false;
        });
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        isReleasingRef.current = true;
        setIsDragging(false);
        setSliderPressed(false);
        const { tabBarWidth: currentTabBarWidth } = stateRef.current;
        const dockContentWidth = Math.max(0, currentTabBarWidth - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
        const tabWidth = dockContentWidth / 4;
        const sliderW = tabWidth - SLIDER_TAB_INSET;

        const targetIndex = lastDraggedIndexRef.current;
        const tabPaths = ['/(tabs)', '/(tabs)/notifications', '/(tabs)/tools', '/(tabs)/profile'];

        if (targetIndex !== navigatedTabRef.current) {
          navigatedTabRef.current = targetIndex;
          router.navigate(tabPaths[targetIndex]);
        }

        const finalCenterX = DOCK_CONTENT_HORIZONTAL_PADDING + (targetIndex + 0.5) * tabWidth;
        const finalLeft = finalCenterX - (sliderW / 2);
        leftPosition.value = withSpring(finalLeft, { damping: 22, stiffness: 180 });
        rightPosition.value = withSpring(finalLeft + sliderW, { damping: 22, stiffness: 180 });
        glowColorProgress.value = withSpring(targetIndex, { damping: 24, stiffness: 160 });

        const animations = [];
        for (let i = 0; i < 4; i++) {
          animations.push(
            Animated.timing(tabOpacities[i], {
              toValue: i === targetIndex ? 1.0 : 0.0,
              duration: 220,
              useNativeDriver: false,
            })
          );
        }
        
        Animated.parallel(animations).start(() => {
          setTabGestureActive(false);
          isReleasingRef.current = false;
        });
      }
    });
  };

  const panResponder0 = useRef(createPanResponder(0)).current;
  const panResponder1 = useRef(createPanResponder(1)).current;
  const panResponder2 = useRef(createPanResponder(2)).current;
  const panResponder3 = useRef(createPanResponder(3)).current;
  const panResponders = [panResponder0, panResponder1, panResponder2, panResponder3];

  // Trigger liquid stretch and sliding animation when index or width changes
  useEffect(() => {
    if (isDraggingRef.current) {
      prevIndexRef.current = activeIndex;
      return; // Skip auto spring animations during manual gesture drags
    }
    
    // Handle tap! When tapping, snap immediately without fading.
    if (!isReleasingRef.current) {
      for (let j = 0; j < 4; j++) {
        tabOpacities[j].setValue(j === activeIndex ? 1.0 : 0.0);
      }
    }

    const dockContentWidth = Math.max(0, tabBarWidth - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
    const tabWidth = dockContentWidth / 4;
    const i = activeIndex;
    const centerX = DOCK_CONTENT_HORIZONTAL_PADDING + (i + 0.5) * tabWidth;
    const sliderW = tabWidth - SLIDER_TAB_INSET;
    const halfWidth = sliderW / 2;

    const targetLeft = centerX - halfWidth;
    const targetRight = centerX + halfWidth;

    staticWidth.value = sliderW;

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
    const left = leftPosition.value;
    const right = rightPosition.value;
    const width = Math.max(28, right - left);
    const targetW = staticWidth.value;
    const press = sliderPressProgress.value;

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
      left,
      width,
      shadowColor: activeShadowColor,
      transform: [
        { scale: 1 + press * 0.20 },
        {
          // Dynamic vertical squish on fast movement
          scaleY: withSpring(Math.max(0.85, 1 - (width - targetW) * 0.003), { damping: 18, stiffness: 180 })
        }
      ]
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

  const dockOpticalSourceStyle = useAnimatedStyle(() => {
    const left = leftPosition.value;
    const right = rightPosition.value;
    const width = Math.max(28, right - left);
    const press = sliderPressProgress.value;

    return {
      left,
      width,
      opacity: press,
      transform: [{ scale: 1 + press * 0.20 }],
    };
  });

  const sliderActiveTabContentStyle = useAnimatedStyle(() => {
    return {
      opacity: 1 - sliderPressProgress.value,
    };
  });

  const dockOpticalSourceContentStyle = useAnimatedStyle(() => {
    return {
      width: tabBarWidth,
      transform: [{ translateX: -leftPosition.value }],
    };
  });

  const tabStyle = USE_GLASSMORPHISM ? {
    position: 'absolute' as const,
    bottom: Platform.OS === 'ios' ? 24 : 16 + insets.bottom,
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
    height: 76,
    paddingBottom: 0,
  };

  const sliderBoostActive = isSliderPressed || isDragging;
  const sliderGlassBlurStep = sliderBoostActive ? 0 : Math.min(5, glassOpacityLevel + 1);

  const onTabBarLayout = (e: LayoutChangeEvent) => {
    setTabBarWidth(e.nativeEvent.layout.width);
  };

  const dockTabs: Array<{ label: string; iconName: BootstrapTabIconName }> = [
    { label: t('home'), iconName: 'home' },
    { label: t('notifications'), iconName: 'articles' },
    { label: t('tools'), iconName: 'tools' },
    { label: t('profile'), iconName: 'profile' },
  ];
  const activeDockTab = dockTabs[activeIndex] ?? dockTabs[0];
  const dockContentWidth = Math.max(0, tabBarWidth - DOCK_CONTENT_HORIZONTAL_PADDING * 2);
  const dockItemWidth = dockContentWidth / 4;

  return (
    <View style={{ flex: 1 }}>
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
              {/* 1. Liquid Glass Dock — native backdrop refraction shader */}
              <View
                style={[
                  styles.dockVisualSurface,
                  styles.glassContainerBorder,
                  {
                    shadowOpacity: 0,
                    shadowRadius: 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 0,
                    overflow: 'hidden',
                  }
                ]}
              >
                <GlassBackground borderRadius={TAB_BAR_RADIUS} isDark={isDark} blurStep={glassOpacityLevel} />
                {isDark ? <View pointerEvents="none" style={styles.darkDockBaseTint} /> : null}
                <GlassRimHighlight borderRadius={TAB_BAR_RADIUS} isDark={isDark} />
              </View>

              {sliderBoostActive ? (
                <Reanimated.View pointerEvents="none" style={[styles.dockOpticalSourceClip, dockOpticalSourceStyle]}>
                  <Reanimated.View style={[styles.dockOpticalSourceChrome, dockOpticalSourceContentStyle]}>
                    <GlassRimHighlight borderRadius={TAB_BAR_RADIUS} isDark={isDark} />
                  </Reanimated.View>
                  <Reanimated.View style={[styles.dockOpticalLayer, styles.dockOpticalSourceContent, dockOpticalSourceContentStyle]}>
                    {dockTabs.map((item) => (
                      <DockTabSlot
                        key={`dock-source-${item.iconName}`}
                        item={item}
                        focused
                        isDark={isDark}
                      />
                    ))}
                  </Reanimated.View>
                </Reanimated.View>
              ) : null}

              {/* 2. Liquid Shared Slider (with edge refraction) */}
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
                  borderRadius={SLIDER_RADIUS}
                  isDark={isDark}
                  blurStep={sliderGlassBlurStep}
                  chromaticBoost={sliderBoostActive}
                  refractionEnabled
                />
                <Reanimated.View style={[StyleSheet.absoluteFill, innerSliderStyle]} />
                <GlassRimHighlight borderRadius={SLIDER_RADIUS} isDark={isDark} compact activeBoost={sliderBoostActive} />
              </Reanimated.View>

              <View pointerEvents="none" style={styles.dockOpticalLayer}>
                {dockTabs.map((item, index) => (
                  <DockTabSlot
                    key={`dock-base-${item.iconName}`}
                    item={item}
                    focused={activeIndex === index}
                    empty={activeIndex === index}
                    isDark={isDark}
                  />
                ))}
              </View>

              <Reanimated.View
                pointerEvents="none"
                style={[
                  styles.selectedDockTabLayer,
                  {
                    left: DOCK_CONTENT_HORIZONTAL_PADDING + activeIndex * dockItemWidth,
                    width: dockItemWidth,
                  },
                  sliderActiveTabContentStyle,
                ]}
              >
                <DockOpticalTabItem
                  label={activeDockTab.label}
                  iconName={activeDockTab.iconName}
                  focused
                  isDark={isDark}
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
                <View 
                  {...panResponders[0].panHandlers}
                  style={cleanStyle}
                >
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    style={{ flex: 1, opacity: 1 }} 
                  />
                </View>
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
                <View 
                  {...panResponders[1].panHandlers}
                  style={cleanStyle}
                >
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    style={{ flex: 1, opacity: 1 }} 
                  />
                </View>
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
                <View 
                  {...panResponders[2].panHandlers}
                  style={cleanStyle}
                >
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    style={{ flex: 1, opacity: 1 }} 
                  />
                </View>
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
                <View 
                  {...panResponders[3].panHandlers}
                  style={cleanStyle}
                >
                  <Pressable 
                    {...rest} 
                    ref={ref as any}
                    android_ripple={null} 
                    style={{ flex: 1, opacity: 1 }} 
                  />
                </View>
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
    </View>
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
    left: DOCK_VISUAL_SIDE_INSET,
    right: DOCK_VISUAL_SIDE_INSET,
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
  darkDockBaseTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(120, 120, 128, 0.14)',
  },
  dockOpticalSourceClip: {
    position: 'absolute',
    top: SLIDER_TOP_INSET,
    height: SLIDER_HEIGHT,
    borderRadius: SLIDER_RADIUS,
    overflow: 'hidden',
  },
  dockOpticalSourceChrome: {
    position: 'absolute',
    top: -SLIDER_TOP_INSET,
    left: 0,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_RADIUS,
    overflow: 'hidden',
  },
  dockOpticalSourceContent: {
    position: 'absolute',
    top: -SLIDER_TOP_INSET,
    left: 0,
    height: TAB_BAR_HEIGHT,
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
  selectedDockTabLayer: {
    position: 'absolute',
    top: 0,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
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
  glassContainerBorder: {
    borderRadius: TAB_BAR_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
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
  glassBottomRim: {
    display: 'none',
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
