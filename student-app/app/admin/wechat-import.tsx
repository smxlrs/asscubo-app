import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Switch, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type CategoryType = 'event_news' | 'notice' | 'news' | 'column' | 'reprint' | 'general';

const CATEGORIES: { value: CategoryType; label: string; color: string }[] = [
  { value: 'event_news', label: '学联活动', color: '#EF4444' },
  { value: 'notice', label: '学术资讯', color: '#3B82F6' },
  { value: 'news', label: '生活辅助', color: '#10B981' },
  { value: 'column', label: '原创专栏', color: '#F59E0B' },
  { value: 'reprint', label: '转载', color: '#6B7280' },
  { value: 'general', label: '综合公告', color: '#8B5CF6' },
];

export default function WeChatImportScreen() {
  const { colors } = useTheme();

  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [sendPush, setSendPush] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ title: string; coverImage: string | null; pushSentCount: number } | null>(null);

  const handleImport = async () => {
    if (!url.trim()) {
      Alert.alert('校验失败', '请输入微信文章链接');
      return;
    }
    if (!url.trim().startsWith('http://mp.weixin.qq.com/s') && !url.trim().startsWith('https://mp.weixin.qq.com/s')) {
      Alert.alert('链接无效', '请输入正确的微信公众号文章链接 (需以 https://mp.weixin.qq.com/s 开头)');
      return;
    }

    setLoading(true);
    setImportResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('wechat-import', {
        body: { 
          url: url.trim(), 
          category, 
          sendPush 
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.status === 'skipped') {
        Alert.alert('导入跳过', '该文章链接在数据库中已存在，无需重复导入。');
      } else if (data.status === 'success') {
        setImportResult({
          title: data.title,
          coverImage: data.coverImage,
          pushSentCount: data.pushSentCount || 0
        });
        setUrl(''); // Clear input on success
      }
    } catch (err: any) {
      console.error('Failed to import article:', err);
      Alert.alert('导入失败', err.message || '请检查链接或网络状态后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>一键导入微信文章</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* URL Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>微信文章链接 *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="粘贴微信公众号文章链接"
            placeholderTextColor={colors.textMuted}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
        </View>

        {/* Category Selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>归类到分类标签 (选填)</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                style={[
                  styles.categoryChip,
                  { borderColor: colors.border },
                  category === cat.value && { backgroundColor: cat.color + '15', borderColor: cat.color }
                ]}
                onPress={() => !loading && setCategory(prev => prev === cat.value ? null : cat.value)}
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

        {/* Send Push Notification Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>同时群发系统通知</Text>
            <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>开启后将自动向所有已注册用户设备发送手机消息推送</Text>
          </View>
          <Switch
            value={sendPush}
            onValueChange={setSendPush}
            disabled={loading}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Submit Button */}
        <Pressable
          style={[styles.submitButton, { backgroundColor: colors.primary }, loading && { opacity: 0.7 }]}
          onPress={handleImport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>立即抓取并导入</Text>
          )}
        </Pressable>

        {/* Success Card */}
        {importResult && (
          <View style={[styles.successCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.successIconHeader}>
              <MaterialCommunityIcons name="check-circle" size={32} color="#10B981" />
              <Text style={[styles.successTitle, { color: colors.textPrimary }]}>导入成功！</Text>
            </View>
            <View style={styles.successDetails}>
              {importResult.coverImage && (
                <Image source={{ uri: importResult.coverImage }} style={styles.successCover} />
              )}
              <View style={styles.successText}>
                <Text style={[styles.successArticleTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                  {importResult.title}
                </Text>
                {importResult.pushSentCount > 0 && (
                  <Text style={[styles.successPushInfo, { color: colors.primaryLight }]}>
                    已成功推送给 {importResult.pushSentCount} 台设备！
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
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
    padding: 16,
    gap: 20,
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
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleTextContainer: {
    flex: 1,
    paddingRight: 16,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  toggleDesc: {
    fontSize: 12,
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  successCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 12,
    marginTop: 10,
  },
  successIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  successDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  successCover: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  successText: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  successArticleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  successPushInfo: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
