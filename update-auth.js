const fs = require('fs');
const path = require('path');

const studentAppDir = path.join(__dirname, 'student-app');
const appDir = path.join(studentAppDir, 'app');

const filesToWrite = {
  // 1. context/AuthContext.tsx
  [path.join(studentAppDir, 'context', 'AuthContext.tsx')]: `import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  name: string | null;
  student_id: string | null;
  faculty: string | null;
  major: string | null;
  campus: string | null;
  role: 'student' | 'admin' | 'super_admin';
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!error && data) {
        setProfile(data as Profile);
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, name: string) {
    // 1. Sign up the user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { 
        data: { name },
        emailRedirectTo: 'exp://192.168.1.25:8081' // Redirect back to Expo Go after verification
      } 
    });
    
    if (error) return { error };

    // 2. Insert into the profile table if auto-trigger didn't run or to ensure it is populated
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        name: name,
        role: 'student'
      });
      if (profileError) {
        console.error('Error writing profile:', profileError);
      }
    }
    return { error: null };
  }

  async function signOut() { 
    await supabase.auth.signOut(); 
  }

  async function refreshProfile() { 
    if (user) await fetchProfile(user.id); 
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
`,

  // 2. app/_layout.tsx
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
        <Stack.Screen name="+not-found" />
      </Stack>
    </AuthProvider>
  );
}
`,

  // 3. app/index.tsx
  [path.join(appDir, 'index.tsx')]: `import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return session ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
`,

  // 4. app/(auth)/_layout.tsx
  [path.join(appDir, '(auth)', '_layout.tsx')]: `import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
`,

  // 5. app/(auth)/login.tsx
  [path.join(appDir, '(auth)', 'login.tsx')]: `import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('请输入邮箱和密码');
      return;
    }
    
    setErrorMsg(null);
    setLoading(true);
    
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setErrorMsg(error.message || '登录失败，请检查邮箱或密码');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err) {
      setErrorMsg('网络异常，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.logo}>🏠</Text>
            <Text style={styles.title}>学联官方平台</Text>
            <Text style={styles.subtitle}>欧洲学生学者联合会官方移动端</Text>
          </View>

          <View style={styles.form}>
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>电子邮箱</Text>
              <TextInput 
                style={styles.input}
                placeholder="请输入邮箱地址"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>登录密码</Text>
              <TextInput 
                style={styles.input}
                placeholder="请输入密码"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Pressable 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>登录</Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>还没有账户？ </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={styles.linkText}>立即注册</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 50,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: COLORS.error + '20',
    borderColor: COLORS.error,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  button: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.primaryLight,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
`,

  // 6. app/(auth)/register.tsx
  [path.join(appDir, '(auth)', 'register.tsx')]: `import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { signUp } = useAuth();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setErrorMsg('请填写所有必填字段');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密码长度不能少于 6 位');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await signUp(email.trim(), password, name.trim());
      if (error) {
        setErrorMsg(error.message || '注册失败，请重试');
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setErrorMsg('网络异常，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✉️</Text>
        <Text style={styles.successTitle}>注册申请已提交</Text>
        <Text style={styles.successText}>
          我们已向您的邮箱发送了一封验证邮件，请打开邮件并点击其中的验证链接激活账户。
        </Text>
        <Text style={styles.successSubtext}>
          验证成功后，您可以返回此页面进行登录。
        </Text>
        <Link href="/(auth)/login" asChild>
          <Pressable style={styles.successButton}>
            <Text style={styles.successButtonText}>返回登录</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>创建账户</Text>
            <Text style={styles.subtitle}>加入学联官方平台</Text>
          </View>

          <View style={styles.form}>
            {errorMsg && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>姓名 / 昵称</Text>
              <TextInput 
                style={styles.input}
                placeholder="请输入您的姓名"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>电子邮箱</Text>
              <TextInput 
                style={styles.input}
                placeholder="建议使用您的大学邮箱"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>设置密码 (至少 6 位)</Text>
              <TextInput 
                style={styles.input}
                placeholder="请输入密码"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <Pressable 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>注册</Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>已有账户？ </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text style={styles.linkText}>立即登录</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: COLORS.error + '20',
    borderColor: COLORS.error,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  button: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: COLORS.primaryLight,
    fontSize: 14,
    fontWeight: 'bold',
  },
  successContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  successSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  successButton: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
`,

  // 7. app/(tabs)/_layout.tsx
  [path.join(appDir, '(tabs)', '_layout.tsx')]: `import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator, Text } from 'react-native';
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
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // If not logged in, redirect to login
  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

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

  // 8. app/(tabs)/profile.tsx
  [path.join(appDir, '(tabs)', 'profile.tsx')]: `import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的</Text>
      
      <View style={styles.card}>
        <Text style={styles.welcome}>你好，{profile?.name || user?.email || '同学'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.role}>身份: {profile?.role === 'admin' ? '管理员' : '普通学生学者'}</Text>
      </View>

      <Pressable style={styles.button} onPress={handleSignOut}>
        <Text style={styles.buttonText}>退出登录</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 24,
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
  welcome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  role: {
    fontSize: 14,
    color: COLORS.primaryLight,
    fontWeight: 'bold',
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: 'bold',
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

console.log('Authentication files successfully written!');
