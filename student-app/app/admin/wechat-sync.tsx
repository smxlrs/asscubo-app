import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { requestWebsiteArticleSync } from '../../lib/websiteArticleSync';

type SyncRun = {
  id: string;
  trigger: 'automatic' | 'manual';
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'busy' | 'error';
  result: Record<string, any> | null;
};

async function readableSyncError(error: any): Promise<string> {
  let detail = '';
  const response = error?.context;
  const status = Number(response?.status || error?.status || 0);
  if (response && typeof response.clone === 'function') {
    try {
      const body = await response.clone().json();
      detail = typeof body?.message === 'string' ? body.message : '';
    } catch { /* Response may not contain JSON. */ }
  }
  const raw = `${detail} ${error?.message || ''}`.toLowerCase();
  if (status === 401 || raw.includes('unauthorized') || raw.includes('jwt')) return '登录状态已过期，请重新登录后再同步。';
  if (status === 403 || raw.includes('permission denied') || raw.includes('row-level security')) return '当前账号没有“文章同步”权限，请联系超级管理员开通。';
  if (status === 429 || raw.includes('rate limit') || raw.includes('too many request')) return '请求过于频繁，请稍后再试。';
  if (raw.includes('timeout') || raw.includes('超时')) return '等待同步结果超时，服务器可能仍在处理。请稍后刷新同步记录确认结果，避免重复提交。';
  if (raw.includes('sync is already running') || raw.includes('lock')) return '已有同步任务正在运行，请稍后再试。';
  if (raw.includes('wechat')) return '服务器仍在使用旧的微信同步服务，请联系管理员切换为网站文章来源。';
  if (raw.includes('pagination') || raw.includes('website changed')) return '网站文章列表在同步时发生变化或未完整返回，本次未切换文章列表，请重试。';
  if (raw.includes('network') || raw.includes('timeout') || raw.includes('fetch')) return '同步服务或网络暂时不可用，请稍后重试。';
  return detail || error?.message || '同步服务暂时不可用，请稍后重试。';
}

function formatDate(value: string | null): string {
  if (!value) return '暂无记录';
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function readableLoadError(error: any): string {
  const raw = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (raw.includes('wechat_sync_runs') && (raw.includes('does not exist') || raw.includes('schema cache'))) {
    return '同步记录功能尚未完成数据库配置，请联系超级管理员执行最新数据库迁移。';
  }
  if (raw.includes('permission denied') || raw.includes('row-level security')) {
    return '当前账号无法读取同步记录，请确认已开通“文章同步”权限。';
  }
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('timeout') || raw.includes('unknownhost')) {
    return '网络连接异常，暂时无法读取同步记录，请稍后重试。';
  }
  return '无法读取同步记录，请稍后刷新重试。';
}

