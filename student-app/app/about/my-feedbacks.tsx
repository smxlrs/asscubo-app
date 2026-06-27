import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Image, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type UserFeedback = {
  id: string;
  email: string;
  wechat: string | null;
  content: string;
  media_url: string | null;
  status: 'unread' | 'read' | 'resolved';
  created_at: string;
  reply: string | null;
  replied_at: string | null;
};

const LOCALIZED = {
  zh: {
    title: '我的反馈信箱',
    loginPrompt: '请先登录以查看您的反馈',
    loginBtn: '登录账户',
    loading: '正在加载反馈记录...',
    noFeedbacks: '您的信箱空空如也',
    noFeedbacksDesc: '您提交的意见反馈和学联的答复都将显示在这里。',
    officialReply: '学联官方回复',
    repliedAt: '回复时间',
    submittedAt: '提交时间',
    status: '处理状态',
    unread: '未读',
    read: '已查看',
    resolved: '已解决',
  },
  'zh-Hant': {
    title: '我的反饋信箱',
    loginPrompt: '請先登錄以查看您的反饋',
    loginBtn: '登錄帳戶',
    loading: '正在加載反饋記錄...',
    noFeedbacks: '您的信箱空空如也',
    noFeedbacksDesc: '您提交的意見反饋和學聯的答覆都將顯示在這裡。',
    officialReply: '學聯官方回覆',
    repliedAt: '回覆時間',
    submittedAt: '提交時間',
    status: '處理狀態',
    unread: '未讀',
    read: '已查看',
    resolved: '已解決',
  },
  en: {
    title: 'My Feedback Inbox',
    loginPrompt: 'Please log in to view your feedback',
    loginBtn: 'Login',
    loading: 'Loading feedback records...',
    noFeedbacks: 'Your inbox is empty',
    noFeedbacksDesc: 'Your submitted feedback and replies from CSSA will be displayed here.',
    officialReply: 'CSSA Official Reply',
    repliedAt: 'Replied at',
    submittedAt: 'Submitted at',
    status: 'Status',
    unread: 'Unread',
    read: 'Read',
    resolved: 'Resolved',
  },
  it: {
    title: 'La Mia Casella di Feedback',
    loginPrompt: 'Accedi per visualizzare i tuoi feedback',
    loginBtn: 'Accedi',
    loading: 'Caricamento dei feedback...',
    noFeedbacks: 'La tua casella è vuota',
    noFeedbacksDesc: 'I feedback inviati e le risposte di ASSCUBO saranno visualizzati qui.',
    officialReply: 'Risposta Ufficiale ASSCUBO',
    repliedAt: 'Risposto il',
    submittedAt: 'Inviato il',
    status: 'Stato',
    unread: 'Non letto',
    read: 'Letto',
    resolved: 'Risolto',
  }
};

const STATUS_COLORS = {
  unread: '#EF4444',
  read: '#3B82F6',
  resolved: '#10B981',
};

export default function MyFeedbacksScreen() {
  const { colors, language } = useTheme();
  const { user } = useAuth();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserFeedbacks = async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Query by user_id OR email (in case older test records only have email)
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setFeedbacks(data as UserFeedback[]);
      }
    } catch (e: any) {
      console.error('Failed to fetch user feedbacks:', e);
      Alert.alert('加载失败', e.message || '获取您的反馈记录失败，请刷新重试。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserFeedbacks();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserFeedbacks();
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const renderFeedbackItem = ({ item }: { item: UserFeedback }) => {
    const statusText = localized[item.status] || item.status;
    const statusColor = STATUS_COLORS[item.status] || '#999';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Card Header metadata */}
        <View style={styles.cardHeader}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {localized.submittedAt}: {formatDateTime(item.created_at)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '15', borderColor: statusColor + '30' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Feedback Body Content */}
        <Text style={[styles.feedbackContent, { color: colors.textPrimary }]}>
          {item.content}
        </Text>

        {/* Media Preview if attached */}
        {item.media_url && (
          <View style={[styles.mediaContainer, { borderColor: colors.border }]}>
            {item.media_url.toLowerCase().endsWith('.mp4') ? (
              <View style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                <MaterialCommunityIcons name="video" size={24} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 6 }}>视频文件已附加</Text>
              </View>
            ) : (
              <Image source={{ uri: item.media_url }} style={styles.attachedImage} resizeMode="cover" />
            )}
          </View>
        )}

        {/* Official CSSA Reply Box */}
        {item.reply ? (
          <View style={[styles.replyContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.replyHeader}>
              <MaterialCommunityIcons name="shield-crown-outline" size={16} color={colors.primaryLight} style={{ marginRight: 6 }} />
              <Text style={[styles.replyHeaderTitle, { color: colors.primaryLight }]}>
                {localized.officialReply}
              </Text>
            </View>
            <Text style={[styles.replyBodyText, { color: colors.textPrimary }]}>
              {item.reply}
            </Text>
            {item.replied_at && (
              <Text style={[styles.replyDateText, { color: colors.textMuted }]}>
                {localized.repliedAt}: {formatDateTime(item.replied_at)}
              </Text>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.title}</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Not Logged In view */}
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="mailbox-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.promptText, { color: colors.textSecondary }]}>
            {localized.loginPrompt}
          </Text>
          <Pressable 
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.loginBtnText}>{localized.loginBtn}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.title}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
            {localized.loading}
          </Text>
        </View>
      ) : (
        <FlatList
          data={feedbacks}
          renderItem={renderFeedbackItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="email-outline" size={60} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {localized.noFeedbacks}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {localized.noFeedbacksDesc}
              </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  promptText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  loginBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  feedbackContent: {
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 12,
  },
  mediaContainer: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  attachedImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyContainer: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginTop: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyHeaderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  replyBodyText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  replyDateText: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
