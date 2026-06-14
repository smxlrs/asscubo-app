import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AssociationScreen() {
  const { colors, t } = useTheme();

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('aboutACSS')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.textDetailsContent}>
        <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{t('aboutACSS')}</Text>
        <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
          {t('acssDescription')}
        </Text>
        <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
          学联致力于全心全意为学子服务，搭建立足本地、面向欧洲的学术桥梁，定期举办学术沙龙、求职交流会、文艺晚会以及体育赛事，丰富留学人员的精神生活，是学子在海外温暖的港湾。
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
