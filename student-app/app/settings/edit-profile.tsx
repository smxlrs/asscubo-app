import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, Image, Modal } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors, language } = useTheme();

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
        Alert.alert('需要权限', '更换头像需要读取相册的权限，请在设置中开启。');
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
          Alert.alert('更换成功', '头像已更新！');
          await refreshProfile();
        } catch (err: any) {
          console.error(err);
          Alert.alert('更换失败', '无法保存头像，请重试');
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('提示', '选择图片失败，请重试');
    }
  };

  const handleUpdateNickname = async () => {
    if (!modalNickname.trim()) {
      Alert.alert('提示', '昵称不能为空');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: modalNickname.trim(), updated_at: new Date().toISOString() })
        .eq('id', user?.id);
      if (error) throw error;
      
      Alert.alert('修改成功', '您的昵称已成功更新！');
      setActiveModal(null);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      Alert.alert('更新失败', err.message || '更新昵称时出错');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    const cleanedEmail = modalEmail.trim();
    if (!cleanedEmail) {
      Alert.alert('提示', '邮箱不能为空');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      Alert.alert('提示', '请输入有效的邮箱地址');
      return;
    }
    if (cleanedEmail.toLowerCase() === user?.email?.toLowerCase()) {
      Alert.alert('提示', '新邮箱不能与当前邮箱相同');
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: cleanedEmail });
      if (error) throw error;
      
      Alert.alert(
        '修改已提交', 
        '我们已向您的新旧邮箱发送了确认邮件，请通过邮件链接验证以完成邮箱修改。',
        [{ text: '确定', onPress: () => {
          setActiveModal(null);
          refreshProfile().catch(console.error);
        }}]
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('更新失败', err.message || '更新邮箱时出错');
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.reauthenticate();
      if (error) throw error;
      
      Alert.alert("验证码已发送", "安全验证码已发送至您的邮箱，请注意查收。");
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
      Alert.alert("发送失败", err.message || "无法发送验证码，请稍后再试。");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!modalPassword.trim() || !modalConfirmPassword.trim()) {
      Alert.alert('提示', '新密码和确认密码不能为空');
      return;
    }
    if (modalPassword.length < 6) {
      Alert.alert('安全提示', '新密码长度不能少于 6 位');
      return;
    }
    if (modalPassword !== modalConfirmPassword) {
      Alert.alert('提示', '两次输入的新密码不一致');
      return;
    }
    if (!modalOtp.trim() || modalOtp.length !== 6) {
      Alert.alert('提示', '请输入 6 位验证码');
      return;
    }
    
    setSaving(true);
    try {
      // 1. Verify the OTP code
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: user?.email || '',
        token: modalOtp.trim(),
        type: 'reauthentication'
      });
      
      if (verifyError) {
        throw new Error(verifyError.message || '验证码错误，请重新输入');
      }
      
      // 2. Verification succeeded! Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: modalPassword.trim()
      });
      if (updateError) throw updateError;
      
      Alert.alert('保存成功', '您的账户密码已成功更新！', [
        {
          text: '确定',
          onPress: () => {
            setActiveModal(null);
            refreshProfile().catch(console.error);
          }
        }
      ]);
    } catch (err: any) {
      console.error(err);
      Alert.alert('更新失败', err.message || '修改密码时出错，请检查验证码或重试。');
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>修改个人资料</Text>
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
          <Text style={[styles.avatarTip, { color: colors.textMuted }]}>点击更换头像</Text>
        </View>

        {/* Basic Fields */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>基本资料</Text>
        </View>
        
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Nickname Display */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>昵称</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{profile?.name || '未设置'}</Text>
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
            <Text style={[styles.label, { color: colors.textSecondary }]}>邮箱</Text>
            <Text style={[styles.valueText, { color: colors.textPrimary }]}>{user?.email || '未设置'}</Text>
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
          <Text style={styles.sectionHeader}>安全设置 (修改密码)</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Change Password Row */}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>登录密码</Text>
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
            <Text style={styles.saveButtonText}>完成</Text>
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
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>修改昵称</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalNickname}
                  onChangeText={setModalNickname}
                  placeholder="请输入新昵称"
                  placeholderTextColor={colors.textMuted}
                  autoFocus={true}
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => setActiveModal(null)}
                    disabled={saving}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleUpdateNickname}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>确认</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {activeModal === 'email' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>修改邮箱</Text>
                <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
                  我们将向新旧邮箱发送验证信，点击其中的链接方可完成修改。
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalEmail}
                  onChangeText={setModalEmail}
                  placeholder="请输入新邮箱"
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
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleUpdateEmail}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>确认</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}

            {activeModal === 'password' && (
              <>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>修改密码</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalPassword}
                  onChangeText={setModalPassword}
                  placeholder="新密码 (不少于6位)"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoFocus={true}
                />
                <TextInput
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                  value={modalConfirmPassword}
                  onChangeText={setModalConfirmPassword}
                  placeholder="再次输入新密码"
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
                    placeholder="请输入6位验证码"
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
                        {countdown > 0 ? `${countdown}s` : (modalOtp ? "重新发送" : "获取验证码")}
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
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { backgroundColor: colors.primary }]}
                    onPress={handleUpdatePassword}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '600' }}>保存</Text>
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
    color: '#8A8A8F',
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
