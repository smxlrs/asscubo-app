import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { TOOL_USAGE_TOOLS, usageDuration, usageToolLabel } from '../../lib/toolUsageCatalog';

type Metrics = { visits: number; users?: number; duration_ms: number };
type ToolRow = Metrics & { tool: string; last_used_at?: string };
type Account = { id: string; name: string | null; email: string; registered_at: string; last_sign_in_at: string | null };
type UserRow = Account & Metrics & { last_used_at: string | null };
type Summary = { collection_enabled: boolean; total_registered: number; new_registered: number; totals: Metrics;
  tools: ToolRow[]; daily: (Metrics & { day: string })[] };
type Detail = { user: Account | null; totals: Metrics; tools: ToolRow[];
  sessions: { session_id: string; tool: string; started_at: string; last_seen_at: string; duration_ms: number }[] };
type Users = { total: number; users: UserRow[] };
const date = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '暂无记录';
const metrics = (row: Metrics, people = false) => `${row.visits} 次${people ? ` · ${row.users || 0} 人` : ''} · ${usageDuration(row.duration_ms)}`;

export default function UsageAnalyticsScreen() {
  const { colors } = useTheme();
  const { user, hasAdminPermission } = useAuth();
  const canSummary = hasAdminPermission('analytics.summary');
  const canUsers = hasAdminPermission('analytics.users');
  const [tab, setTab] = useState<'summary' | 'users'>('summary');
  const mode = tab === 'summary' && canSummary ? 'summary' : canUsers ? 'users' : 'summary';
  const [days, setDays] = useState(7);
  const [refresh, setRefresh] = useState(0);
  const range = useMemo(() => { const end = Date.now(); return {
    p_from: new Date(end - days * 86400_000).toISOString(), p_to: new Date(end).toISOString(),
  }; }, [days, refresh]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<{ summary?: Summary; users?: Users; detail?: Detail } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
    <Pressable key={label} onPress={action} style={[styles.button, { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.surface }]}>
      <Text style={{ color: active ? '#fff' : colors.textPrimary }}>{label}</Text>
    </Pressable>
  );
  const copy = (text: string, key?: string) => <Text key={key} style={[styles.copy, { color: colors.textPrimary }]}>{text}</Text>;
  const tools = (rows: ToolRow[], people: boolean) => TOOL_USAGE_TOOLS.map(tool => {
    const row = rows.find(item => item.tool === tool.id) || { visits: 0, users: 0, duration_ms: 0 };
    return copy(`${tool.label}：${metrics(row, people)}${'last_used_at' in row && row.last_used_at ? `\n最近使用：${date(row.last_used_at)}` : ''}`, tool.id);
  });
  const account = (item: Account) => <View>{copy(`${item.name || '未设置昵称'} · ${item.email}`)}
    {copy(`注册：${date(item.registered_at)}\n最近登录：${date(item.last_sign_in_at)}`)}</View>;
  const summary = canSummary ? result?.summary : undefined;
  const users = canUsers ? result?.users : undefined;
  const detail = canUsers ? result?.detail : undefined;
  const total = detail?.totals.visits ?? users?.total ?? 0;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.row}>{button('返回', () => router.back())}{copy('使用统计')}</View>
      <View style={styles.row}>
        {canSummary && button('总体与工具', () => { setTab('summary'); setSelected(null); setOffset(0); }, mode === 'summary')}
        {canUsers && button('用户明细', () => { setTab('users'); setSelected(null); setOffset(0); }, mode === 'users')}
      </View>
      <View style={styles.row}>{[7, 30, 90].map(n => button(`最近 ${n} 天`, () => { setDays(n); setOffset(0); }, days === n))}
        {button('刷新', () => setRefresh(n => n + 1))}</View>
      <Text style={{ color: colors.textSecondary }}>前台停留时长为估算；不等同于实际操作。最近登录不等同于最近打开 App。仅保留最近 90 天，启用前无使用记录。人数跨工具去重，每日按罗马日期统计，时长按访问开始时间归属。</Text>
      {mode === 'users' && !selected && <View>
        <TextInput value={search} onChangeText={setSearch} placeholder="按昵称或邮箱搜索" placeholderTextColor={colors.textSecondary}
          onSubmitEditing={() => { setQuery(search.trim()); setOffset(0); }}
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]} />
        {button('搜索', () => { setQuery(search.trim()); setOffset(0); })}
      </View>}
      {selected && mode === 'users' && button('返回用户列表', () => { setSelected(null); setOffset(0); })}
      {loading && <ActivityIndicator color={colors.primary} />}
      {!!error && copy(error)}
      {summary && <View>
        {copy(`采集状态：${summary.collection_enabled ? '服务器已开启（还需客户端开启）' : '关闭'}`)}
        {copy(`注册账号总数：${summary.total_registered}\n本期新增注册：${summary.new_registered}`)}
        {copy(`全部工具合计：${summary.totals.visits} 次\n去重使用人数：${summary.totals.users || 0} 人\n累计前台时长：${usageDuration(summary.totals.duration_ms)}`)}
        {copy('各工具汇总')}{tools(summary.tools, true)}
        {copy('每日趋势（罗马日期）')}
        {summary.daily.length ? summary.daily.map(row => copy(`${row.day}：${metrics(row, true)}`, row.day)) : copy('所选范围暂无使用记录')}
      </View>}
      {users && <View>{copy(`共 ${users.total} 个账号（包括尚未使用工具的账号）`)}
        {users.users.map(item => <Pressable key={item.id} onPress={() => { setSelected(item.id); setOffset(0); }} style={[styles.card, { borderColor: colors.border }]}>
          {account(item)}{copy(`${metrics(item)}\n最近使用：${date(item.last_used_at)}`)}
        </Pressable>)}
      </View>}
      {detail && <View>{detail.user ? account(detail.user) : copy('账号已不存在')}
        {copy(`该用户合计：${metrics(detail.totals)}`)}{tools(detail.tools, false)}
        {copy('逐次访问记录')}{detail.sessions.map(item => copy(`${usageToolLabel(item.tool)} · ${usageDuration(item.duration_ms)}\n进入：${date(item.started_at)}\n最后活跃：${date(item.last_seen_at)}`, item.session_id))}
        {!detail.sessions.length && copy('所选范围暂无访问记录')}
      </View>}
      {mode === 'users' && result && <View style={styles.row}>
        {offset > 0 && button('上一页', () => setOffset(n => Math.max(0, n - 25)))}
        {copy(`第 ${Math.floor(offset / 25) + 1} 页`)}
        {offset + 25 < total && button('下一页', () => setOffset(n => n + 25))}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { padding: 20, gap: 16 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  button: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  copy: { fontSize: 15, lineHeight: 24, marginVertical: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
});
