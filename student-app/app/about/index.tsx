import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Linking, Image, Animated, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { setDebugLoggingEnabled } from '../../lib/logger';

const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.asscuboxue.app';
const APP_STORE_ID = Constants.expoConfig?.extra?.appStoreId as string | undefined;

const UPDATE_TEXTS: Record<string, {
  storeTitle: string; storeDescription: string; openStore: string;
  storeUnavailable: string; cancel: string; checkUpdate: string;
}> = {
  zh: {
    storeTitle: '检查更新',
    storeDescription: '应用更新由应用商店管理。前往商店即可查看、下载或更新当前版本。',
    openStore: '前往应用商店',
    storeUnavailable: 'App Store 页面将在 iOS 版本上架后提供。',
    cancel: '取消',
    checkUpdate: '检查更新',
  },
  'zh-Hant': {
    storeTitle: '檢查更新',
    storeDescription: '應用程式更新由應用商店管理。前往商店即可查看、下載或更新目前版本。',
    openStore: '前往應用商店',
    storeUnavailable: 'iOS 版本上架後將提供 App Store 頁面。',
    cancel: '取消',
    checkUpdate: '檢查更新',
  },
  en: {
    storeTitle: 'Check for Updates',
    storeDescription: 'Updates are managed by your app store. Open the listing to view or install the latest version.',
    openStore: 'Open App Store',
    storeUnavailable: 'The App Store listing will be available after the iOS release is published.',
    cancel: 'Cancel',
    checkUpdate: 'Check for Updates',
  },
  it: {
    storeTitle: 'Controlla aggiornamenti',
    storeDescription: "Gli aggiornamenti sono gestiti dall'app store. Apri la pagina per visualizzare o installare l'ultima versione.",
    openStore: "Apri l'App Store",
    storeUnavailable: "La pagina dell'App Store sara disponibile dopo la pubblicazione della versione iOS.",
    cancel: 'Annulla',
    checkUpdate: 'Controlla aggiornamenti',
  },
};

export default function AboutIndexScreen() {
  const { colors, t, language } = useTheme();
  const { hasUnreadFeedbackReply } = useAuth();
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
        setDebugLoggingEnabled(true).catch((error) => {
          console.warn('Failed to enable debug mode:', error);
        });
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
    const storeUrl = Platform.OS === 'ios'
      ? (APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}` : null)
      : GOOGLE_PLAY_URL;

    if (!storeUrl) {
      Alert.alert(ut.storeTitle, ut.storeUnavailable);
      return;
    }

    Alert.alert(ut.storeTitle, ut.storeDescription, [
      { text: ut.cancel, style: 'cancel' },
      { text: ut.openStore, onPress: () => Linking.openURL(storeUrl) },
    ]);
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
          >
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{ut.checkUpdate}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/feedback')}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, color: colors.textPrimary }}>{t('feedback')}</Text>
              {hasUnreadFeedbackReply && (
                <View style={styles.redDot} />
              )}
            </View>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/terms')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>用户协议</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/privacy')}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>隐私政策</Text>
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
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginLeft: 6,
  },
});
