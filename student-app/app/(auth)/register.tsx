import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

// 请修改为你们学校的邮箱域名
const ALLOWED_EMAIL_DOMAIN = '@stu.';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  function validateEmail(email: string): boolean {
    return email.toLowerCase().includes(ALLOWED_EMAIL_DOMAIN) &&
      email.includes('.edu');
  }

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('提示', '请填写所有字段');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('邮箱无效', '请使用学校教育邮箱（xxx@stu.xxx.edu.cn）注册');
      return;
    }
    if (password.length < 8) {
      Alert.alert('密码太短', '密码至少需要8位字符');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('密码不一致', '两次输入的密码不匹配');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        Alert.alert('注册失败', '该邮箱已被注册，请直接登录');
      } else {
        Alert.alert('注册失败', error.message);
      }
    } else {
      router.replace('/(auth)/verify');
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A0508', '#0F0F0F']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.accentCircle} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.backButton}>
              <Text style={styles.backText}>← 返回登录</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.header}>
            <Text style={styles.title}>创建账号</Text>
            <Text style={styles.subtitle}>加入学联之家，连接校园生活</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>真实姓名</Text>
              <TextInput
                style={styles.input}
                placeholder="请输入您的姓名"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>教育邮箱</Text>
              <TextInput
                style={styles.input}
                placeholder="xxx@stu.university.edu.cn"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Text style={styles.hint}>📧 仅限学校教育邮箱注册</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>设置密码</Text>
              <TextInput
                style={styles.input}
                placeholder="至少8位字符"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>确认密码</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword && password !== confirmPassword && styles.inputError,
                ]}
                placeholder="再次输入密码"
                placeholderTextColor={COLORS.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {confirmPassword && password !== confirmPassword && (
                <Text style={styles.errorText}>密码不一致</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.registerButton, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.primaryLight, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>注册并发送验证邮件</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.terms}>
              注册即代表您同意学联平台的使用条款和隐私政策
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  accentCircle: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: COLORS.primary,
    opacity: 0.07,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: { marginBottom: SPACING.lg },
  backText: {
    color: COLORS.primary,
    fontSize: SIZES.md,
    fontFamily: FONTS.medium,
  },
  header: { marginBottom: SPACING.xl },
  title: {
    fontSize: SIZES.xxxl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  inputError: { borderColor: COLORS.error },
  hint: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  errorText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  registerButton: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginTop: SPACING.md,
  },
  buttonGradient: {
    paddingVertical: SPACING.base,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  registerButtonText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  terms: {
    textAlign: 'center',
    marginTop: SPACING.base,
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
