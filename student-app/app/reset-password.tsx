import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, translateAuthError } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { recordDebugEvent } from '../lib/logger';
import { useOtpCooldown } from '../hooks/useOtpCooldown';
import { appAlert as Alert } from '../lib/appAlert';

export default function ResetPasswordScreen() {
  const { colors, t, language } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { remaining, startCooldown } = useOtpCooldown();

  const emailDomain = email.trim().split('@')[1]?.toLowerCase() || 'invalid';

  const sendResetCode = async () => {
    if (!email.trim()) {
      setMessage(t('enterEmailAddress'));
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      recordDebugEvent('auth', 'Password reset code requested', { emailDomain });
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setCodeSent(true);
      startCooldown();
      recordDebugEvent('auth', 'Password reset code request completed', { emailDomain });
      setMessage('验证码已发送，请输入邮件中的 6 位验证码。');
    } catch (error: any) {
      recordDebugEvent('auth', 'Password reset code request failed', { emailDomain, error: error?.message || String(error) }, 'warn');
      setMessage(translateAuthError(error?.message || '', language));
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async () => {
    if (otp.trim().length !== 6) {
      setMessage(t('enter6DigitOtp'));
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      recordDebugEvent('auth', 'Password reset code verification requested', { emailDomain });
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'recovery',
      });
      if (error) throw error;
      recordDebugEvent('auth', 'Password reset code verified', { emailDomain });
      setRecoveryReady(true);
    } catch (error: any) {
      recordDebugEvent('auth', 'Password reset code verification failed', { emailDomain, error: error?.message || String(error) }, 'warn');
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

  const sendLabel = remaining > 0
    ? `已发送 ${remaining}s`
    : (codeSent ? '未收到？再发一次' : '发送验证码');

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
            {!recoveryReady && <Text style={[styles.description, { color: colors.textSecondary }]}>验证邮箱中的验证码后，即可设置新的登录密码。</Text>}

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
                  editable={!codeSent}
                />
                {codeSent && (
                  <View style={styles.codeRow}>
                    <TextInput
                      style={[styles.input, styles.codeInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
                      placeholder={t('otpCodePlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      onSubmitEditing={verifyResetCode}
                    />
                    <Pressable
                      style={[styles.resendButton, { borderColor: colors.border, backgroundColor: remaining > 0 || loading ? colors.surfaceElevated : colors.primarySoft }]}
                      onPress={sendResetCode}
                      disabled={remaining > 0 || loading}
                    >
                      {loading ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Text style={{ color: remaining > 0 ? colors.textMuted : colors.primary, fontSize: 12, fontWeight: '600' }}>{sendLabel}</Text>}
                    </Pressable>
                  </View>
                )}
                {!codeSent ? (
                  <Pressable style={[styles.button, { backgroundColor: colors.primary }, loading && styles.disabled]} onPress={sendResetCode} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{sendLabel}</Text>}
                  </Pressable>
                ) : (
                  <Pressable style={[styles.button, { backgroundColor: colors.primary }, loading && styles.disabled]} onPress={verifyResetCode} disabled={loading}>
                    {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>验证验证码</Text>}
                  </Pressable>
                )}
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
  codeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  codeInput: { flex: 1 },
  resendButton: { height: 50, minWidth: 112, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  button: { height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
