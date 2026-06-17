import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const { colors, t } = useTheme();

  const [activeView, setActiveView] = useState<'main' | 'association' | 'intro' | 'feedback'>('main');
  const [contact, setContact] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const handleFeedbackSubmit = () => {
    if (!contact.trim() || !feedbackText.trim()) {
      Alert.alert(t('feedback'), t('feedbackError'));
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert(t('feedback'), t('feedbackSuccess'));
      setContact('');
      setFeedbackText('');
      setActiveView('main');
    }, 1500);
  };

  const handleBack = () => {
    if (activeView !== 'main') {
      setActiveView('main');
    } else {
      router.back();
    }
  };

  const getHeaderTitle = () => {
    if (activeView === 'association') return t('aboutACSS');
    if (activeView === 'intro') return t('platformIntro');
    if (activeView === 'feedback') return t('feedback');
    return t('about');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={[styles.backText, { color: colors.primaryLight }]}>← {t('back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{getHeaderTitle()}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {activeView === 'main' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🏠</Text>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>{t('appName')}</Text>
            <Text style={[styles.version, { color: colors.textSecondary }]}>Version 1.0.0 (Beta)</Text>
          </View>

          <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* 1. About ACSS */}
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => setActiveView('association')}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('aboutACSS')}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>

            {/* 2. Platform Intro */}
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => setActiveView('intro')}>
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
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => setActiveView('feedback')}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('feedback')}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>
          </View>

          <Text style={[styles.copyright, { color: colors.textMuted }]}>
            © 2026 {t('copyright')}
          </Text>
        </ScrollView>
      )}

      {activeView === 'association' && (
        <ScrollView contentContainerStyle={styles.textDetailsContent}>
          <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{t('aboutACSS')}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            {t('acssDescription')}
          </Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            学联致力于全心全意为学子服务，搭建立足本地、面向欧洲的学术桥梁，定期举办学术沙龙、求职交流会、文艺晚会以及体育赛事，丰富留学人员的精神生活，是学子在海外温暖的港湾。
          </Text>
        </ScrollView>
      )}

      {activeView === 'intro' && (
        <ScrollView contentContainerStyle={styles.textDetailsContent}>
          <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{t('platformIntro')}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            {t('aboutDescription')}
          </Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            本App不仅是信息发布的权威出口，还内置了留学生在学术、生活、求职等方面的多样化实用小工具（如汇率换算、常见问题手册等）。我们期望将平台打造成全场景覆盖的高效率一站式载体。
          </Text>
        </ScrollView>
      )}

      {activeView === 'feedback' && (
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.formHeaderTitle, { color: colors.textPrimary }]}>{t('feedback')}</Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('contactInfo')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('contactInfo')}
              placeholderTextColor={colors.textMuted}
              value={contact}
              onChangeText={setContact}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('feedbackContent')}</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('feedbackContent')}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
          </View>

          <Pressable 
            style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]} 
            onPress={handleFeedbackSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>{t('submit')}</Text>
            )}
          </Pressable>
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
  textDetailsContent: {
    padding: 24,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailParagraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 14,
  },
  formContent: {
    padding: 24,
  },
  formHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  textArea: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    paddingTop: 16,
  },
  submitButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
