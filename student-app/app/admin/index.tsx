import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const { hasAdminPermission, refreshProfile } = useAuth();
  const [refreshingAccess, setRefreshingAccess] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setRefreshingAccess(true);
    refreshProfile().finally(() => {
      if (active) setRefreshingAccess(false);
    });
    return () => { active = false; };
  }, []));
  const [clearing, setClearing] = useState(false);

  const handleClearOldArticles = () => {
    Alert.alert(
      '清理历史已删文章',
      '确定要彻底删除除了最新10篇之外的所有【已删除/未发布】的历史文章吗？此操作不可逆。未被删除的正常文章将继续保留。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定清理',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              // 1. 获取最新10篇文章的ID（包括软删的，防止因误删而在此期间被微信重新同步）
              const { data, error } = await supabase
                .from('articles')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(10);

              if (error) throw error;

              if (!data || data.length <= 10) {
                const count = data ? data.length : 0;
                Alert.alert('提示', `无需清理，当前数据库中总共仅有 ${count} 篇文章。`);
                return;
              }

              const latestIds = data.map(item => item.id);
              
              // 2. 仅删除除了最新10个ID之外且【已被软删除/未发布】的文章
              const { error: deleteError } = await supabase
                .from('articles')
                .delete()
                .eq('is_published', false)
                .not('id', 'in', `(${latestIds.join(',')})`);

              if (deleteError) throw deleteError;

              Alert.alert('清理成功', '已成功从数据库中彻底清除旧的历史已删文章。');
            } catch (err: any) {
              console.error('Failed to clear old articles:', err);
              Alert.alert('清理失败', err.message || '请检查网络或权限后重试。');
            } finally {
              setClearing(false);
            }
          }
        }
      ]
    );
  };

  const articleItems = [
    hasAdminPermission('articles.sync') && {
      key: 'wechat-import', icon: 'link-plus', label: '一键导入微信文章', value: '链接抓取',
      onPress: () => router.push('/admin/wechat-import'),
    },
    hasAdminPermission('articles.sync') && {
      key: 'wechat-sync', icon: 'sync', label: '同步微信文章', value: '查看记录与手动同步',
      onPress: () => router.push('/admin/wechat-sync'),
    },
    hasAdminPermission('articles.manage') && {
      key: 'clear-articles', icon: 'trash-can-outline',
      label: clearing ? '正在清理已删文章...' : '清理历史已删文章',
      value: '保留最新10篇的排重', onPress: handleClearOldArticles, disabled: clearing, loading: clearing,
    },
    hasAdminPermission('articles.manage') && {
      key: 'manage-articles', icon: 'playlist-edit', label: '管理已有文章及分类', value: '分类与删除',
      onPress: () => router.push('/admin/manage-articles'),
    },
  ].filter(Boolean) as Array<{
    key: string; icon: string; label: string; value: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  }>;

  const notificationItems = [
    hasAdminPermission('notifications.publish') && {
      key: 'publish-notification', icon: 'bullhorn-outline', label: '发布通知', value: '群发推送',
      onPress: () => router.push('/admin/notification'),
    },
    hasAdminPermission('notifications.manage') && {
      key: 'manage-notifications', icon: 'bell-ring-outline', label: '管理已有通知及分类', value: '分类与删除',
      onPress: () => router.push('/admin/manage-notifications'),
    },
  ].filter(Boolean) as Array<{
    key: string; icon: string; label: string; value: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  }>;

  const handbookItems = [
    hasAdminPermission('handbook.manage') && {
      key: 'manage-handbook', icon: 'book-open-page-variant-outline', label: '新生手册管理', value: '章节与内容',
      onPress: () => router.push('/admin/manage-handbook'),
    },
  ].filter(Boolean) as Array<{
    key: string; icon: string; label: string; value: string; onPress: () => void;
  }>;

  const userItems = [
    (hasAdminPermission('users.moderate') || hasAdminPermission('users.delete')) && {
      key: 'manage-users', icon: 'account-multiple-outline', label: '已注册用户管理', value: '审核与账号安全',
      onPress: () => router.push('/admin/manage-users'),
    },
    hasAdminPermission('feedback.manage') && {
      key: 'manage-feedbacks', icon: 'message-draw', label: '用户意见反馈管理', value: '状态标记与查看',
      onPress: () => router.push('/admin/manage-feedbacks'),
    },
  ].filter(Boolean) as Array<{
    key: string; icon: string; label: string; value: string; onPress: () => void;
  }>;

  const futureItems = [
    hasAdminPermission('cssa_card.manage') && {
      key: 'manage-cssa-card', icon: 'card-account-details-outline', label: '学联卡管理', value: '未上线',
      onPress: () => undefined, disabled: true,
    },
    hasAdminPermission('events.manage') && {
      key: 'manage-events', icon: 'calendar-edit', label: '活动发布与管理', value: '未上线',
      onPress: () => undefined, disabled: true,
    },
  ].filter(Boolean) as Array<{
    key: string; icon: string; label: string; value: string; onPress: () => void; disabled: boolean;
  }>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>管理后台</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {refreshingAccess && (
          <View style={styles.accessLoading}>
            <ActivityIndicator size="small" color={colors.primaryLight} />
          </View>
        )}
        {!refreshingAccess && (
          <>
        {articleItems.length > 0 && (
          <>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>文章管理</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {articleItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  style={[styles.rowPressable, { borderBottomColor: colors.border }, index === articleItems.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={item.onPress}
                  disabled={item.disabled}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={item.disabled ? colors.textMuted : colors.primaryLight} style={styles.rowIcon} />
                  <Text style={[styles.rowLabel, { color: item.disabled ? colors.textMuted : colors.textPrimary }]}>{item.label}</Text>
                  <View style={styles.rowRight}>
                    {item.loading ? <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} /> : (
                      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{item.value}</Text>
                    )}
                    <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {notificationItems.length > 0 && (
          <>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>通知管理</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {notificationItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  style={[styles.rowPressable, { borderBottomColor: colors.border }, index === notificationItems.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={item.onPress}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primaryLight} style={styles.rowIcon} />
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{item.value}</Text>
                    <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {handbookItems.length > 0 && (
          <>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>新生手册</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {handbookItems.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.rowPressable, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}
                  onPress={item.onPress}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primaryLight} style={styles.rowIcon} />
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{item.value}</Text>
                    <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {userItems.length > 0 && (
          <>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>用户与安全管理</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {userItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  style={[styles.rowPressable, { borderBottomColor: colors.border }, index === userItems.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={item.onPress}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.primaryLight} style={styles.rowIcon} />
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{item.value}</Text>
                    <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {futureItems.length > 0 && (
          <>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionHeader}>未来管理功能</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {futureItems.map((item, index) => (
                <View
                  key={item.key}
                  style={[styles.rowView, { borderBottomColor: colors.border }, index === futureItems.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={colors.textMuted} style={styles.rowIcon} />
                  <Text style={[styles.rowLabel, styles.futureRowLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  <Text style={[styles.statusText, { color: colors.textMuted }]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </>
        )}
          </>
        )}
      </ScrollView>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 28,
  },
  accessLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  sectionHeaderContainer: {
    marginLeft: 16,
    marginTop: 20,
    marginBottom: 6,
  },
  sectionHeader: {
    fontSize: 13,
    color: '#8A8A8F',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  rowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowView: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowIcon: {
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
  },
  futureRowLabel: {
    flex: 1,
    textAlign: 'left',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  rowValue: {
    fontSize: 14,
    marginRight: 8,
  },
  arrow: {
    fontSize: 18,
  },
  statusText: {
    fontSize: 13,
  },
});
