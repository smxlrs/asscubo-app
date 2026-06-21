import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [deleting, setDeleting] = React.useState(false);

  // Refresh profile on focus to ensure data is updated when returning from edit page
  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(console.error);
    }, [])
  );

  const handleSignOut = async () => {
    Alert.alert('确认退出', '您确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(tabs)');
          } catch (err) {
            console.error('Logout error:', err);
          }
        }
      }
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert('⚠️ 危险操作', '您确定要注销并删除您的账户吗？此操作将永久抹除您的个人资料和全部关联数据，且无法撤销！', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认删除',
        style: 'destructive',
        onPress: () => {
          Alert.alert('再次确认', '为了安全起见，请再次确认是否要彻底删除账号？', [
            { text: '取消', style: 'cancel' },
            {
              text: '彻底删除',
              style: 'destructive',
              onPress: async () => {
                setDeleting(true);
                try {
                  // Call RPC function to delete account
                  const { error } = await supabase.rpc('delete_user_account');
                  if (error) throw error;
                  
                  // Delete local session
                  await signOut();
                  Alert.alert('注销成功', '您的账户及数据已被永久删除。');
                  router.replace('/(tabs)');
                } catch (err: any) {
                  console.error('Delete account error:', err);
                  Alert.alert('注销失败', '无法自动删除账号，可能是您的数据库尚未部署删除账户的触发函数。请联系管理员，或重试。');
                } finally {
                  setDeleting(false);
                }
              }
            }
          ]);
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>个人资料</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Avatar Area */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={60} color={colors.textSecondary} />
              )}
            </View>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>基本信息</Text>
        </View>
        
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Nickname */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>昵称</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{profile?.name || '未设置'}</Text>
          </View>

          {/* Email */}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>邮箱</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{user?.email || '未设置'}</Text>
          </View>
        </View>

        {/* Edit Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Pressable
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/settings/edit-profile')}
          >
            <Text style={styles.editButtonText}>修改个人资料</Text>
          </Pressable>
        </View>

        {/* Dangerous Area */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>账号管理</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 40 }]}>
          {/* Logout */}
          <Pressable
            style={[styles.rowPressable, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={handleSignOut}
          >
            <MaterialCommunityIcons name="logout" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>退出登录</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          {/* Delete Account */}
          <Pressable
            style={styles.rowPressable}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={colors.error} size="small" style={{ marginRight: 8 }} />
            ) : (
              <MaterialCommunityIcons name="account-remove-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.rowLabel, { color: colors.error }]}>注销并删除账户</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 28,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
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
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rowPressable: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  label: {
    width: 60,
    fontSize: 15,
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
  },
  arrow: {
    fontSize: 18,
  },
  editButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
