import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Image, TextInput, BackHandler } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ScrollView } from 'react-native';

type Notification = {
  id: string;
  title: string;
  content: string;
  category: string;
  link?: string;
  cover_image?: string;
  created_at: string;
  is_pinned?: boolean;
};

const CATEGORY_DETAILS = {
  events: { label: '学联活动', icon: 'calendar-star', color: '#EF4444' },
  academic: { label: '学术资讯', icon: 'school', color: '#3B82F6' },
  life: { label: '生活辅助', icon: 'home-heart', color: '#10B981' },
  general: { label: '综合通知', icon: 'bullhorn', color: '#8B5CF6' },
};

export default function NotificationsScreen() {
  const { colors, isDark, t } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  async function fetchNotifications(isRefresh = false, filter = selectedFilter) {
    if (!isRefresh && loadingMoreRef.current) return;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      const currentOffset = isRefresh ? 0 : notifications.length;

      let query = supabase
        .from('articles')
        .select('id, title, summary, category, cover_image, created_at, link, is_pinned')
        .eq('is_published', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + 14);

      if (filter !== 'all') {
        if (filter === 'events') {
          query = query.eq('category', 'event_news');
        } else if (filter === 'academic') {
          query = query.eq('category', 'notice');
        } else if (filter === 'life') {
          query = query.eq('category', 'news');
        } else if (filter === 'general') {
          query = query.in('category', ['general', 'column', 'reprint']);
        }
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        const normalizeCategory = (dbCategory: string): string => {
          if (dbCategory === 'event_news') return 'events';
          if (dbCategory === 'notice') return 'academic';
          if (dbCategory === 'news') return 'life';
          if (dbCategory === 'column' || dbCategory === 'reprint') return 'general';
          return dbCategory || 'general';
        };

        const mapped = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          content: item.summary || '查看文章详情',
          category: normalizeCategory(item.category),
          link: item.link || undefined,
          cover_image: item.cover_image || undefined,
          created_at: item.created_at,
          is_pinned: item.is_pinned
        })) as Notification[];

        setNotifications(prev => {
          if (isRefresh) return mapped;
          const combined = [...prev, ...mapped];
          return combined.filter((item, index, self) => 
            self.findIndex(n => n.id === item.id) === index
          );
        });
        setHasMore(data.length === 15);
      }
    } catch (e) {
      console.log('Failed to fetch from articles table:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  useEffect(() => {
    setNotifications([]);
    setHasMore(true);
    setLoading(true);
    fetchNotifications(true, selectedFilter);
  }, [selectedFilter]);

  useEffect(() => {
    const backAction = () => {
      if (isSearching) {
        setIsSearching(false);
        setSearchQuery('');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isSearching]);

  const onRefresh = () => {
    fetchNotifications(true, selectedFilter);
  };

  const handlePressNotification = (item: Notification) => {
    if (item.link) {
      router.push(`/article/web?url=${encodeURIComponent(item.link)}&title=${encodeURIComponent(item.title)}` as any);
    } else {
      setExpandedId(expandedId === item.id ? null : item.id);
    }
  };

  const filteredNotifications = notifications.filter(n => 
    !searchQuery.trim() || 
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {/* Title Header */}
      <View style={[styles.titleContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('notifications') || '通知'}</Text>
        <Pressable onPress={() => {
          setIsSearching(!isSearching);
          if (isSearching) setSearchQuery('');
        }} style={styles.searchIconButton}>
          <MaterialCommunityIcons name={isSearching ? "close" : "magnify"} size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {isSearching && (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="搜索文章..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
      )}

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Pressable
            style={[styles.filterChip, selectedFilter === 'all' && { backgroundColor: colors.primarySoft }]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterText, { color: selectedFilter === 'all' ? colors.primaryLight : colors.textSecondary }]}>
              全部
            </Text>
          </Pressable>
          {Object.entries(CATEGORY_DETAILS).map(([key, value]) => (
            <Pressable
              key={key}
              style={[styles.filterChip, selectedFilter === key && { backgroundColor: value.color + '15' }]}
              onPress={() => setSelectedFilter(key)}
            >
              <Text style={[styles.filterText, { color: selectedFilter === key ? value.color : colors.textSecondary }]}>
                {value.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* List content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (hasMore && !loadingMore) {
              fetchNotifications(false);
            }
          }}
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: 12 }} color={colors.primary} /> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="newspaper" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noNotifications') || '暂无通知'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const details = CATEGORY_DETAILS[item.category as keyof typeof CATEGORY_DETAILS];
            const showBadge = details && item.category !== 'general';
            const isExpanded = expandedId === item.id;
            return (
              <Pressable
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handlePressNotification(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {item.is_pinned && (
                      <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
                        <MaterialCommunityIcons name="pin" size={14} color="#F59E0B" style={styles.badgeIcon} />
                        <Text style={[styles.badgeText, { color: '#F59E0B' }]}>置顶</Text>
                      </View>
                    )}
                    {showBadge ? (
                      <View style={[styles.badge, { backgroundColor: details.color + '15' }]}>
                        <MaterialCommunityIcons name={details.icon as any} size={14} color={details.color} style={styles.badgeIcon} />
                        <Text style={[styles.badgeText, { color: details.color }]}>{details.label}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
                </View>

                <View style={styles.cardBodyRow}>
                  <View style={styles.cardTextContainer}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    {(!item.link || isExpanded) && (
                      <Text style={[styles.cardContent, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                        {item.content}
                      </Text>
                    )}
                  </View>
                  {item.cover_image ? (
                    <Image
                      source={{
                        uri: item.cover_image,
                        headers: {
                          Referer: 'https://mp.weixin.qq.com',
                        },
                      }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>

                {!item.link && item.content.length > 80 && (
                  <View style={styles.cardFooter}>
                    <Text style={[styles.footerLinkText, { color: colors.textMuted }]}>
                      {isExpanded ? '收起详情' : '展开阅读'}
                    </Text>
                    <MaterialCommunityIcons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
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
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  filterText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
    marginBottom: 6,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginLeft: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  cardContent: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
    gap: 4,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchIconButton: {
    padding: 8,
    marginRight: -8,
  },
  searchBarContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
});
