import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState('general');

  async function fetchPosts() {
    const { data } = await supabase
      .from('community_posts')
      .select('id, title, content, group_type, group_value, reply_count, created_at, author:author_id(name, faculty)')
      .eq('group_type', selectedType)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) setPosts(data as any);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchPosts(); }, [selectedType]);

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (diffH < 1) return '刚刚';
    if (diffH < 24) return `${diffH}小时前`;
    if (diffH < 168) return `${Math.floor(diffH / 24)}天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>💬 社群广场</Text>
        <TouchableOpacity
          style={styles.newPostBtn}
          onPress={() => router.push('/community/new' as any)}
        >
          <Text style={styles.newPostText}>+ 发帖</Text>
        </TouchableOpacity>
      </View>

      {/* Group type tabs */}
      <View style={styles.typeTabs}>
        {GROUP_TYPES.map((gt) => (
          <TouchableOpacity
            key={gt.key}
            style={[styles.typeTab, selectedType === gt.key && styles.typeTabActive]}
            onPress={() => setSelectedType(gt.key)}
          >
            <Text style={[styles.typeTabText, selectedType === gt.key && styles.typeTabTextActive]}>
              {gt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💭</Text>
              <Text style={styles.emptyText}>暂无帖子，来发第一帖吧！</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.postCard}
              onPress={() => router.push(`/community/${item.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={styles.postHeader}>
                <View style={styles.authorAvatar}>
                  <Text style={styles.authorAvatarText}>
                    {item.author?.name?.[0] || '匿'}
                  </Text>
                </View>
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{item.author?.name || '匿名用户'}</Text>
                  <Text style={styles.postMeta}>
                    {item.author?.faculty && `${item.author.faculty} · `}{formatDate(item.created_at)}
                  </Text>
                </View>
                {item.group_value !== 'all' && (
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{item.group_value}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.postContent} numberOfLines={2}>{item.content}</Text>
              <View style={styles.postFooter}>
                <Text style={styles.replyCount}>💬 {item.reply_count} 条回复</Text>
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
  title: { fontSize: SIZES.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  newPostBtn: {
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeTabText: { fontSize: SIZES.xs, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  typeTabTextActive: { color: '#FFFFFF' },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 20 },
  postCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  authorAvatarText: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: '#FFFFFF' },
  authorInfo: { flex: 1 },
  authorName: { fontSize: SIZES.sm, fontFamily: FONTS.semiBold, color: COLORS.textPrimary },
  postMeta: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  groupBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  groupBadgeText: { fontSize: SIZES.xs, fontFamily: FONTS.medium, color: COLORS.primary },
  postTitle: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  postContent: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SPACING.sm },
  postFooter: {},
  replyCount: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.base, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
