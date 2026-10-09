import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCacheSize, clearCacheDir } from '../../lib/cacheStorage';
import { appAlert as Alert } from '../../lib/appAlert';

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0.0 KB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const LOCALIZED = {
  zh: {
    notificationsSetting: '通知设置',
    cacheUnavailable: '暂时无法统计',
    cacheFailed: '部分缓存未能清理，请稍后重试。',
    cacheHint: '统计可清理的临时文件。下载的词典、收藏和个人数据会保留。',
    manageSubscriptions: '管理订阅',
  },
  'zh-Hant': {
    notificationsSetting: '通知設置',
    cacheUnavailable: '暫時無法統計',
    cacheFailed: '部分快取未能清理，請稍後重試。',
    cacheHint: '統計可清理的暫存檔案。下載的詞典、收藏和個人資料會保留。',
    manageSubscriptions: '管理訂閱',
  },
  en: {
    notificationsSetting: 'Notifications',
    cacheUnavailable: 'Size unavailable',
    cacheFailed: 'Some cached files could not be cleared. Please try again later.',
    cacheHint: 'Shows removable temporary files. Downloaded dictionaries, favorites and personal data are kept.',
    manageSubscriptions: 'Manage Subscriptions',
  },
  it: {
    notificationsSetting: 'Notifiche',
    cacheUnavailable: 'Dimensione non disponibile',
    cacheFailed: 'Alcuni file temporanei non sono stati eliminati. Riprova più tardi.',
    cacheHint: 'Mostra i file temporanei eliminabili. Dizionari scaricati, preferiti e dati personali vengono conservati.',
    manageSubscriptions: 'Gestisci Iscrizioni',
  }
};

export default function SettingsIndexScreen() {
  const { colors, t, themeMode, languageMode, tabBarStyle, setTabBarStyle, language } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;
  const [cacheSize, setCacheSize] = useState('…');
  const [clearingCache, setClearingCache] = useState(false);
  const cacheRequest = useRef(0);
  const clearingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    const request = ++cacheRequest.current;
    setCacheSize('…');
    getCacheSize().then(size => {
      if (request === cacheRequest.current) setCacheSize(formatBytes(size));
    }).catch(error => {
      console.warn('Failed to calculate cache size:', error);
      if (request === cacheRequest.current) setCacheSize(localized.cacheUnavailable);
    });
    return () => { cacheRequest.current++; };
  }, [localized.cacheUnavailable]));

  const handleClearCache = () => {
    if (clearingRef.current) return;
    Alert.alert(t('clearCache'), t('confirmClearCache'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        onPress: async () => {
          if (clearingRef.current) return;
          clearingRef.current = true;
          setClearingCache(true);
          const request = ++cacheRequest.current;
          let failed = false;
          try {
            await clearCacheDir();
          } catch (error) {
            failed = true;
            console.warn('Failed to clear cache directory:', error);
          }
          try {
            const size = await getCacheSize();
            if (request === cacheRequest.current) setCacheSize(formatBytes(size));
          } catch {
            if (request === cacheRequest.current) setCacheSize(localized.cacheUnavailable);
          } finally {
            clearingRef.current = false;
            setClearingCache(false);
          }
          if (request === cacheRequest.current) {
            Alert.alert(t('clearCache'), failed ? localized.cacheFailed : t('cacheCleared'));
          }
        }
      }
    ]);
  };

  const getThemeLabel = () => {
    if (themeMode === 'light') return t('lightMode');
    if (themeMode === 'dark') return t('darkMode');
    if (themeMode === 'system') return t('systemMode');
    if (themeMode === 'custom') return t('customMode');
    return '';
  };

  const getLanguageLabel = () => {
    if (languageMode === 'system') return t('systemMode');
    if (languageMode === 'zh') return '简体中文';
    if (languageMode === 'zh-Hant') return '繁體中文';
    if (languageMode === 'en') return 'English';
    if (languageMode === 'it') return 'Italiano';
    return '';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Dynamic Header */}
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Main Settings Page */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('systemSettings')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Theme Link */}
          <Pressable style={[styles.rowPressable, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/settings/theme')}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('themeSetting')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{getThemeLabel()}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          {/* Language Link */}
          <Pressable style={[styles.rowPressable, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/settings/language')}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('languageSetting')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{getLanguageLabel()}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          {/* Notifications Settings Link */}
          <Pressable style={styles.rowPressable} onPress={() => router.push('/settings/notifications')}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.notificationsSetting}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{localized.manageSubscriptions}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>

        {/* Experimental Features Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('experimentalSetting')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Tab Bar Style Link */}
          <Pressable style={[styles.rowPressable, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/settings/tab-bar')}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('tabBarSetting')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                {tabBarStyle === 'glassmorphism' ? t('tabBarGlassmorphism') : t('tabBarTraditional')}
              </Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          {/* Quick Actions Link */}
          <Pressable style={styles.rowPressable} onPress={() => router.push('/settings/quick-actions')}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('quickActionSetting')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>

        {/* Cache & Storage Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('dataStorage')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable style={styles.rowPressable} onPress={handleClearCache} disabled={clearingCache}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('clearCache')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{clearingCache ? '…' : cacheSize}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginHorizontal: 20, marginTop: 8 }}>
          {localized.cacheHint}
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
    flex: 1,
  },
  sectionHeaderContainer: {
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  rowPressable: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowLabel: {
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
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 30,
    marginBottom: 30,
  },
  rowContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flex: 1,
    marginRight: 16,
  },
  rowSubLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});
