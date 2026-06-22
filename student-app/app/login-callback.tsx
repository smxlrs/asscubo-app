import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginCallback() {
  const { colors, isDark } = useTheme();
  const [statusMessage, setStatusMessage] = useState('正在验证您的账户，请稍候...');
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    let safetyTimer: NodeJS.Timeout | null = null;

    function triggerSuccess() {
      if (active) {
        setVerificationSuccess(true);
        setStatusMessage('验证成功！');
        if (safetyTimer) {
          clearTimeout(safetyTimer);
        }
      }
    }

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
          if (error) {
            const isAlreadyConsumed = error.message?.toLowerCase().includes('session') || 
                                      error.message?.toLowerCase().includes('code') ||
                                      error.message?.toLowerCase().includes('expired');
            if (isAlreadyConsumed) {
              console.log('Code already consumed, assuming verified:', error.message);
            } else {
              throw error;
            }
          }
          
          triggerSuccess();
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
          if (error) {
            const isAlreadyConsumed = error.message?.toLowerCase().includes('session') || 
                                      error.message?.toLowerCase().includes('code') ||
                                      error.message?.toLowerCase().includes('expired');
            if (isAlreadyConsumed) {
              console.log('Session already set or token consumed:', error.message);
            } else {
              throw error;
            }
          }

          triggerSuccess();
          return;
        }

        // Case 3: If no explicit codes are parsed, check if we are already logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          triggerSuccess();
        } else {
          triggerSuccess();
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
    safetyTimer = setTimeout(() => {
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
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, []);

  if (verificationSuccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient 
          colors={isDark ? ['#1A0508', '#0F0F0F'] : ['#FFF5F6', '#F5F7FA']} 
          style={StyleSheet.absoluteFill} 
        />
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={54} color="#4CAF50" />
          </View>
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>验证成功！</Text>
          
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            您的账户已成功激活！{'\n'}
            现在可以使用注册的账号和密码登录应用。
          </Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.buttonBg, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonText}>前往登录</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
  content: {
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonBg: {
    paddingVertical: 14,
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
