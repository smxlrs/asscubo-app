import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOCALIZED = {
  zh: {
    introParagraph2: '本App不仅是信息发布的权威出口，还内置了留学生在学术、生活、求职等方面的多样化实用小工具（如汇率换算、常见问题手册等）。我们期望将平台打造成全场景覆盖的高效率一站式载体。',
  },
  'zh-Hant': {
    introParagraph2: '本App不僅是信息發布的權威出口，還內置了留學生在學術、生活、求職等方面的多樣化實用小工具（如匯率換算、常見問題手冊等）。我們期望將平台打造成全場景覆蓋的高效率一站式載體。',
  },
  en: {
    introParagraph2: 'This App serves not only as an authoritative portal for information release, but also integrates a variety of practical tools for international students in academic, daily life, and career development aspects (such as exchange rates, FAQ manual, etc.). We aim to make this platform a highly efficient one-stop hub covering all scenarios.',
  },
  it: {
    introParagraph2: 'Questa applicazione non è solo un canale ufficiale per la pubblicazione di informazioni, ma integra anche vari strumenti utili per gli studenti internazionali in ambito accademico, quotidiano e professionale (come tassi di cambio, manuale FAQ, ecc.). Vogliamo rendere la piattaforma un punto di riferimento one-stop ad alta efficienza per tutte le esigenze.',
  }
};

export default function PlatformIntroScreen() {
  const { colors, t, language } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('platformIntro')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.textDetailsContent}>
        <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{t('platformIntro')}</Text>
        <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
          {t('aboutDescription')}
        </Text>
        <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
          {localized.introParagraph2}
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
});
