import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Animated, type StyleProp, type ViewStyle } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const PROFILE_BOOTSTRAP_ICONS = {
  person: {
    outline: [
      'M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z',
    ],
    fill: [
      'M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    ],
  },
  shield: {
    outline: [
      'M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56',
      'M9.5 6.5a1.5 1.5 0 0 1-1 1.415l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99a1.5 1.5 0 1 1 2-1.415',
    ],
    fill: [
      'M8 0c-.69 0-1.843.265-2.928.56-1.11.3-2.229.655-2.887.87a1.54 1.54 0 0 0-1.044 1.262c-.596 4.477.787 7.795 2.465 9.99a11.8 11.8 0 0 0 2.517 2.453c.386.273.744.482 1.048.625.28.132.581.24.829.24s.548-.108.829-.24a7 7 0 0 0 1.048-.625 11.8 11.8 0 0 0 2.517-2.453c1.678-2.195 3.061-5.513 2.465-9.99a1.54 1.54 0 0 0-1.044-1.263 63 63 0 0 0-2.887-.87C9.843.266 8.69 0 8 0m0 5a1.5 1.5 0 0 1 .5 2.915l.385 1.99a.5.5 0 0 1-.491.595h-.788a.5.5 0 0 1-.49-.595l.384-1.99A1.5 1.5 0 0 1 8 5',
    ],
  },
  gear: {
    outline: [
      'M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0',
      'M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z',
    ],
    fill: [
      'M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z',
    ],
  },
  people: {
    outline: [
      'M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
    ],
    fill: [
      'M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
    ],
  },
  info: {
    outline: [
      'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16',
      'm8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
    ],
    fill: [
      'M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2',
    ],
  },
} as const;

type ProfileBootstrapIconName = keyof typeof PROFILE_BOOTSTRAP_ICONS;

function ProfileBootstrapIcon({
  name,
  filled = false,
  color,
  size = 22,
  style,
}: {
  name: ProfileBootstrapIconName;
  filled?: boolean;
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const paths = PROFILE_BOOTSTRAP_ICONS[name][filled ? 'fill' : 'outline'];

  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" style={style}>
      {paths.map((d, index) => (
        <Path key={`${name}-${filled ? 'fill' : 'outline'}-${index}`} d={d} fill={color} />
      ))}
    </Svg>
  );
}

const LOCALIZED = {
  zh: {
    studentFallback: '同学',
    profileBtn: '个人资料',
    adminPanel: '管理后台',
  },
  'zh-Hant': {
    studentFallback: '同學',
    profileBtn: '個人資料',
    adminPanel: '管理后台',
  },
  en: {
    studentFallback: 'student',
    profileBtn: 'Profile Details',
    adminPanel: 'Admin Panel',
  },
  it: {
    studentFallback: 'studente',
    profileBtn: 'Dettagli Profilo',
    adminPanel: 'Pannello Admin',
  }
};

export default function ProfileScreen() {
  const userObj = useAuth();
  const user = userObj?.user;
  const profile = userObj?.profile;
  const hasUnreadFeedbackReply = userObj?.hasUnreadFeedbackReply;
  const refreshProfile = userObj?.refreshProfile;
  const { colors, t, tabBarStyle, tabOpacities, isDark, language } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  useFocusEffect(useCallback(() => {
    refreshProfile?.();
  }, []));

  const navigateToLogin = () => {
    router.push('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }}>
      <Animated.View style={{ flex: 1, opacity: tabOpacities[3] }}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarStyle === 'glassmorphism' ? 110 : 20 }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('profile')}</Text>
          
          {user ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.userInfo}>
                <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <ProfileBootstrapIcon name="person" filled size={32} color={colors.textSecondary} />
                  )}
                </View>
                <View style={styles.userDetails}>
                  <Text style={[styles.welcome, { color: colors.textPrimary }]}>
                    {t('hello')}{profile?.name || localized.studentFallback}
                  </Text>
                  <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
                </View>
              </View>
              <Pressable 
                style={[styles.profileButton, { backgroundColor: colors.primary }]} 
                onPress={() => router.push('/settings/profile')}
              >
                <Text style={[styles.profileButtonText, { color: '#FFFFFF' }]}>{localized.profileBtn}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.userInfo}>
                <View style={[styles.avatarContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <ProfileBootstrapIcon name="person" size={32} color={colors.textMuted} />
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
            {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
              <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/admin')}>
                <ProfileBootstrapIcon name="shield" size={22} color={colors.primaryLight} style={styles.menuIcon} />
                <Text style={[styles.menuLabel, { color: colors.textPrimary, fontWeight: 'bold' }]}>{localized.adminPanel}</Text>
                <Text style={[styles.arrow, { color: colors.primaryLight }]}>›</Text>
              </Pressable>
            )}

            <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/settings')}>
              <ProfileBootstrapIcon name="gear" size={22} color={colors.textSecondary} style={styles.menuIcon} />
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('settings')}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>


            <Pressable style={[styles.menuRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]} onPress={() => router.push('/about/platforms')}>
              <ProfileBootstrapIcon name="people" size={22} color={colors.textSecondary} style={styles.menuIcon} />
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('officialPlatforms') || '公众平台'}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>

            <Pressable style={styles.menuRow} onPress={() => router.push('/about')}>
              <ProfileBootstrapIcon name="info" size={22} color={colors.textSecondary} style={styles.menuIcon} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 15, color: colors.textPrimary }}>{t('about')}</Text>
                {hasUnreadFeedbackReply && (
                  <View style={styles.redDot} />
                )}
              </View>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>
          </View>
        </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
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
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginLeft: 6,
  },
});
