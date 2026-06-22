import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export default function LoginCallback() {
  const { colors, isDark } = useTheme();
  const [statusMessage, setStatusMessage] = useState('正在验证您的账户，请稍候...');
  const [errorOccurred, setErrorOccurred] = useState(false);

  useEffect(() => {
    let active = true;

    async function handleCallback() {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && active) {
          await processUrl(initialUrl);
        }
      } catch (e) {
        console.error('Failed to get initial URL:', e);
      }

      const subscription = Linking.addEventListener('url', async ({ url }) => {
        if (active) {
          await processUrl(url);
        }
      });

      return () => {
        subscription.remove();
      };
    }

    async function processUrl(url: string) {
      if (!url) return;
      console.log('Processing deep link URL:', url);
      
      const parsed = Linking.parse(url);
      const { queryParams } = parsed;

      // Check for errors passed in query params
      if (queryParams && queryParams.error) {
        const errMsg = queryParams.error_description || queryParams.error || '验证失败';
        if (active) {
          setStatusMessage(decodeURIComponent(errMsg as string));
          setErrorOccurred(true);
        }
        setTimeout(() => {
          if (active) router.replace('/(auth)/login');
        }, 3000);
        return;
      }

      try {
        // Case 1: PKCE flow (auth code in query parameters)
        if (queryParams && typeof queryParams.code === 'string') {
          if (active) setStatusMessage('正在交换登录凭证...');
          const { error } = await supabase.auth.exchangeCodeForSession(queryParams.code);
          if (error) throw error;
          
          if (active) setStatusMessage('验证成功，正在为您跳转...');
          setTimeout(() => {
            if (active) router.replace('/(tabs)');
          }, 1000);
          return;
        }

        // Case 2: Implicit flow (access token in hash fragment)
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        const hashIndex = url.indexOf('#');
        const hash = hashIndex !== -1 ? url.substring(hashIndex + 1) : '';

        if (hash) {
          // Parse hash fragment parameters
          const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
          const params = cleanHash.split('&').reduce((acc: Record<string, string>, part: string) => {
            const [key, value] = part.split('=');
            if (key && value) acc[key] = decodeURIComponent(value);
            return acc;
          }, {});

          accessToken = params['access_token'] || null;
          refreshToken = params['refresh_token'] || null;
        }

        // Check queryParams as fallback for tokens
        if (!accessToken && queryParams) {
          accessToken = (queryParams['access_token'] as string) || null;
          refreshToken = (queryParams['refresh_token'] as string) || null;
        }

        if (accessToken && refreshToken) {
          if (active) setStatusMessage('正在建立安全会话...');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;

          if (active) setStatusMessage('登录成功，正在为您跳转...');
          setTimeout(() => {
            if (active) router.replace('/(tabs)');
          }, 1000);
          return;
        }

        // Case 3: If no explicit codes are parsed, check if we are already logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (active) setStatusMessage('账户已激活，正在载入...');
          setTimeout(() => {
            if (active) router.replace('/(tabs)');
          }, 1000);
        } else {
          // Default fallback: redirect to verify-success
          if (active) setStatusMessage('已返回应用，正在载入验证结果...');
          setTimeout(() => {
            if (active) router.replace('/(auth)/verify-success');
          }, 1500);
        }

      } catch (e: any) {
        console.error('Auth callback error:', e);
        if (active) {
          setStatusMessage(e.message || '账户验证过程中出错');
          setErrorOccurred(true);
        }
        setTimeout(() => {
          if (active) router.replace('/(auth)/login');
        }, 3000);
      }
    }

    handleCallback();

    // Safety timeout in case callback processing stalls
    const safetyTimer = setTimeout(() => {
      if (active) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            router.replace('/(tabs)');
          } else {
            router.replace('/(auth)/login');
          }
        });
      }
    }, 8000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0A0A' : '#F5F7FA' }]}>
      {!errorOccurred ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <View style={[styles.errorIcon, { backgroundColor: colors.error + '20' }]}>
          <Text style={{ color: colors.error, fontSize: 24, fontWeight: 'bold' }}>✕</Text>
        </View>
      )}
      <Text style={[styles.statusText, { color: errorOccurred ? colors.error : colors.textSecondary }]}>
        {statusMessage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    marginTop: 18,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
});
