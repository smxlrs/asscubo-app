import { Tabs, router } from 'expo-router';
import { View, Text, Animated, StyleSheet, Easing, Pressable, Platform, Dimensions, LayoutChangeEvent, PanResponder } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState } from 'react';
import { BlurView, BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const INITIAL_TAB_BAR_WIDTH = SCREEN_WIDTH - 40;

function interpolateColorJS(value: number, color1: string, color2: string): string {
  const hex = (c: string) => {
    const raw = c.replace('#', '');
    if (raw.length === 3) {
      return raw.split('').map(x => x + x).join('');
    }
    return raw;
  };
  
  const h1 = hex(color1);
  const h2 = hex(color2);
  
  const r1 = parseInt(h1.substring(0, 2), 16);
  const g1 = parseInt(h1.substring(2, 4), 16);
  const b1 = parseInt(h1.substring(4, 6), 16);
  
  const r2 = parseInt(h2.substring(0, 2), 16);
  const g2 = parseInt(h2.substring(2, 4), 16);
  const b2 = parseInt(h2.substring(4, 6), 16);
  
  const r = Math.round(r1 + (r2 - r1) * value);
  const g = Math.round(g1 + (g2 - g1) * value);
  const b = Math.round(b1 + (b2 - b1) * value);
  
  const clamp = (val: number) => Math.max(0, Math.min(255, val));
  const toHex = (val: number) => clamp(val).toString(16).padStart(2, '0');
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function TabIcon({ label, iconName, focused, activeColor, inactiveColor }: { label: string; iconName: string; focused: boolean; activeColor: string; inactiveColor: string }) {
  const { tabBarStyle } = useTheme();
  const USE_GLASSMORPHISM = tabBarStyle === 'glassmorphism';
  let name = focused ? iconName : `${iconName}-outline`;
  if (iconName === 'newspaper' && !focused) {
    name = 'newspaper-variant-outline';
  }
  
  // Animation values
  const widthAnim = useRef(new Animated.Value(focused ? 50 : 26)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const iconScaleAnim = useRef(new Animated.Value(focused ? 1.05 : 1.0)).current;
  const colorAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  // Local state to hold the interpolated color to avoid setNativeProps crashes
  const [iconColor, setIconColor] = useState(focused ? activeColor : inactiveColor);

  useEffect(() => {
    // Keep colorState in sync if theme colors change
    setIconColor(focused ? activeColor : inactiveColor);
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
      Animated.timing(colorAnim, {
        toValue: focused ? 1 : 0,
        duration: 180,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  useEffect(() => {
    const listenerId = colorAnim.addListener(({ value }) => {
      const color = interpolateColorJS(value, inactiveColor, activeColor);
      setIconColor(color);
    });
    return () => {
      colorAnim.removeListener(listenerId);
    };
  }, [inactiveColor, activeColor]);

  return (
    <View style={[
      styles.tabIconContainer,
      USE_GLASSMORPHISM ? { height: 68, paddingTop: 13 } : { height: 76, paddingTop: 20 }
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
          <MaterialCommunityIcons 
            name={name as any} 
            size={22} 
            color={iconColor} 
          />
        </Animated.View>
      </View>
      <Text style={[
        styles.tabLabel, 
        { 
          color: iconColor,
          fontWeight: focused ? '600' : 'normal' 
        }
      ]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, t, isDark, tabBarStyle, tabGestureOpacity, setTabGestureActive } = useTheme();
  const USE_GLASSMORPHISM = tabBarStyle === 'glassmorphism';
  const USE_NATIVE_GLASS = Platform.OS === 'ios' && isGlassEffectAPIAvailable();
  const blurTargetRef = useRef(null);
  const ExpoTabs = Tabs as any;

  // Liquid glass animations state
  const [activeIndex, setActiveIndex] = useState(0);
  const [tabBarWidth, setTabBarWidth] = useState(INITIAL_TAB_BAR_WIDTH);

  // Math variables for concentric capsule alignment
  const tabWidthVal = INITIAL_TAB_BAR_WIDTH / 4;
  const initialSliderWidth = tabWidthVal - 12;
  const initialHalfWidth = initialSliderWidth / 2;

  // Reanimated shared values
  const leftPosition = useSharedValue((0.5 * tabWidthVal) - initialHalfWidth);
  const rightPosition = useSharedValue((0.5 * tabWidthVal) + initialHalfWidth);
  const staticWidth = useSharedValue(initialSliderWidth);
  const glowColorProgress = useSharedValue(0);

  const prevIndexRef = useRef(0);

  // Drag gesture tracking state & PanResponder factory
  const stateRef = useRef({ activeIndex, tabBarWidth });
  useEffect(() => {
    stateRef.current = { activeIndex, tabBarWidth };
  }, [activeIndex, tabBarWidth]);

  const isDraggingRef = useRef(false);
  const startTabRef = useRef(3);

  const createPanResponder = (k: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current.activeIndex === k,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return stateRef.current.activeIndex === k && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        startTabRef.current = stateRef.current.activeIndex;
        setTabGestureActive(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { tabBarWidth: currentTabBarWidth } = stateRef.current;
        const tabWidth = currentTabBarWidth / 4;
        const startTab = startTabRef.current;
        const startCenterX = (startTab + 0.5) * tabWidth;
        let dragCenterX = startCenterX + gestureState.dx;

        const minCenterX = 0.5 * tabWidth;
        const maxCenterX = 3.5 * tabWidth;
        dragCenterX = Math.max(minCenterX, Math.min(maxCenterX, dragCenterX));

        const sliderW = tabWidth - 12;
        const halfWidth = sliderW / 2;

        leftPosition.value = dragCenterX - halfWidth;
        rightPosition.value = dragCenterX + halfWidth;

        // Smooth real-time background color transition as we drag!
        glowColorProgress.value = dragCenterX / tabWidth - 0.5;

        const nearestTab = Math.round(dragCenterX / tabWidth - 0.5);
        const nearestTabConstrained = Math.min(3, Math.max(0, nearestTab));

        const nearestCenter = (nearestTabConstrained + 0.5) * tabWidth;
        const dist = Math.abs(dragCenterX - nearestCenter);
        const opacityVal = Math.max(0, Math.min(1, 1.0 - dist / (0.5 * tabWidth)));

        tabGestureOpacity.setValue(opacityVal);

        if (nearestTabConstrained !== stateRef.current.activeIndex) {
          setActiveIndex(nearestTabConstrained);
        }
      },
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        const { tabBarWidth: currentTabBarWidth, activeIndex: currentActiveIndex } = stateRef.current;
        const tabWidth = currentTabBarWidth / 4;
        const sliderW = tabWidth - 12;

        // Perform the screen replacement ONLY when the drag finishes
        const tabPaths = ['/(tabs)', '/(tabs)/notifications', '/(tabs)/tools', '/(tabs)/profile'];
        router.replace(tabPaths[currentActiveIndex]);

        const finalCenterX = (currentActiveIndex + 0.5) * tabWidth;
        const finalLeft = finalCenterX - (sliderW / 2);
        leftPosition.value = withSpring(finalLeft, { damping: 22, stiffness: 180 });
        rightPosition.value = withSpring(finalLeft + sliderW, { damping: 22, stiffness: 180 });
        glowColorProgress.value = withSpring(currentActiveIndex, { damping: 24, stiffness: 160 });

        Animated.timing(tabGestureOpacity, {
          toValue: 1.0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setTabGestureActive(false);
        });
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        const { tabBarWidth: currentTabBarWidth, activeIndex: currentActiveIndex } = stateRef.current;
        const tabWidth = currentTabBarWidth / 4;
        const sliderW = tabWidth - 12;

        // Perform the screen replacement on termination
        const tabPaths = ['/(tabs)', '/(tabs)/notifications', '/(tabs)/tools', '/(tabs)/profile'];
        router.replace(tabPaths[currentActiveIndex]);

        const finalCenterX = (currentActiveIndex + 0.5) * tabWidth;
        const finalLeft = finalCenterX - (sliderW / 2);
        leftPosition.value = withSpring(finalLeft, { damping: 22, stiffness: 180 });
        rightPosition.value = withSpring(finalLeft + sliderW, { damping: 22, stiffness: 180 });
        glowColorProgress.value = withSpring(currentActiveIndex, { damping: 24, stiffness: 160 });

        Animated.timing(tabGestureOpacity, {
          toValue: 1.0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setTabGestureActive(false);
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
    const tabWidth = tabBarWidth / 4;
    const i = activeIndex;
    const centerX = (i + 0.5) * tabWidth;
    const sliderW = tabWidth - 12;
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
  const homeColor = isDark ? '#E5E5EA' : colors.primary; // Softer Off-White / Crimson Red
  const articlesColor = homeColor;
  const toolsColor = homeColor;
  const profileColor = homeColor;
  const inactiveTabColor = isDark ? '#8E8E93' : colors.textMuted; // Gray-white in dark mode, textMuted in light mode

  // Animated styles for sliding highlight and inner bubble content
  const sliderStyle = useAnimatedStyle(() => {
    const left = leftPosition.value;
    const right = rightPosition.value;
    const width = Math.max(28, right - left);
    const targetW = staticWidth.value;

    const activeShadowColor = interpolateColor(
      glowColorProgress.value,
      [0, 1, 2, 3],
      isDark ? [
        'rgba(255, 255, 255, 0.08)',
        'rgba(255, 255, 255, 0.08)',
        'rgba(255, 255, 255, 0.08)',
        'rgba(255, 255, 255, 0.08)'
      ] : [
        'rgba(163, 22, 33, 0.3)',
        'rgba(163, 22, 33, 0.3)',
        'rgba(163, 22, 33, 0.3)',
        'rgba(163, 22, 33, 0.3)'
      ]
    );

    return {
      left,
      width,
      shadowColor: activeShadowColor,
      transform: [
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
        'rgba(255, 255, 255, 0.15)',  // Home Dark
        'rgba(255, 255, 255, 0.15)',  // Articles Dark
        'rgba(255, 255, 255, 0.15)',  // Tools Dark
        'rgba(255, 255, 255, 0.15)'   // Profile Dark
      ] : [
        'rgba(163, 22, 33, 0.20)',  // Home Red (Brighter on white bg)
        'rgba(163, 22, 33, 0.20)',  // Articles Red
        'rgba(163, 22, 33, 0.20)',  // Tools Red
        'rgba(163, 22, 33, 0.20)'   // Profile Red
      ]
    );

    return {
      backgroundColor: activeColorHex,
    };
  }, [isDark]);

  const tabStyle = USE_GLASSMORPHISM ? {
    position: 'absolute' as const,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    borderRadius: 34, // Capsule ends (height 68 / 2)
    height: 68,
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

  const onTabBarLayout = (e: LayoutChangeEvent) => {
    setTabBarWidth(e.nativeEvent.layout.width);
  };

  return (
    <BlurTargetView 
      ref={blurTargetRef} 
      style={{ flex: 1 }}
    >
      <ExpoTabs
        safeAreaInsets={USE_GLASSMORPHISM ? { bottom: 0, top: 0, left: 0, right: 0 } : undefined}
        sceneContainerStyle={{ backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}
        screenOptions={{
          headerShown: false,
          tabBarStyle: tabStyle,
          tabBarShowLabel: false,
          tabBarBackground: USE_GLASSMORPHISM ? () => (
            <View 
              onLayout={onTabBarLayout}
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: 34, // Capsule ends
                  overflow: 'visible',
                  transform: [{ translateY: -8 }],
                }
              ]}
            >
              {/* 1. Glass Plate Container */}
              {USE_NATIVE_GLASS ? (
                /* Native iOS Liquid Glass plate — uses system UIVisualEffectView */
                <GlassView
                  glassEffectStyle="regular"
                  colorScheme={isDark ? 'dark' : 'light'}
                  style={[
                    StyleSheet.absoluteFill,
                    styles.glassContainerBorder,
                  ]}
                />
              ) : (
                /* Fallback: handcrafted BlurView + gradient stack (Android & old iOS) */
                <LinearGradient
                  colors={isDark ? ['rgba(255, 255, 255, 0.28)', 'rgba(0, 0, 0, 0.15)'] : ['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.15)'] }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[
                    StyleSheet.absoluteFill,
                    styles.glassContainerBorder,
                    {
                      shadowOpacity: isDark ? 0.14 : 0.05,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 2,
                    }
                  ]}
                >
                  {/* Inner Content Layer (offset by 1.0px to reveal gradient edge) */}
                  <View 
                    style={[
                      StyleSheet.absoluteFill, 
                      styles.glassContainerInner, 
                      { 
                        backgroundColor: isDark ? 'rgba(15, 15, 15, 0.65)' : 'rgba(255, 255, 255, 0.52)'
                      }
                    ]}
                  >
                    {Platform.OS === 'ios' ? (
                      <BlurView 
                        tint={isDark ? 'dark' : 'extraLight'} 
                        intensity={90} 
                        style={StyleSheet.absoluteFill} 
                      />
                    ) : (
                      <BlurView 
                        tint={isDark ? 'dark' : 'light'}
                        blurTarget={blurTargetRef}
                        intensity={isDark ? 120 : 80} 
                        style={StyleSheet.absoluteFill} 
                      />
                    )}

                    {/* 3D Diagonal Specular Shine Overlay */}
                    <LinearGradient
                      colors={
                        isDark
                          ? ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.03)', 'transparent', 'rgba(0, 0, 0, 0.04)']
                          : ['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.05)', 'transparent', 'transparent']
                      }
                      start={{ x: 0.1, y: 0 }}
                      end={{ x: 0.9, y: 1 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                  </View>
                </LinearGradient>
              )}

              {/* 2. Liquid Shared Slider (Glass Bubble) */}
              <Reanimated.View 
                style={[
                  styles.sliderPill,
                  {
                    backgroundColor: 'transparent',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: USE_NATIVE_GLASS ? 0 : 0.3,
                    shadowRadius: USE_NATIVE_GLASS ? 0 : 6,
                    elevation: USE_NATIVE_GLASS ? 0 : 3,
                  },
                  sliderStyle
                ]} 
              >
                {USE_NATIVE_GLASS ? (
                  /* Native iOS Liquid Glass bubble */
                  <GlassView
                    glassEffectStyle="regular"
                    isInteractive
                    colorScheme={isDark ? 'dark' : 'light'}
                    style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                  />
                ) : (
                  /* Fallback: gradient border bubble (Android & old iOS) */
                  <LinearGradient
                    colors={isDark ? ['rgba(255, 255, 255, 0.55)', 'rgba(0, 0, 0, 0.2)'] : ['rgba(255, 255, 255, 0.85)', 'rgba(255, 255, 255, 0.35)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
                  >
                    {/* Inner Content Layer (offset by 0.8px to reveal gradient edge) */}
                    <Reanimated.View
                      style={[
                        styles.sliderPillInner,
                        innerSliderStyle
                      ]}
                    >
                      {/* 3D Specular Shine inside the bubble */}
                      <LinearGradient
                        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.03)', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      />
                    </Reanimated.View>
                  </LinearGradient>
                )}
              </Reanimated.View>
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
            tabBarIcon: ({ focused }) => (
              <TabIcon label={t('home')} iconName="home" focused={focused} activeColor={homeColor} inactiveColor={inactiveTabColor} />
            ),
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
            tabBarIcon: ({ focused }) => (
              <TabIcon label={t('notifications')} iconName="newspaper" focused={focused} activeColor={articlesColor} inactiveColor={inactiveTabColor} />
            ),
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
            tabBarIcon: ({ focused }) => (
              <TabIcon label={t('tools')} iconName="view-grid" focused={focused} activeColor={toolsColor} inactiveColor={inactiveTabColor} />
            ),
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
            tabBarIcon: ({ focused }) => (
              <TabIcon label={t('profile')} iconName="account" focused={focused} activeColor={profileColor} inactiveColor={inactiveTabColor} />
            ),
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
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="events"
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
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: 34,
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
  sliderPill: {
    position: 'absolute',
    top: 6,
    height: 56,
    borderRadius: 28,
  },
  sliderPillInner: {
    position: 'absolute',
    top: 0.8,
    left: 0.8,
    right: 0.8,
    bottom: 0.8,
    borderRadius: 27.2,
    overflow: 'hidden',
  },
});
