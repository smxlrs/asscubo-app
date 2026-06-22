import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Alert, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Feedback = {
  id: string;
  email: string;
  wechat: string | null;
  content: string;
  media_url: string | null;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
};

const STATUS_DETAILS = {
  unread: { label: '未读', color: '#EF4444', icon: 'email-outline' },
  read: { label: '已读', color: '#3B82F6', icon: 'email-open-outline' },
  resolved: { label: '已解决', color: '#10B981', icon: 'check-circle-outline' },
};

export default function ManageFeedbacksScreen() {
  const { colors, isDark } = useTheme();
  
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'read' | 'resolved'>('all');
  
  // Modal for detail view and status selection
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Image Viewer Modal
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  const fetchFeedbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setFeedbacks(data as Feedback[]);
      }
    } catch (e) {
      console.error('Error fetching feedbacks:', e);
      Alert.alert('加载失败', '无法拉取意见反馈数据，请重试。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleStatusChange = async (feedbackId: string, newStatus: 'unread' | 'read' | 'resolved') => {
    try {
      const { error } = await supabase
        .from('feedbacks')
        .update({ status: newStatus })
        .eq('id', feedbackId);

      if (error) throw error;

      setFeedbacks(prev => prev.map(f => f.id === feedbackId ? { ...f, status: newStatus } : f));
      
      // Sync local active feedback if detail modal is open
      if (selectedFeedback && selectedFeedback.id === feedbackId) {
        setSelectedFeedback(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('状态修改失败', err.message || '更新失败，请稍后重试。');
    }
  };

  const handleDeleteFeedback = (feedback: Feedback) => {
    Alert.alert(
      '确认删除',
      `确定要彻底删除该条来自 ${feedback.email} 的反馈吗？此操作不可逆。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('feedbacks')
                .delete()
                .eq('id', feedback.id);

              if (error) throw error;

              setFeedbacks(prev => prev.filter(f => f.id !== feedback.id));
              setShowDetailModal(false);
              setSelectedFeedback(null);
              Alert.alert('已删除', '意见反馈记录已成功删除。');
            } catch (err: any) {
              console.error(err);
              Alert.alert('删除失败', err.message || '操作出错，请重试。');
            }
          }
        }
      ]
    );
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    if (activeFilter === 'all') return true;
    return f.status === activeFilter;
  });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: Feedback }) => {
    const statusInfo = STATUS_DETAILS[item.status];
    const isVideo = item.media_url?.toLowerCase().endsWith('.mp4');

    return (
      <Pressable 
        style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          setSelectedFeedback(item);
          setShowDetailModal(true);
          // If status is unread, automatically mark as read upon clicking
          if (item.status === 'unread') {
            handleStatusChange(item.id, 'read');
          }
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.userInfoRow}>
            <MaterialCommunityIcons name="email-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.userEmailText, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '18', borderColor: statusInfo.color + '30' }]}>
            <MaterialCommunityIcons name={statusInfo.icon as any} size={12} color={statusInfo.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {item.wechat && (
          <View style={styles.wechatRow}>
            <MaterialCommunityIcons name="wechat" size={14} color="#07C160" />
            <Text style={[styles.wechatText, { color: colors.textSecondary }]}>微信号: {item.wechat}</Text>
          </View>
        )}

        <Text style={[styles.cardContentPreview, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.content}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDateTime(item.created_at)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {item.media_url && (
              <View style={styles.mediaIndicator}>
                <MaterialCommunityIcons 
                  name={isVideo ? "video-outline" : "image-outline"} 
                  size={14} 
                  color={colors.primaryLight} 
                />
                <Text style={[styles.mediaIndicatorText, { color: colors.primaryLight }]}>
                  {isVideo ? '附带视频' : '附带图片'}
                </Text>
              </View>
            )}
            <Text style={[styles.viewDetailText, { color: colors.primary }]}>查看详情 →</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>用户意见反馈管理</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
        {(['all', 'unread', 'read', 'resolved'] as const).map(filter => {
          const isActive = activeFilter === filter;
          const label = filter === 'all' ? '全部' : STATUS_DETAILS[filter].label;
          const filterColor = filter === 'all' ? colors.primary : STATUS_DETAILS[filter].color;
          return (
            <Pressable
              key={filter}
              style={[
                styles.tabButton,
                isActive && { borderBottomColor: filterColor }
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[
                styles.tabButtonText,
                { color: isActive ? filterColor : colors.textSecondary, fontWeight: isActive ? 'bold' : 'normal' }
              ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredFeedbacks}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchFeedbacks();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="message-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>暂无该类型下的意见反馈</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitleText, { color: colors.textPrimary }]}>反馈详情</Text>
              <Pressable onPress={() => setShowDetailModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            {selectedFeedback && (
              <ScrollView style={styles.modalScrollBody} contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.detailMetaCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <View style={styles.detailMetaRow}>
                    <Text style={[styles.detailMetaLabel, { color: colors.textSecondary }]}>用户邮箱：</Text>
                    <Text style={[styles.detailMetaValue, { color: colors.textPrimary }]} selectable>{selectedFeedback.email}</Text>
                  </View>
                  {selectedFeedback.wechat && (
                    <View style={styles.detailMetaRow}>
                      <Text style={[styles.detailMetaLabel, { color: colors.textSecondary }]}>微信号码：</Text>
                      <Text style={[styles.detailMetaValue, { color: colors.textPrimary }]} selectable>{selectedFeedback.wechat}</Text>
                    </View>
                  )}
                  <View style={styles.detailMetaRow}>
                    <Text style={[styles.detailMetaLabel, { color: colors.textSecondary }]}>提交时间：</Text>
                    <Text style={[styles.detailMetaValue, { color: colors.textPrimary }]}>{formatDateTime(selectedFeedback.created_at)}</Text>
                  </View>
                </View>

                {/* Feedback Content */}
                <View style={styles.detailBodyContainer}>
                  <Text style={[styles.detailBodyTitle, { color: colors.textPrimary }]}>反馈内容：</Text>
                  <Text style={[styles.detailBodyText, { color: colors.textSecondary }]} selectable={true}>
                    {selectedFeedback.content}
                  </Text>
                </View>

                {/* Media Attachment */}
                {selectedFeedback.media_url && (
                  <View style={styles.attachmentContainer}>
                    <Text style={[styles.detailBodyTitle, { color: colors.textPrimary, marginBottom: 8 }]}>媒体附件：</Text>
                    {selectedFeedback.media_url.toLowerCase().endsWith('.mp4') ? (
                      <Pressable 
                        style={[styles.videoPlaceholderCard, { backgroundColor: colors.surfaceElevated }]}
                        onPress={() => Alert.alert('视频播放提示', '视频附件暂不支持在后台直接播放，请复制链接在浏览器中下载查看:\n\n' + selectedFeedback.media_url)}
                      >
                        <MaterialCommunityIcons name="video" size={32} color={colors.primaryLight} />
                        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>点击获取视频链接</Text>
                      </Pressable>
                    ) : (
                      <Pressable onPress={() => setActiveImageUrl(selectedFeedback.media_url)}>
                        <Image source={{ uri: selectedFeedback.media_url }} style={styles.attachmentImage} resizeMode="cover" />
                        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>点击放大查看大图</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Status Switch actions */}
                <View style={[styles.statusActionsBox, { borderTopColor: colors.border }]}>
                  <Text style={[styles.detailBodyTitle, { color: colors.textPrimary, marginBottom: 12 }]}>更新处理状态：</Text>
                  <View style={styles.statusButtonsRow}>
                    {(['unread', 'read', 'resolved'] as const).map(st => {
                      const isCurrent = selectedFeedback.status === st;
                      const config = STATUS_DETAILS[st];
                      return (
                        <Pressable
                          key={st}
                          style={[
                            styles.statusActionButton,
                            { 
                              borderColor: isCurrent ? config.color : colors.border,
                              backgroundColor: isCurrent ? config.color + '15' : 'transparent',
                              borderWidth: isCurrent ? 1.5 : 1
                            }
                          ]}
                          onPress={() => handleStatusChange(selectedFeedback.id, st)}
                        >
                          <MaterialCommunityIcons name={config.icon as any} size={14} color={isCurrent ? config.color : colors.textMuted} />
                          <Text style={[
                            styles.statusActionButtonText,
                            { 
                              color: isCurrent ? config.color : colors.textSecondary,
                              fontWeight: isCurrent ? 'bold' : 'normal'
                            }
                          ]}>
                            {config.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Delete button */}
                <Pressable 
                  style={[styles.deleteRecordBtn, { borderColor: colors.error }]} 
                  onPress={() => handleDeleteFeedback(selectedFeedback)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={[styles.deleteRecordBtnText, { color: colors.error }]}>删除该条反馈记录</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal
        visible={!!activeImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActiveImageUrl(null)}
      >
        <Pressable style={styles.imageOverlay} onPress={() => setActiveImageUrl(null)}>
          {activeImageUrl && (
            <Image source={{ uri: activeImageUrl }} style={styles.zoomImage} resizeMode="contain" />
          )}
          <Pressable style={styles.closeZoomBtn} onPress={() => setActiveImageUrl(null)}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
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
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    height: 48,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 16,
  },
  userEmailText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  wechatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  wechatText: {
    fontSize: 12,
  },
  cardContentPreview: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaIndicatorText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 60,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalScrollBody: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
    gap: 20,
    paddingBottom: 40,
  },
  detailMetaCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailMetaLabel: {
    fontSize: 13,
    width: 72,
  },
  detailMetaValue: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  detailBodyContainer: {
    gap: 8,
  },
  detailBodyTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailBodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  attachmentContainer: {
    width: '100%',
  },
  videoPlaceholderCard: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  statusActionsBox: {
    paddingTop: 16,
    borderTopWidth: 1,
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusActionButtonText: {
    fontSize: 13,
  },
  deleteRecordBtn: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  deleteRecordBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '100%',
  },
  closeZoomBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
