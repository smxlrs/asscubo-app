import React, { useEffect, useState } from 'react';

// --- 遗言发送器：开始 ---
const WEBHOOK_URL = 'https://webhook.site/4e33e610-cc65-4846-943c-3f97cd061bf6';

if (global.ErrorUtils) {
  const originalHandler = global.ErrorUtils.getGlobalHandler();
  
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    // 临死前发送网络请求把错误抛到公网
    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        isFatal: isFatal,
        time: new Date().toISOString()
      })
    }).catch(() => {}); // 忽略网络错误
    
    // 发送完遗言后，让系统按原计划闪退
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}
// --- 遗言发送器：结束 ---

import { initLogger } from '../lib/logger';
initLogger();
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, BackHandler, ToastAndroid, View } from 'react-native';
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
  const { user, loading } = useAuth();

  useEffect(() => {
    async function initActions() {
      const savedIds = await getSavedQuickActionIds();
      registerQuickActions(savedIds, t);
    }
    initActions();
  }, [t]);

  useEffect(() => {
    if (isReady && !loading) {
      SplashScreen.hideAsync().catch((err) => {
        console.warn('Error hiding native splash screen:', err);
      });
    }
  }, [isReady, loading]);

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
