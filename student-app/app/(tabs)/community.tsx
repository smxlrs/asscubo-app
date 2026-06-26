import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Post = {
  id: string;
  title: string;
  content: string;
  group_type: string;
  group_value: string;
  reply_count: number;
  created_at: string;
  author: { name: string | null; faculty: string | null } | null;
};

const GROUP_TYPES = [
  { key: 'general', label: '📢 全体' },
  { key: 'faculty', label: '🏛️ 按院系' },
  { key: 'year', label: '📅 按年级' },
  { key: 'campus', label: '🏫 按校区' },
];

export default function CommunityScreen() {
  const { user, profile } = useAuth();
  const { colors, isDark, t, language } = useTheme();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [selectedType, setSelectedType] = useState('general');

  async function fetchPosts() {
    try {
      setHasError(false);
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, title, content, group_type, group_value, reply_count, created_at, author:author_id(name, faculty)')
        .eq('group_type', selectedType)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (data) setPosts(data as any);
    } catch (e) {
      console.warn('Failed to fetch community posts:', e);
      setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchPosts(); }, [selectedType]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (diffH < 1) return t('comm_time_just_now');
    if (diffH < 24) return t('comm_time_hours_ago').replace('{hours}', String(diffH));
    if (diffH < 168) return t('comm_time_days_ago').replace('{days}', String(Math.floor(diffH / 24)));
    if (language === 'zh' || language === 'zh-Hant') {
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    }
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return d.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', options);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('comm_title')}</Text>
        <TouchableOpacity
          style={[styles.newPostBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/community/new' as any)}
        >
          <Text style={styles.newPostText}>{t('comm_new_post')}</Text>
        </TouchableOpacity>
      </View>

      {/* Group type tabs */}
      <View style={styles.typeTabs}>
        {GROUP_TYPES.map((gt) => (
          <TouchableOpacity
            key={gt.key}
            style={[
              styles.typeTab, 
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedType === gt.key && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setSelectedType(gt.key)}
          >
            <Text style={[
              styles.typeTabText, 
              { color: colors.textSecondary },
              selectedType === gt.key && { color: '#FFFFFF' }
            ]}>
              {t('comm_filter_' + (gt.key === 'general' ? 'all' : gt.key))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : hasError ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={48} color="#A31621" style={{ marginBottom: 12 }} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {t('networkErrorTitle') || '网络似乎出了点问题'}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
            {t('networkErrorSub') || '目前无法连接到服务器，请检查您的网络设置'}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              setLoading(true);
              fetchPosts();
            }}
          >
            <Text style={styles.retryBtnText}>{t('retry') || '重新连接'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💭</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('comm_empty_posts')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/community/${item.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.postHeader}>
                <View style={[styles.authorAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.authorAvatarText}>
                    {item.author?.name?.[0] || t('comm_anon_avatar')}
                  </Text>
                </View>
                <View style={styles.authorInfo}>
                  <Text style={[styles.authorName, { color: colors.textPrimary }]}>
                    {item.author?.name || t('comm_anon_user')}
                  </Text>
                  <Text style={[styles.postMeta, { color: colors.textMuted }]}>
                    {item.author?.faculty && `${item.author.faculty} · `}{formatDate(item.created_at)}
                  </Text>
                </View>
                {item.group_value !== 'all' && (
                  <View style={[styles.groupBadge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.groupBadgeText, { color: colors.primary }]}>{item.group_value}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.postTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.postContent, { color: colors.textSecondary }]} numberOfLines={2}>{item.content}</Text>
              <View style={styles.postFooter}>
                <Text style={[styles.replyCount, { color: colors.textMuted }]}>
                  {t('comm_replies_count').replace('{count}', String(item.reply_count))}
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
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: SIZES.xl, fontFamily: FONTS.bold },
  newPostBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  newPostText: { fontSize: SIZES.sm, fontFamily: FONTS.bold, color: '#FFFFFF' },
  typeTabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.base,
    gap: SPACING.xs,
  },
  typeTab: {
    flex: 1,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  typeTabText: { fontSize: SIZES.xs, fontFamily: FONTS.medium },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 20 },
  postCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  authorAvatarText: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: '#FFFFFF' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: SIZES.sm, fontFamily: FONTS.semiBold },
  postMeta: { fontSize: SIZES.xs, fontFamily: FONTS.regular },
  groupBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  groupBadgeText: { fontSize: SIZES.xs, fontFamily: FONTS.medium },
  postTitle: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, marginBottom: SPACING.xs },
  postContent: { fontSize: SIZES.sm, fontFamily: FONTS.regular, lineHeight: 18, marginBottom: SPACING.sm },
  postFooter: {},
  replyCount: { fontSize: SIZES.xs, fontFamily: FONTS.regular },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.base, fontFamily: FONTS.regular },
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
    marginTop: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
