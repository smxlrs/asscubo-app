import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme, ThemeMode, Language } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { 
    colors, 
    t, 
    themeMode, 
    setThemeMode, 
    customStart, 
    setCustomStart, 
    customEnd, 
    setCustomEnd, 
    language, 
    setLanguage 
  } = useTheme();

  const [activeView, setActiveView] = useState<'main' | 'theme' | 'language'>('main');
  const [cacheSize, setCacheSize] = useState('12.4 MB');

  const handleClearCache = () => {
    Alert.alert(t('clearCache'), t('confirmClearCache'), [
      { text: t('cancel'), style: 'cancel' },
      { 
        text: t('confirm'), 
        onPress: () => {
          setCacheSize('0.0 KB');
          Alert.alert(t('clearCache'), t('cacheCleared'));
        } 
      }
    ]);
  };

  const adjustCustomTime = (type: 'start' | 'end', unit: 'hour' | 'min', operation: '+' | '-') => {
    const timeStr = type === 'start' ? customStart : customEnd;
    let [h, m] = timeStr.split(':').map(Number);

    if (unit === 'hour') {
      if (operation === '+') h = (h + 1) % 24;
      else h = (h - 1 + 24) % 24;
    } else {
      if (operation === '+') m = (m + 5) % 60;
      else m = (m - 5 + 60) % 60;
    }

    const paddedH = h.toString().padStart(2, '0');
    const paddedM = m.toString().padStart(2, '0');
    const formatted = `${paddedH}:${paddedM}`;

    if (type === 'start') {
      setCustomStart(formatted);
    } else {
      setCustomEnd(formatted);
    }
  };

  const getThemeLabel = () => {
    if (themeMode === 'light') return t('lightMode');
    if (themeMode === 'dark') return t('darkMode');
    if (themeMode === 'system') return t('systemMode');
    if (themeMode === 'custom') return t('customMode');
    return '';
  };

  const getLanguageLabel = () => {
    if (language === 'zh') return '简体中文';
    if (language === 'en') return 'English';
    if (language === 'it') return 'Italiano';
    return '';
  };

  const handleBack = () => {
    if (activeView !== 'main') {
      setActiveView('main');
    } else {
      router.back();
    }
  };

  const getHeaderTitle = () => {
    if (activeView === 'theme') return t('themeSetting');
    if (activeView === 'language') return t('languageSetting');
    return t('settings');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Dynamic Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={[styles.backText, { color: colors.primaryLight }]}>← {t('back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{getHeaderTitle()}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {activeView === 'main' && (
        <ScrollView style={styles.content}>
          {/* Main Settings Page */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>{t('systemSettings')}</Text>
          </View>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Theme Link */}
            <Pressable style={[styles.rowPressable, { borderBottomColor: colors.border }]} onPress={() => setActiveView('theme')}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('themeSetting')}</Text>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{getThemeLabel()}</Text>
                <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
              </View>
            </Pressable>

            {/* Language Link */}
            <Pressable style={[styles.rowPressable, { borderBottomColor: colors.border }]} onPress={() => setActiveView('language')}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('languageSetting')}</Text>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{getLanguageLabel()}</Text>
                <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
              </View>
            </Pressable>
          </View>

          {/* Cache & Storage Section */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>{t('dataStorage')}</Text>
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

          <Text style={[styles.versionText, { color: colors.textMuted }]}>{t('version')}</Text>
        </ScrollView>
      )}

      {activeView === 'theme' && (
        <ScrollView style={styles.content}>
          {/* Theme selection sub-view */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>{t('themeSetting')}</Text>
          </View>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {([
              { id: 'light', label: t('lightMode') },
              { id: 'dark', label: t('darkMode') },
              { id: 'system', label: t('systemMode') },
              { id: 'custom', label: t('customMode') }
            ] as { id: ThemeMode; label: string }[]).map((mode) => (
              <Pressable 
                key={mode.id}
                style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
                onPress={() => setThemeMode(mode.id)}
              >
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{mode.label}</Text>
                {themeMode === mode.id && (
                  <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>

          {/* Custom time configuration inside theme submenu */}
          {themeMode === 'custom' && (
            <View style={[styles.customTimeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.customTimeRangeInfo, { color: colors.textSecondary }]}>
                {t('customTimeRange')}
              </Text>
              
              <View style={styles.timePickerRow}>
                <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>{t('startTime')}</Text>
                <View style={styles.timeControls}>
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'hour', '-')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customStart.split(':')[0]}</Text>
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'hour', '+')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                  
                  <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
                  
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'min', '-')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customStart.split(':')[1]}</Text>
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'min', '+')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.timePickerRow, { marginTop: 15 }]}>
                <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>{t('endTime')}</Text>
                <View style={styles.timeControls}>
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'hour', '-')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customEnd.split(':')[0]}</Text>
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'hour', '+')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                  
                  <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
                  
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'min', '-')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                  </Pressable>
                  <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customEnd.split(':')[1]}</Text>
                  <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'min', '+')}>
                    <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeView === 'language' && (
        <ScrollView style={styles.content}>
          {/* Language selection sub-view */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeader}>{t('languageSetting')}</Text>
          </View>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {([
              { id: 'zh', label: '简体中文' },
              { id: 'en', label: 'English' },
              { id: 'it', label: 'Italiano' }
            ] as { id: Language; label: string }[]).map((lang) => (
              <Pressable 
                key={lang.id}
                style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
                onPress={() => setLanguage(lang.id)}
              >
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{lang.label}</Text>
                {language === lang.id && (
                  <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
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
    marginLeft: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 13,
    color: '#8A8A8F',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  rowPressable: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 15,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
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
  customTimeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  customTimeRangeInfo: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeText: {
    width: 32,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 30,
    marginBottom: 30,
  },
});
