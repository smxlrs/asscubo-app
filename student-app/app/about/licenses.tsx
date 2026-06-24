import React from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LicenseItem {
  name: string;
  version: string;
  license: string;
  copyright: string;
  description: string;
  url: string;
}

const LICENSES: LicenseItem[] = [
  {
    name: 'React',
    version: '19.2.3',
    license: 'MIT',
    copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
    description: 'A JavaScript library for building user interfaces.',
    url: 'https://github.com/facebook/react',
  },
  {
    name: 'React Native',
    version: '0.85.3',
    license: 'MIT',
    copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
    description: 'A framework for building native applications using React.',
    url: 'https://github.com/facebook/react-native',
  },
  {
    name: 'Expo Suite',
    version: 'SDK 56',
    license: 'MIT',
    copyright: 'Copyright (c) 650 Industries, Inc.',
    description: 'An open-source platform for making universal native apps with React.',
    url: 'https://github.com/expo/expo',
  },
  {
    name: 'Supabase JS',
    version: '2.108.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2020 Supabase.',
    description: 'Isomorphic JavaScript client for Supabase.',
    url: 'https://github.com/supabase/supabase-js',
  },
  {
    name: 'React Native Reanimated',
    version: '4.3.1',
    license: 'MIT',
    copyright: 'Copyright (c) 2016 Software Mansion.',
    description: 'A powerful animation library for React Native.',
    url: 'https://github.com/software-mansion/react-native-reanimated',
  },
  {
    name: 'expo-quick-actions',
    version: '6.0.2',
    license: 'MIT',
    copyright: 'Copyright (c) 650 Industries, Inc.',
    description: 'Expo plugin for home screen quick actions (app shortcuts).',
    url: 'https://github.com/expo/expo',
  },
  {
    name: 'Pako',
    version: '2.1.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2014-2021 Vitaly Puzrin and contributors.',
    description: 'High speed zlib port in JavaScript.',
    url: 'https://github.com/nodeca/pako',
  },
  {
    name: 'js-mdict',
    version: '7.0.0',
    license: 'MIT',
    copyright: 'Copyright (c) 2017-2021 fengdh.',
    description: 'JavaScript parser for MDict dictionary files (.mdx/.mdd).',
    url: 'https://github.com/fengdh/js-mdict',
  },
  {
    name: 'TypeScript',
    version: '6.0.3',
    license: 'Apache-2.0',
    copyright: 'Copyright (c) Microsoft Corporation.',
    description: 'A typed superset of JavaScript that compiles to plain JavaScript.',
    url: 'https://github.com/microsoft/TypeScript',
  },
];

export default function LicensesScreen() {
  const { colors, t } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>开源许可 / Licenses</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={LICENSES}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <Pressable 
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => Linking.openURL(item.url)}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.libName, { color: colors.textPrimary }]}>{item.name}</Text>
              <View style={[styles.badge, { backgroundColor: colors.border }]}>
                <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{item.license}</Text>
              </View>
            </View>
            <Text style={[styles.versionText, { color: colors.textMuted }]}>版本: {item.version}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
            <Text style={[styles.copyright, { color: colors.textMuted }]}>{item.copyright}</Text>
          </Pressable>
        )}
        contentContainerStyle={styles.listContent}
      />
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
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
    marginVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  libName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 12,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  copyright: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
