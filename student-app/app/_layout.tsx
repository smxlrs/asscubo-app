import React, { useEffect, useState, useRef } from 'react';
import { initLogger } from '../lib/logger';
initLogger();
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, BackHandler, ToastAndroid, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ThemeProvider as NavigationProvider, DefaultTheme, DarkTheme } from 'expo-router/react-navigation';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch((err) => {
  console.warn('Error calling SplashScreen.preventAutoHideAsync():', err);
});
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e) {
  console.log('expo-notifications is not supported in this environment (e.g. Expo Go on Android SDK 53+)');
}

import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { getSavedQuickActionIds, registerQuickActions } from '../lib/quickActions';

// Configure how notifications are presented when the app is in the foreground
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      // 1. Read category from payload
      const category = notification.request.content.data?.category;
      
      // 2. Fetch user notification preferences from AsyncStorage
      // If the user has disabled this category, do NOT show the alert
      if (category) {
        try {
          const key = `@ag_notification_${category}`;
          const val = await AsyncStorage.getItem(key);
          if (val === 'false') {
            return {
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          }
        } catch (e) {
          console.warn('Failed to read notification preference:', e);
        }
      }

      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    },
  });
}

async function registerForPushNotificationsAsync() {
  if (!Notifications) {
    console.log('expo-notifications is not loaded. Skipping push registration.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '常规通知',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A316217C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notifications!');
      return null;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('EAS project ID not found in config.');
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } else {
    console.log('Push notifications require a physical device');
    return null;
  }
}

function AppContent() {
  const { isDark, isReady, predictiveBack, t } = useTheme();
  const { user, loading, networkError, retryInit } = useAuth();
  const splashHiddenRef = useRef(false);

  const hideSplash = () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch((err) => {
      console.warn('Error hiding native splash screen:', err);
    });
  };

  // 正常放行
  useEffect(() => {
    if (isReady && !loading) hideSplash();
  }, [isReady, loading]);

  // 兜底：8 秒内无论如何强制放行，防止极端情况卡死
  useEffect(() => {
    const timer = setTimeout(hideSplash, 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function initActions() {
      const savedIds = await getSavedQuickActionIds();
      registerQuickActions(savedIds, t);
    }
    initActions();
  }, [t]);

  useEffect(() => {
    async function setupNotifications() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          // 1. Upsert push token in push_tokens table
          await supabase.from('push_tokens').upsert({
            user_id: user?.id || null, // null for guests
            token: token,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'token' });

          // 2. Sync token to user profile if logged in
          if (user?.id) {
            await supabase
              .from('profiles')
              .update({ push_token: token })
              .eq('id', user.id);
          }
        }
      } catch (e) {
        console.log('Notification registration failed:', e);
      }
    }
    
    setupNotifications();
  }, [user]);

  useEffect(() => {
    if (!Notifications) return;

    // Handle notification click responses (deep linking)
    const subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data && typeof data.link === 'string') {
        router.push(`/article/web?url=${encodeURIComponent(data.link)}&title=${encodeURIComponent((response.notification.request.content.title as string) || t('details'))}` as any);
      } else if (data && typeof data.articleId === 'string') {
        router.push(`/article/${data.articleId}` as any);
      } else {
        router.push('/notifications');
      }
    });

    return () => subscription.remove();
  }, [t]);

  useEffect(() => {
    if (predictiveBack) {
      // If predictive back is enabled, we do not intercept the back press on root/sub screens.
      // The system handles exit/pop natively with predictive back animations.
      // Exit becomes single back press as requested.
      return;
    }

    // If predictive back is disabled, we globally intercept back events to block
    // the system predictive animations and use custom pop / double-press exit logic instead.
    let lastPressTime = 0;

    const handleBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true; // Intercepted: handles back manually, blocking system gesture animation
      }

      const now = Date.now();
      if (now - lastPressTime < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastPressTime = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('exitAppPrompt'), ToastAndroid.SHORT);
      }
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [predictiveBack, t]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: isDark ? '#0A0A0A' : '#FFFFFF',
    },
  };

  // 离线 / 网络错误全屏提示
  if (networkError && !loading) {
    return (
      <View style={[offlineStyles.container, { backgroundColor: isDark ? '#0A0A0A' : '#F5F7FA' }]}>
        <Text style={offlineStyles.icon}>📡</Text>
        <Text style={[offlineStyles.title, { color: isDark ? '#F5F5F5' : '#1D2939' }]}>
          {t('networkErrorTitle') || '网络似乎出了点问题'}
        </Text>
        <Text style={[offlineStyles.sub, { color: isDark ? '#A0A0A0' : '#6B7280' }]}>
          {t('networkErrorSub') || '请检查网络连接后重试'}
        </Text>
        <Pressable
          style={({ pressed }) => [offlineStyles.btn, { opacity: pressed ? 0.75 : 1 }]}
          onPress={retryInit}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={offlineStyles.btnText}>{t('retry') || '重试'}</Text>
          }
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}>
        <Stack screenOptions={{ 
          headerShown: false, 
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }
        }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="login-callback" />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="about" options={{ presentation: 'card' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
    </NavigationProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const offlineStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  icon: {
    fontSize: 52,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  btn: {
    marginTop: 12,
    backgroundColor: '#A31621',
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
