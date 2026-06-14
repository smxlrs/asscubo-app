import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function VerifyScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A0508', '#0F0F0F']} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📬</Text>
        </View>
        <Text style={styles.title}>验证您的邮箱</Text>
        <Text style={styles.description}>
          我们已向您的教育邮箱发送了一封验证邮件。{'\n\n'}
          请点击邮件中的链接完成验证后，再回来登录。
        </Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>📋 注意事项</Text>
          <Text style={styles.tipText}>• 验证邮件可能需要几分钟才能到达</Text>
          <Text style={styles.tipText}>• 请检查垃圾邮件文件夹</Text>
          <Text style={styles.tipText}>• 验证链接有效期为 24 小时</Text>
        </View>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>已验证，去登录</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  icon: { fontSize: 50 },
  title: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.base,
    textAlign: 'center',
  },
  description: {
    fontSize: SIZES.base,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  tipCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    marginBottom: SPACING.xl,
  },
  tipTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  tipText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: SPACING.base,
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
