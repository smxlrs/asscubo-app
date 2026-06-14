const fs = require('fs');
const path = require('path');

const studentAppDir = path.join(__dirname, 'student-app');
const appDir = path.join(studentAppDir, 'app');

const filesToWrite = {
  // 1. context/ThemeContext.tsx
  [path.join(studentAppDir, 'context', 'ThemeContext.tsx')]: `import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system' | 'custom';
export type Language = 'zh' | 'en';

type ThemeContextType = {
  themeMode: ThemeMode;
  customStart: string;
  customEnd: string;
  language: Language;
  isDark: boolean;
  colors: typeof darkColors;
  t: (key: string) => string;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setCustomStart: (time: string) => Promise<void>;
  setCustomEnd: (time: string) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  isReady: boolean;
};

const darkColors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#555555',
  primary: '#A31621',
  primaryLight: '#C41E2A',
  primarySoft: '#A3162115',
  success: '#22C55E',
  error: '#EF4444',
};

const lightColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceElevated: '#E4E7EC',
  border: '#D0D5DD',
  textPrimary: '#1D2939',
  textSecondary: '#475467',
  textMuted: '#98A2B3',
  primary: '#A31621',
  primaryLight: '#C41E2A',
  primarySoft: '#A3162115',
  success: '#22C55E',
  error: '#EF4444',
};

const translations: Record<Language, Record<string, string>> = {
  zh: {
    home: '首页',
    notifications: '通知',
    tools: '工具',
    profile: '我的',
    settings: '设置',
    about: '关于我们',
    logout: '退出登录',
    login: '登录账户',
    guestMode: '游客模式',
    loginPrompt: '登录即可体验完整功能',
    hello: '你好，',
    studentRole: '普通学生学者',
    adminRole: '管理员',
    systemSettings: '系统设置',
    dataStorage: '数据与存储',
    legalTerms: '法律与条款',
    privacyPolicy: '隐私政策',
    userAgreement: '用户协议',
    clearCache: '清除缓存',
    cacheCleared: '缓存清除成功！',
    confirmClearCache: '确定要清除应用缓存吗？',
    cancel: '取消',
    confirm: '确定',
    languageSetting: '语言设置',
    themeSetting: '主题模式',
    appInfo: '平台简介',
    contactUs: '联系我们',
    officialWebsite: '官方网站',
    wechatPub: '微信公众号',
    serviceEmail: '客服邮箱',
    copyright: '欧洲学生学者联合会. \\nAll rights reserved.',
    version: '版本: 1.0.0 (Beta)',
    aboutDescription: '本应用是由欧洲学生学者联合会官方出品的一站式校园生活服务平台，旨在为广大留欧学生学者提供最及时权威的信息资讯、最实用的生活学术工具以及充满活力的青年社区。',
    back: '返回',
    save: '保存',
    lightMode: '浅色模式',
    darkMode: '深色模式',
    systemMode: '跟随系统',
    customMode: '自定义时间',
    customTimeRange: '在此时间段内切换至深色模式。',
    startTime: '开始时间',
    endTime: '结束时间',
    emptyContent: '内容建设中...',
    noNotifications: '暂无新通知',
    toolsDeveloping: '工具箱正在研发中...',
    guestExplore: '暂不登录，游客探索',
    emailLabel: '电子邮箱',
    passwordLabel: '登录密码',
    emailPlaceholder: '请输入邮箱地址',
    passwordPlaceholder: '请输入密码',
    registerLabel: '注册账户',
    registerLink: '立即注册',
    noAccount: '还没有账户？',
    hasAccount: '已有账户？',
    loginLink: '立即登录',
    nameLabel: '姓名 / 昵称',
    namePlaceholder: '请输入您的姓名',
    emailRegPlaceholder: '建议使用您的大学邮箱',
    passwordRegPlaceholder: '请输入密码 (至少6位)',
    successRegTitle: '注册申请已提交',
    successRegText: '我们已向您的邮箱发送了一封验证邮件，请打开邮件并点击其中的验证链接激活账户。',
    successRegSubtext: '验证成功后，您可以返回此页面进行登录。',
    regSuccess: '注册成功！'
  },
  en: {
    home: 'Home',
    notifications: 'Notifications',
    tools: 'Tools',
    profile: 'Profile',
    settings: 'Settings',
    about: 'About Us',
    logout: 'Logout',
    login: 'Login',
    guestMode: 'Guest Mode',
    loginPrompt: 'Login to unlock all features',
    hello: 'Hello, ',
    studentRole: 'Student / Scholar',
    adminRole: 'Administrator',
    systemSettings: 'System Settings',
    dataStorage: 'Data & Storage',
    legalTerms: 'Legal & Terms',
    privacyPolicy: 'Privacy Policy',
    userAgreement: 'User Agreement',
    clearCache: 'Clear Cache',
    cacheCleared: 'Cache cleared successfully!',
    confirmClearCache: 'Are you sure you want to clear cache?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    languageSetting: 'Language',
    themeSetting: 'Theme Mode',
    appInfo: 'App Info',
    contactUs: 'Contact Us',
    officialWebsite: 'Official Website',
    wechatPub: 'WeChat Public Account',
    serviceEmail: 'Service Email',
    copyright: 'Association of Chinese Students and Scholars. \\nAll rights reserved.',
    version: 'Version: 1.0.0 (Beta)',
    aboutDescription: 'This app is the official one-stop campus life service platform created by the Association of Chinese Students and Scholars in Europe, designed to provide the latest information, practical tools, and vibrant community services.',
    back: 'Back',
    save: 'Save',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    systemMode: 'Follow System',
    customMode: 'Custom Schedule',
    customTimeRange: 'Switch to dark mode within this time range.',
    startTime: 'Start Time',
    endTime: 'End Time',
    emptyContent: 'Content under construction...',
    noNotifications: 'No new notifications',
    toolsDeveloping: 'Tools are under development...',
    guestExplore: 'Continue as Guest',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    emailPlaceholder: 'Enter your email address',
    passwordPlaceholder: 'Enter your password',
    registerLabel: 'Create Account',
    registerLink: 'Register Now',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    loginLink: 'Login Now',
    nameLabel: 'Name / Nickname',
    namePlaceholder: 'Enter your name',
    emailRegPlaceholder: 'University email recommended',
    passwordRegPlaceholder: 'Enter password (at least 6 chars)',
    successRegTitle: 'Registration Submitted',
    successRegText: 'We have sent a verification email. Please click the link inside to activate your account.',
    successRegSubtext: 'Once verified, you can return here to sign in.',
    regSuccess: 'Registered Successfully!'
  }
};

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [customStart, setCustomStartState] = useState('20:00');
  const [customEnd, setCustomEndState] = useState('07:00');
  const [language, setLanguageState] = useState<Language>('zh');
  const [isReady, setIsReady] = useState(false);
  const [tick, setTick] = useState(0);

  const systemScheme = useColorScheme();

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedMode = await AsyncStorage.getItem('theme_mode');
        const savedStart = await AsyncStorage.getItem('custom_start');
        const savedEnd = await AsyncStorage.getItem('custom_end');
        const savedLang = await AsyncStorage.getItem('language');

        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedStart) setCustomStartState(savedStart);
        if (savedEnd) setCustomEndState(savedEnd);
        if (savedLang) setLanguageState(savedLang as Language);
      } catch (e) {
        console.error('Failed to load theme settings', e);
      } finally {
        setIsReady(true);
      }
    }
    loadSettings();
  }, []);

  // Set up clock tick for custom theme scheduled updates
  useEffect(() => {
    if (themeMode !== 'custom') return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [themeMode]);

  const getIsDark = () => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    if (themeMode === 'system') return systemScheme === 'dark';
    if (themeMode === 'custom') {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();

      const [startHour, startMin] = customStart.split(':').map(Number);
      const [endHour, endMin] = customEnd.split(':').map(Number);
      const startMinTotal = startHour * 60 + startMin;
      const endMinTotal = endHour * 60 + endMin;

      if (startMinTotal < endMinTotal) {
        return currentMin >= startMinTotal && currentMin < endMinTotal;
      } else {
        return currentMin >= startMinTotal || currentMin < endMinTotal;
      }
    }
    return true;
  };

  const isDark = getIsDark();
  const colors = isDark ? darkColors : lightColors;

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem('theme_mode', mode);
  };

  const setCustomStart = async (time: string) => {
    setCustomStartState(time);
    await AsyncStorage.setItem('custom_start', time);
  };

  const setCustomEnd = async (time: string) => {
    setCustomEndState(time);
    await AsyncStorage.setItem('custom_end', time);
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await AsyncStorage.setItem('language', lang);
  };

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />;
  }

  return (
    <ThemeContext.Provider value={{
      themeMode,
      customStart,
      customEnd,
      language,
      isDark,
      colors,
      t,
      setThemeMode,
      setCustomStart,
      setCustomEnd,
      setLanguage,
      isReady
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
`,

  // 2. app/_layout.tsx
  [path.join(appDir, '_layout.tsx')]: `import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          <Stack.Screen name="about" options={{ presentation: 'card' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
`,

  // 3. app/(tabs)/_layout.tsx
  [path.join(appDir, '(tabs)', '_layout.tsx')]: `import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

function TabIcon({ label, icon, focused, activeColor, inactiveColor }: { label: string; icon: string; focused: boolean; activeColor: string; inactiveColor: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: focused ? activeColor : inactiveColor, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, t } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('home')} icon="🏠" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('notifications')} icon="📢" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tools')} icon="🛠️" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('profile')} icon="👤" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
`,

  // 4. app/(tabs)/index.tsx
  [path.join(appDir, '(tabs)', 'index.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function HomeScreen() {
  const { colors, t } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('home')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('emptyContent')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
});
`,

  // 5. app/(tabs)/notifications.tsx
  [path.join(appDir, '(tabs)', 'notifications.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function NotificationsScreen() {
  const { colors, t } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('notifications')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('noNotifications')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
});
`,

  // 6. app/(tabs)/tools.tsx
  [path.join(appDir, '(tabs)', 'tools.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function ToolsScreen() {
  const { colors, t } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tools')}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('toolsDeveloping')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
});
`,

  // 7. app/(tabs)/profile.tsx
  [path.join(appDir, '(tabs)', 'profile.tsx')]: `import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

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
              <Text style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>👤</Text>
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
              <Text style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>👤</Text>
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
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('settings')}</Text>
            <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
          </Pressable>

          <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => router.push('/about')}>
            <Text style={styles.menuIcon}>ℹ️</Text>
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
  avatar: {
    fontSize: 40,
    marginRight: 16,
    padding: 8,
    borderRadius: 99,
    overflow: 'hidden',
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
    fontSize: 18,
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
`,

  // 8. app/about.tsx
  [path.join(appDir, 'about.tsx')]: `import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const { colors, t } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primaryLight }]}>← {t('back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('about')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={[styles.appName, { color: colors.textPrimary }]}>{t('guestExplore').split('，')[0]}</Text>
          <Text style={[styles.version, { color: colors.textSecondary }]}>{t('version')}</Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.primaryLight }]}>{t('appInfo')}</Text>
          <Text style={[styles.description, { color: colors.textPrimary }]}>
            {t('aboutDescription')}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.primaryLight }]}>{t('contactUs')}</Text>
          <Text style={[styles.contactItem, { color: colors.textSecondary }]}>{t('officialWebsite')}: www.asscubo.org</Text>
          <Text style={[styles.contactItem, { color: colors.textSecondary }]}>{t('wechatPub')}: 欧洲学联官方发布</Text>
          <Text style={[styles.contactItem, { color: colors.textSecondary }]}>{t('serviceEmail')}: info@asscubo.org</Text>
        </View>

        <Text style={[styles.copyright, { color: colors.textMuted }]}>
          © 2026 {t('copyright')}
        </Text>
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
  content: {
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  version: {
    fontSize: 14,
  },
  infoCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  contactItem: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 40,
    marginBottom: 20,
  },
});
`,

  // 9. app/settings.tsx
  [path.join(appDir, 'settings.tsx')]: `import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme, ThemeMode, Language } from '../context/ThemeContext';
