import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ScrollView } from 'react-native';

type Notification = {
  id: string;
  title: string;
  content: string;
  category: 'events' | 'academic' | 'life' | 'general';
  link?: string;
  created_at: string;
};

const CATEGORY_DETAILS = {
  events: { label: '学联活动', icon: 'calendar-star', color: '#EF4444' },
  academic: { label: '学术资讯', icon: 'school', color: '#3B82F6' },
  life: { label: '生活辅助', icon: 'home-heart', color: '#10B981' },
  general: { label: '综合公告', icon: 'bullhorn', color: '#8B5CF6' },
};

export default function NotificationsScreen() {
  const { colors, t } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchNotifications() {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setNotifications(data as Notification[]);
      }
    } catch (e) {
      console.log('Failed to fetch from notifications table, using mock fallback:', e);
      // Fallback Mock Data
      const mockNotifications: Notification[] = [
        {
          id: '1',
          title: '中秋联欢晚会正式开放报名',
          content: '欧洲学生学者联合会将于本周五举办一年一度的中秋晚会！现场有精彩的文艺演出和丰厚的抽奖活动，请大家点击链接抓紧报名，席位有限。',
          category: 'events',
          link: 'https://mp.weixin.qq.com/s/example1',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          id: '2',
          title: '博洛尼亚大学2026/2027学年注册指引',
          content: '博大新学期注册和缴费入口现已开放。关于第一期学费减免（ISEE）的申报截止日期，以及新生入学税注册流程的详细图文指引现已发布。',
          category: 'academic',
          link: 'https://mp.weixin.qq.com/s/example2',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
        {
          id: '3',
          title: '米兰/博洛尼亚暑期租房安全预警',
          content: '近期发生多起针对中国留学生的线上虚假租房诈骗案。特此提醒大家：切勿在未实地看房或未签正式合同前转账押金，如有疑问请查阅防骗手册。',
          category: 'life',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        },
      ];
      setNotifications(mockNotifications);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handlePressNotification = (item: Notification) => {
    if (item.link) {
      router.push(`/article/web?url=${encodeURIComponent(item.link)}&title=${encodeURIComponent(item.title)}` as any);
    } else {
      setExpandedId(expandedId === item.id ? null : item.id);
    }
  };

  const filteredNotifications = selectedFilter === 'all'
    ? notifications
    : notifications.filter(n => n.category === selectedFilter);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Title Header */}
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('notifications') || '通知'}</Text>
      </View>

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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noNotifications') || '暂无新通知'}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const details = CATEGORY_DETAILS[item.category] || { label: '综合', icon: 'bell', color: '#8A8A8F' };
            const isExpanded = expandedId === item.id;
            return (
              <Pressable
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handlePressNotification(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: details.color + '15' }]}>
                    <MaterialCommunityIcons name={details.icon as any} size={14} color={details.color} style={styles.badgeIcon} />
                    <Text style={[styles.badgeText, { color: details.color }]}>{details.label}</Text>
                  </View>
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
                </View>

                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                
                {(!item.link || isExpanded) && (
                  <Text style={[styles.cardContent, { color: colors.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                    {item.content}
                  </Text>
                )}

                {item.link ? (
                  <View style={styles.cardFooter}>
                    <Text style={[styles.footerLinkText, { color: colors.primaryLight }]}>查看推文详情</Text>
                    <MaterialCommunityIcons name="arrow-right" size={14} color={colors.primaryLight} />
                  </View>
                ) : (
                  item.content.length > 80 && (
                    <View style={styles.cardFooter}>
                      <Text style={[styles.footerLinkText, { color: colors.textMuted }]}>
                        {isExpanded ? '收起详情' : '展开阅读'}
                      </Text>
                      <MaterialCommunityIcons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                    </View>
                  )
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
});
