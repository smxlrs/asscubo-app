import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Linking, Image, Animated } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load debug mode state dynamically when screen is focused
  useFocusEffect(
    useCallback(() => {
      async function loadDebugMode() {
        const val = await AsyncStorage.getItem('@ag_debug_mode');
        setShowLogs(val === 'true');
      }
      loadDebugMode();
    }, [])
  );

  const showToast = (text: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastText(text);
    // Fade in
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    toastTimeoutRef.current = setTimeout(() => {
      // Fade out
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setToastText(null);
      });
    }, 1500);
  };

  const handleVersionTap = () => {
    const now = Date.now();
    if (now - lastTap < 1000) {
      const newCount = tapCount + 1;
      setTapCount(newCount);

      const isIt = language === 'it';
      
      if (showLogs) {
        if (language === 'zh-Hant') showToast('您已處於調試模式');
        else if (isIt) showToast('Sei già in modalità debug');
        else if (language === 'en') showToast('You are already in debug mode');
        else showToast('您已处于调试模式');
        return;
      }

      if (newCount === 5) {
        if (language === 'zh-Hant') showToast('再按三下進入調試模式');
        else if (isIt) showToast('Tocca altre 3 volte per entrare in modalità debug');
        else if (language === 'en') showToast('Tap 3 more times to enter debug mode');
        else showToast('再按三下进入调试模式');
      } else if (newCount === 6) {
        if (language === 'zh-Hant') showToast('再按兩下進入調試模式');
        else if (isIt) showToast('Tocca altre 2 volte per entrare in modalità debug');
        else if (language === 'en') showToast('Tap 2 more times to enter debug mode');
        else showToast('再按两下进入调试模式');
      } else if (newCount === 7) {
        if (language === 'zh-Hant') showToast('再按一下進入調試模式');
        else if (isIt) showToast("Tocca un'altra volta per entrare in modalità debug");
        else if (language === 'en') showToast('Tap 1 more time to enter debug mode');
        else showToast('再按一下进入调试模式');
      } else if (newCount >= 8) {
        setShowLogs(true);
        AsyncStorage.setItem('@ag_debug_mode', 'true');
        if (language === 'zh-Hant') showToast('您已進入調試模式');
        else if (isIt) showToast('Sei entrato in modalità debug');
        else if (language === 'en') showToast('You have entered debug mode');
        else showToast('您已进入调试模式');
        setTapCount(0);
      }
    } else {
      setTapCount(1);
    }
    setLastTap(now);
  };

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
          <View style={[styles.logoImageWrapper, { borderColor: colors.border }]}>
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>{t('appName')}</Text>
          <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>{t('appSubtitle')}</Text>
        </View>

        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/association')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('aboutACSS')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/intro')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('platformIntro')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          {/* 版本号 */}
          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={handleVersionTap}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('versionLabel')}</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{currentVersion}</Text>
          </Pressable>

          {/* 检查更新 */}
          <Pressable
            style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
          >
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{ut.checkUpdate}</Text>
            <View style={styles.rowRight}>
              {checkingUpdate && <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} />}
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/feedback')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('feedback')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/privacy')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>隐私政策</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/terms')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>用户协议</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable 
            style={[
              styles.menuRow, 
              showLogs && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }
            ]} 
            onPress={() => router.push('/about/licenses')}
          >
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>开源许可</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          {showLogs && (
            <Pressable style={styles.menuRow} onPress={() => router.push('/about/logs')}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>查看系统日志</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.copyright, { color: colors.textMuted }]}>
          © 2026{' '}
          <Text
            style={{ textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://asscubo.it')}
          >
            {language === 'zh'
              ? '博洛尼亚大学中国学联'
              : language === 'zh-Hant'
              ? '博洛尼亞大學中國學聯'
              : 'ASSCUBO'}
          </Text>
          .{'\n'}All rights reserved.
        </Text>
      </ScrollView>

      {toastText && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>
      )}
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
  logoImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  appName: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  appSubtitle: { fontSize: 13, marginBottom: 8 },
  versionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10 },
  version: { fontSize: 14 },
  menuSection: { width: '100%', borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  menuRow: {
    height: 54, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, justifyContent: 'space-between',
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
  toastContainer: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
