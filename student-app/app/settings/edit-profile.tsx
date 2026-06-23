import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, Image, Modal } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

const LOCALIZED = {
  zh: {
    headerTitle: '修改个人资料',
    permTitle: '需要权限',
    permMsg: '更换头像需要读取相册的权限，请在设置中开启。',
    changeSuccess: '更换成功',
    avatarUpdated: '头像已更新！',
    changeFail: '更换失败',
    saveAvatarFail: '无法保存头像，请重试',
    picSelectFail: '选择图片失败，请重试',
    emptyNickname: '昵称不能为空',
    updateSuccess: '修改成功',
    nicknameUpdated: '您的昵称已成功更新！',
    updateFail: '更新失败',
    nicknameUpdateError: '更新昵称时出错',
    emptyEmail: '邮箱不能为空',
    invalidEmail: '请输入有效的邮箱地址',
    sameEmail: '新邮箱不能与当前邮箱相同',
    emailChangeSubmitted: '修改已提交',
    emailChangeConfirm: '我们已向您的新旧邮箱发送了确认邮件，请通过邮件链接验证以完成邮箱修改。',
    emailUpdateError: '更新邮箱时出错',
    otpSent: '验证码已发送',
    otpSentMsg: '安全验证码已发送至您的邮箱，请注意查收。',
    otpSendFail: '发送失败',
    otpSendFailMsg: '无法发送验证码，请稍后再试。',
    emptyPass: '新密码和确认密码不能为空',
    passMinLength: '新密码长度不能少于 6 位',
    passMismatch: '两次输入的新密码不一致',
    enterOtp: '请输入 6 位验证码',
    otpCodeError: '验证码错误，请重新输入',
    saveSuccess: '保存成功',
    passUpdated: '您的账户密码已成功更新！',
    passUpdateError: '修改密码时出错，请检查验证码或重试。',
    changeAvatar: '点击更换头像',
    basicInfo: '基本资料',
    nickname: '昵称',
    email: '邮箱',
    notSet: '未设置',
    securitySettings: '安全设置 (修改密码)',
    loginPassword: '登录密码',
    done: '完成',
    editNickname: '修改昵称',
    enterNewNickname: '请输入新昵称',
    editEmail: '修改邮箱',
    emailVerificationHint: '我们将向新旧邮箱发送验证信，点击其中的链接方可完成修改。',
    enterNewEmail: '请输入新邮箱',
    editPassword: '修改密码',
    newPasswordPlaceholder: '新密码 (不少于6位)',
    confirmPasswordPlaceholder: '再次输入新密码',
    otpPlaceholder: '请输入6位验证码',
    resend: '重新发送',
    getOtp: '获取验证码',
    tip: '提示',
    securityTip: '安全提示',
  },
  'zh-Hant': {
    headerTitle: '修改個人資料',
    permTitle: '需要權限',
    permMsg: '更換頭像需要讀取相冊的權限，請在設置中開啟。',
    changeSuccess: '更換成功',
    avatarUpdated: '頭像已更新！',
    changeFail: '更換失敗',
    saveAvatarFail: '無法保存頭像，請重試',
    picSelectFail: '選擇圖片失敗，請重試',
    emptyNickname: '暱稱不能為空',
    updateSuccess: '修改成功',
    nicknameUpdated: '您的暱稱已成功更新！',
    updateFail: '更新失敗',
    nicknameUpdateError: '更新暱稱時出錯',
    emptyEmail: '郵箱不能為空',
    invalidEmail: '請輸入有效的郵箱地址',
    sameEmail: '新郵箱不能與當前郵箱相同',
    emailChangeSubmitted: '修改已提交',
    emailChangeConfirm: '我們已向您的新舊郵箱發送了確認郵件，請通過郵件鏈接驗證以完成郵箱修改。',
    emailUpdateError: '更新郵箱時出錯',
    otpSent: '驗證碼已發送',
    otpSentMsg: '安全驗證碼已發送至您的郵箱，請注意查收。',
    otpSendFail: '發送失敗',
    otpSendFailMsg: '無法發送驗證碼，請稍後再試。',
    emptyPass: '新密碼和確認密碼不能為空',
    passMinLength: '新密碼長度不能少於 6 位',
    passMismatch: '兩次輸入的新密碼不一致',
    enterOtp: '請輸入 6 位驗證碼',
    otpCodeError: '驗證碼錯誤，請重新輸入',
    saveSuccess: '保存成功',
    passUpdated: '您的帳戶密碼已成功更新！',
    passUpdateError: '修改密碼時出錯，請檢查驗證碼或重試。',
    changeAvatar: '點擊更換頭像',
    basicInfo: '基本資料',
    nickname: '暱稱',
    email: '郵箱',
    notSet: '未設置',
    securitySettings: '安全設置 (修改密碼)',
    loginPassword: '登錄密碼',
    done: '完成',
    editNickname: '修改暱稱',
    enterNewNickname: '請輸入新暱稱',
    editEmail: '修改郵箱',
    emailVerificationHint: '我們將向新舊郵箱發送驗證信，點擊其中的鏈接方可完成修改。',
    enterNewEmail: '請輸入新郵箱',
    editPassword: '修改密碼',
    newPasswordPlaceholder: '新密碼 (不少於6位)',
    confirmPasswordPlaceholder: '再次輸入新密碼',
    otpPlaceholder: '請輸入6位驗證碼',
    resend: '重新發送',
    getOtp: '獲取驗證碼',
    tip: '提示',
    securityTip: '安全提示',
  },
  en: {
    headerTitle: 'Edit Profile Details',
    permTitle: 'Permission Required',
    permMsg: 'We need permission to access your photo library to change your avatar.',
    changeSuccess: 'Success',
    avatarUpdated: 'Avatar updated successfully!',
    changeFail: 'Failed',
    saveAvatarFail: 'Unable to save avatar, please try again.',
    picSelectFail: 'Failed to select image, please try again.',
    emptyNickname: 'Nickname cannot be empty',
    updateSuccess: 'Success',
    nicknameUpdated: 'Your nickname has been updated successfully!',
    updateFail: 'Failed',
    nicknameUpdateError: 'Error updating nickname',
    emptyEmail: 'Email cannot be empty',
    invalidEmail: 'Please enter a valid email address',
    sameEmail: 'New email cannot be the same as your current one',
    emailChangeSubmitted: 'Change Submitted',
    emailChangeConfirm: 'We have sent a confirmation email to both your old and new email addresses. Please verify through the links to complete the change.',
    emailUpdateError: 'Error updating email',
    otpSent: 'Verification Code Sent',
    otpSentMsg: 'A verification code has been sent to your email. Please check your inbox.',
    otpSendFail: 'Failed to Send',
    otpSendFailMsg: 'Unable to send verification code, please try again later.',
    emptyPass: 'New password and confirmation password cannot be empty',
    passMinLength: 'New password must be at least 6 characters',
    passMismatch: 'Passwords do not match',
    enterOtp: 'Please enter a 6-digit verification code',
    otpCodeError: 'Invalid code, please try again',
    saveSuccess: 'Success',
    passUpdated: 'Your password has been updated successfully!',
    passUpdateError: 'Error updating password, please check the code and try again.',
    changeAvatar: 'Click to change avatar',
    basicInfo: 'Basic Info',
    nickname: 'Nickname',
    email: 'Email',
    notSet: 'Not Set',
    securitySettings: 'Security (Change Password)',
    loginPassword: 'Password',
    done: 'Done',
    editNickname: 'Edit Nickname',
    enterNewNickname: 'Enter new nickname',
    editEmail: 'Edit Email',
    emailVerificationHint: 'We will send a verification email to both old and new addresses. Click the links to apply changes.',
    enterNewEmail: 'Enter new email',
    editPassword: 'Change Password',
    newPasswordPlaceholder: 'New Password (at least 6 chars)',
    confirmPasswordPlaceholder: 'Re-enter new password',
    otpPlaceholder: 'Enter 6-digit code',
    resend: 'Resend',
    getOtp: 'Get Code',
    tip: 'Notice',
    securityTip: 'Security Notice',
  },
  it: {
    headerTitle: 'Modifica Profilo',
    permTitle: 'Permesso Richiesto',
    permMsg: 'Abbiamo bisogno dell\'autorizzazione per accedere alla tua galleria foto per cambiare avatar.',
    changeSuccess: 'Successo',
    avatarUpdated: 'Avatar aggiornato con successo!',
    changeFail: 'Errore',
    saveAvatarFail: 'Impossibile salvare l\'avatar, riprova.',
    picSelectFail: 'Selezione dell\'immagine fallita, riprova.',
    emptyNickname: 'Il nickname non può essere vuoto',
    updateSuccess: 'Successo',
    nicknameUpdated: 'Il tuo nickname è stato aggiornato con successo!',
    updateFail: 'Errore',
    nicknameUpdateError: 'Errore durante l\'aggiornamento del nickname',
    emptyEmail: 'L\'email non può essere vuota',
    invalidEmail: 'Inserisci un indirizzo email valido',
    sameEmail: 'La nuova email non può essere uguale a quella attuale',
    emailChangeSubmitted: 'Richiesta Inviata',
    emailChangeConfirm: 'Abbiamo inviato un\'email di conferma ai tuoi vecchi e nuovi indirizzi email. Clicca sui link per applicare le modifiche.',
    emailUpdateError: 'Errore durante l\'aggiornamento dell\'email',
    otpSent: 'Codice Inviato',
    otpSentMsg: 'Un codice di verifica è stato inviato alla tua email. Controlla la posta.',
    otpSendFail: 'Invio Fallito',
    otpSendFailMsg: 'Impossibile inviare il codice, riprova più tardi.',
    emptyPass: 'La password e la conferma non possono essere vuote',
    passMinLength: 'La password deve contenere almeno 6 caratteri',
    passMismatch: 'Le password non corrispondono',
    enterOtp: 'Inserisci il codice a 6 cifre',
    otpCodeError: 'Codice non valido, riprova',
    saveSuccess: 'Successo',
    passUpdated: 'La tua password è stata aggiornata con successo!',
    passUpdateError: 'Errore durante l\'aggiornamento della password, controlla il codice e riprova.',
    changeAvatar: 'Clicca per cambiare avatar',
    basicInfo: 'Informazioni di Base',
    nickname: 'Nickname',
    email: 'Email',
    notSet: 'Non Impostato',
    securitySettings: 'Sicurezza (Modifica Password)',
    loginPassword: 'Password',
    done: 'Salva',
    editNickname: 'Modifica Nickname',
    enterNewNickname: 'Inserisci il nuovo nickname',
    editEmail: 'Modifica Email',
    emailVerificationHint: 'Invieremo un\'email di conferma a entrambi gli indirizzi. Clicca sui link per completare.',
    enterNewEmail: 'Inserisci la nuova email',
    editPassword: 'Modifica Password',
    newPasswordPlaceholder: 'Nuova password (almeno 6 caratteri)',
    confirmPasswordPlaceholder: 'Reinserisci la nuova password',
    otpPlaceholder: 'Inserisci codice a 6 cifre',
    resend: 'Reinvia',
    getOtp: 'Ottieni Codice',
    tip: 'Avviso',
    securityTip: 'Avviso di Sicurezza',
  }
};

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors, language, t } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  // Modal control states
  const [activeModal, setActiveModal] = useState<'nickname' | 'email' | 'password' | null>(null);
  const [modalNickname, setModalNickname] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalConfirmPassword, setModalConfirmPassword] = useState('');
  const [modalOtp, setModalOtp] = useState('');
  
  // OTP states
  const [sendingOtp, setSendingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = React.useRef<any>(null);

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(localized.permTitle, localized.permMsg);
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSaving(true);
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              avatar_url: base64Data,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user?.id);
          if (error) throw error;
          
          setAvatarUrl(base64Data);
          Alert.alert(localized.changeSuccess, localized.avatarUpdated);
          await refreshProfile();
        } catch (err: any) {
          console.error(err);
          Alert.alert(localized.changeFail, localized.saveAvatarFail);
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert(localized.tip, localized.picSelectFail);
    }
  };

  const handleUpdateNickname = async () => {
    if (!modalNickname.trim()) {
      Alert.alert(localized.tip, localized.emptyNickname);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: modalNickname.trim(), updated_at: new Date().toISOString() })
        .eq('id', user?.id);
      if (error) throw error;
      
      Alert.alert(localized.updateSuccess, localized.nicknameUpdated);
      setActiveModal(null);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      Alert.alert(localized.updateFail, err.message || localized.nicknameUpdateError);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    const cleanedEmail = modalEmail.trim();
    if (!cleanedEmail) {
      Alert.alert(localized.tip, localized.emptyEmail);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      Alert.alert(localized.tip, localized.invalidEmail);
      return;
    }
    if (cleanedEmail.toLowerCase() === user?.email?.toLowerCase()) {
      Alert.alert(localized.tip, localized.sameEmail);
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: cleanedEmail },
        { emailRedirectTo: 'https://asscubo.it/verified.html' }
      );
      if (error) throw error;
      
      Alert.alert(
        localized.emailChangeSubmitted, 
        localized.emailChangeConfirm,
        [{ text: t('confirm') || '确定', onPress: () => {
          setActiveModal(null);
          refreshProfile().catch(console.error);
        }}]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert(localized.updateFail, err.message || localized.emailUpdateError);
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.reauthenticate();
      if (error) throw error;
      
      Alert.alert(localized.otpSent, localized.otpSentMsg);
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error(err);
      Alert.alert(localized.otpSendFail, err.message || localized.otpSendFailMsg);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!modalPassword.trim() || !modalConfirmPassword.trim()) {
      Alert.alert(localized.tip, localized.emptyPass);
      return;
    }
    if (modalPassword.length < 6) {
      Alert.alert(localized.securityTip, localized.passMinLength);
      return;
    }
    if (modalPassword !== modalConfirmPassword) {
      Alert.alert(localized.tip, localized.passMismatch);
      return;
    }
    if (!modalOtp.trim() || modalOtp.length !== 6) {
      Alert.alert(localized.tip, localized.enterOtp);
      return;
    }
    
    setSaving(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user?.email || '',
        token: modalOtp.trim(),
        type: 'reauthentication'
      });
      
      if (verifyError) {
        throw new Error(verifyError.message || localized.otpCodeError);
      }
      
      const { error: updateError } = await supabase.auth.updateUser({
        password: modalPassword.trim()
      });
      if (updateError) throw updateError;
      
      Alert.alert(localized.saveSuccess, localized.passUpdated, [
        {
          text: t('confirm') || '确定',
          onPress: () => {
            setActiveModal(null);
            refreshProfile().catch(console.error);
          }
        }
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert(localized.updateFail, err.message || localized.passUpdateError);
    } finally {
      setSaving(false);
    }
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

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar Area */}
        <View style={styles.avatarSection}>
          <Pressable onPress={pickImage} style={styles.avatarWrapper} disabled={saving}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={60} color={colors.textSecondary} />
              )}
            </View>
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              {saving ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
              )}
            </View>
          </Pressable>
          <Text style={[styles.avatarTip, { color: colors.textMuted }]}>{localized.changeAvatar}</Text>
        </View>

        {/* Basic Fields */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.basicInfo}</Text>
        </View>
        
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Nickname Display */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{localized.nickname}</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{profile?.name || localized.notSet}</Text>
            <Pressable 
              style={styles.editButton} 
              onPress={() => {
                setModalNickname(profile?.name || '');
                setActiveModal('nickname');
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primaryLight} />
            </Pressable>
          </View>

          {/* Email Display */}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{localized.email}</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{user?.email || localized.notSet}</Text>
            <Pressable 
              style={styles.editButton} 
              onPress={() => {
                setModalEmail(user?.email || '');
                setActiveModal('email');
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primaryLight} />
            </Pressable>
          </View>
        </View>

        {/* Security Fields */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.securitySettings}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Change Password Row */}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{localized.loginPassword}</Text>
            <Text style={[styles.valueText, { color: colors.textMuted }]}>••••••••</Text>
            <Pressable 
              style={styles.editButton} 
              onPress={() => {
                setModalPassword('');
                setModalConfirmPassword('');
                setModalOtp('');
                setCountdown(0);
                setActiveModal('password');
              }}
            >
              <MaterialCommunityIcons name="lock-reset" size={22} color={colors.primaryLight} />
            </Pressable>
          </View>
        </View>

        {/* Done/Back Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 32, marginBottom: 40 }}>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.saveButtonText}>{localized.done}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Dynamic Pop-up Modal */}
      <Modal
        visible={activeModal !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setActiveModal(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {activeModal === 'nickname' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{localized.editNickname}</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalNickname}
                  onChangeText={setModalNickname}
                  placeholder={localized.enterNewNickname}
                  placeholderTextColor={colors.textMuted}
                  autoFocus={true}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => setActiveModal(null)}
                    disabled={saving}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('cancel') || '取消'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleUpdateNickname}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('confirm') || '确认'}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {activeModal === 'email' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{localized.editEmail}</Text>
                <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                  {localized.emailVerificationHint}
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalEmail}
                  onChangeText={setModalEmail}
                  placeholder={localized.enterNewEmail}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus={true}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => setActiveModal(null)}
                    disabled={saving}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('cancel') || '取消'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleUpdateEmail}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('confirm') || '确认'}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {activeModal === 'password' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{localized.editPassword}</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalPassword}
                  onChangeText={setModalPassword}
                  placeholder={localized.newPasswordPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoFocus={true}
                />
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalConfirmPassword}
                  onChangeText={setModalConfirmPassword}
                  placeholder={localized.confirmPasswordPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                />
                <View style={styles.otpInputRow}>
                  <TextInput
                    style={[
                      styles.modalInput,
                      styles.otpCodeInput,
                      { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }
                    ]}
                    value={modalOtp}
                    onChangeText={setModalOtp}
                    placeholder={localized.otpPlaceholder}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Pressable
                    style={[
                      styles.sendOtpButton,
                      { backgroundColor: !user?.email || countdown > 0 || sendingOtp ? colors.surfaceElevated : colors.primary },
                      (!user?.email || countdown > 0 || sendingOtp) && { borderColor: colors.border }
                    ]}
                    onPress={handleSendOtp}
                    disabled={!user?.email || countdown > 0 || sendingOtp}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color={countdown > 0 ? colors.textMuted : "#FFF"} size="small" />
                    ) : (
                      <Text style={{ 
                        color: !user?.email || countdown > 0 || sendingOtp ? colors.textMuted : "#FFF", 
                        fontSize: 12, 
                        fontWeight: 'bold' 
                      }}>
                        {countdown > 0 ? `${countdown}s` : (modalOtp ? localized.resend : localized.getOtp)}
                      </Text>
                    )}
                  </Pressable>
                </View>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => setActiveModal(null)}
                    disabled={saving}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('cancel') || '取消'}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleUpdatePassword}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>{localized.done}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
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
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarTip: {
    fontSize: 12,
    marginTop: 8,
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
  label: {
    width: 70,
    fontSize: 15,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  saveButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 12,
    marginTop: 2,
  },
  valueText: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    width: '100%',
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: 12,
    borderWidth: 1,
  },
  otpInputRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  otpCodeInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 10,
  },
  sendOtpButton: {
    width: 100,
    height: 46,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  editButton: {
    padding: 8,
  },
});
