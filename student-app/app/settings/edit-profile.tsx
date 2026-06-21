import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

export default function EditProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();

  const [nickname, setNickname] = useState(profile?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleEmailChange = (text: string) => {
    setEmail(text);
    const cleaned = text.trim();
    if (cleaned === '') {
      setEmailError('邮箱不能为空');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setEmailError('请输入有效的邮箱格式');
    } else {
      setEmailError('');
    }
  };

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
        setAvatarUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('提示', '选择图片失败，请重试');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!nickname.trim()) {
      Alert.alert('提示', '昵称不能为空');
      return;
    }
    
    if (!email.trim()) {
      Alert.alert('提示', '邮箱不能为空');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('提示', '请输入有效的邮箱地址');
      return;
    }

    // Password validation if password is typed
    if (password.trim()) {
      if (password.length < 6) {
        Alert.alert('安全提示', '新密码长度不能少于 6 位');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('提示', '两次输入的新密码不一致');
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Update Profile (nickname and avatar)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: nickname.trim(),
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Update Auth (email and/or password)
      const updatePayload: any = {};
      let emailChanged = false;
      let passwordChanged = false;

      if (email.trim() && email.trim().toLowerCase() !== user.email?.toLowerCase()) {
        updatePayload.email = email.trim();
        emailChanged = true;
      }
      if (password.trim()) {
        updatePayload.password = password.trim();
        passwordChanged = true;
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: authError } = await supabase.auth.updateUser(updatePayload);
        if (authError) throw authError;

        let successMessage = '个人资料已更新。';
        if (emailChanged && passwordChanged) {
          successMessage += '\n我们已向您的新旧邮箱发送了确认更改邮件，并向邮箱发送了密码修改确认邮件，请通过邮件链接完成验证。';
        } else if (emailChanged) {
          successMessage += '\n我们已向您的新旧邮箱发送了确认更改邮件，请通过邮件链接验证以完成邮箱修改。';
        } else if (passwordChanged) {
          successMessage += '\n密码重置确认邮件已发送，请在邮箱中确认后再使用新密码登录。';
        }

        Alert.alert('修改已提交', successMessage, [
          {
            text: '确定',
            onPress: () => {
              // Clear password input fields after saving
              setPassword('');
              setConfirmPassword('');
              refreshProfile().catch(console.error);
              router.back();
            }
          }
        ]);
      } else {
        Alert.alert('保存成功', '个人资料已成功更新！', [
          {
            text: '确定',
            onPress: () => {
              refreshProfile().catch(console.error);
              router.back();
            }
          }
        ]);
      }
    } catch (err: any) {
      console.error('Error updating profile:', err);
      Alert.alert('更新失败', err.message || '更新个人资料时出错，请重试。');
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
          <Pressable onPress={pickImage} style={styles.avatarWrapper}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={60} color={colors.textSecondary} />
              )}
            </View>
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="camera" size={16} color="#FFF" />
            </View>
          </Pressable>
          <Text style={[styles.avatarTip, { color: colors.textMuted }]}>点击更换头像</Text>
        </View>

        {/* Basic Fields */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>基本资料</Text>
        </View>
        
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Nickname Input */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>昵称</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="请输入昵称"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Email Input */}
          <View style={[styles.row, emailError ? { height: 'auto', paddingVertical: 12 } : null]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>邮箱</Text>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, paddingVertical: 4 }]}
                  value={email}
                  onChangeText={handleEmailChange}
                  placeholder="请输入邮箱"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {emailError ? (
                  <Text style={[styles.errorText, { color: colors.error }]}>
                    {emailError}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Security Fields */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>安全设置 (修改密码)</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* New Password */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>新密码</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={password}
              onChangeText={setPassword}
              placeholder="需要修改时输入新密码"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>确认密码</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="请再次输入新密码"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 32, marginBottom: 40 }}>
          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>保存修改</Text>
            )}
          </Pressable>
        </View>
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
});
