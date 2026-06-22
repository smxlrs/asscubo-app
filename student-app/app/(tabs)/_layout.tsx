import { Tabs } from 'expo-router';
import { View, Text, Animated, StyleSheet, Easing, Pressable, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useRef, useEffect, useState } from 'react';
import { BlurView } from 'expo-blur';


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
  const widthAnim = useRef(new Animated.Value(focused ? 56 : 30)).current;
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
        toValue: focused ? 56 : 30,
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
    <View style={[styles.tabIconContainer, USE_GLASSMORPHISM && { paddingTop: 6 }]}>
      <View style={styles.iconWrapper}>
        {/* Capsule Highlight Pill Background */}
        <Animated.View 
          style={[
            styles.pillBg, 
            { 
              backgroundColor: activeColor + '1D', // ~11% opacity primary tint
              opacity: opacityAnim,
              width: widthAnim,
            }
          ]} 
        />
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
  const { colors, t, isDark, tabBarStyle } = useTheme();
  const USE_GLASSMORPHISM = tabBarStyle === 'glassmorphism';

  const tabStyle = USE_GLASSMORPHISM ? {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Platform.OS === 'ios' 
      ? 'transparent' 
      : (isDark ? 'rgba(25, 25, 25, 0.88)' : 'rgba(255, 255, 255, 0.88)'),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
    elevation: 0,
    shadowOpacity: 0,
  } : {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    height: 76,
    paddingBottom: 0,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: tabStyle,
        tabBarShowLabel: false,
        tabBarBackground: USE_GLASSMORPHISM && Platform.OS === 'ios' ? () => (
          <BlurView 
            tint={isDark ? 'dark' : 'light'} 
            intensity={80} 
            style={StyleSheet.absoluteFill} 
          />
        ) : undefined,
        tabBarButton: (props) => {
          const { ref, style, ...rest } = props as any;
          return (
            <Pressable 
              {...rest} 
              ref={ref as any}
              android_ripple={null} 
              style={[
                style,
                { opacity: 1 }
              ]} 
            />
          );
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('home')} iconName="home" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('notifications')} iconName="newspaper" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tools')} iconName="view-grid" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('profile')} iconName="account" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 15,
  },
  iconWrapper: {
    width: 56,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pillBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 15,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
