import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const { colors, t } = useTheme();

  const navigateToLogin = () => {
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('profile')}</Text>
        
        {user ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userInfo}>
              <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <MaterialCommunityIcons name="account" size={32} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.welcome, { color: colors.textPrimary }]}>
                  {t('hello')}{profile?.name || '同学'}
                </Text>
                <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
              </View>
            </View>
            <Pressable 
              style={[styles.profileButton, { backgroundColor: colors.primary }]} 
              onPress={() => router.push('/settings/profile')}
            >
              <Text style={[styles.profileButtonText, { color: '#FFFFFF' }]}>个人资料</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userInfo}>
              <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="account-outline" size={32} color={colors.textMuted} />
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.welcome, { color: colors.textPrimary }]}>{t('guestMode')}</Text>
                <Text style={[styles.email, { color: colors.textSecondary }]}>{t('loginPrompt')}</Text>
              </View>
            </View>
            <Pressable style={[styles.signInButton, { backgroundColor: colors.primary }]} onPress={navigateToLogin}>
              <Text style={styles.signInButtonText}>{t('login')}</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {profile?.role === 'admin' && (
            <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/admin')}>
              <MaterialCommunityIcons name="shield-key-outline" size={22} color={colors.primaryLight} style={styles.menuIcon} />
              <Text style={[styles.menuLabel, { color: colors.textPrimary, fontWeight: 'bold' }]}>管理后台</Text>
              <Text style={[styles.arrow, { color: colors.primaryLight }]}>›</Text>
            </Pressable>
          )}

          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/settings')}>
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('settings')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>


          <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/platforms')}>
            <MaterialCommunityIcons name="account-group-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('officialPlatforms') || '公众平台'}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={styles.menuRow} onPress={() => router.push('/about')}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('about')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
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
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 10,
  },
  card: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 60,
    height: 60,
  },
  userDetails: {
    flex: 1,
  },
  welcome: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    marginBottom: 4,
  },
  role: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  signInButton: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  profileButton: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  profileButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  menuSection: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
  },
  arrow: {
    fontSize: 18,
  },
});
