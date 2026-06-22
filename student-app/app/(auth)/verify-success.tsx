import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function VerifySuccessScreen() {
  const { colors, isDark } = useTheme();

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
        
        <Text style={[styles.title, { color: colors.textPrimary }]}>邮箱验证成功</Text>
        
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          您的账户已成功激活！{'\n'}
          现在可以使用注册的账号和密码登录应用。
        </Text>
        
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>欢迎加入博学</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            • 开启您的学术与校园生活助手{'\n'}
            • 随时查看最新动态、通知与微信文章{'\n'}
            • 使用精心打磨的工具箱提升效率
          </Text>
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
            <Text style={styles.buttonText}>前往登录</Text>
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
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
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
  infoCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    width: '100%',
    marginBottom: SPACING.xxl,
  },
  infoTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
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
