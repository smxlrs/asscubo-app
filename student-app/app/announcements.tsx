import { LoadingImage } from '../components/LoadingImage';
import { usePublicationFeed } from '../hooks/usePublicationFeed';
import { useAuth } from '../context/AuthContext';
import { localDateInput } from '../lib/eventTime';
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Image, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../constants/theme';
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler';

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'events', label: '学联活动' },
  { key: 'academic', label: '学术资讯' },
  { key: 'life', label: '生活辅助' },
  { key: 'general', label: '综合通知' },
];

const getCategoryLabel = (category: string, t: (key: string) => string) => {
  if (category === 'events' || category === 'event_news') return t('category_events');
  if (category === 'academic' || category === 'notice') return t('category_academic');
  if (category === 'life' || category === 'news') return t('category_life');
  return t('category_general');
};

const getCategoryColor = (category: string) => {
  if (category === 'events' || category === 'event_news') return '#EF4444';
  if (category === 'academic' || category === 'notice') return '#3B82F6';
  if (category === 'life' || category === 'news') return '#10B981';
  return '#8B5CF6';
};

export default function AnnouncementsScreen() {
  const { colors, isDark, t } = useTheme();

  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const feed = usePublicationFeed({ kind: 'all', category: selectedCategory, search }, user?.id ?? null);
  const { items: displayItems, loading, refreshing, loadingMore, hasError, errorReason } = feed;
  const onRefresh = () => { void feed.refresh(); };
  const handleEndReached = () => { void feed.loadMore(); };

  const closeSearch = () => {
    setIsSearching(false);
    setSearch('');
  };

  const handleBackPress = () => {
    if (isSearching) {
      closeSearch();
      return true;
    }

    router.back();
    return true;
  };

  useEffect(() => {
    if (isSearching) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isSearching]);

  useAndroidBackHandler(handleBackPress, [isSearching]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return localDateInput(d.toISOString()).slice(0, 10);
  }

  const bgColor = isDark ? '#0A0A0A' : '#FFFFFF';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerIconButton}
            activeOpacity={0.7}
            onPress={handleBackPress}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.primary} />
          </TouchableOpacity>

          {isSearching ? (
            <TextInput
              ref={searchInputRef}
              style={[
                styles.headerSearchInput,
                {
                  backgroundColor: colors.surface,
                  color: colors.textPrimary,
                  borderColor: colors.border,
                },
              ]}
              placeholder={t('searchAnnouncementsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          ) : (
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {t('latestUpdates')}
            </Text>
          )}

          {isSearching ? (
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={closeSearch}
            >
              <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={() => setIsSearching(true)}
            >
              <MaterialCommunityIcons name="magnify" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.filterChip,
                selectedCategory === cat.key && {
                  backgroundColor: cat.key === 'all' ? colors.primarySoft : getCategoryColor(cat.key) + '15',
                }
              ]}
              onPress={() => {
                setSelectedCategory(cat.key);
              }}
            >
              <Text style={[
                styles.filterText,
                {
                  color: selectedCategory === cat.key
                    ? cat.key === 'all' ? colors.primaryLight : getCategoryColor(cat.key)
                    : colors.textSecondary,
                }
              ]}>
                {t('category_' + cat.key)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40, backgroundColor: bgColor }} color={colors.primary} />
      ) : hasError ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={48} color="#A31621" style={{ marginBottom: 12 }} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {t('networkErrorTitle') || '网络似乎出了点问题'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
            {t(errorReason)}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              void feed.refresh();
            }}
          >
            <Text style={styles.retryBtnText}>{t('retry') || '重新连接'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => `${item.type}:${item.id}`}
          style={{ backgroundColor: bgColor }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: 12 }} color={colors.primary} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noRelatedContent')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                if (item.type === 'article') {
                  router.push(`/article/${item.id}` as any);
                } else if (item.link) {
                  router.push(`/article/web?url=${encodeURIComponent(item.link)}&title=${encodeURIComponent(item.title)}` as any);
                } else {
                  router.push(`/article/${item.id}` as any);
                }
              }}
              activeOpacity={0.85}
            >
              <View style={styles.cardContentRow}>
                <View style={styles.cardTextContent}>
                  <View style={styles.cardTop}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 4 }}>
                      {/* Pinned Badge */}
                      {item.is_pinned && (
                        <View style={[
                          styles.typeBadge,
                          {
                            backgroundColor: '#F59E0B20',
                            marginRight: 6,
                            flexDirection: 'row',
                            alignItems: 'center'
                          }
                        ]}>
                          <MaterialCommunityIcons name="pin" size={10} color="#F59E0B" style={{ marginRight: 2 }} />
                          <Text style={[styles.typeText, { color: '#F59E0B' }]}>{t('featured')}</Text>
                        </View>
                      )}

                      {/* Type Badge */}
                      <View style={[
                        styles.typeBadge,
                        {
                          backgroundColor: item.type === 'notification' ? '#3B82F6' : '#10B981',
                          marginRight: 6
                        }
                      ]}>
                        <Text style={[
                          styles.typeText,
                          { color: '#FFFFFF', fontWeight: 'bold' }
                        ]}>
                          {item.type === 'notification' ? t('notificationType') : t('articleType')}
                        </Text>
                      </View>

                      {/* Category Badge */}
                      {item.category !== 'general' && (
                        <View style={[styles.catBadge, { backgroundColor: getCategoryColor(item.category) + '25' }]}>
                          <Text style={[styles.catText, { color: getCategoryColor(item.category) }]}>
                            {getCategoryLabel(item.category, t)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                  {item.summary && <Text style={[styles.cardSummary, { color: colors.textSecondary }]} numberOfLines={2}>{item.summary}</Text>}
                </View>
                {item.cover_image ? (
                  <LoadingImage
                    source={{
                      uri: item.cover_image,
                      headers: {
                        Referer: 'https://mp.weixin.qq.com',
                      },
                    }}
                    style={styles.cardImage}
                    backgroundColor={colors.surface}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
              <View style={styles.cardBottom}>
                <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
                <Text style={[styles.readMore, { color: colors.primary }]}>
                  {!item.link ? t('viewDetailsArrow') : t('readFullArticleArrow')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingLeft: 4, paddingRight: SPACING.lg, paddingTop: 4, paddingBottom: SPACING.sm },
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  headerSearchInput: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: 'bold', color: COLORS.textSecondary },
  filterTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 20 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  cardTextContent: {
    flex: 1,
    minWidth: 0,
  },
  cardImage: {
    width: '42%',
    maxWidth: 176,
    flexShrink: 0,
    aspectRatio: 2,
    borderRadius: RADIUS.md,
    marginLeft: SPACING.md,
    backgroundColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  catBadge: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  catText: { fontSize: SIZES.xs, fontFamily: FONTS.bold },
  typeBadge: { borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  typeText: { fontSize: SIZES.xs, fontFamily: FONTS.bold },
  date: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  cardTitle: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, lineHeight: 22, marginBottom: SPACING.xs },
  cardSummary: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SPACING.sm },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  views: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  readMore: { flexShrink: 1, textAlign: 'right', fontSize: SIZES.xs, fontFamily: FONTS.medium, color: COLORS.primary },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.base, fontFamily: FONTS.regular, color: COLORS.textMuted },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
