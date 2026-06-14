const fs = require('fs');
const path = require('path');

const studentAppDir = path.join(__dirname, 'student-app');
const appDir = path.join(studentAppDir, 'app');

const filesToWrite = {
  // 1. app/index.tsx
  [path.join(appDir, 'index.tsx')]: `import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)" />;
}
`,

  // 2. app/(tabs)/_layout.tsx
  [path.join(appDir, '(tabs)', '_layout.tsx')]: `import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { COLORS } from '../../constants/theme';

function TabIcon({ label, icon, focused }: { label: string; icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: focused ? COLORS.primary : COLORS.textMuted, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
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
          tabBarIcon: ({ focused }) => <TabIcon label="首页" icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="通知" icon="📢" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="工具" icon="🛠️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="我的" icon="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
`,

  // 3. app/_layout.tsx
  [path.join(appDir, '_layout.tsx')]: `import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="about" options={{ presentation: 'card' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </AuthProvider>
  );
}
`,

  // 4. app/settings.tsx
  [path.join(appDir, 'settings.tsx')]: `import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [cacheSize, setCacheSize] = useState('12.4 MB');

  const handleClearCache = () => {
    Alert.alert('提示', '确定要清除应用缓存吗？', [
      { text: '取消', style: 'cancel' },
      { 
        text: '确定', 
        onPress: () => {
          setCacheSize('0.0 KB');
          Alert.alert('提示', '缓存清除成功！');
        } 
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>系统设置</Text>
          
          <View style={styles.row}>
            <Text style={styles.rowLabel}>推送通知</Text>
            <Switch 
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={Platform.OS === 'ios' ? '#FFF' : COLORS.textPrimary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据与存储</Text>
          
          <Pressable style={styles.rowPressable} onPress={handleClearCache}>
            <Text style={styles.rowLabel}>清除缓存</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{cacheSize}</Text>
              <Text style={styles.arrow}>›</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>法律与条款</Text>
          
          <Pressable style={styles.rowPressable} onPress={() => Alert.alert('隐私政策', '此处为隐私政策内容...')}>
            <Text style={styles.rowLabel}>隐私政策</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>

          <Pressable style={styles.rowPressable} onPress={() => Alert.alert('用户协议', '此处为用户协议内容...')}>
            <Text style={styles.rowLabel}>用户协议</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.versionText}>版本: 1.0.0 (Beta)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerPlaceholder: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 16,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  row: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowPressable: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLabel: {
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  arrow: {
    fontSize: 18,
    color: COLORS.textMuted,
  },
  versionText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 30,
    marginBottom: 20,
  },
});
`,

  // 5. app/about.tsx
  [path.join(appDir, 'about.tsx')]: `import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>关于我们</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={styles.appName}>学联官方平台</Text>
          <Text style={styles.version}>Version 1.0.0 (Beta)</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>平台简介</Text>
          <Text style={styles.description}>
            本应用是由欧洲学生学者联合会官方出品的一站式校园生活服务平台，旨在为广大留欧学生学者提供最及时权威的信息资讯、最实用的生活学术工具以及充满活力的青年社区。
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>联系我们</Text>
          <Text style={styles.contactItem}>官方网站: www.asscubo.org</Text>
          <Text style={styles.contactItem}>微信公众号: 欧洲学联官方发布</Text>
          <Text style={styles.contactItem}>客服邮箱: info@asscubo.org</Text>
        </View>

        <Text style={styles.copyright}>
          © 2026 欧洲学生学者联合会. {"\n"}All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    color: COLORS.primaryLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
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
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  version: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryLight,
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  contactItem: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
    lineHeight: 20,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginTop: 40,
    marginBottom: 20,
  },
});
`,

  // 6. app/(tabs)/profile.tsx
  [path.join(appDir, '(tabs)', 'profile.tsx')]: `import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>我的</Text>
        
        {user ? (
          // Logged In Status
          <View style={styles.card}>
            <View style={styles.userInfo}>
              <Text style={styles.avatar}>👤</Text>
              <View style={styles.userDetails}>
                <Text style={styles.welcome}>你好，{profile?.name || '学联同学'}</Text>
                <Text style={styles.email}>{user?.email}</Text>
                <Text style={styles.role}>身份: {profile?.role === 'admin' ? '管理员' : '普通学生学者'}</Text>
              </View>
            </View>
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutButtonText}>退出登录</Text>
            </Pressable>
          </View>
        ) : (
          // Guest Status
          <View style={styles.card}>
            <View style={styles.userInfo}>
              <Text style={styles.avatar}>👤</Text>
              <View style={styles.userDetails}>
                <Text style={styles.welcome}>游客模式</Text>
                <Text style={styles.email}>登录即可体验完整功能</Text>
              </View>
            </View>
            <Pressable style={styles.signInButton} onPress={navigateToLogin}>
              <Text style={styles.signInButtonText}>登录账户</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.menuSection}>
          <Pressable style={styles.menuRow} onPress={() => router.push('/settings')}>
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuLabel}>设置</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>

          <Pressable style={styles.menuRow} onPress={() => router.push('/about')}>
            <Text style={styles.menuIcon}>ℹ️</Text>
            <Text style={styles.menuLabel}>关于我们</Text>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 20,
    marginTop: 10,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.surfaceElevated,
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
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  role: {
    fontSize: 12,
    color: COLORS.primaryLight,
    fontWeight: 'bold',
  },
  signInButton: {
    width: '100%',
    height: 44,
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  signOutButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: 'bold',
  },
  menuSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  menuRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  arrow: {
    fontSize: 18,
    color: COLORS.textMuted,
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

console.log('App guest access and subpages written successfully!');
