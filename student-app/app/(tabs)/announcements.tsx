import React, { useEffect, useState } from 'react';
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
};

const CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'notice', label: '通知' },
  { key: 'news', label: '新闻' },
  { key: 'event_news', label: '活动' },
  { key: 'general', label: '综合' },
];

const CATEGORY_COLORS: Record<string, string> = {
  notice: '#FF6B6B', news: '#4ECDC4', event_news: '#C9A84C', general: '#A0A0A0',
};

export default function AnnouncementsScreen() {
  const { colors, isDark } = useTheme();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  async function fetchArticles() {
    let query = supabase
      .from('articles')
      .select('id, title, summary, category, cover_image, created_at, view_count')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (selectedCategory !== 'all') query = query.eq('category', selectedCategory);
    if (search.trim()) query = query.ilike('title', `%${search.trim()}%`);

    const { data } = await query.limit(50);
    if (data) setArticles(data);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchArticles(); }, [selectedCategory, search]);

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
          <Text style={[styles.title, { color: colors.textPrimary, marginBottom: 0 }]}>公告与新闻</Text>
        </View>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="搜索文章..."
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
            onPress={() => setSelectedCategory(cat.key)}
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
          data={articles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchArticles(); }} tintColor={colors.primary} />
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
              onPress={() => router.push(`/article/${item.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.cardContentRow}>
                <View style={styles.cardTextContent}>
                  <View style={styles.cardTop}>
                    <View style={[styles.catBadge, { backgroundColor: (CATEGORY_COLORS[item.category] || '#A0A0A0') + '25' }]}>
                      <Text style={[styles.catText, { color: CATEGORY_COLORS[item.category] || '#A0A0A0' }]}>
                        {CATEGORIES.find(c => c.key === item.category)?.label || '综合'}
                      </Text>
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
                <Text style={[styles.views, { color: colors.textMuted }]}>👁 {item.view_count} 次阅读</Text>
                <Text style={[styles.readMore, { color: colors.primary }]}>阅读全文 →</Text>
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
