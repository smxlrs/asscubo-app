import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { broadcastPushNotification } from '../../lib/notificationService';

type CategoryType = 'events' | 'academic' | 'life' | 'general';

const CATEGORIES: { value: CategoryType; label: string; color: string }[] = [
  { value: 'events', label: '学联活动', color: '#EF4444' },
  { value: 'academic', label: '学术资讯', color: '#3B82F6' },
  { value: 'life', label: '生活辅助', color: '#10B981' },
  { value: 'general', label: '综合公告', color: '#8B5CF6' },
];

export default function PublishNotificationScreen() {
  const { colors } = useTheme();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryType>('general');
  const [summary, setSummary] = useState('');
  const [wechatLink, setWechatLink] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [contentBody, setContentBody] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('校验失败', '请输入通知标题');
      return;
    }
    if (!summary.trim()) {
      Alert.alert('校验失败', '请输入通知简述');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Insert into articles table (so it displays on Home and Announcements)
      // Map category:
      // notifications categories: events, academic, life, general
      // articles categories: event_news, notice, news, general
      let articleCategory = 'general';
      if (category === 'events') articleCategory = 'event_news';
      if (category === 'academic') articleCategory = 'notice';
      if (category === 'life') articleCategory = 'news';

      const articlePayload = {
        title: title.trim(),
        summary: summary.trim(),
        category: articleCategory,
        cover_image: coverImage.trim() || null,
        link: wechatLink.trim() || null,
        content: contentBody.trim() || null,
        is_published: true,
        created_at: new Date().toISOString(),
        view_count: 0,
      };

      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .insert([articlePayload])
        .select();

      if (articleError) {
        throw articleError;
      }

      const articleId = articleData && articleData[0]?.id;

      // 2. Insert into notifications table (so it displays in the Bell history page)
      const notificationPayload = {
        title: title.trim(),
        content: summary.trim(),
        category: category,
        link: wechatLink.trim() || null,
        created_at: new Date().toISOString(),
      };

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationPayload]);

      if (notificationError) {
        console.warn('Failed to insert into notifications table (it may not be created yet):', notificationError);
      }

      // 3. Broadcast Expo Push Notification to all users
      const pushTitle = `【${CATEGORIES.find(c => c.value === category)?.label}】${title}`;
      const pushResult = await broadcastPushNotification(
        pushTitle,
        summary.trim(),
        category,
        wechatLink.trim() || undefined,
        articleId || undefined
      );

      if (pushResult.success) {
        Alert.alert(
          '发布成功', 
          `通知已成功同步至数据库，并已群发推送至 ${pushResult.sentCount} 台用户设备！`,
          [{ text: '返回后台', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          '发布成功', 
          '通知已成功保存到数据库，但推送消息群发失败，请联系管理员检查后台设置。',
          [{ text: '返回后台', onPress: () => router.back() }]
        );
      }

    } catch (error: any) {
      console.error('Error publishing notification:', error);
      Alert.alert('发布失败', error.message || '请检查网络连接后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>发布通知公告</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Title Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>通知标题 *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="例如：中秋晚会门票正式开放抢购"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
          />
        </View>

        {/* Category Selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>订阅分类 *</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                style={[
                  styles.categoryChip,
                  { borderColor: colors.border },
                  category === cat.value && { backgroundColor: cat.color + '15', borderColor: cat.color }
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text style={[
                  styles.categoryChipText,
                  { color: colors.textSecondary },
                  category === cat.value && { color: cat.color, fontWeight: 'bold' }
                ]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>通知简述/推送内容 *</Text>
          <TextInput
            style={[
              styles.input, 
              styles.textArea,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }
            ]}
            placeholder="本段内容将作为系统推送的消息正文展现在用户手机锁屏栏上（100字以内最佳）"
            placeholderTextColor={colors.textMuted}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            maxLength={150}
          />
        </View>

        {/* WeChat Link Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>公众号文章链接 (可选)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="粘贴微信公众号推文链接，用户点击后可直接内嵌WebView阅读"
            placeholderTextColor={colors.textMuted}
            value={wechatLink}
            onChangeText={setWechatLink}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Cover Image Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>封面图片链接 (可选)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="输入图片链接，将作为卡片封面图展现在首页动态列表中"
            placeholderTextColor={colors.textMuted}
            value={coverImage}
            onChangeText={setCoverImage}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Content Body Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>自写通知正文 (无外链时选填)</Text>
          <TextInput
            style={[
              styles.input, 
              styles.largeTextArea,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }
            ]}
            placeholder="如果不想跳转微信链接，可以在此处直接输入详情文字（支持原生富文本渲染展示）"
            placeholderTextColor={colors.textMuted}
            value={contentBody}
            onChangeText={setContentBody}
            multiline
            numberOfLines={10}
          />
        </View>

        {/* Submit Button */}
        <Pressable
          style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>立即发布并群发推送</Text>
          )}
        </Pressable>
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  categoryChipText: {
    fontSize: 13,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  largeTextArea: {
    height: 160,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
