import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutIndexScreen() {
  const { colors, t } = useTheme();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      Alert.alert(
        t('checkUpdate'), 
        t('noUpdate') + '\n\n(💡 提示：正式版本发布后，App可通过集成 expo-updates 服务进行无线热更新；或在更新时点击版本号调用浏览器直接下载最新的 APK/IPA 安装包进行升级。)'
      );
    }, 1200);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={{
            width: 10,
            height: 10,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: colors.primaryLight,
            transform: [{ rotate: '45deg' }],
            marginHorizontal: 8,
            marginVertical: 4,
          }} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('about')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>{t('appName')}</Text>
          <Text style={[styles.version, { color: colors.textSecondary }]}>Version 1.0.0 (Beta)</Text>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* 1. About ACSS */}
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about/association')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('aboutACSS')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          {/* 2. Platform Intro */}
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about/intro')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('platformIntro')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          {/* 3. Version Update Check */}
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={handleCheckUpdate} disabled={checkingUpdate}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('versionLabel')}</Text>
            <View style={styles.rowRight}>
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} />
              ) : (
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>1.0.0 (Beta)</Text>
              )}
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          {/* 4. Feedback Form */}
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about/feedback')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('feedback')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>
        </View>

        <Text style={[styles.copyright, { color: colors.textMuted }]}>
          © 2026 {t('copyright')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  version: {
    fontSize: 14,
  },
  menuSection: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  menuLabel: {
    fontSize: 15,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 14,
    marginRight: 8,
  },
  arrow: {
    fontSize: 18,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 40,
    marginBottom: 20,
  },
});
