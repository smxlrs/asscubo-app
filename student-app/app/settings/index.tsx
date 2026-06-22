import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0.0 KB';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function getCacheSize(): Promise<number> {
  let size = 0;
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return 0;
  try {
    const info = await FileSystem.getInfoAsync(cacheDir);
    if (!info.exists) return 0;
    
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    for (const file of files) {
      const fileUri = `${cacheDir}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        size += fileInfo.size || 0;
      }
    }
  } catch (e) {
    console.warn('Failed to calculate cache size:', e);
  }
  return size;
}

async function clearCacheDir() {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return;
  try {
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    for (const file of files) {
      const fileUri = `${cacheDir}${file}`;
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (e) {
    console.warn('Failed to clear cache directory:', e);
  }
}

export default function SettingsIndexScreen() {
  const { colors, t, themeMode, languageMode } = useTheme();
  const [cacheSize, setCacheSize] = useState('0.0 KB');

  useEffect(() => {
    async function updateCacheSize() {
      const size = await getCacheSize();
      setCacheSize(formatBytes(size));
    }
    updateCacheSize();
  }, []);

  const handleClearCache = () => {
    Alert.alert(t('clearCache'), t('confirmClearCache'), [
      { text: t('cancel'), style: 'cancel' },
      { 
        text: t('confirm'), 
        onPress: async () => {
          await clearCacheDir();
          const size = await getCacheSize();
          setCacheSize(formatBytes(size));
          Alert.alert(t('clearCache'), t('cacheCleared'));
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
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>通知设置</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>管理订阅</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>

        {/* Cache & Storage Section */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('dataStorage')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable style={styles.rowPressable} onPress={handleClearCache}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('clearCache')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{cacheSize}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>
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
});
