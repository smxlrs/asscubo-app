import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { ADMIN_PERMISSION_OPTIONS, AdminPermission } from '../../../lib/adminPermissions';
import { TypedDeleteConfirmationModal } from '../../../components/TypedDeleteConfirmationModal';

type ManagedUser = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string;
  role: 'student' | 'admin' | 'super_admin';
  push_token: string | null;
  is_banned: boolean;
  permissions: AdminPermission[];
  created_at: string;
};

export default function ManageUserDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors, isDark } = useTheme();
  const { profile, hasAdminPermission } = useAuth();
  const [user, setUser] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';
  const canModerate = hasAdminPermission('users.moderate');
  const canDelete = hasAdminPermission('users.delete');
  const activeSwitchColor = isDark ? colors.primaryLight : colors.primary;
  const inactiveSwitchThumb = isDark ? '#737373' : '#FFFFFF';

  const loadUser = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_get_users');
      if (error) throw error;
      const target = ((data || []) as ManagedUser[]).find((item) => item.id === userId);
      if (!target) throw new Error('用户不存在或已被删除。');
      setUser(target);
      setAdminEnabled(target.role === 'admin');
      setPermissions(target.permissions || []);
    } catch (error: any) {
      Alert.alert('加载失败', error.message || '无法获取用户信息。', [
        { text: '返回', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  const sendPushNotification = async (title: string, body: string) => {
    if (!user?.push_token) return;
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.push_token,
          sound: 'default',
          title,
          body,
          data: { type: 'profile_violation' },
        }),
      });
    } catch (error) {
      console.warn('Failed to send moderation push:', error);
    }
  };

  const runModeration = async (action: 'clear_avatar' | 'reset_name' | 'ban' | 'unban') => {
    if (!user) return;
    setProcessing(action);
    try {
      const { data, error } = await supabase.rpc('admin_moderate_user', {
        target_user_id: user.id,
        moderation_action: action,
      });
      if (error) throw error;

      if (action === 'clear_avatar') {
        setUser({ ...user, avatar_url: null });
        await sendPushNotification('头像需重新设置', '您的头像不符合规定，请重新设置。');
      } else if (action === 'reset_name') {
        const generatedName = String(data || '用户');
        setUser({ ...user, name: generatedName });
        await sendPushNotification('昵称需重新设置', '您的昵称不符合规定，请重新设置。');
      } else {
        setUser({ ...user, is_banned: action === 'ban' });
      }
      Alert.alert('处理成功', action === 'ban' ? '该用户已被封禁。' : action === 'unban' ? '该用户已解封。' : '违规资料已处理。');
    } catch (error: any) {
      Alert.alert('操作失败', error.message || '用户处理失败，请重试。');
    } finally {
      setProcessing(null);
    }
  };

  const confirmModeration = (action: 'clear_avatar' | 'reset_name' | 'ban' | 'unban') => {
    const copy = {
      clear_avatar: ['清除违规头像', '确认清除该用户头像并发送整改通知？'],
      reset_name: ['重置违规昵称', '确认将该用户昵称重置为随机编号并发送整改通知？'],
      ban: ['封禁用户', '封禁后该用户将无法登录，确认继续？'],
      unban: ['解封用户', '确认恢复该用户的登录权限？'],
    }[action];
    Alert.alert(copy[0], copy[1], [
      { text: '取消', style: 'cancel' },
      { text: '确认', style: action === 'unban' ? 'default' : 'destructive', onPress: () => runModeration(action) },
    ]);
  };

  const togglePermission = (permission: AdminPermission) => {
    setPermissions((current) => current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission]);
  };

  const saveAdminAccess = async () => {
    if (!user) return;
    setProcessing('permissions');
    try {
      const { error } = await supabase.rpc('super_admin_set_admin_access', {
        target_user_id: user.id,
        make_admin: adminEnabled,
        new_permissions: adminEnabled ? permissions : [],
      });
      if (error) throw error;
      setUser({ ...user, role: adminEnabled ? 'admin' : 'student', permissions: adminEnabled ? permissions : [] });
      Alert.alert('已保存', adminEnabled ? '管理员身份和权限已更新。' : '该用户已恢复为普通用户。');
    } catch (error: any) {
      Alert.alert('保存失败', error.message || '管理员权限更新失败。');
    } finally {
      setProcessing(null);
    }
  };

  const performDeleteUser = async () => {
    if (!user) return;
    setProcessing('delete');
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: user.id });
    setProcessing(null);
    if (error) {
      Alert.alert('删除失败', error.message || '无法删除该用户。');
    } else {
      setDeleteConfirmationVisible(false);
      Alert.alert('已删除', '用户账号及关联数据已永久删除。', [{ text: '返回', onPress: () => router.back() }]);
    }
  };

  const deleteUser = () => {
    if (!user) return;
    Alert.alert('永久删除账号（1/3）', `即将删除 ${user.name || user.email} 的账号。此操作无法撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '继续',
        style: 'destructive',
        onPress: () => Alert.alert('再次确认（2/3）', '账号、用户资料和关联数据会立即永久删除，之后无法恢复。', [
          { text: '取消', style: 'cancel' },
          {
            text: '进入最终确认',
            style: 'destructive',
            onPress: () => setDeleteConfirmationVisible(true),
          },
        ]),
      },
    ]);
  };

  if (loading || !user) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const targetProtected = user.role === 'super_admin';
  const canActOnTarget = !targetProtected && (user.role === 'student' || isSuperAdmin);
  const roleLabel = targetProtected ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通用户';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>用户设置</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {user.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} /> : (
              <MaterialCommunityIcons name="account" size={42} color={colors.textSecondary} />
            )}
          </View>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{user.name || '未设置昵称'}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user.email}</Text>
          <View style={styles.statusLine}>
            <Text style={[styles.statusText, { color: targetProtected ? '#D97706' : user.role === 'admin' ? colors.primaryLight : colors.textSecondary }]}>{roleLabel}</Text>
            {user.is_banned && <Text style={[styles.statusText, { color: '#EF4444' }]}>已封禁</Text>}
          </View>
        </View>

        {targetProtected && (
          <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#D97706" />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>超级管理员受到保护，无法在APP中修改、降级或删除</Text>
          </View>
        )}

        {isSuperAdmin && !targetProtected && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>管理员身份与权限</Text>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingCopy}>
                  <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>普通管理员</Text>
                  <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>允许进入管理后台</Text>
                </View>
                <Switch
                  value={adminEnabled}
                  onValueChange={setAdminEnabled}
                  trackColor={{ false: colors.border, true: activeSwitchColor }}
                  thumbColor={adminEnabled ? '#FFFFFF' : inactiveSwitchThumb}
                  ios_backgroundColor={colors.border}
                />
              </View>
              {adminEnabled && ADMIN_PERMISSION_OPTIONS.map((permission) => {
                const enabled = permissions.includes(permission.key);
                const dangerous = 'dangerous' in permission && permission.dangerous;
                return (
                  <View key={permission.key} style={[styles.permissionRow, { borderBottomColor: colors.border }]}>
                    <MaterialCommunityIcons name={permission.icon as any} size={20} color={dangerous ? '#EF4444' : colors.primaryLight} />
                    <View style={styles.permissionCopy}>
                      <Text style={[styles.settingTitle, { color: dangerous ? '#EF4444' : colors.textPrimary }]}>{permission.label}</Text>
                      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>{permission.description}</Text>
                    </View>
                    <Switch
                      value={enabled}
                      onValueChange={() => togglePermission(permission.key)}
                      trackColor={{ false: colors.border, true: activeSwitchColor }}
                      thumbColor={enabled ? '#FFFFFF' : inactiveSwitchThumb}
                      ios_backgroundColor={colors.border}
                    />
                  </View>
                );
              })}
              <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} disabled={processing !== null} onPress={saveAdminAccess}>
                {processing === 'permissions' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>保存管理员设置</Text>}
              </Pressable>
            </View>
          </>
        )}

        {canActOnTarget && canModerate && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>资料违规与账号状态</Text>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActionRow icon="image-off-outline" label="清除违规头像" color="#EF4444" colors={colors} disabled={processing !== null} onPress={() => confirmModeration('clear_avatar')} />
              <ActionRow icon="account-cancel-outline" label="重置违规昵称" color="#EF4444" colors={colors} disabled={processing !== null} onPress={() => confirmModeration('reset_name')} />
              <ActionRow
                icon={user.is_banned ? 'lock-open-outline' : 'lock-outline'}
                label={user.is_banned ? '解除封禁' : '封禁用户'}
                color={user.is_banned ? '#10B981' : '#F59E0B'}
                colors={colors}
                disabled={processing !== null}
                onPress={() => confirmModeration(user.is_banned ? 'unban' : 'ban')}
                last
              />
            </View>
          </>
        )}

        {canActOnTarget && canDelete && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>危险操作</Text>
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActionRow icon="delete-outline" label="永久删除账号" color="#EF4444" colors={colors} disabled={processing !== null} onPress={deleteUser} last />
            </View>
          </>
        )}
      </ScrollView>

      <TypedDeleteConfirmationModal
        visible={deleteConfirmationVisible}
        subject={`删除用户：${user.name || user.email}`}
        description="该用户的账号、资料和关联数据会被永久删除，此操作无法撤销。"
        confirmationPhrase="确认删除该用户"
        busy={processing === 'delete'}
        onCancel={() => setDeleteConfirmationVisible(false)}
        onConfirm={performDeleteUser}
      />
    </SafeAreaView>
  );
}

function ActionRow({ icon, label, color, colors, disabled, onPress, last = false }: {
  icon: string;
  label: string;
  color: string;
  colors: any;
  disabled: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, { borderBottomColor: colors.border, opacity: pressed || disabled ? 0.55 : 1 }, last && { borderBottomWidth: 0 }]}
      disabled={disabled}
      onPress={onPress}
    >
      <MaterialCommunityIcons name={icon as any} size={21} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerButton: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { paddingBottom: 36 },
  identity: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatar: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 82, height: 82 },
  name: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  email: { fontSize: 13, marginTop: 4 },
  statusLine: { flexDirection: 'row', gap: 12, marginTop: 9 },
  statusText: { fontSize: 12, fontWeight: '700' },
  notice: { marginHorizontal: 16, borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 12, fontWeight: '700', marginHorizontal: 16, marginTop: 22, marginBottom: 7 },
  section: { borderTopWidth: 1, borderBottomWidth: 1 },
  settingRow: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  settingCopy: { flex: 1, paddingRight: 10 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingDescription: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  permissionRow: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  permissionCopy: { flex: 1, paddingVertical: 8 },
  primaryButton: { height: 44, margin: 16, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  actionRow: { height: 56, marginHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  actionLabel: { flex: 1, fontSize: 15, fontWeight: '600', marginLeft: 12 },
});
