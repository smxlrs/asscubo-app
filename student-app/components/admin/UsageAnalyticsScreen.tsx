import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { TOOL_USAGE_TOOLS, usageDuration, usageToolLabel } from '../../lib/toolUsageCatalog';

type Metrics = { visits: number; users?: number; duration_ms: number };
type ToolRow = Metrics & { tool: string; last_used_at?: string };
type Account = { avatar_url?: string | null; id: string; name: string | null; email: string; registered_at: string; last_sign_in_at: string | null };
type UserRow = Account & Metrics & { last_used_at: string | null };
type Summary = { collection_enabled: boolean; total_registered: number; new_registered: number; totals: Metrics;
  tools: ToolRow[]; daily: (Metrics & { day: string })[] };
type Detail = { user: Account | null; totals: Metrics; tools: ToolRow[];
  sessions: { session_id: string; tool: string; started_at: string; last_seen_at: string; duration_ms: number }[] };
type Users = { total: number; users: UserRow[] };
const date = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Europe/Rome', hour12: false }) : '暂无记录';
const metrics = (row: Metrics, people = false) => `${row.visits} 次${people ? ` · ${row.users || 0} 人` : ''} · ${usageDuration(row.duration_ms)}`;
const toolIcons = { bus: 'bus', train: 'train', dictionary: 'book-alphabet', rate: 'currency-eur', classroom: 'school-outline', studyroom: 'desk', handbook: 'book-open-page-variant-outline', events: 'calendar-star' } as const;

export function UsageAccountAvatar({ uri }: { uri?: string | null }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  return <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
    {uri && !failed ? <Image source={{ uri }} style={styles.avatarImage} onError={() => setFailed(true)} accessibilityLabel="用户头像" />
      : <MaterialCommunityIcons name="account" size={27} color={colors.textSecondary} />}
  </View>;
}

