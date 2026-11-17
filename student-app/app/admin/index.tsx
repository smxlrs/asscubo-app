import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const { profile, hasAdminPermission, refreshProfile } = useAuth();
  const [refreshingAccess, setRefreshingAccess] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setRefreshingAccess(true);
    refreshProfile().finally(() => {
      if (active) setRefreshingAccess(false);
    });
    return () => { active = false; };
  }, []));
  const articleItems = [
    hasAdminPermission('articles.sync') && {
      key: 'website-sync', icon: 'sync', label: '网站文章同步', value: '查看记录与手动同步',
      onPress: () => router.push('/admin/wechat-sync'),
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
    (hasAdminPermission('analytics.summary') || hasAdminPermission('analytics.users')) && {
      key: 'usage-analytics', icon: 'chart-bar', label: '使用统计', value: '总览、工具与用户明细',
      onPress: () => router.push('/admin/usage-analytics'),
    },
    (profile?.role === 'admin' || profile?.role === 'super_admin') && {
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
      key: 'manage-events', icon: 'calendar-edit', label: '活动发布与管理', value: '活动、表单、车辆与报名',
      onPress: () => router.push('/admin/manage-events'), disabled: false,
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
              <Text style={styles.sectionHeader}>活动与其他管理</Text>
            </View>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {futureItems.map((item, index) => {
                const rowStyle = [
                  styles.rowView,
                  { borderBottomColor: colors.border },
                  index === futureItems.length - 1 && { borderBottomWidth: 0 },
                ];
                const content = (
                  <>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={item.disabled ? colors.textMuted : colors.primaryLight} style={styles.rowIcon} />
                    <Text style={[styles.rowLabel, item.disabled && styles.futureRowLabel, { color: item.disabled ? colors.textMuted : colors.textPrimary }]}>{item.label}</Text>
                    <View style={styles.rowRight}>
                      <Text style={[styles.statusText, { color: item.disabled ? colors.textMuted : colors.textSecondary }]}>{item.value}</Text>
                      {!item.disabled && <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>}
                    </View>
                  </>
                );
                return item.disabled ? (
                  <View key={item.key} style={rowStyle}>{content}</View>
                ) : (
                  <Pressable key={item.key} style={rowStyle} onPress={item.onPress}>{content}</Pressable>
                );
              })}
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
