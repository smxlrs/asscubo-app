import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator, Modal } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Notification = {
  id: string;
  title: string;
  category: string | null;
  link: string | null;
  created_at: string;
  is_pinned: boolean;
};

const NOTIFICATION_CATEGORIES: Record<string, { label: string; color: string }> = {
  events: { label: '学联活动', color: '#EF4444' },
  academic: { label: '学术资讯', color: '#3B82F6' },
  life: { label: '生活辅助', color: '#10B981' },
  general: { label: '综合通知', color: '#8B5CF6' }
};

export default function ManageNotificationsScreen() {
  const { colors } = useTheme();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, category, link, created_at, is_pinned')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (data) {
        setNotifications(data as Notification[]);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
      Alert.alert('加载失败', '无法拉取通知列表，请刷新重试。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleCategoryChange = async (notificationId: string, newCategory: string | null) => {
    try {
      const finalCategory = newCategory || 'general';
      // Update category in notifications table
      const { error } = await supabase
        .from('notifications')
        .update({ category: finalCategory })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, category: finalCategory } : n));
    } catch (err: any) {
      console.error(err);
      Alert.alert('修改失败', err.message || '修改分类失败，请重试。');
    }
  };

  const handleTogglePin = async (notification: Notification) => {
    try {
      const newPinned = !notification.is_pinned;
      const { error } = await supabase
        .from('notifications')
        .update({ is_pinned: newPinned })
        .eq('id', notification.id);

      if (error) throw error;

      setNotifications(prev => {
        const updated = prev.map(n => n.id === notification.id ? { ...n, is_pinned: newPinned } : n);
        return [...updated].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
    } catch (err: any) {
      console.error(err);
      Alert.alert('操作失败', err.message || '切换置顶状态失败，请重试。');
    }
  };

  const showCategoryPicker = (notification: Notification) => {
    setActiveNotification(notification);
    setSelectedCategory(notification.category);
    setPickerVisible(true);
  };

  const handleDelete = (notification: Notification) => {
    Alert.alert(
      '确认删除',
      `确定要彻底删除通知《${notification.title.slice(0, 20)}...》吗？此操作无法撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from notifications table
              const { error: notifError } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notification.id);

              if (notifError) throw notifError;

              setNotifications(prev => prev.filter(n => n.id !== notification.id));
              Alert.alert('删除成功', '通知已成功删除。');
            } catch (err: any) {
              console.error(err);
              Alert.alert('删除失败', err.message || '删除出错，请重试。');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const cat = item.category ? NOTIFICATION_CATEGORIES[item.category] : null;
    const formattedDate = new Date(item.created_at).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <View style={[styles.itemRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemDate, { color: colors.textMuted }]}>{formattedDate}</Text>
            <Pressable 
              style={[
                styles.categoryTag, 
                { 
                  backgroundColor: cat ? cat.color + '15' : colors.border + '30', 
                  borderColor: cat ? cat.color + '40' : colors.border 
                }
              ]}
              onPress={() => showCategoryPicker(item)}
            >
              <Text style={[styles.categoryTagText, { color: cat ? cat.color : colors.textSecondary }]}>
                {cat ? cat.label : '未分类'} ▾
              </Text>
            </Pressable>
          </View>
        </View>
        
        <View style={styles.actionButtons}>
          <Pressable style={styles.pinButton} onPress={() => handleTogglePin(item)}>
            <MaterialCommunityIcons 
              name={item.is_pinned ? "pin" : "pin-outline"} 
              size={22} 
              color={item.is_pinned ? "#F59E0B" : colors.textMuted} 
            />
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)}>
            <MaterialCommunityIcons name="trash-can-outline" size={22} color="#EF4444" />
          </Pressable>
        </View>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>管理已有通知</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchNotifications();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="folder-open-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>暂无通知数据</Text>
            </View>
          }
        />
      )}

      {/* Category Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setPickerVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>修改通知分类</Text>
            {activeNotification && (
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                修改《{activeNotification.title}》的分类为：
              </Text>
            )}
            
            <View style={styles.modalButtonsContainer}>
              {Object.entries(NOTIFICATION_CATEGORIES).map(([key, cat]) => {
                const isSelected = selectedCategory === key;
                return (
                  <Pressable
                    key={key}
                    style={({ pressed }) => [
                      styles.modalCategoryButton,
                      { 
                        borderColor: isSelected ? cat.color : cat.color + '30',
                        backgroundColor: isSelected ? cat.color + '15' : (pressed ? cat.color + '05' : 'transparent'),
                        borderWidth: isSelected ? 1.5 : 1
                      }
                    ]}
                    onPress={() => {
                      setSelectedCategory(prev => prev === key ? null : key);
                    }}
                  >
                    <View style={[styles.colorDot, { backgroundColor: cat.color }]} />
                    <Text style={[
                      styles.modalCategoryText, 
                      { 
                        color: colors.textPrimary,
                        fontWeight: isSelected ? 'bold' : 'normal' 
                      }
                    ]}>
                      {cat.label}
                    </Text>
                    {isSelected && (
                      <MaterialCommunityIcons 
                        name="check-circle" 
                        size={16} 
                        color={cat.color} 
                        style={{ marginLeft: 'auto' }} 
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActionsRow}>
              <Pressable 
                style={[styles.modalActionButton, { backgroundColor: colors.border }]}
                onPress={() => setPickerVisible(false)}
              >
                <Text style={[styles.modalActionButtonText, { color: colors.textPrimary }]}>取消</Text>
              </Pressable>
              
              <Pressable 
                style={[styles.modalActionButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  if (activeNotification) {
                    setPickerVisible(false);
                    await handleCategoryChange(activeNotification.id, selectedCategory);
                  }
                }}
              >
                <Text style={[styles.modalActionButtonText, { color: '#FFFFFF' }]}>确认</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
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
    paddingBottom: 24,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 16,
    gap: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemDate: {
    fontSize: 12,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  modalCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  modalCategoryText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
