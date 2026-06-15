import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const { colors, t } = useTheme();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

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
                <MaterialCommunityIcons name="account" size={32} color={colors.textSecondary} />
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.welcome, { color: colors.textPrimary }]}>
                  {t('hello')}{profile?.name || '同学'}
                </Text>
                <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
                <Text style={[styles.role, { color: colors.primaryLight }]}>
                  {profile?.role === 'admin' ? t('adminRole') : t('studentRole')}
                </Text>
              </View>
            </View>
            <Pressable style={[styles.signOutButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={handleSignOut}>
              <Text style={[styles.signOutButtonText, { color: colors.error }]}>{t('logout')}</Text>
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
          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/settings')}>
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.textSecondary} style={styles.menuIcon} />
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('settings')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about')}>
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
  signOutButton: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  signOutButtonText: {
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
