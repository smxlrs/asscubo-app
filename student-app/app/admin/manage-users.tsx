import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type UserProfile = {
  id: string;
  name: string | null;
  avatar_url: string | null;
  email: string;
  role: string;
  push_token: string | null;
  created_at: string;
};

export default function ManageUsersScreen() {
  const { colors } = useTheme();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      // Fetch users using the secure admin RPC function
      const { data, error } = await supabase.rpc('admin_get_users');
      
      if (error) throw error;
      if (data) {
        setUsers(data as UserProfile[]);
      }
    } catch (e: any) {
      console.error('Error fetching users:', e);
      Alert.alert('加载失败', e.message || '无法获取已注册用户列表，请确保您是管理员并已在数据库中运行了敏感词迁移脚本。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const sendPushNotification = async (pushToken: string, bodyText: string) => {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: pushToken,
          sound: 'default',
          title: '系统通知',
          body: bodyText,
          data: { type: 'profile_violation' }
        })
      });
    } catch (err) {
      console.warn('Failed to send violation push:', err);
    }
  };

  const handleAvatarViolation = (user: UserProfile) => {
    Alert.alert(
      '确认警告',
      `您确定要将用户《${user.name || '未设置昵称'}》的头像标记为违规吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '下一步',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '再次确认',
              '此操作将立即清除该用户的头像并向其发送整改通知推送，确认执行？',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '确认执行',
                  style: 'destructive',
                  onPress: async () => {
                    setProcessingId(user.id);
                    try {
                      // 1. Clear avatar_url in DB
                      const { error } = await supabase
                        .from('profiles')
                        .update({ avatar_url: null })
                        .eq('id', user.id);

                      if (error) throw error;

                      // 2. Send push notice if token exists
                      if (user.push_token) {
                        await sendPushNotification(user.push_token, '您的头像不符合规定，请重新设置。');
                      }

                      // 3. Update local state
                      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, avatar_url: null } : u));
                      Alert.alert('处理成功', '违规头像已被清空，通知已发送。');
                    } catch (err: any) {
                      console.error(err);
                      Alert.alert('操作失败', err.message || '处理头像违规时出错。');
                    } finally {
                      setProcessingId(null);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const handleNicknameViolation = (user: UserProfile) => {
    Alert.alert(
      '确认警告',
      `您确定要将用户《${user.name || '未设置昵称'}》的昵称标记为违规吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '下一步',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '再次确认',
              '此操作将随机重置该用户的昵称为编号，并向其发送整改通知推送，确认执行？',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '确认执行',
                  style: 'destructive',
                  onPress: async () => {
                    setProcessingId(user.id);
                    try {
                      // Generate a random number nickname
                      const randomNum = Math.floor(10000 + Math.random() * 90000);
                      const newNickname = `用户_${randomNum}`;

                      // 1. Update nickname in DB
                      const { error } = await supabase
                        .from('profiles')
                        .update({ name: newNickname })
                        .eq('id', user.id);

                      if (error) throw error;

                      // 2. Send push notice if token exists
                      if (user.push_token) {
                        await sendPushNotification(user.push_token, '您的昵称不符合规定，请重新设置。');
                      }

                      // 3. Update local state
                      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, name: newNickname } : u));
                      Alert.alert('处理成功', `违规昵称已被重置为《${newNickname}》，通知已发送。`);
                    } catch (err: any) {
                      console.error(err);
                      Alert.alert('操作失败', err.message || '处理昵称违规时出错。');
                    } finally {
                      setProcessingId(null);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: UserProfile }) => {
    const formattedDate = new Date(item.created_at).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const isProcessing = processingId === item.id;

    return (
      <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* User Info Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <MaterialCommunityIcons name="account" size={36} color={colors.textSecondary} />
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.username, { color: colors.textPrimary }]}>
              {item.name || '未设置昵称'}
            </Text>
            <Text style={[styles.email, { color: colors.textSecondary }]}>
              {item.email}
            </Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: item.role === 'student' ? colors.border : colors.primaryLight + '20' }]}>
            <Text style={[styles.roleText, { color: item.role === 'student' ? colors.textSecondary : colors.primaryLight }]}>
              {item.role === 'student' ? '学生' : item.role === 'admin' ? '管理员' : '主管理员'}
            </Text>
          </View>
        </View>

        {/* User Meta Row */}
        <View style={styles.metaRow}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            注册时间: {formattedDate}
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            推送状态: {item.push_token ? '已激活' : '未激活'}
          </Text>
        </View>

        {/* Action Buttons */}
        {item.role === 'student' && (
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            <Pressable 
              style={({ pressed }) => [
                styles.actionBtn, 
                { opacity: pressed || isProcessing ? 0.6 : 1 }
              ]} 
              disabled={isProcessing}
              onPress={() => handleAvatarViolation(item)}
            >
              <MaterialCommunityIcons name="image-off-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.avatarViolationText}>头像违规</Text>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable 
              style={({ pressed }) => [
                styles.actionBtn, 
                { opacity: pressed || isProcessing ? 0.6 : 1 }
              ]}
              disabled={isProcessing}
              onPress={() => handleNicknameViolation(item)}
            >
              <MaterialCommunityIcons name="account-cancel-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.nicknameViolationText}>昵称违规</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>已注册用户管理</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchUsers();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-multiple-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>暂无已注册用户</Text>
            </View>
          }
        />
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  userCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  avatarViolationText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  nicknameViolationText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
  divider: {
    width: 1,
    height: 20,
    alignSelf: 'center',
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