export default function UsageAnalyticsScreen({ detailUserId, initialDays = 7 }: { detailUserId?: string; initialDays?: number } = {}) {
  const { colors } = useTheme();
  const { user, hasAdminPermission } = useAuth();
  const canSummary = hasAdminPermission('analytics.summary');
  const canUsers = hasAdminPermission('analytics.users');
  const [tab, setTab] = useState<'summary' | 'users'>(detailUserId ? 'users' : 'summary');
  const mode = detailUserId ? 'users' : tab === 'summary' && canSummary ? 'summary' : canUsers ? 'users' : 'summary';
  const [days, setDays] = useState(initialDays);
  const [refresh, setRefresh] = useState(0);
  const range = useMemo(() => { const end = Date.now(); return {
    p_from: new Date(end - days * 86400_000).toISOString(), p_to: new Date(end).toISOString(),
  }; }, [days, refresh]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const selected = detailUserId || null;
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{ summary?: Summary; users?: Users; detail?: Detail } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isFocused = useIsFocused();
  const hasSearch = !selected && mode === 'users' && canUsers && !!(search || query);
  const clearSearch = useCallback(() => {
    Keyboard.dismiss(); setSearch(''); setQuery(''); setOffset(0);
  }, []);
  // Covers stack back actions and iOS gestures as well as the custom header.
  usePreventRemove(isFocused && hasSearch, clearSearch);
  useFocusEffect(useCallback(() => {
    if (!hasSearch) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { clearSearch(); return true; });
    return () => subscription.remove();
  }, [hasSearch, clearSearch]));
  const goBack = () => {
    if (hasSearch) { clearSearch(); return; }
    if (router.canGoBack()) router.back();
    else router.replace(selected ? '/admin/usage-analytics' : '/admin');
  };
  useEffect(() => {
    let current = true;
    setResult(null); setError('');
    if (!(mode === 'summary' ? canSummary : canUsers)) { setLoading(false); return; }
    setLoading(true);
    async function load() {
      try {
        const name = mode === 'summary' ? 'admin_tool_usage_summary' : selected ? 'admin_tool_usage_user' : 'admin_tool_usage_users';
        const params = mode === 'summary' ? range : selected
          ? { ...range, p_user_id: selected, p_offset: offset, p_limit: 25 }
          : { ...range, p_search: query, p_offset: offset, p_limit: 25 };
        const { data, error: failure } = await supabase.rpc(name, params);
        if (failure) throw failure;
        if (!data || typeof data !== 'object') throw new Error('Invalid report');
        if (current) setResult(mode === 'summary' ? { summary: data as Summary } : selected ? { detail: data as Detail } : { users: data as Users });
      } catch { if (current) setError('暂时无法读取统计，请确认统计服务已安装且当前账号拥有权限。'); }
      finally { if (current) setLoading(false); }
    }
    void load();
    return () => { current = false; };
  }, [mode, canSummary, canUsers, user?.id, range, query, selected, offset]);
  const button = (label: string, action: () => void, active = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={action}
      style={({ pressed }) => [styles.button, { borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.surface, opacity: pressed ? 0.65 : 1 }]}>
      <Text style={{ color: active ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
  const copy = (text: string, key?: string) => <Text key={key} style={[styles.copy, { color: colors.textSecondary }]}>{text}</Text>;
  const heading = (title: string, caption?: string) => <View style={styles.sectionHeading}>
    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
    {!!caption && <Text style={[styles.caption, { color: colors.textSecondary }]}>{caption}</Text>}
  </View>;
  const panel = { backgroundColor: colors.surface, borderColor: colors.border };
  const stat = (label: string, value: string | number, accent = false) => <View key={label} style={[styles.stat, panel]}>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.statValue, label === '累计前台时长' && styles.compactValue, { color: accent ? colors.primaryLight : colors.textPrimary }]}>{value}</Text>
  </View>;
  const empty = (message: string) => <View style={styles.empty}>
    <MaterialCommunityIcons name="chart-box-outline" size={32} color={colors.textMuted} />
    {copy(message)}
  </View>;
  const tools = (rows: ToolRow[], people: boolean) => <View style={[styles.panel, panel]}>{TOOL_USAGE_TOOLS.map((tool, index) => {
    const row = rows.find(item => item.tool === tool.id) || { visits: 0, users: 0, duration_ms: 0 };
    const max = Math.max(1, ...rows.map(item => item.visits));
    return <View key={tool.id} style={[styles.toolRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <View style={[styles.toolIcon, { backgroundColor: colors.primarySoft }]}>
        <MaterialCommunityIcons name={toolIcons[tool.id]} size={22} color={colors.primaryLight} />
      </View>
      <View style={styles.flex}>
        <View style={styles.between}><Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{tool.label}</Text>
          <Text style={[styles.itemTitle, { color: colors.primaryLight }]}>{row.visits} 次</Text></View>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>{people ? `${row.users || 0} 人使用 · ` : ''}{usageDuration(row.duration_ms)}</Text>
        <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.bar, { width: `${Math.min(100, row.visits / max * 100)}%`, backgroundColor: colors.primaryLight }]} />
        </View>
        {'last_used_at' in row && !!row.last_used_at && <Text style={[styles.caption, { color: colors.textMuted }]}>最近使用：{date(row.last_used_at)}</Text>}
      </View>
    </View>;
  })}</View>;
  const account = (item: Account) => <View style={styles.accountRow}>
    <UsageAccountAvatar key={item.avatar_url || item.id} uri={item.avatar_url} />
    <View style={styles.flex}>
      <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.name || '未设置昵称'}</Text>
      <Text selectable style={[styles.caption, { color: colors.textSecondary }]}>{item.email}</Text>
    </View>
  </View>;
  const summary = canSummary ? result?.summary : undefined;
  const users = canUsers ? result?.users : undefined;
  const detail = canUsers ? result?.detail : undefined;
  const total = detail?.totals.visits ?? users?.total ?? 0;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
    <View style={[styles.header, panel]}>
      <Pressable accessibilityRole="button" accessibilityLabel={selected ? '返回用户列表' : '返回'} style={styles.headerButton}
        onPress={goBack}>
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{selected ? '用户使用详情' : '使用统计'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="刷新" style={styles.headerButton} onPress={() => setRefresh(n => n + 1)}>
        <MaterialCommunityIcons name="refresh" size={23} color={colors.primaryLight} />
      </Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {!selected && <View style={styles.row}>
        {canSummary && button('总体与工具', () => { setTab('summary'); setOffset(0); }, mode === 'summary')}
        {canUsers && button('用户明细', () => { setTab('users'); setOffset(0); }, mode === 'users')}
      </View>}
      <View style={styles.row}>{[7, 30, 90].map(n => button(`最近 ${n} 天`, () => { setDays(n); setOffset(0); }, days === n))}</View>
      {mode === 'users' && !selected && <View style={[styles.searchBox, panel]}>
        <TextInput value={search} onChangeText={setSearch} placeholder="搜索昵称或邮箱" placeholderTextColor={colors.textMuted}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search"
          onSubmitEditing={() => { setQuery(search.trim()); setOffset(0); }}
          style={[styles.searchInput, { color: colors.textPrimary }]} />
        {!!search && <Pressable accessibilityLabel="清除搜索" hitSlop={8} onPress={clearSearch}>
          <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="搜索" style={styles.searchButton}
          onPress={() => { Keyboard.dismiss(); setQuery(search.trim()); setOffset(0); }}>
          <MaterialCommunityIcons name="magnify" size={23} color={colors.primaryLight} />
        </Pressable>
      </View>}
      {!(mode === 'summary' ? canSummary : canUsers) && empty('暂无查看统计的权限')}
      {loading && <View style={styles.empty}><ActivityIndicator color={colors.primary} />{copy('正在加载统计…')}</View>}
      {!!error && <View style={[styles.notice, panel]}>{copy(error)}{button('重试', () => setRefresh(n => n + 1))}</View>}
      {summary && <View style={styles.sections}>
        <View style={styles.between}>{heading('数据概览', `最近 ${days} 天`)}
          <View style={[styles.badge, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.dot, { backgroundColor: summary.collection_enabled ? colors.success : colors.textMuted }]} />
            <Text style={[styles.caption, { color: colors.textSecondary }]}>采集{summary.collection_enabled ? '已开启' : '已关闭'}</Text>
          </View>
        </View>
        <View style={styles.statGrid}>
          {stat('全部工具合计', `${summary.totals.visits} 次`, true)}
          {stat('去重使用人数', `${summary.totals.users || 0} 人`, true)}
          {stat('注册账号总数', summary.total_registered)}
          {stat('本期新增注册', summary.new_registered)}
        </View>
        <View style={[styles.durationCard, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="clock-outline" size={24} color={colors.primaryLight} />
          <View style={styles.flex}><Text style={[styles.statLabel, { color: colors.textSecondary }]}>累计前台时长</Text>
            <Text style={[styles.durationValue, { color: colors.textPrimary }]}>{usageDuration(summary.totals.duration_ms)}</Text></View>
        </View>
        {heading('各工具汇总', '次数 · 使用人数 · 前台时长')}{tools(summary.tools, true)}
        {heading('每日趋势', '每日按罗马日期统计')}
        <View style={[styles.panel, panel]}>{summary.daily.length ? summary.daily.map(row => <View key={row.day} style={[styles.dailyRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{row.day}</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>{metrics(row, true)}</Text>
        </View>) : empty('所选范围暂无使用记录')}</View>
      </View>}
      {users && <View style={styles.sections}>
        {heading('用户列表', `共 ${users.total} 个账号 · 包括尚未使用工具的账号`)}
        <View style={[styles.panel, panel]}>{users.users.length ? users.users.map(item => <Pressable key={item.id} accessibilityRole="button"
          onPress={() => router.push({ pathname: '/admin/usage-analytics-user', params: { userId: item.id, days: String(days) } })}
          style={({ pressed }) => [styles.userRow, { borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
          <View style={styles.between}><View style={styles.flex}>{account(item)}</View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} /></View>
          <View style={[styles.userMetrics, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.caption, { color: colors.primaryLight }]}>{metrics(item)}</Text>
          </View>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>注册：{date(item.registered_at)}</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>最近登录：{date(item.last_sign_in_at)}</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>最近使用：{date(item.last_used_at)}</Text>
        </Pressable>) : empty(query ? '没有匹配的用户，试试其他昵称或邮箱' : '暂无用户记录')}</View>
      </View>}
      {detail && <View style={styles.sections}>
        <View style={[styles.accountCard, panel]}>{detail.user ? <>{account(detail.user)}
          {copy(`注册：${date(detail.user.registered_at)}\n最近登录：${date(detail.user.last_sign_in_at)}`)}</> : copy('账号已不存在')}</View>
        <View style={styles.statGrid}>{stat('使用次数', `${detail.totals.visits} 次`, true)}{stat('累计前台时长', usageDuration(detail.totals.duration_ms))}</View>
        {heading('工具使用分布')}{tools(detail.tools, false)}
        {heading('逐次访问记录', `共 ${detail.totals.visits} 次访问`)}
        <View style={[styles.panel, panel]}>{detail.sessions.length ? detail.sessions.map(item => <View key={item.session_id} style={[styles.sessionRow, { borderBottomColor: colors.border }]}>
          <View style={styles.between}><Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{usageToolLabel(item.tool)}</Text>
            <Text style={[styles.caption, { color: colors.primaryLight }]}>{usageDuration(item.duration_ms)}</Text></View>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>进入：{date(item.started_at)}</Text>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>最后活跃：{date(item.last_seen_at)}</Text>
        </View>) : empty('所选范围暂无访问记录')}</View>
      </View>}
      {mode === 'users' && result && <View style={styles.pagination}>
        {offset > 0 && button('上一页', () => setOffset(n => Math.max(0, n - 25)))}
        <Text style={[styles.caption, { color: colors.textSecondary }]}>第 {Math.floor(offset / 25) + 1} 页 / 共 {Math.max(1, Math.ceil(total / 25))} 页</Text>
        {offset + 25 < total && button('下一页', () => setOffset(n => n + 25))}
      </View>}
      <View style={[styles.notice, { backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.noticeTitle, { color: colors.textSecondary }]}>统计说明</Text>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>所有时间均按罗马时间显示，自动适配冬夏令时。前台停留时长为估算，不等同于实际操作；最近登录不等同于最近打开 App。仅保留最近 90 天，启用前无使用记录。总人数跨工具去重，时长按访问开始时间归属。</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  page: { padding: 16, paddingBottom: 32, gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center' },
  copy: { fontSize: 13, lineHeight: 21, marginVertical: 6 },
  caption: { fontSize: 12, lineHeight: 20, flexShrink: 1 },
  sectionHeading: { gap: 4, flexShrink: 1 }, sectionTitle: { fontSize: 17, fontWeight: '700' },
  sections: { gap: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: '45%', minWidth: 120, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  statLabel: { fontSize: 12, lineHeight: 19 }, statValue: { fontSize: 25, lineHeight: 34, fontWeight: '700' },
  compactValue: { fontSize: 18, lineHeight: 28 },
  durationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 16 },
  durationValue: { fontSize: 20, lineHeight: 29, fontWeight: '700', marginTop: 4 },
  panel: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  toolRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  toolIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', lineHeight: 23, flexShrink: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginVertical: 8 }, bar: { height: 4, borderRadius: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  searchBox: { borderWidth: 1, borderRadius: 8, paddingLeft: 12, paddingRight: 4, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 8 },
  userRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarImage: { width: 50, height: 50 },
  searchButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  userMetrics: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginVertical: 8, alignSelf: 'flex-start', maxWidth: '100%' },
  accountCard: { borderWidth: 1, borderRadius: 12, padding: 16 },
  dailyRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  sessionRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12 },
  empty: { alignItems: 'center', padding: 28, gap: 8 },
  notice: { borderRadius: 10, padding: 14, gap: 6 }, noticeTitle: { fontSize: 12, fontWeight: '700' },
});
