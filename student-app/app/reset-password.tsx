import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, translateAuthError } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { recordDebugEvent } from '../lib/logger';

function getTokensFromUrl(url: string) {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams(hash || url.split('?')[1] || '');
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  };
}

export default function ResetPasswordScreen() {
  const { colors, t, language } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const processRecoveryUrl = useCallback(async (url: string | null) => {
    if (!url) return;

    const { queryParams } = Linking.parse(url);
    if (queryParams?.error) {
      setMessage(String(queryParams.error_description || t('resetLinkInvalid')));
      return;
    }

    try {
      let error: Error | null = null;
      const code = queryParams?.code;
      if (typeof code === 'string') {
        ({ error } = await supabase.auth.exchangeCodeForSession(code));
      } else {
        const { accessToken, refreshToken } = getTokensFromUrl(url);
        if (!accessToken || !refreshToken) return;
        ({ error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }));
      }

      if (error) throw error;
      setMessage(null);
      setRecoveryReady(true);
    } catch (error: any) {
      setMessage(error?.message || t('resetLinkInvalid'));
    }
  }, [t]);

  useEffect(() => {
    Linking.getInitialURL().then(processRecoveryUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => processRecoveryUrl(url));
    return () => subscription.remove();
  }, [processRecoveryUrl]);

  const sendResetLink = async () => {
    if (!email.trim()) {
      setMessage(t('enterEmailAddress'));
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      recordDebugEvent('auth', 'Password reset email requested', { emailDomain: email.trim().split('@')[1]?.toLowerCase() || 'invalid' });
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) throw error;
      recordDebugEvent('auth', 'Password reset email request completed');
      setMessage(t('resetLinkSentDescription'));
    } catch (error: any) {
      recordDebugEvent('auth', 'Password reset email request failed', { error: error?.message || String(error) }, 'warn');
      setMessage(translateAuthError(error?.message || '', language));
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (newPassword.length < 6) {
      setMessage(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      recordDebugEvent('auth', 'Password update requested');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      recordDebugEvent('auth', 'Password update completed');
      Alert.alert(t('resetPassword'), t('passwordUpdated'), [
        { text: t('goToLogin'), onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      recordDebugEvent('auth', 'Password update failed', { error: error?.message || String(error) }, 'warn');
      setMessage(translateAuthError(error?.message || '', language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')}
          style={styles.backButton}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
              <MaterialCommunityIcons name={recoveryReady ? 'lock-reset' : 'email-lock-outline'} size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t('resetPassword')}</Text>
            {!recoveryReady && <Text style={[styles.description, { color: colors.textSecondary }]}>{t('resetPasswordDescription')}</Text>}

            {message && (
              <View style={[styles.notice, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{message}</Text>
              </View>
            )}

            {recoveryReady ? (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={t('passwordRegPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={t('confirmPasswordPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  onSubmitEditing={updatePassword}
                />
                <Pressable style={[styles.button, { backgroundColor: colors.primary }, loading && styles.disabled]} onPress={updatePassword} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('resetPassword')}</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={t('emailPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  onSubmitEditing={sendResetLink}
                />
                <Pressable style={[styles.button, { backgroundColor: colors.primary }, loading && styles.disabled]} onPress={sendResetLink} disabled={loading}>
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{t('sendResetLink')}</Text>}
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 72 },
  iconWrap: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 22 },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28 },
  notice: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 12, marginBottom: 18 },
  noticeText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  input: { height: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, fontSize: 15, marginBottom: 14 },
  button: { height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
