import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme, LanguageMode } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LanguageSettingsScreen() {
  const { colors, t, languageMode, setLanguage } = useTheme();

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('languageSetting')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('languageSetting')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            { id: 'system', label: t('systemMode') },
            { id: 'zh', label: '简体中文' },
            { id: 'zh-Hant', label: '繁體中文' },
            { id: 'en', label: 'English' },
            { id: 'it', label: 'Italiano' }
          ] as { id: LanguageMode; label: string }[]).map((lang, index, arr) => (
            <Pressable 
              key={lang.id}
              style={[
                styles.rowPressable, 
                { 
                  borderBottomColor: colors.border,
                  borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth 
                }
              ]} 
              onPress={() => setLanguage(lang.id)}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{lang.label}</Text>
              {languageMode === lang.id && (
                <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
              )}
            </Pressable>
          ))}
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
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