import { COLORS } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { 
    colors, 
    t, 
    themeMode, 
    setThemeMode, 
    customStart, 
    setCustomStart, 
    customEnd, 
    setCustomEnd, 
    language, 
    setLanguage 
  } = useTheme();

  const [cacheSize, setCacheSize] = useState('12.4 MB');

  const handleClearCache = () => {
    Alert.alert(t('clearCache'), t('confirmClearCache'), [
      { text: t('cancel'), style: 'cancel' },
      { 
        text: t('confirm'), 
        onPress: () => {
          setCacheSize('0.0 KB');
          Alert.alert(t('clearCache'), t('cacheCleared'));
        } 
      }
    ]);
  };

  const adjustCustomTime = (type: 'start' | 'end', unit: 'hour' | 'min', operation: '+' | '-') => {
    const timeStr = type === 'start' ? customStart : customEnd;
    let [h, m] = timeStr.split(':').map(Number);

    if (unit === 'hour') {
      if (operation === '+') h = (h + 1) % 24;
      else h = (h - 1 + 24) % 24;
    } else {
      if (operation === '+') m = (m + 5) % 60; // adjust by 5 mins
      else m = (m - 5 + 60) % 60;
    }

    const paddedH = h.toString().padStart(2, '0');
    const paddedM = m.toString().padStart(2, '0');
    const formatted = \`\${paddedH}:\${paddedM}\`;

    if (type === 'start') {
      setCustomStart(formatted);
    } else {
      setCustomEnd(formatted);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primaryLight }]}>← {t('back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* 1. Theme Configuration */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>{t('themeSetting')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            { id: 'light', label: t('lightMode') },
            { id: 'dark', label: t('darkMode') },
            { id: 'system', label: t('systemMode') },
            { id: 'custom', label: t('customMode') }
          ] as { id: ThemeMode; label: string }[]).map((mode) => (
            <Pressable 
              key={mode.id}
              style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
              onPress={() => setThemeMode(mode.id)}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{mode.label}</Text>
              {themeMode === mode.id && (
                <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* Custom Time Selection UI */}
        {themeMode === 'custom' && (
          <View style={[styles.customTimeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.customTimeRangeInfo, { color: colors.textSecondary }]}>
              {t('customTimeRange')}
            </Text>
            
            {/* Start Time Picker Row */}
            <View style={styles.timePickerRow}>
              <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>{t('startTime')}</Text>
              <View style={styles.timeControls}>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'hour', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customStart.split(':')[0]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'hour', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
                
                <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
                
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'min', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customStart.split(':')[1]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'min', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>

            {/* End Time Picker Row */}
            <View style={[styles.timePickerRow, { marginTop: 15 }]}>
              <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>{t('endTime')}</Text>
              <View style={styles.timeControls}>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'hour', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customEnd.split(':')[0]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'hour', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
                
                <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
                
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'min', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customEnd.split(':')[1]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'min', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* 2. Language Configuration */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>{t('languageSetting')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            { id: 'zh', label: '简体中文' },
            { id: 'en', label: 'English' }
          ] as { id: Language; label: string }[]).map((lang) => (
            <Pressable 
              key={lang.id}
              style={[styles.rowPressable, { borderBottomColor: colors.border }]} 
              onPress={() => setLanguage(lang.id)}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{lang.label}</Text>
              {language === lang.id && (
                <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {/* 3. Cache & Storage */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>{t('dataStorage')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable style={styles.rowPressable} onPress={handleClearCache}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('clearCache')}</Text>
            <View style={styles.rowRight}>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{cacheSize}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </View>
          </Pressable>
        </View>

        <Text style={[styles.versionText, { color: colors.textMuted }]}>{t('version')}</Text>
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
  content: {
    flex: 1,
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderStyle: 'solid',
  },
  rowPressable: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 15,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 14,
    marginRight: 8,
  },
  arrow: {
    fontSize: 18,
  },
  customTimeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  customTimeRangeInfo: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeText: {
    width: 32,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 30,
    marginBottom: 30,
  },
});
`
};

Object.entries(filesToWrite).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully wrote file: ${filePath}`);
});

console.log('Theme files written successfully!');
