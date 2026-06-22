import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, BackHandler, ToastAndroid } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { CustomSplashScreen } from '../components/CustomSplashScreen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

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
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
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
      name: 'default',
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
  const { isDark, isReady } = useTheme();
  const { user, loading } = useAuth();
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function setupNotifications() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          // Upsert push token in Supabase
          await supabase.from('push_tokens').upsert({
            user_id: user?.id || null, // null for guests
            token: token,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'token' });
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
        router.push(`/article/web?url=${encodeURIComponent(data.link)}&title=${encodeURIComponent((response.notification.request.content.title as string) || '详情')}` as any);
      } else if (data && typeof data.articleId === 'string') {
        router.push(`/article/${data.articleId}` as any);
      } else {
        router.push('/notifications');
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let lastPressTime = 0;

    const handleBackPress = () => {
      if (router.canGoBack()) {
        return false;
      }

      const now = Date.now();
      if (now - lastPressTime < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastPressTime = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('再按一次退出博学', ToastAndroid.SHORT);
      }
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, []);

  const showSplashScreen = !isReady || loading || !splashAnimationDone || !minSplashTimeElapsed;
  const splashVisible = !isReady || loading || !minSplashTimeElapsed;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="login-callback" />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="about" options={{ presentation: 'card' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      {showSplashScreen && (
        <CustomSplashScreen
          visible={splashVisible}
          onAnimationComplete={() => setSplashAnimationDone(true)}
        />
      )}
    </>
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
