import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type Article = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  cover_image: string | null;
  created_at: string;
  view_count: number;
};

type Event = {
  id: string;
  title: string;
  location: string | null;
  start_time: string;
  cover_image: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  notice: '通知',
  news: '新闻',
  event_news: '活动',
  general: '综合',
};

const CATEGORY_COLORS: Record<string, string> = {
  notice: '#FF6B6B',
  news: '#4ECDC4',
  event_news: '#C9A84C',
  general: '#A0A0A0',
};

export default function HomeScreen() {
  const { profile } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    const [articlesRes, eventsRes] = await Promise.all([
      supabase
        .from('articles')
        .select('id, title, summary, category, cover_image, created_at, view_count')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('events')
        .select('id, title, location, start_time, cover_image')
        .eq('is_published', true)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(3),
    ]);

    if (articlesRes.data) setArticles(articlesRes.data);
    if (eventsRes.data) setUpcomingEvents(eventsRes.data);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchData(); }, []);

  function onRefresh() {
    setRefreshing(true);
    fetchData();
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? '早上好' : greetingHour < 18 ? '下午好' : '晚上好';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header Banner */}
        <LinearGradient
          colors={['#A31621', '#7A1018', '#1A0508']}
          style={styles.headerBanner}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>{greeting}，{profile?.name || '同学'} 👋</Text>
              <Text style={styles.headerSubtitle}>学联之家 · 连接校园生活</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {profile?.name ? profile.name[0] : '学'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{articles.length}</Text>
              <Text style={styles.statLabel}>篇文章</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{upcomingEvents.length}</Text>
              <Text style={styles.statLabel}>个活动</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>在线</Text>
              <Text style={styles.statLabel}>状态</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {[
            { icon: '📢', label: '公告', route: '/(tabs)/announcements' },
            { icon: '📅', label: '活动', route: '/(tabs)/events' },
            { icon: '📖', label: '手册', route: '/(tabs)/handbook' },
            { icon: '💬', label: '社群', route: '/(tabs)/community' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.quickActionItem}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionEmoji}>{item.icon}</Text>
              </View>
              <Text style={styles.quickActionLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 近期活动</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/events')}>
                <Text style={styles.seeAll}>查看全部 →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {upcomingEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => router.push(`/event/${event.id}` as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#242424', '#1A1A1A']}
                    style={styles.eventCardGradient}
                  >
                    <View style={styles.eventDateBadge}>
                      <Text style={styles.eventDateText}>{formatDate(event.start_time)}</Text>
                    </View>
                    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                    {event.location && (
                      <Text style={styles.eventLocation} numberOfLines={1}>📍 {event.location}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Latest Articles */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📰 最新动态</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/announcements')}>
              <Text style={styles.seeAll}>查看全部 →</Text>
            </TouchableOpacity>
          </View>

          {articles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>暂无文章，敬请期待</Text>
            </View>
          ) : (
            articles.map((article, index) => (
              <TouchableOpacity
                key={article.id}
                style={styles.articleCard}
                onPress={() => router.push(`/article/${article.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.articleLeft}>
                  <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[article.category] + '20' }]}>
                    <Text style={[styles.categoryText, { color: CATEGORY_COLORS[article.category] }]}>
                      {CATEGORY_LABELS[article.category] || '综合'}
                    </Text>
                  </View>
                  <Text style={styles.articleTitle} numberOfLines={2}>{article.title}</Text>
                  {article.summary && (
                    <Text style={styles.articleSummary} numberOfLines={2}>{article.summary}</Text>
                  )}
                  <View style={styles.articleMeta}>
                    <Text style={styles.articleDate}>{formatDate(article.created_at)}</Text>
                    <Text style={styles.articleViews}>👁 {article.view_count}</Text>
                  </View>
                </View>
                {index === 0 && (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredText}>置顶</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  headerBanner: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  avatarButton: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: RADIUS.md,
    padding: SPACING.base,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  quickActionItem: { flex: 1, alignItems: 'center' },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  quickActionEmoji: { fontSize: 24 },
  quickActionLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.base,
  },
  sectionTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  horizontalScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  eventCard: {
    width: 200,
    marginRight: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  eventCardGradient: { padding: SPACING.base },
  eventDateBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  eventDateText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  eventTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  eventLocation: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  articleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...SHADOWS.sm,
  },
  articleLeft: { flex: 1 },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    marginBottom: SPACING.xs,
  },
  categoryText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.semiBold,
  },
  articleTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: SPACING.xs,
  },
  articleSummary: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  articleMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 2,
  },
  articleDate: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  articleViews: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  featuredBadge: {
    backgroundColor: COLORS.gold + '20',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    marginLeft: SPACING.sm,
  },
  featuredText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    color: COLORS.gold,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
});
