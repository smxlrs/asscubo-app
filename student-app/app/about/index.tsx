import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { MaterialIcons } from '@expo/vector-icons';

const GITHUB_REPO = 'smxlrs/asscubo-app';
const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const RELEASES_API  = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/** 比较 4 位版本号，latest > current 时返回 true */
function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const l = parse(latest);
  const c = parse(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

function extractChangelog(body: string, maxLen = 200): string {
  if (!body) return '';
  const cleaned = body
    .replace(/#{1,6}\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^\s*[-*]\s/gm, '• ')
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '…' : cleaned;
}

const UPDATE_TEXTS: Record<string, {
  newVersion: string; current: string; latest: string;
  goUpdate: string; later: string; upToDate: string;
  networkErr: string; openGitHub: string; cancel: string;
  checkUpdate: string;
}> = {
  zh: {
    newVersion: '发现新版本',
    current: '当前版本',
    latest: '最新版本',
    goUpdate: '前往下载',
    later: '稍后再说',
    upToDate: '当前已是最新版本 🎉',
    networkErr: '网络连接失败，请稍后重试。',
    openGitHub: '打开 GitHub Releases',
    cancel: '取消',
    checkUpdate: '检查更新',
  },
  'zh-Hant': {
    newVersion: '發現新版本',
    current: '當前版本',
    latest: '最新版本',
    goUpdate: '前往下載',
    later: '稍後再說',
    upToDate: '目前已是最新版本 🎉',
    networkErr: '網路連線失敗，請稍後重試。',
    openGitHub: '開啟 GitHub Releases',
    cancel: '取消',
    checkUpdate: '檢查更新',
  },
  en: {
    newVersion: 'New Version Available',
    current: 'Current',
    latest: 'Latest',
    goUpdate: 'Download Now',
    later: 'Later',
    upToDate: "You're on the latest version 🎉",
    networkErr: 'Network error. Please try again later.',
    openGitHub: 'Open GitHub Releases',
    cancel: 'Cancel',
    checkUpdate: 'Check for Updates',
  },
  it: {
    newVersion: 'Nuova versione disponibile',
    current: 'Versione attuale',
    latest: 'Ultima versione',
    goUpdate: 'Scarica ora',
    later: 'Dopo',
    upToDate: "Hai l'ultima versione 🎉",
    networkErr: 'Errore di rete. Riprova più tardi.',
    openGitHub: 'Apri GitHub Releases',
    cancel: 'Annulla',
    checkUpdate: 'Controlla aggiornamenti',
  },
};

export default function AboutIndexScreen() {
  const { colors, t, language } = useTheme();
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const currentVersion = Constants.expoConfig?.version ?? '1.0.0.2';
  const ut = UPDATE_TEXTS[language] ?? UPDATE_TEXTS['zh'];

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
        const apkAsset = (data.assets as { name: string; browser_download_url: string }[] | undefined)
          ?.find(a => a.name.endsWith('.apk'));
        const downloadUrl: string = apkAsset?.browser_download_url ?? RELEASES_PAGE;
        const changelog = extractChangelog((data.body as string) ?? '');

        Alert.alert(
          `🎉 ${ut.newVersion} v${latestVersion}`,
          `${ut.current}: v${currentVersion}\n${ut.latest}: v${latestVersion}${changelog ? `\n\n${changelog}` : ''}`,
          [
            { text: ut.later, style: 'cancel' },
            { text: ut.goUpdate, onPress: () => Linking.openURL(downloadUrl) },
          ]
        );
      } else {
        Alert.alert(ut.checkUpdate, ut.upToDate);
      }
    } catch (e) {
      console.warn('Update check failed:', e);
      Alert.alert(
        ut.checkUpdate,
        ut.networkErr,
        [
          { text: ut.cancel, style: 'cancel' },
          { text: ut.openGitHub, onPress: () => Linking.openURL(RELEASES_PAGE) },
        ]
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={{
            width: 10, height: 10,
            borderLeftWidth: 2, borderBottomWidth: 2,
            borderColor: colors.primaryLight,
            transform: [{ rotate: '45deg' }],
            marginHorizontal: 8, marginVertical: 4,
          }} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('about')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>{t('appName')}</Text>
          <Pressable onPress={handleCheckUpdate} disabled={checkingUpdate} style={styles.versionRow}>
            {checkingUpdate
              ? <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 6 }} />
              : <MaterialIcons name="system-update" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
            }
            <Text style={[styles.version, { color: colors.textSecondary }]}>v{currentVersion}</Text>
          </Pressable>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about/association')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('aboutACSS')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about/intro')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('platformIntro')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.menuRow, { borderBottomColor: colors.border }]}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
          >
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{ut.checkUpdate}</Text>
            <View style={styles.rowRight}>
              {checkingUpdate
                ? <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} />
                : <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{currentVersion}</Text>
              }
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about/feedback')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('feedback')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => Linking.openURL(RELEASES_PAGE)}
          style={[styles.releasesLink, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <MaterialIcons name="open-in-new" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 13, color: colors.primary }}>GitHub Releases</Text>
        </Pressable>

        <Text style={[styles.copyright, { color: colors.textMuted }]}>
          © 2026 {t('copyright')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1,
  },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerPlaceholder: { width: 50 },
  content: { alignItems: 'center', padding: 20 },
  logoContainer: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  logo: { fontSize: 64, marginBottom: 12 },
  appName: { fontSize: 22, fontWeight: 'bold', marginBottom: 6 },
  versionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  version: { fontSize: 14 },
  menuSection: { width: '100%', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  menuRow: {
    height: 54, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'space-between',
  },
  menuLabel: { fontSize: 15 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, marginRight: 8 },
  arrow: { fontSize: 18 },
  releasesLink: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, marginBottom: 12,
  },
  copyright: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 30, marginBottom: 20 },
});
