import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '请输入邮箱和密码');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert('登录失败', error.message === 'Invalid login credentials'
        ? '邮箱或密码错误，请重试'
        : error.message);
    }
    // On success, AuthContext listener will redirect to tabs
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1A0508', '#0F0F0F']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative accent circle */}
      <View style={styles.accentCircle} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🎓</Text>
            </View>
            <Text style={styles.appName}>学联之家</Text>
            <Text style={styles.subtitle}>学生学生联合会官方平台</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>欢迎回来</Text>
            <Text style={styles.cardSubtitle}>使用教育邮箱登录</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>教育邮箱</Text>
              <TextInput
                style={styles.input}
                placeholder="your.name@stu.edu.cn"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>密码</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="请输入密码"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.primaryLight, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>登 录</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>还没有账号？</Text>
              <View style={styles.dividerLine} />
            </View>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.registerButton} activeOpacity={0.8}>
                <Text style={styles.registerButtonText}>注册新账号</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <Text style={styles.footer}>仅限持有效教育邮箱的在校学生使用</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  accentCircle: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
    opacity: 0.08,
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  logoEmoji: { fontSize: 40 },
  appName: {
    fontSize: SIZES.xxxl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  cardSubtitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
  },
  inputGroup: { marginBottom: SPACING.base },
  label: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    fontSize: SIZES.base,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  eyeButton: {
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 52,
    justifyContent: 'center',
  },
  eyeText: { fontSize: 18 },
  loginButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginGradient: {
    paddingVertical: SPACING.base,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  loginButtonText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    letterSpacing: 3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  registerButton: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  footer: {
    textAlign: 'center',
    marginTop: SPACING.xl,
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
});