export default function WebsiteSyncScreen() {
  const { colors } = useTheme();
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('wechat_sync_runs').select('id, trigger, started_at, completed_at, status, result').order('started_at', { ascending: false }).limit(10);
      if (error) throw error;
      setRuns((data || []) as SyncRun[]);
    } catch (error: any) {
      console.error('Failed to load website sync status:', error);
      Alert.alert('加载失败', readableLoadError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = () => {
    Alert.alert('立即同步网站文章', '将从 asscubo.it 读取全部公开文章，更新标题、摘要、封面和阅读链接。确定立即同步吗？', [
      { text: '取消', style: 'cancel' },
      { text: '确定同步', onPress: async () => {
        setSyncing(true);
        try {
          const data = await requestWebsiteArticleSync();
          if (!data || !['success', 'busy'].includes(data.status)) throw new Error(data?.message || '服务器未返回有效的同步结果，请重试。');
          if (data?.status === 'busy') {
            Alert.alert('同步进行中', '已有自动或手动同步任务正在运行，请稍后再查看结果。');
          } else {
            if (data.source !== 'wordpress') throw new Error('服务器仍在使用旧的微信同步服务，请联系管理员切换为网站文章来源。');
            Alert.alert('同步完成', `新增：${data.synced ?? 0} 篇\n更新：${data.updated ?? 0} 篇\n无需更新：${data.skipped ?? 0} 篇\n当前可见：${data.visible ?? 0} 篇\n\n旧文章修改后仍按原发布时间排序。`);
          }
          await loadData();
        } catch (error: any) {
          console.error('Manual website sync error:', error);
          Alert.alert('同步提示', await readableSyncError(error));
          await loadData();
        } finally {
          setSyncing(false);
        }
      } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}><View style={[styles.backArrow, { borderColor: colors.primaryLight }]} /></Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>网站文章同步</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View> : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />}
          contentContainerStyle={styles.content}
          ListHeaderComponent={<>
            <Pressable
              style={[styles.syncButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleSync}
              disabled={syncing}
            >
              {syncing
                ? <ActivityIndicator size="small" color={colors.primaryLight} style={styles.syncIcon} />
                : <MaterialCommunityIcons name="sync" size={20} color={colors.primaryLight} style={styles.syncIcon} />}
              <Text style={[styles.syncButtonText, { color: colors.textPrimary }]}>{syncing ? '正在同步网站文章...' : '立即同步网站文章'}</Text>
              <Text style={[styles.syncButtonValue, { color: colors.textSecondary }]}>{syncing ? '请稍候' : '后台检测并同步'}</Text>
              <Text style={[styles.syncArrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>最近 10 次同步记录</Text>
          </>}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>暂无同步记录</Text>}
          renderItem={({ item }) => {
            const result = item.result || {};
            const failed = item.status === 'error';
            return <View style={[styles.article, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <View style={styles.runHeader}><Text style={[styles.articleTitle, { color: colors.textPrimary }]}>{item.trigger === 'manual' ? '管理员手动同步' : '自动同步'}</Text><Text style={[styles.status, { color: failed ? '#D92D20' : item.status === 'running' ? '#C47F00' : '#16805B' }]}>{failed ? '失败' : item.status === 'running' ? '进行中' : '成功'}</Text></View>
              <Text style={[styles.articleMeta, { color: colors.textMuted }]}>开始：{formatDate(item.started_at)} · 完成：{formatDate(item.completed_at)}</Text>
              <Text style={[styles.detail, { color: colors.textSecondary }]}>抓取 {result.fetched ?? 0} · 新增 {result.synced ?? 0} · 更新 {result.updated ?? 0} · 无需更新 {result.skipped ?? 0} · 可见 {result.visible ?? 0} · 推送失败 {result.push_failures ?? 0}</Text>
              {failed && <Text style={[styles.errorText, { color: '#D92D20' }]} numberOfLines={3}>{result.message || '同步失败，请查看服务器日志'}</Text>}
            </View>;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  backArrow: { width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }], marginHorizontal: 8, marginVertical: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerPlaceholder: { width: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 24 },
  summary: { margin: 16, padding: 16, borderWidth: 1, borderRadius: 8 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  summaryTitle: { fontSize: 16, fontWeight: 'bold' },
  meta: { fontSize: 13, marginTop: 4 },
  metrics: { flexDirection: 'row', gap: 20, marginTop: 14 },
  metric: { fontSize: 14, fontWeight: '600' },
  errorText: { marginTop: 12, fontSize: 13 },
  syncButton: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1 },
  syncIcon: { marginRight: 12 },
  syncButtonText: { fontSize: 16 },
  syncButtonValue: { marginLeft: 'auto', marginRight: 8, fontSize: 14 },
  syncArrow: { fontSize: 18 },
  sectionTitle: { marginTop: 24, marginHorizontal: 16, marginBottom: 8, fontSize: 14, fontWeight: '600' },
  article: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  runHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  articleTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  articleMeta: { marginTop: 6, fontSize: 12 },
  detail: { marginTop: 7, fontSize: 13 },
  status: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', padding: 36 },
});
