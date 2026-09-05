import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View, TextInput, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { appAlert as Alert } from '../../lib/appAlert';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Helper to decode base64 string to ArrayBuffer for Supabase Storage uploads
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

export default function FeedbackScreen() {
  const { colors, t, language } = useTheme();
  const { user, loading: authLoading, hasUnreadFeedbackReply } = useAuth();

  const [email, setEmail] = useState(user?.email || '');
  const [wechat, setWechat] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Media picker states
  const [mediaAssets, setMediaAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const getLoginRequiredMessage = () => {
    if (language === 'it') return 'Effettua l\'accesso per inviare un feedback.';
    if (language === 'en') return 'Please log in before submitting feedback.';
    if (language === 'zh-Hant') return '請在登入後進行反饋。';
    return '请在登录后进行反馈';
  };

  useEffect(() => {
    if (!authLoading && !user) {
      Alert.alert(t('feedback'), getLoginRequiredMessage(), [
        { text: t('cancel') || '取消', style: 'cancel' },
        { text: t('goToLogin') || '前往登录', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  }, [authLoading, user, language]);

  const getWechatLabel = () => {
    if (language === 'it') return 'WeChat (Opzionale)';
    if (language === 'en') return 'WeChat (Optional)';
    if (language === 'zh-Hant') return '微信 (選填)';
    return '微信 (选填)';
  };

  const getWechatPlaceholder = () => {
    if (language === 'it') return 'Inserisci WeChat ID';
    if (language === 'en') return 'Enter WeChat ID';
    if (language === 'zh-Hant') return '請輸入微訊號';
    return '请输入微信号';
  };

  const getEmailPlaceholder = () => {
    if (language === 'it') return 'Inserisci l\'indirizzo e-mail';
    if (language === 'en') return 'Enter email address';
    if (language === 'zh-Hant') return '請輸入郵箱地址';
    return '请输入邮箱地址';
  };

  const getFeedbackPlaceholder = () => {
    if (language === 'it') return 'Inserisci il tuo feedback...';
    if (language === 'en') return 'Enter your feedback...';
    if (language === 'zh-Hant') return '請填寫您的寶貴意見...';
    return '请填写您的宝贵意见...';
  };

  const getUploadLabel = () => {
    if (language === 'it') return 'Carica immagine o video';
    if (language === 'en') return 'Upload image or video';
    if (language === 'zh-Hant') return '上傳圖片或視頻';
    return '上传图片或视频';
  };

  const getUploadWarning = () => {
    if (language === 'it') return 'Abbiamo bisogno dell\'autorizzazione per accedere alla galleria.';
    if (language === 'en') return 'We need media library permissions to upload images or videos.';
    if (language === 'zh-Hant') return '我們需要相冊訪問權限來上傳圖片或視頻。';
    return '我们需要相册访问权限来上传图片或视频。';
  };

  const getInvalidEmailWarning = () => {
    if (language === 'it') return 'Inserisci un indirizzo e-mail valido';
    if (language === 'en') return 'Please enter a valid email address';
    if (language === 'zh-Hant') return '請輸入有效的郵箱地址';
    return '请输入有效的邮箱地址';
  };

  const getFillFieldsWarning = () => {
    if (language === 'it') return 'Si prega di inserire l\'e-mail e il contenuto del feedback';
    if (language === 'en') return 'Please fill in your email and feedback content';
    if (language === 'zh-Hant') return '請填寫郵箱和反饋內容';
    return '请填写邮箱和反馈内容';
  };

  const handleSelectMedia = async () => {
    if (!user) {
      Alert.alert(t('feedback'), getLoginRequiredMessage(), [
        { text: t('cancel') || '取消', style: 'cancel' },
        { text: t('goToLogin') || '前往登录', onPress: () => router.replace('/(auth)/login') },
      ]);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('feedback'), getUploadWarning());
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setMediaAssets((currentAssets) => {
        const knownUris = new Set(currentAssets.map((asset) => asset.uri));
        return [...currentAssets, ...result.assets.filter((asset) => !knownUris.has(asset.uri))];
      });
    }
  };

  const handleRemoveMedia = (uri: string) => {
    setMediaAssets((currentAssets) => currentAssets.filter((asset) => asset.uri !== uri));
  };

  const handleFeedbackSubmit = async () => {
    if (!user) {
      Alert.alert(t('feedback'), getLoginRequiredMessage(), [
        { text: t('cancel') || '取消', style: 'cancel' },
        { text: t('goToLogin') || '前往登录', onPress: () => router.replace('/(auth)/login') },
      ]);
      return;
    }

    if (!email.trim() || !feedbackText.trim()) {
      Alert.alert(t('feedback'), getFillFieldsWarning());
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t('feedback'), getInvalidEmailWarning());
      return;
    }

    if (mediaAssets.length > 4 || mediaAssets.some((asset) => (asset.fileSize || 0) > 20 * 1024 * 1024)) {
      Alert.alert(t('feedback'), language === 'en' ? 'Please select up to 4 files, each no larger than 20 MB.' : '最多选择 4 个文件，且每个文件不得超过 20 MB。');
      return;
    }

    setSubmitting(true);
    try {
      const uploadedMedia: Array<{ url: string; type: 'image' | 'video' }> = [];

      // Upload each attachment in sequence so several videos do not compete for memory.
      for (const mediaAsset of mediaAssets) {
        const base64 = await FileSystem.readAsStringAsync(mediaAsset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const mediaType = mediaAsset.type === 'video' ? 'video' : 'image';
        const fileExt = mediaAsset.fileName?.split('.').pop()?.toLowerCase()
          || mediaAsset.uri.split('?')[0].split('.').pop()?.toLowerCase()
          || (mediaType === 'video' ? 'mp4' : 'jpg');
        const fileName = `feedback-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const arrayBuffer = decodeBase64(base64);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('covers')
          .upload(filePath, arrayBuffer, {
            contentType: mediaAsset.mimeType || (mediaType === 'video' ? 'video/mp4' : `image/${fileExt === 'png' ? 'png' : 'jpeg'}`),
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('covers')
          .getPublicUrl(filePath);

        uploadedMedia.push({ url: publicUrl, type: mediaType });
      }

      // 2. Insert feedback data to feedbacks table
      const { error: dbError } = await supabase
        .from('feedbacks')
        .insert([{
          user_id: user?.id || null,
          email: email.trim(),
          wechat: wechat.trim() || null,
          content: feedbackText.trim(),
          // This remains compatible with the existing text column and legacy single attachments.
          media_url: uploadedMedia.length > 0 ? JSON.stringify(uploadedMedia) : null,
          created_at: new Date().toISOString()
        }]);

      if (dbError) throw dbError;

      Alert.alert(t('feedback'), t('feedbackSuccess') || '提交成功！非常感谢您的意见反馈。');
      setEmail('');
      setWechat('');
      setFeedbackText('');
      setMediaAssets([]);
      router.back();
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      const failMsg = language === 'it' ? 'Invio fallito, riprova.' : language === 'en' ? 'Submission failed, please try again.' : language === 'zh-Hant' ? '提交失敗，請重試。' : '提交失败，请重试。';
      Alert.alert(t('feedback'), err.message || failMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={{
            width: 10,
            height: 10,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: colors.primaryLight,
            transform: [{ rotate: '45deg' }],
            marginHorizontal: 8,
            marginVertical: 4,
          }} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('feedback')}</Text>
        <Pressable style={styles.mailboxButton} onPress={() => router.push('/about/my-feedbacks')}>
          <View style={{ position: 'relative' }}>
            <MaterialCommunityIcons name="mailbox-outline" size={22} color={colors.primaryLight} />
            {hasUnreadFeedbackReply && (
              <View style={[styles.headerRedDot, { borderColor: colors.surface }]} />
            )}
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.formHeaderTitle, { color: colors.textPrimary }]}>{t('feedback')}</Text>
        
        {/* Email input (Required, on top) */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {t('emailLabel')} <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder={getEmailPlaceholder()}
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* WeChat input (Optional, below Email) */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {getWechatLabel()}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder={getWechatPlaceholder()}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            value={wechat}
            onChangeText={setWechat}
          />
        </View>

        {/* Feedback Content (Required, below WeChat) */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            {t('feedbackContent')} <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder={getFeedbackPlaceholder()}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            value={feedbackText}
            onChangeText={setFeedbackText}
          />
        </View>

        {/* Selected attachments */}
        {mediaAssets.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaPreviewList}>
            {mediaAssets.map((asset) => {
              const isVideo = asset.type === 'video';
              return (
                <View key={asset.assetId || asset.uri} style={[styles.mediaPreviewItem, { borderColor: colors.border }]}>
                  {isVideo ? (
                    <View style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                      <MaterialCommunityIcons name="video-outline" size={28} color={colors.primary} />
                    </View>
                  ) : (
                    <Image source={{ uri: asset.uri }} style={styles.mediaPreview} />
                  )}
                  <Pressable
                    style={[styles.removeMediaBtn, { backgroundColor: colors.error }]}
                    onPress={() => handleRemoveMedia(asset.uri)}
                    accessibilityLabel="Remove attachment"
                  >
                    <MaterialCommunityIcons name="close" size={16} color="#FFF" />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Media upload button */}
        <Pressable 
          style={[styles.uploadButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} 
          onPress={handleSelectMedia}
        >
          <MaterialCommunityIcons name="image-plus" size={24} color={colors.textSecondary} style={styles.uploadButtonIcon} />
          <Text style={[styles.uploadButtonText, { color: colors.textSecondary }]}>
            {getUploadLabel()}
          </Text>
        </Pressable>

        <Pressable 
          style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]} 
          onPress={handleFeedbackSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>{t('submit')}</Text>
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
  backText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  mailboxButton: {
    paddingVertical: 8,
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRedDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
  },
  formContent: {
    padding: 24,
  },
  formHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  textArea: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    paddingTop: 16,
  },
  mediaPreviewList: {
    gap: 12,
    paddingBottom: 18,
  },
  mediaPreviewItem: {
    position: 'relative',
    width: 112,
    height: 112,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  uploadButtonIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
