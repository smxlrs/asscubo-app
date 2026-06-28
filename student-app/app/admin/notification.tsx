import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert, ActivityIndicator, Modal, FlatList, Image, Switch } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { broadcastPushNotification } from '../../lib/notificationService';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

type CategoryType = 'events' | 'academic' | 'life' | 'general';

const CATEGORIES: { value: CategoryType; label: string; color: string }[] = [
  { value: 'events', label: '学联活动', color: '#EF4444' },
  { value: 'academic', label: '学术资讯', color: '#3B82F6' },
  { value: 'life', label: '生活辅助', color: '#10B981' },
  { value: 'general', label: '综合通知', color: '#8B5CF6' },
];

type ArticleItem = {
  id: string;
  title: string;
  link: string | null;
  cover_image: string | null;
};

// Helper to decode base64 string to ArrayBuffer for Supabase Storage binary uploads
const decodeBase64 = (base64: string): ArrayBuffer => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75,
    len = base64.length,
    i,
    p = 0,
    encoded1,
    encoded2,
    encoded3,
    encoded4;

  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

  for (i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arraybuffer;
};

export default function PublishNotificationScreen() {
  const { colors } = useTheme();
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [summary, setSummary] = useState('');
  const [contentBody, setContentBody] = useState('');
  
  // WeChat article selection states
  const [articlesList, setArticlesList] = useState<ArticleItem[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Local image upload states
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBodyImage, setUploadingBodyImage] = useState(false);

  const [sendPush, setSendPush] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch articles on mount
  useEffect(() => {
    async function loadArticles() {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('id, title, link, cover_image')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!error && data) {
          setArticlesList(data as ArticleItem[]);
        }
      } catch (err) {
        console.error('Failed to load articles list:', err);
      }
    }
    loadArticles();
  }, []);

  const selectedArticle = articlesList.find(a => a.id === selectedArticleId) || null;

  // Filtered articles list based on search query
  const filteredArticles = articlesList.filter(art => 
    !searchQuery.trim() || art.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限受限', '我们需要您的相册访问权限来上传封面图片。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setUploadingImage(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const arrayBuffer = decodeBase64(base64);

        const { data, error } = await supabase.storage
          .from('covers')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('covers')
          .getPublicUrl(filePath);

        setImageUri(publicUrl);
        Alert.alert('上传成功', '封面图片已成功上传！');
      } catch (err: any) {
        console.error('Failed to upload image:', err);
        Alert.alert('上传失败', err.message || '图片上传到服务器失败，请重试。');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleInsertBodyImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('权限受限', '我们需要您的相册访问权限来选择并上传图片。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setUploadingBodyImage(true);
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const fileExt = asset.uri.split('.').pop() || 'jpg';
        const fileName = `body-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const arrayBuffer = decodeBase64(base64);

        const { data, error } = await supabase.storage
          .from('covers')
          .upload(filePath, arrayBuffer, {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('covers')
          .getPublicUrl(filePath);

        const imgTag = `<img src="${publicUrl}" style="max-width: 100%; border-radius: 8px; margin: 10px 0; display: block;" />\n`;
        setContentBody(prev => prev + imgTag);
        Alert.alert('插入成功', '图片已成功上传并插入正文！');
      } catch (err: any) {
        console.error('Failed to upload body image:', err);
        Alert.alert('上传失败', err.message || '图片上传到服务器失败，请重试。');
      } finally {
        setUploadingBodyImage(false);
      }
    }
  };

  const handleCategoryPress = (val: CategoryType) => {
    if (category === val) {
      setCategory(null); // Deselect
    } else {
      setCategory(val);
    }
  };

  const getFinalCoverImage = () => {
    if (imageUri) return imageUri;
    if (selectedArticle) return selectedArticle.cover_image;
    return null;
  };

  const getFinalWechatLink = () => {
    return selectedArticle ? selectedArticle.link : null;
  };

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
      const finalCover = getFinalCoverImage();
      const finalLink = getFinalWechatLink();

      // 1. Insert into notifications table (default category to 'general' if null to satisfy DB not-null constraint)
      const notificationPayload = {
        title: title.trim(),
        content: summary.trim(),
        category: category || 'general',
        link: finalLink,
        cover_image: finalCover,
        created_at: new Date().toISOString(),
      };

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationPayload]);

      if (notificationError) {
        throw notificationError;
      }

      // 2. Broadcast Expo Push Notification to all users if checked
      if (sendPush) {
        const categoryLabel = category ? CATEGORIES.find(c => c.value === category)?.label : '系统通知';
        const pushTitle = `【${categoryLabel}】${title}`;
        const pushResult = await broadcastPushNotification(
          pushTitle,
          summary.trim(),
          category || 'general', // Fallback to general for preference delivery
          finalLink || undefined,
          undefined // No native article ID for pure notifications
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
      } else {
        Alert.alert(
          '发布成功', 
          '通知已成功保存到数据库（未群发手机推送）。',
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

  const finalCover = getFinalCoverImage();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>发布通知</Text>
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
          <Text style={[styles.label, { color: colors.textPrimary }]}>通知分类 (可选，点击可取消选择)</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                style={[
                  styles.categoryChip,
                  { borderColor: colors.border },
                  category === cat.value && { backgroundColor: cat.color + '15', borderColor: cat.color }
                ]}
                onPress={() => handleCategoryPress(cat.value)}
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
            placeholder="作为推送消息与简述展现（100字内）"
            placeholderTextColor={colors.textMuted}
            value={summary}
            onChangeText={setSummary}
            multiline
            numberOfLines={3}
            maxLength={150}
          />
        </View>

        {/* Article Selector Instead of WeChat URL Text Input */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>关联公众号文章 (可选)</Text>
          <View style={styles.selectorWrapper}>
            <Pressable
              style={[styles.input, styles.articleSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowArticleModal(true)}
            >
              <Text style={[styles.selectorText, { color: selectedArticle ? colors.textPrimary : colors.textMuted }]} numberOfLines={1}>
                {selectedArticle ? selectedArticle.title : '点击选择已搬运的文章'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
            {selectedArticleId && (
              <Pressable style={styles.clearSelectorButton} onPress={() => setSelectedArticleId(null)}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#EF4444" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Cover Image local upload */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>封面图片</Text>
          <View style={styles.imagePickerContainer}>
            {finalCover ? (
              <Image source={{ uri: finalCover }} style={styles.coverPreview} />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="image-outline" size={28} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>暂无封面图</Text>
              </View>
            )}
            
            <View style={styles.imagePickerButtons}>
              <Pressable
                style={[styles.pickerButton, { backgroundColor: colors.primary }]}
                onPress={handleSelectImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="upload" size={16} color="#FFFFFF" />
                    <Text style={styles.pickerButtonText}>从相册上传</Text>
                  </>
                )}
              </Pressable>
              {imageUri && (
                <Pressable
                  style={[styles.pickerButton, styles.pickerDeleteButton, { borderColor: colors.border }]}
                  onPress={() => setImageUri(null)}
                >
                  <Text style={[styles.pickerButtonText, { color: '#EF4444' }]}>清除图片</Text>
                </Pressable>
              )}
            </View>
          </View>
          
          {!imageUri && selectedArticle?.cover_image && (
            <Text style={[styles.imageNoticeText, { color: colors.primaryLight }]}>
              💡 系统未上传本地图片，将自动采用关联文章的封面图。
            </Text>
          )}
        </View>

        {/* Content Body Input */}
        <View style={styles.formGroup}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>自写通知正文 (选填)</Text>
            <Pressable
              style={({ pressed }) => [
                styles.insertImageButton,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={handleInsertBodyImage}
              disabled={uploadingBodyImage}
            >
              {uploadingBodyImage ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="image-plus" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[styles.insertImageButtonText, { color: colors.primary }]}>插入图片</Text>
                </>
              )}
            </Pressable>
          </View>
          <TextInput
            style={[
              styles.input, 
              styles.largeTextArea,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }
            ]}
            placeholder="直接输入详情正文（选填，支持插入图片）"
            placeholderTextColor={colors.textMuted}
            value={contentBody}
            onChangeText={setContentBody}
            multiline
            numberOfLines={10}
          />
        </View>

        {/* Send Push Notification Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>同时群发系统推送</Text>
            <Text style={[styles.toggleDesc, { color: colors.textSecondary }]}>开启后将自动向所有已注册用户设备发送手机消息推送</Text>
          </View>
          <Switch
            value={sendPush}
            onValueChange={setSendPush}
            disabled={submitting}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
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
            <Text style={styles.submitButtonText}>
              {sendPush ? '立即发布并群发推送' : '立即发布'}
            </Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Article Selector Modal */}
      <Modal visible={showArticleModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={[styles.modalContent, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>选择关联的微信文章</Text>
              <Pressable onPress={() => { setShowArticleModal(false); setSearchQuery(''); }}>
                <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.modalSearchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.modalSearchInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="搜索已搬运的文章标题..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            {articlesList.length === 0 ? (
              <View style={styles.modalCenter}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>正在加载文章列表...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredArticles}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalListContent}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.modalItemRow, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSelectedArticleId(item.id);
                      setShowArticleModal(false);
                      setSearchQuery('');
                    }}
                  >
                    <Text style={[styles.modalItemText, { color: colors.textPrimary }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {selectedArticleId === item.id && (
                      <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View style={styles.modalCenter}>
                    <Text style={{ color: colors.textMuted }}>未找到匹配的文章</Text>
                  </View>
                }
              />
            )}
          </SafeAreaView>
        </View>
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
  selectorWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  articleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 40, // Avoid text overlap with arrow
  },
  selectorText: {
    fontSize: 14,
    flex: 1,
  },
  clearSelectorButton: {
    position: 'absolute',
    right: 32,
    padding: 6,
  },
  imagePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
  },
  coverPreview: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerButtons: {
    flex: 1,
    gap: 8,
  },
  pickerButton: {
    height: 36,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  pickerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  pickerDeleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  imageNoticeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 24,
    zIndex: 1,
  },
  modalSearchInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingLeft: 38,
    paddingRight: 12,
    flex: 1,
    fontSize: 14,
  },
  modalListContent: {
    paddingHorizontal: 16,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalItemText: {
    fontSize: 14,
    flex: 1,
    paddingRight: 16,
    lineHeight: 20,
  },
  modalCenter: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insertImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  insertImageButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
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
});
