import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image, Modal, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { showCustomAlert } from '../../lib/customAlert';
import { appAlert as Alert } from '../../lib/appAlert';

const LOCALIZED = {
  zh: {
    headerTitle: '个人资料',
    baseInfo: '基本信息',
    nickname: '昵称',
    email: '邮箱',
    notSet: '未设置',
    editProfileBtn: '修改个人资料',
    accountManage: '账号管理',
    logout: '退出登录',
    deleteAccount: '注销并删除账户',
    confirmLogoutTitle: '确认退出',
    confirmLogoutMsg: '您确定要退出登录吗？',
    confirmDeleteTitle: '⚠️ 危险操作',
    confirmDeleteMsg: '您确定要注销并删除您的账户吗？此操作将永久抹除您的个人资料和全部关联数据，且无法撤销！',
    deleteVerifyTitle: '安全验证',
    deleteVerifyMsg: '为了您的账户安全，我们需要向您的邮箱发送一个安全验证码以确认身份。',
    sendOtp: '发送验证码',
    sendOtpError: '发送失败',
    sendOtpErrorMsg: '无法发送验证码，请稍后再试。',
    enterOtpTitle: '请输入完整的 6 位验证码。',
    otpCodeError: '验证码错误，请重新输入',
    deleteSuccess: '注销成功',
    deleteSuccessMsg: '您的账户及数据已被永久删除。',
    deleteFail: '验证失败',
    deleteFailMsg: '无法完成账户删除，请联系管理员或重试。',
    modalTitle: '安全身份验证',
    modalSub: '我们已向您的邮箱 {email} 发送了一个 6 位验证码，请在下方输入以确认注销账户。',
    confirmDeleteBtn: '确认注销',
    cssaCardBtn: '查看我的学联卡',
    cssaCardMsg: '该功能正在开发中，敬请期待！',
  },
  'zh-Hant': {
    headerTitle: '個人資料',
    baseInfo: '基本資訊',
    nickname: '暱稱',
    email: '郵箱',
    notSet: '未設置',
    editProfileBtn: '修改個人資料',
    accountManage: '帳號管理',
    logout: '退出登錄',
    deleteAccount: '注銷並刪除帳戶',
    confirmLogoutTitle: '確認退出',
    confirmLogoutMsg: '您確定要退出登錄嗎？',
    confirmDeleteTitle: '⚠️ 危險操作',
    confirmDeleteMsg: '您確定要注銷並刪除您的帳戶嗎？此操作將永久抹除您的個人資料和全部關聯數據，且無法撤銷！',
    deleteVerifyTitle: '安全驗證',
    deleteVerifyMsg: '為了您的帳戶安全，我們需要向您的郵箱發送一個安全驗證碼以確認身份。',
    sendOtp: '發送驗證碼',
    sendOtpError: '發送失敗',
    sendOtpErrorMsg: '無法發送驗證碼，請稍後再試。',
    enterOtpTitle: '請輸入完整的 6 位驗證碼。',
    otpCodeError: '驗證碼錯誤，請重新輸入',
    deleteSuccess: '注銷成功',
    deleteSuccessMsg: '您的帳戶及數據已被永久刪除。',
    deleteFail: '驗證失敗',
    deleteFailMsg: '無法完成帳戶刪除，請聯繫管理員或重試。',
    modalTitle: '安全身份驗證',
    modalSub: '我們已向您的郵箱 {email} 發送了一個 6 位驗證碼，請在下方輸入以確認注銷帳戶。',
    confirmDeleteBtn: '確認注銷',
    cssaCardBtn: '查看我的學聯卡',
    cssaCardMsg: '該功能正在開發中，敬請期待！',
  },
  en: {
    headerTitle: 'Profile Details',
    baseInfo: 'Basic Info',
    nickname: 'Nickname',
    email: 'Email',
    notSet: 'Not Set',
    editProfileBtn: 'Edit Profile Details',
    accountManage: 'Account Management',
    logout: 'Logout',
    deleteAccount: 'Delete Account',
    confirmLogoutTitle: 'Confirm Logout',
    confirmLogoutMsg: 'Are you sure you want to log out?',
    confirmDeleteTitle: '⚠️ Dangerous Action',
    confirmDeleteMsg: 'Are you sure you want to delete your account? This action will permanently erase your profile and all associated data, and cannot be undone!',
    deleteVerifyTitle: 'Security Verification',
    deleteVerifyMsg: 'For your account security, we need to send a verification code to your email to confirm your identity.',
    sendOtp: 'Send Verification Code',
    sendOtpError: 'Failed to Send',
    sendOtpErrorMsg: 'Unable to send verification code, please try again later.',
    enterOtpTitle: 'Please enter a complete 6-digit verification code.',
    otpCodeError: 'Invalid code, please try again',
    deleteSuccess: 'Account Deleted',
    deleteSuccessMsg: 'Your account and data have been permanently deleted.',
    deleteFail: 'Verification Failed',
    deleteFailMsg: 'Unable to complete account deletion, please contact support or try again.',
    modalTitle: 'Security Reauthentication',
    modalSub: 'We have sent a 6-digit verification code to your email {email}. Please enter it below to confirm account deletion.',
    confirmDeleteBtn: 'Confirm Deletion',
    cssaCardBtn: 'View My CSSA Card',
    cssaCardMsg: 'This feature is under development.',
  },
  it: {
    headerTitle: 'Dettagli Profilo',
    baseInfo: 'Informazioni di Base',
    nickname: 'Nickname',
    email: 'Email',
    notSet: 'Non Impostato',
    editProfileBtn: 'Modifica Profilo',
    accountManage: 'Gestione Account',
    logout: 'Disconnetti',
    deleteAccount: 'Elimina Account',
    confirmLogoutTitle: 'Conferma Uscita',
    confirmLogoutMsg: 'Sei sicuro di voler uscire?',
    confirmDeleteTitle: '⚠️ Azione Pericolosa',
    confirmDeleteMsg: 'Sei sicuro di voler eliminare il tuo account? Questa azione cancellerà permanentemente il tuo profilo e tutti i dati associati, e non può essere annullata!',
    deleteVerifyTitle: 'Verifica di Sicurezza',
    deleteVerifyMsg: 'Per la sicurezza del tuo account, dobbiamo inviare un codice di verifica alla tua email per confermare la tua identità.',
    sendOtp: 'Invia Codice di Verifica',
    sendOtpError: 'Invio Fallito',
    sendOtpErrorMsg: 'Impossibile inviare il codice di verifica, riprova più tardi.',
    enterOtpTitle: 'Inserisci un codice di verifica a 6 cifre completo.',
    otpCodeError: 'Codice non valido, riprova',
    deleteSuccess: 'Account Eliminato',
    deleteSuccessMsg: 'Il tuo account e i tuoi dati sono stati eliminati permanentemente.',
    deleteFail: 'Verifica Fallita',
    deleteFailMsg: 'Impossibile completare l\'eliminazione dell\'account, contatta l\'assistenza o riprova.',
    modalTitle: 'Verifica di Sicurezza',
    modalSub: 'Abbiamo inviato un codice di verifica a 6 cifre alla tua email {email}. Inseriscilo qui sotto per confermare l\'eliminazione dell\'account.',
    confirmDeleteBtn: 'Conferma Eliminazione',
    cssaCardBtn: 'Vedi Tessera ASSCUBO',
    cssaCardMsg: 'Servizio in fase di sviluppo.',
  }
};

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { colors, t, language } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  const [deleting, setDeleting] = React.useState(false);
  const [isOtpModalVisible, setIsOtpModalVisible] = React.useState(false);
  const [otpToken, setOtpToken] = React.useState('');
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshProfile().catch(console.error);
    }, [])
  );

  const handleSignOut = async () => {
    showCustomAlert(localized.confirmLogoutTitle, localized.confirmLogoutMsg, [
      { text: t('cancel') || '取消', style: 'cancel' },
      {
        text: t('confirm') || '确定',
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
    ], { messageAlign: 'left', buttonPresentation: 'text', textButtonAlignment: 'end' });
  };

  const handleDeleteAccount = async () => {
    showCustomAlert(localized.confirmDeleteTitle.replace(/^⚠️\s*/, ''), localized.confirmDeleteMsg, [
      { text: t('cancel') || '取消', style: 'cancel' },
      {
        text: t('confirm') || '确定',
        style: 'destructive',
        onPress: () => {
          showCustomAlert(localized.deleteVerifyTitle, localized.deleteVerifyMsg, [
            { text: t('cancel') || '取消', style: 'cancel' },
            {
              text: localized.sendOtp,
              onPress: async () => {
                setDeleting(true);
                try {
                  const { error } = await supabase.auth.reauthenticate();
                  if (error) throw error;
                  
                  setOtpToken('');
                  setOtpError(null);
                  setIsOtpModalVisible(true);
                } catch (err: any) {
                  console.error('Reauthenticate error:', err);
                  showCustomAlert(
                    localized.sendOtpError,
                    err.message || localized.sendOtpErrorMsg,
                    [{ text: t('confirm') || '确定' }],
                    { messageAlign: 'left', buttonPresentation: 'text' }
                  );
                } finally {
                  setDeleting(false);
                }
              }
            }
          ], { messageAlign: 'left', buttonPresentation: 'text', textButtonAlignment: 'end' });
        }
      }
    ], { icon: 'warning', messageAlign: 'left', buttonPresentation: 'text', textButtonAlignment: 'end' });
  };

  const handleVerifyOtp = async () => {
    if (otpToken.length !== 6) {
      setOtpError(localized.enterOtpTitle);
      return;
    }
    
    setVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user?.email || '',
        token: otpToken,
        type: 'reauthentication'
      });
      
      if (verifyError) {
        throw new Error(verifyError.message || localized.otpCodeError);
      }
      
      const { error: deleteError } = await supabase.rpc('delete_user_account');
      if (deleteError) throw deleteError;
      
      setIsOtpModalVisible(false);
      await signOut();
      showCustomAlert(
        localized.deleteSuccess,
        localized.deleteSuccessMsg,
        [{ text: t('confirm') || '确定', onPress: () => router.replace('/(tabs)') }],
        { messageAlign: 'left', buttonPresentation: 'text' }
      );
    } catch (err: any) {
      console.error('Delete account flow error:', err);
      showCustomAlert(
        localized.deleteFail,
        err.message || localized.deleteFailMsg,
        [{ text: t('confirm') || '确定' }],
        { messageAlign: 'left', buttonPresentation: 'text' }
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleCssaCardTap = () => {
    Alert.alert(t('tip') || '提示', localized.cssaCardMsg);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primaryLight} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.headerTitle}</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.baseInfo}</Text>
        </View>
        
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Nickname */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{localized.nickname}</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{profile?.name || localized.notSet}</Text>
          </View>

          {/* Email */}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{localized.email}</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{user?.email || localized.notSet}</Text>
          </View>
        </View>

        {/* CSSA Card Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
          <Pressable
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={handleCssaCardTap}
          >
            <Text style={styles.editButtonText}>{localized.cssaCardBtn}</Text>
          </Pressable>
        </View>

        {/* Dangerous Area */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.accountManage}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 40 }]}>
          {/* Edit Profile */}
          <Pressable
            style={[styles.rowPressable, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={() => router.push('/settings/edit-profile')}
          >
            <MaterialCommunityIcons name="account-edit-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.editProfileBtn}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          {/* Logout */}
          <Pressable
            style={[styles.rowPressable, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={handleSignOut}
          >
            <MaterialCommunityIcons name="logout" size={20} color={colors.error} style={{ marginRight: 8 }} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.logout}</Text>
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
            <Text style={[styles.rowLabel, { color: colors.error }]}>{localized.deleteAccount}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Safety Reauthentication Verification Modal */}
      <Modal
        visible={isOtpModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!verifying) setIsOtpModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{localized.modalTitle}</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              {localized.modalSub.replace('{email}', user?.email || '')}
            </Text>
            
            <TextInput
              style={[
                styles.otpInput,
                otpError && styles.otpInputWithError,
                { 
                  color: colors.textPrimary,
                  borderColor: otpError ? colors.error : colors.border,
                  backgroundColor: colors.surfaceElevated,
                }
              ]}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otpToken}
              onChangeText={(value) => {
                setOtpToken(value);
                if (otpError) setOtpError(null);
              }}
              autoFocus={true}
              editable={!verifying}
            />
            {otpError ? <Text style={[styles.otpErrorText, { color: colors.error }]}>{otpError}</Text> : null}

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setIsOtpModalVisible(false)}
                disabled={verifying}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>{t('cancel') || '取消'}</Text>
              </Pressable>
              
              <Pressable
                style={styles.modalButton}
                onPress={handleVerifyOtp}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color={colors.error} size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.error }]}>{localized.confirmDeleteBtn}</Text>
                )}
              </Pressable>
            </View>
          </View>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 376,
    borderRadius: 20,
    paddingTop: 20,
    paddingBottom: 13,
    paddingHorizontal: 24,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 27,
    textAlign: 'left',
  },
  modalSub: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'left',
    marginBottom: 18,
  },
  otpInput: {
    width: '100%',
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 18,
    paddingHorizontal: 12,
  },
  otpInputWithError: {
    marginBottom: 4,
  },
  otpErrorText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'flex-end',
    gap: 32,
    marginTop: 12,
  },
  modalButton: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
