import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Article = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  cover_image: string | null;
  created_at: string;
  view_count: number;
  link?: string | null;
  type: 'article' | 'notification';
  is_pinned: boolean;
};

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'event_news', label: '学联活动' },
  { key: 'notice', label: '学术资讯' },
  { key: 'news', label: '生活辅助' },
  { key: 'column', label: '原创专栏' },
  { key: 'reprint', label: '转载' },
  { key: 'general', label: '综合' },
];

const getCategoryLabel = (category: string) => {
  if (category === 'event_news' || category === 'events') return '学联活动';
  if (category === 'notice' || category === 'academic') return '学术资讯';
  if (category === 'news' || category === 'life') return '生活辅助';
  if (category === 'column') return '原创专栏';
  if (category === 'reprint') return '转载';
  return '综合';
};

const getCategoryColor = (category: string) => {
  if (category === 'event_news' || category === 'events') return '#EF4444';
  if (category === 'notice' || category === 'academic') return '#3B82F6';
  if (category === 'news' || category === 'life') return '#10B981';
  if (category === 'column') return '#F59E0B';
  if (category === 'reprint') return '#6B7280';
  return '#8B5CF6';
};

export default function AnnouncementsScreen() {
  const { colors, isDark } = useTheme();
  
  // Loaded database items
  const [loadedArticles, setLoadedArticles] = useState<Article[]>([]);
  const [loadedNotifications, setLoadedNotifications] = useState<Article[]>([]);
  
  // Pagination limits and offset
  const [displayLimit, setDisplayLimit] = useState(15);
  const [hasMoreArticles, setHasMoreArticles] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Combined, filtered, and sliced items currently shown in FlatList
  const [displayItems, setDisplayItems] = useState<Article[]>([]);

  async function fetchInitialData() {
    try {
      setLoading(true);
      // Fetch initial 10 articles and all notifications (up to 100)
      const [articlesRes, notificationsRes] = await Promise.all([
        supabase
          .from('articles')
          .select('id, title, summary, category, cover_image, created_at, view_count, link, is_pinned')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('notifications')
          .select('id, title, content, category, cover_image, created_at, link, is_pinned')
          .order('created_at', { ascending: false })
          .limit(100)
      ]);

      if (articlesRes.error) throw articlesRes.error;
      if (notificationsRes.error) throw notificationsRes.error;

      const articlesData = (articlesRes.data || []).map(item => ({ 
        ...item, 
        type: 'article' as const 
      }));
      
      const notificationsData = (notificationsRes.data || []).map(item => ({
        id: item.id,
        title: item.title,
        summary: item.content || null,
        category: item.category || 'general',
        cover_image: item.cover_image || null,
        created_at: item.created_at,
        view_count: 0,
        link: item.link || null,
        type: 'notification' as const,
        is_pinned: item.is_pinned
      }));

      setLoadedArticles(articlesData);
      setLoadedNotifications(notificationsData);
      setHasMoreArticles(articlesData.length === 10);
      setDisplayLimit(15);
    } catch (e) {
      console.error('Failed to fetch initial announcements data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMoreArticles() {
    if (loadingMoreRef.current || !hasMoreArticles) return;

    try {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const currentOffset = loadedArticles.length;
      console.log(`Paging more articles from offset: ${currentOffset}...`);
      
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, summary, category, cover_image, created_at, view_count, link, is_pinned')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + 9);

      if (error) throw error;

      if (data && data.length > 0) {
        const newArticles = data.map(item => ({ ...item, type: 'article' as const }));
        setLoadedArticles(prev => {
          const combined = [...prev, ...newArticles];
          return combined.filter((art, idx, self) => self.findIndex(a => a.id === art.id) === idx);
        });
        setHasMoreArticles(data.length === 10);
      } else {
        setHasMoreArticles(false);
      }

      // Increment limit
      setDisplayLimit(prev => prev + 15);
    } catch (e) {
      console.error('Failed to load more articles:', e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInitialData();
  };

  // Re-combine, filter, sort and slice list items
  useEffect(() => {
    let combined = [...loadedArticles, ...loadedNotifications];

    // Filter by category
    if (selectedCategory !== 'all') {
      combined = combined.filter(item => {
        const cat = item.category;
        if (selectedCategory === 'event_news') return cat === 'event_news' || cat === 'events';
        if (selectedCategory === 'notice') return cat === 'notice' || cat === 'academic';
        if (selectedCategory === 'news') return cat === 'news' || cat === 'life';
        if (selectedCategory === 'general') return cat === 'general';
        return cat === selectedCategory;
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
  }, [loadedArticles, loadedNotifications, selectedCategory, search, displayLimit]);

  const handleEndReached = () => {
    // Only load from network if we reached the display limit
    if (displayItems.length >= displayLimit) {
      if (hasMoreArticles) {
        loadMoreArticles();
      } else {
        setDisplayLimit(prev => prev + 15);
      }
    }
  };

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? "light" : "dark"} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm }}>
          <MaterialCommunityIcons name="bullhorn-outline" size={24} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.title, { color: colors.textPrimary, marginBottom: 0 }]}>动态与通知</Text>
        </View>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="搜索动态与通知..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Filter */}
      <View style={styles.filterRow}>
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
              { 
                color: selectedCategory === cat.key ? '#FFFFFF' : colors.textSecondary 
              }
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={(item) => `${item.type}-${item.id}`}
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
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>暂无相关内容</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                if (item.type === 'notification') {
                  if (item.link) {
                    router.push(`/article/web?url=${encodeURIComponent(item.link)}&title=${encodeURIComponent(item.title)}` as any);
                  } else {
                    router.push('/(tabs)/notifications');
                  }
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
                          <Text style={[styles.typeText, { color: '#F59E0B' }]}>置顶</Text>
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
                          {item.type === 'notification' ? '通知' : '文章'}
                        </Text>
                      </View>

                      {/* Category Badge */}
                      {item.category !== 'general' && (
                        <View style={[styles.catBadge, { backgroundColor: getCategoryColor(item.category) + '25' }]}>
                          <Text style={[styles.catText, { color: getCategoryColor(item.category) }]}>
                            {getCategoryLabel(item.category)}
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
                {item.type === 'article' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="eye-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                    <Text style={[styles.views, { color: colors.textMuted }]}>{item.view_count} 次阅读</Text>
                  </View>
                ) : <View />}
                <Text style={[styles.readMore, { color: colors.primary }]}>
                  {item.type === 'notification' && !item.link ? '查看详情 →' : '阅读全文 →'}
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
  container: { flex: 1, backgroundColor: COLORS.background },
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.base,
    gap: SPACING.sm,
    flexWrap: 'wrap',
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
