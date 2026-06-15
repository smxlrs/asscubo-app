import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function VerifyScreen() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient 
        colors={isDark ? ['#1A0508', '#0F0F0F'] : ['#FFF5F6', '#F5F7FA']} 
        style={StyleSheet.absoluteFill} 
      />
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="email-open-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>验证您的邮箱</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          我们已向您的教育邮箱发送了一封验证邮件。{'\n\n'}
          请点击邮件中的链接完成验证后，再回来登录。
        </Text>
        
        <View style={[styles.tipCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.tipTitle, { color: colors.textPrimary }]}>注意事项</Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>• 验证邮件可能需要几分钟才能到达</Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>• 请检查垃圾邮件文件夹</Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>• 验证链接有效期为 24 小时</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(auth)/login')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.primary]}
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
  container: { 
    flex: 1, 
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.base,
    textAlign: 'center',
  },
  description: {
    fontSize: SIZES.base,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  tipCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    width: '100%',
    marginBottom: SPACING.xl,
  },
  tipTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    marginBottom: SPACING.sm,
  },
  tipText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
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
