import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const GITHUB_REPO = 'smxlrs/asscubo-app';
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** 比较版本号，如果 latest > current 返回 true */
function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const l = parse(latest);
  const c = parse(current);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

export default function AboutIndexScreen() {
  const { colors, t } = useTheme();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch(RELEASES_API, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const latestTag: string = data.tag_name ?? '';
      const latestVersion = latestTag.replace(/^v/, '');

      if (!latestVersion) throw new Error('No release found');

      if (isNewerVersion(latestVersion, currentVersion)) {
        // 找 APK 附件
        const apkAsset = data.assets?.find((a: { name: string }) =>
          a.name.endsWith('.apk')
        );
        const downloadUrl: string =
          (apkAsset as { browser_download_url?: string } | undefined)?.browser_download_url ??
          (data.html_url as string);

        const releaseNotes: string = ((data.body as string) ?? '').slice(0, 300);

        Alert.alert(
          `🎉 发现新版本 v${latestVersion}`,
          `当前版本：v${currentVersion}\n最新版本：v${latestVersion}${releaseNotes ? `\n\n${releaseNotes}` : ''}`,
          [
            { text: t('cancel'), style: 'cancel' },
            {
              text: '立即更新',
              onPress: () => Linking.openURL(downloadUrl),
            },
          ]
        );
      } else {
        Alert.alert(t('checkUpdate'), t('noUpdate'));
      }
    } catch (e) {
      console.warn('Update check failed:', e);
      Alert.alert(
        t('checkUpdate'),
        '无法连接到服务器，请稍后重试。\n\n您也可以访问 GitHub 手动下载：\nhttps://github.com/' + GITHUB_REPO + '/releases',
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: '打开 GitHub',
            onPress: () => Linking.openURL(`https://github.com/${GITHUB_REPO}/releases`),
          },
        ]
      );
    } finally {
      setCheckingUpdate(false);
    }
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
          <Text style={[styles.version, { color: colors.textSecondary }]}>Version {currentVersion}</Text>
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
          <Pressable
            style={[styles.menuRow, { borderBottomColor: colors.border }]}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
          >
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('versionLabel')}</Text>
            <View style={styles.rowRight}>
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} />
              ) : (
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{currentVersion}</Text>
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
