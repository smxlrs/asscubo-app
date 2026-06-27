import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const [syncing, setSyncing] = useState(false);

  const handleSyncWechat = () => {
    Alert.alert(
      '立即同步微信文章',
      '确定要立即检测并同步微信公众号的最新文章吗？\n这可能会需要几秒钟时间，同步成功后会自动给所有订阅用户发送推送通知。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定同步',
          onPress: async () => {
            setSyncing(true);
            try {
              const { data, error } = await supabase.functions.invoke('wechat-sync');
              if (error) throw error;
              if (data && data.status === 'error') throw new Error(data.message || '同步失败');
              
              const synced = data?.synced ?? 0;
              const skipped = data?.skipped ?? 0;
              Alert.alert('同步完成', `检测同步成功！\n新增同步: ${synced} 篇\n跳过重复: ${skipped} 篇`);
            } catch (err: any) {
              console.error('Manual WeChat sync error:', err);
              Alert.alert('同步失败', err.message || '请检查网络或配置后重试。');
            } finally {
              setSyncing(false);
            }
          }
        }
      ]
    );
  };

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

      <ScrollView style={styles.content}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>信息发布与公告</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable 
            style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
            onPress={() => router.push('/admin/notification')}
          >
            <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.primaryLight} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>发布通知</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>群发推送</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
            onPress={() => router.push('/admin/wechat-import')}
          >
            <MaterialCommunityIcons name="link-plus" size={20} color={colors.primaryLight} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>一键导入微信文章</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>链接抓取</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
            onPress={handleSyncWechat}
            disabled={syncing}
          >
            <MaterialCommunityIcons 
              name="sync" 
              size={20} 
              color={syncing ? colors.textMuted : colors.primaryLight} 
              style={styles.rowIcon} 
            />
            <Text style={[styles.rowLabel, { color: syncing ? colors.textMuted : colors.textPrimary }]}>
              {syncing ? '正在同步微信文章...' : '立即同步微信文章'}
            </Text>
            <View style={styles.rowRight}>
              {syncing ? (
                <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} />
              ) : (
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>后台检测并同步</Text>
              )}
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
            onPress={handleClearOldArticles}
            disabled={clearing}
          >
            <MaterialCommunityIcons 
              name="trash-can-outline" 
              size={20} 
              color={clearing ? colors.textMuted : colors.primaryLight} 
              style={styles.rowIcon} 
            />
            <Text style={[styles.rowLabel, { color: clearing ? colors.textMuted : colors.textPrimary }]}>
              {clearing ? '正在清理已删文章...' : '清理历史已删文章'}
            </Text>
            <View style={styles.rowRight}>
              {clearing ? (
                <ActivityIndicator size="small" color="#EF4444" style={{ marginRight: 8 }} />
              ) : (
                <Text style={[styles.rowValue, { color: colors.textSecondary }]}>保留最新10篇的排重</Text>
              )}
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
            onPress={() => router.push('/admin/manage-articles')}
          >
            <MaterialCommunityIcons name="playlist-edit" size={20} color={colors.primaryLight} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>管理已有文章及分类</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>分类与删除</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.rowPressable, { borderBottomWidth: 0 }]} 
            onPress={() => router.push('/admin/manage-notifications')}
          >
            <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primaryLight} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>管理已有通知及分类</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>分类与删除</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>用户与安全管理</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable 
            style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
            onPress={() => router.push('/admin/manage-users')}
          >
            <MaterialCommunityIcons name="account-multiple-outline" size={20} color={colors.primaryLight} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>已注册用户管理</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>头像/昵称审核</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>

          <Pressable 
            style={[styles.rowPressable, { borderBottomWidth: 0 }]} 
            onPress={() => router.push('/admin/manage-feedbacks')}
          >
            <MaterialCommunityIcons name="message-draw" size={20} color={colors.primaryLight} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>用户意见反馈管理</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>状态标记与查看</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>未来管理功能 (建设中)</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* ASSCUBO Card management placeholder */}
          <View style={styles.rowView}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="card-account-details-outline" size={20} color={colors.textMuted} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: colors.textMuted }]}>学联卡管理</Text>
            </View>
            <Text style={[styles.statusText, { color: colors.textMuted }]}>建设中</Text>
          </View>
        </View>
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
    justifyContent: 'space-between',
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
