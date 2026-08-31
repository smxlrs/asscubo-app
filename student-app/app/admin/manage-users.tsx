import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

type UserProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string;
  role: 'student' | 'admin' | 'super_admin';
  is_banned: boolean;
  created_at: string;
};

const ROLE_ORDER: Record<UserProfile['role'], number> = {
  super_admin: 0,
  admin: 1,
  student: 2,
};

export default function ManageUsersScreen() {
  const { colors } = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_get_users');
      if (error) throw error;

      const sorted = ([...(data || [])] as UserProfile[]).sort((a, b) => {
        const roleDifference = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
        if (roleDifference !== 0) return roleDifference;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setUsers(sorted);
    } catch (error: any) {
      Alert.alert('加载失败', error.message || '无法获取已注册用户列表。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      user.name?.toLowerCase().includes(normalized) || user.email.toLowerCase().includes(normalized)
    );
  }, [query, users]);

  const renderUser = ({ item }: { item: UserProfile }) => {
    const roleLabel = item.role === 'super_admin' ? '超级管理员' : item.role === 'admin' ? '管理员' : '普通用户';
    const roleColor = item.role === 'super_admin' ? '#D97706' : item.role === 'admin' ? colors.primaryLight : colors.textSecondary;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.userRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 },
        ]}
        onPress={() => router.push({ pathname: '/admin/manage-user/[userId]', params: { userId: item.id } })}
      >
        <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} /> : (
            <MaterialCommunityIcons name="account" size={27} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.userCopy}>
          <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name || '未设置昵称'}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>{item.email}</Text>
          <View style={styles.badges}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '18' }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
            </View>
            {item.is_banned && (
              <View style={[styles.roleBadge, { backgroundColor: '#EF444418' }]}>
                <Text style={[styles.roleText, { color: '#EF4444' }]}>已封禁</Text>
              </View>
            )}
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>已注册用户管理</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="搜索昵称或邮箱"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchUsers(); }}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>没有匹配的用户</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  searchBox: { margin: 16, marginBottom: 8, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 32 },
  userRow: { minHeight: 88, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 50, height: 50 },
  userCopy: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  userName: { fontSize: 16, fontWeight: '700' },
  email: { fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 7 },
  roleBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3 },
  roleText: { fontSize: 10, fontWeight: '700' },
  emptyText: { textAlign: 'center', paddingTop: 48 },
});
