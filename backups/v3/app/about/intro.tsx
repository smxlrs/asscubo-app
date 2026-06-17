import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PlatformIntroScreen() {
  const { colors, t } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primaryLight }]}>← {t('back')}</Text>
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
          本App不仅是信息发布的权威出口，还内置了留学生在学术、生活、求职等方面的多样化实用小工具（如汇率换算、常见问题手册等）。我们期望将平台打造成全场景覆盖的高效率一站式载体。
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
