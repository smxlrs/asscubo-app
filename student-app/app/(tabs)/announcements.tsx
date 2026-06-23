import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Image, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type NotificationItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  cover_image: string | null;
  created_at: string;
  link?: string | null;
  is_pinned: boolean;
  type: 'notification' | 'article';
};

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
  
  // Loaded database items
  const [loadedNotifications, setLoadedNotifications] = useState<NotificationItem[]>([]);
  
  // Pagination limits and offset
  const [displayLimit, setDisplayLimit] = useState(15);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Combined, filtered, and sliced items currently shown in FlatList
  const [displayItems, setDisplayItems] = useState<NotificationItem[]>([]);

  async function fetchInitialData() {
    try {
      setLoading(true);
      
      const [notificationsRes, articlesRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, title, content, category, cover_image, created_at, link, is_pinned')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('articles')
          .select('id, title, summary, category, cover_image, created_at, link, is_pinned')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      if (notificationsRes.error) throw notificationsRes.error;
      if (articlesRes.error) throw articlesRes.error;

      const notificationsData = (notificationsRes.data || []).map(item => ({
        id: item.id,
        title: item.title,
        summary: item.content || null,
        category: item.category || 'general',
        cover_image: item.cover_image || null,
        created_at: item.created_at,
        link: item.link || null,
        is_pinned: item.is_pinned,
        type: 'notification' as const
      }));

      const articlesData = (articlesRes.data || []).map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary || null,
        category: item.category || 'general',
        cover_image: item.cover_image || null,
        created_at: item.created_at,
        link: item.link || null,
        is_pinned: item.is_pinned,
        type: 'article' as const
      }));

      const combined = [...notificationsData, ...articlesData];

      // Sort by is_pinned DESC, then created_at DESC
      combined.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setLoadedNotifications(combined);
      setHasMoreNotifications(false); // Cap reached
      setDisplayLimit(40);
    } catch (e) {
      console.error('Failed to fetch initial announcements data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMoreNotifications() {
    setHasMoreNotifications(false);
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInitialData();
  };

  // Filter, sort and slice list items
  useEffect(() => {
    let combined = [...loadedNotifications];

    // Filter by category
    if (selectedCategory !== 'all') {
      combined = combined.filter(item => {
        if (item.type === 'article') {
          if (selectedCategory === 'events') return item.category === 'event_news';
          if (selectedCategory === 'academic') return item.category === 'notice';
          if (selectedCategory === 'life') return item.category === 'news';
          if (selectedCategory === 'general') return item.category === 'general';
          return item.category === selectedCategory;
        } else {
          return item.category === selectedCategory;
        }
      });
    }

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      combined = combined.filter(item => 
        item.title.toLowerCase().includes(q) ||
        (item.summary && item.summary.toLowerCase().includes(q))
      );
    }

    // Sort by is_pinned DESC, then created_at DESC
    combined.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setDisplayItems(combined.slice(0, displayLimit));
  }, [loadedNotifications, selectedCategory, search, displayLimit]);

  const handleEndReached = () => {
    if (displayItems.length >= displayLimit) {
      if (hasMoreNotifications) {
        loadMoreNotifications();
      } else {
        setDisplayLimit(prev => prev + 15);
      }
    }
  };

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const bgColor = isDark ? '#0A0A0A' : '#FFFFFF';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]} edges={['top']}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
          <MaterialCommunityIcons name="bullhorn-outline" size={24} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.title, { color: colors.textPrimary, marginBottom: 0 }]}>{t('latestUpdates')}</Text>
        </View>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder={t('searchAnnouncementsPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScrollView}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.filterChip, 
              { 
                backgroundColor: selectedCategory === cat.key ? colors.primary : colors.surface, 
                borderColor: selectedCategory === cat.key ? colors.primary : colors.border 
              }
            ]}
            onPress={() => {
              setSelectedCategory(cat.key);
              setDisplayLimit(15); // reset limit on category change
            }}
          >
            <Text style={[
              styles.filterText, 
              { color: selectedCategory === cat.key ? '#FFFFFF' : colors.textSecondary }
            ]}>
              {t('category_' + cat.key)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40, backgroundColor: bgColor }} color={colors.primary} />
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => item.id}
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
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                    <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                  {item.summary && <Text style={[styles.cardSummary, { color: colors.textSecondary }]} numberOfLines={2}>{item.summary}</Text>}
                </View>
                {item.cover_image ? (
                  <Image
                    source={{
                      uri: item.cover_image,
                      headers: {
                        Referer: 'https://mp.weixin.qq.com',
                      },
                    }}
                    style={[styles.cardImage, { backgroundColor: colors.border }]}
                    resizeMode="cover"
                  />
                ) : null}
              </View>
              <View style={styles.cardBottom}>
                <View />
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
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, paddingBottom: SPACING.sm },
  title: { fontSize: SIZES.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    fontSize: SIZES.md,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterScrollView: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.base,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: SIZES.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
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
  },
  cardImage: {
    width: 80,
    height: 80,
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
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  views: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  readMore: { fontSize: SIZES.xs, fontFamily: FONTS.medium, color: COLORS.primary },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.base, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
