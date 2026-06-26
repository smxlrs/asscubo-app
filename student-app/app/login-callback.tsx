import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export default function LoginCallback() {
  const { colors, isDark, t } = useTheme();
  const [statusMessage, setStatusMessage] = useState(t('verifyingAccount'));
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Automatic navigation on success if active session exists
  useEffect(() => {
    if (verificationSuccess && hasActiveSession) {
      const timer = setTimeout(() => {
        router.replace('/(tabs)');
      }, 2000); // 2 seconds delay
      return () => clearTimeout(timer);
    }
  }, [verificationSuccess, hasActiveSession]);

  useEffect(() => {
    let active = true;
    let safetyTimer: any = null;
    let subscription: { remove: () => void } | null = null;
    let pollInterval: any = null;

    async function triggerSuccess() {
      if (active) {
        setVerificationSuccess(true);
        setStatusMessage(t('verificationSuccessMsg'));
        if (safetyTimer) {
          clearTimeout(safetyTimer);
        }
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        try {
          await SecureStore.deleteItemAsync('temp_signup_email');
          await SecureStore.deleteItemAsync('temp_signup_password');
        } catch (e) {
          console.warn('Failed to clear temp signup credentials:', e);
        }
      }
    }

    function triggerFailure(msg: string) {
      if (active) {
        setErrorMessage(msg);
        setErrorOccurred(true);
        if (safetyTimer) {
          clearTimeout(safetyTimer);
        }
        if (pollInterval) {
          clearInterval(pollInterval);
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

      subscription = Linking.addEventListener('url', async ({ url }) => {
        if (active) {
          await processUrl(url);
        }
      });

      // Start background polling check for verification status using saved credentials
      await startBackgroundVerificationCheck();
    }

    async function startBackgroundVerificationCheck() {
      try {
        const email = await SecureStore.getItemAsync('temp_signup_email');
        const password = await SecureStore.getItemAsync('temp_signup_password');
        
        if (!email || !password) {
          console.log('No temporary signup credentials found for background polling.');
          return;
        }

        console.log('Starting background verification check for:', email);
        
        pollInterval = setInterval(async () => {
          if (!active || verificationSuccess || errorOccurred) {
            if (pollInterval) clearInterval(pollInterval);
            return;
          }
          
          try {
            console.log('Polling sign-in in background...');
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: password,
            });
            
            if (!error && data?.session) {
              console.log('Background verification check succeeded! Logged in.');
              if (pollInterval) clearInterval(pollInterval);
              
              if (active) {
                setHasActiveSession(true);
                await triggerSuccess();
              }
            } else if (error) {
              console.log('Background verification check poll status:', error.message);
            }
          } catch (err) {
            console.error('Error during background verification poll:', err);
          }
        }, 2000);
      } catch (err) {
        console.error('Error setting up background verification check:', err);
      }
    }

    async function processUrl(url: string) {
      if (!url) return;
      console.log('Processing deep link URL:', url);
      
      const parsed = Linking.parse(url);
      const { queryParams } = parsed;

      // 1. Check if we have the verified=true flag from verified.html
      const isVerifiedFromWeb = url.includes('verified=true');

      // 2. Check for errors passed in query params
      if (queryParams && queryParams.error) {
        const errMsg = queryParams.error_description || queryParams.error || t('verificationFailed');
        triggerFailure(decodeURIComponent(errMsg as string));
        return;
      }

      try {
        // Case 1: PKCE flow (auth code in query parameters)
        if (queryParams && typeof queryParams.code === 'string') {
          if (active) setStatusMessage(t('activatingSession'));
          const { error } = await supabase.auth.exchangeCodeForSession(queryParams.code);
          if (error) {
            const isAlreadyConsumed = error.message?.toLowerCase().includes('session') || 
                                      error.message?.toLowerCase().includes('code') ||
                                      error.message?.toLowerCase().includes('expired') ||
                                      error.message?.toLowerCase().includes('consumed');
            if (isAlreadyConsumed || isVerifiedFromWeb) {
              console.log('Code already consumed or verified from web, assuming success:', error.message);
            } else {
              throw error;
            }
          }
          
          if (active) {
            const { data: { session } } = await supabase.auth.getSession();
            setHasActiveSession(!!session);
          }
          await triggerSuccess();
          return;
        }

        // Case 2: Implicit flow (access token in hash fragment or query params)
        let accessToken: string | null = null;
        let refreshToken: string | null = null;

        const hashIndex = url.indexOf('#');
        const hash = hashIndex !== -1 ? url.substring(hashIndex + 1) : '';

        if (hash) {
          const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
          const qIndex = cleanHash.indexOf('?');
          const hashOnly = qIndex !== -1 ? cleanHash.substring(0, qIndex) : cleanHash;

          const params = hashOnly.split('&').reduce((acc: Record<string, string>, part: string) => {
            const [key, value] = part.split('=');
            if (key && value) {
              let val = decodeURIComponent(value);
              const valQidx = val.indexOf('?');
              if (valQidx !== -1) {
                val = val.substring(0, valQidx);
              }
              acc[key] = val;
            }
            return acc;
          }, {});

          accessToken = params['access_token'] || null;
          refreshToken = params['refresh_token'] || null;
        }

        if (!accessToken && queryParams) {
          accessToken = (queryParams['access_token'] as string) || null;
          refreshToken = (queryParams['refresh_token'] as string) || null;
        }

        if (accessToken && refreshToken) {
          if (active) setStatusMessage(t('establishingSession'));
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            const isAlreadyConsumed = error.message?.toLowerCase().includes('session') || 
                                      error.message?.toLowerCase().includes('code') ||
                                      error.message?.toLowerCase().includes('expired') ||
                                      error.message?.toLowerCase().includes('consumed');
            if (isAlreadyConsumed || isVerifiedFromWeb) {
              console.log('Session already set or verified from web, assuming success:', error.message);
            } else {
              throw error;
            }
          }

          if (active) {
            const { data: { session } } = await supabase.auth.getSession();
            setHasActiveSession(!!session);
          }
          await triggerSuccess();
          return;
        }

        // Case 3: Fallback check if we are already logged in or marked verified from web
        const { data: { session } } = await supabase.auth.getSession();
        if (session || isVerifiedFromWeb) {
          if (active) {
            setHasActiveSession(!!session);
          }
          await triggerSuccess();
        } else {
          throw new Error(t('linkInvalidOrIncomplete'));
        }

      } catch (e: any) {
        console.error('Auth callback error:', e);
        const friendlyMsg = e.message?.includes('expired') || e.message?.includes('invalid')
          ? t('linkConsumedOrExpired')
          : (e.message || '账户验证过程中出错');
        triggerFailure(friendlyMsg);
      }
    }

    handleCallback();

    // Safety timeout in case callback processing stalls (e.g. network issue)
    safetyTimer = setTimeout(() => {
      if (active && !verificationSuccess && !errorOccurred) {
        triggerFailure(t('verificationTimeout'));
      }
    }, 15000);

    return () => {
      active = false;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (subscription) subscription.remove();
    };
  }, []);

  // ── Success State ─────────────────────────────────────────
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
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('authSuccess')}</Text>
          
          {hasActiveSession ? (
            <>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {t('accountActivatedAutoLogin')}
              </Text>
              
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  router.replace('/(tabs)');
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.buttonBg, { backgroundColor: colors.primary }]}>
                  <Text style={styles.buttonText}>{t('enterApp')}</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {t('verifySuccessDesc')}
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
                  <Text style={styles.buttonText}>{t('goToLogin')}</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Error State ───────────────────────────────────────────
  if (errorOccurred) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient 
          colors={isDark ? ['#1A0508', '#0F0F0F'] : ['#FFF5F6', '#F5F7FA']} 
          style={StyleSheet.absoluteFill} 
        />
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, shadowColor: colors.error }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={54} color={colors.error} />
          </View>
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('somethingWentWrong')}</Text>
          
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {errorMessage || t('fallbackActivationError')}
          </Text>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              router.replace('/(auth)/login');
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.buttonBg, { backgroundColor: colors.primary }]}>
              <Text style={styles.buttonText}>{t('backToLogin')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading State ─────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0A0A0A' : '#F5F7FA' }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.statusText, { color: colors.textSecondary }]}>
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
