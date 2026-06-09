import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const FACULTIES = ['计算机学院', '理学院', '文学院', '商学院', '工学院', '医学院', '法学院', '艺术学院', '其他'];
const CAMPUSES = ['主校区', '南校区', '北校区', '东校区'];
const YEARS = ['2021', '2022', '2023', '2024', '2025'];

export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: profile?.name || '',
    student_id: profile?.student_id || '',
    faculty: profile?.faculty || '',
    major: profile?.major || '',
    campus: profile?.campus || '',
    enrollment_year: String(profile?.enrollment_year || ''),
  });

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: form.name,
        student_id: form.student_id,
        faculty: form.faculty,
        major: form.major,
        campus: form.campus,
        enrollment_year: form.enrollment_year ? parseInt(form.enrollment_year) : null,
      })
      .eq('id', user?.id);
    setSaving(false);
    if (!error) {
      await refreshProfile();
      setEditing(false);
      Alert.alert('保存成功', '个人资料已更新');
    } else {
      Alert.alert('保存失败', error.message);
    }
  }

  function InfoRow({ label, value, field }: { label: string; value: string; field: string }) {
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        {editing ? (
          <TextInput
            style={styles.infoInput}
            value={form[field as keyof typeof form]}
            onChangeText={(v) => setForm(prev => ({ ...prev, [field]: v }))}
            placeholder={`请输入${label}`}
            placeholderTextColor={COLORS.textMuted}
          />
        ) : (
          <Text style={styles.infoValue}>{value || '未填写'}</Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <LinearGradient
          colors={['#A31621', '#7A1018', '#1A0508']}
          style={styles.profileHeader}
        >
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {profile?.name?.[0] || user?.email?.[0]?.toUpperCase() || '学'}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile?.name || '同学'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {profile?.role === 'super_admin' ? '👑 超级管理员'
                : profile?.role === 'admin' ? '⚡ 管理员'
                : '🎓 在校学生'}
            </Text>
          </View>
        </LinearGradient>

        {/* Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>个人资料</Text>
            {!editing ? (
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
                <Text style={styles.editBtnText}>✏️ 编辑</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelBtnText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>保存</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <InfoRow label="真实姓名" value={profile?.name || ''} field="name" />
          <InfoRow label="学号" value={profile?.student_id || ''} field="student_id" />
          <InfoRow label="院系" value={profile?.faculty || ''} field="faculty" />
          <InfoRow label="专业" value={profile?.major || ''} field="major" />
          <InfoRow label="校区" value={profile?.campus || ''} field="campus" />
          <InfoRow label="入学年份" value={String(profile?.enrollment_year || '')} field="enrollment_year" />
        </View>

        {/* Menu Items */}
        <View style={styles.menuCard}>
          {[
            { icon: '📅', label: '我的报名活动', onPress: () => {} },
            { icon: '💬', label: '我的帖子', onPress: () => {} },
            { icon: '🔔', label: '通知设置', onPress: () => {} },
            { icon: '🔒', label: '修改密码', onPress: () => {} },
          ].map((item, index, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, index < arr.length - 1 && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => Alert.alert('退出登录', '确认退出吗？', [
            { text: '取消', style: 'cancel' },
            { text: '退出', style: 'destructive', onPress: signOut },
          ])}
        >
          <Text style={styles.signOutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.version}>学联之家 v1.0.0</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileHeader: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatarLargeText: { fontSize: 40, fontFamily: FONTS.bold, color: '#FFFFFF' },
  profileName: { fontSize: SIZES.xxl, fontFamily: FONTS.bold, color: '#FFFFFF' },
  profileEmail: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.7)' },
  roleBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginTop: SPACING.xs,
  },
  roleText: { fontSize: SIZES.sm, fontFamily: FONTS.semiBold, color: '#FFFFFF' },
  card: {
    margin: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.base,
  },
  cardTitle: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  editBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  editBtnText: { fontSize: SIZES.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  editActions: { flexDirection: 'row', gap: SPACING.sm },
  cancelBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: SIZES.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  saveBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    minWidth: 48,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: SIZES.sm, fontFamily: FONTS.bold, color: '#FFFFFF' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.base,
  },
  infoLabel: {
    width: 72,
    fontSize: SIZES.sm,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  infoInput: {
    flex: 1,
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuCard: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    gap: SPACING.sm,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuIcon: { fontSize: 20 },
  menuLabel: { flex: 1, fontSize: SIZES.base, fontFamily: FONTS.medium, color: COLORS.textPrimary },
  menuChevron: { fontSize: SIZES.xl, color: COLORS.textMuted },
  signOutBtn: {
    margin: SPACING.lg,
    padding: SPACING.base,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.error + '50',
    alignItems: 'center',
  },
  signOutText: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, color: COLORS.error },
  version: {
    textAlign: 'center',
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
});
