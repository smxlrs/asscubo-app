const fs = require('fs');
const path = require('path');

const BASE = path.join('i:', 'PARTTIME', 'AG', 'student-app');

function write(rel, content) {
  const full = path.join(BASE, ...rel.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  console.log('OK:', rel);
}

// ── .env ──────────────────────────────────────────────────────────────────────
write('.env', `EXPO_PUBLIC_SUPABASE_URL=https://avxzgaozbfeqttmhmlld.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ROyJRMFd8_hDw3YwRBUmHA_E61yNqqa
`);

// ── lib/supabase.ts ───────────────────────────────────────────────────────────
write('lib/supabase.ts', `import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
`);

// ── context/AuthContext.tsx ────────────────────────────────────────────────────
write('context/AuthContext.tsx', `import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

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
        router.replace('/(auth)/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as Profile);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
    if (!error) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) await supabase.from('profiles').update({ name }).eq('id', userData.user.id);
    }
    return { error };
  }

  async function signOut() { await supabase.auth.signOut(); }
  async function refreshProfile() { if (user) await fetchProfile(user.id); }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
`);

// ── constants/Colors.ts (keep existing) ──────────────────────────────────────
// theme.ts
write('constants/theme.ts', `export const COLORS = {
  primary: '#A31621',
  primaryDark: '#7A1019',
  primaryLight: '#C41E2A',
  primarySoft: '#A3162115',
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#555555',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
};

export const SIZES = {
  xs: 11,
  sm: 13,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
};
`);

// ── app/_layout.tsx (ROOT) ────────────────────────────────────────────────────
write('app/_layout.tsx', `import { Stack } from 'expo-router';
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
`);

// ── app/index.tsx ──────────────────────────────────────────────────────────────
write('app/index.tsx', `import { Redirect } from 'expo-router';
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
`);

// ── app/(auth)/_layout.tsx ────────────────────────────────────────────────────
write('app/(auth)/_layout.tsx', `import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
  if (session) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
`);

// ── app/(auth)/login.tsx ──────────────────────────────────────────────────────
write('app/(auth)/login.tsx', `import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const { signIn } = useAuth();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Reminder', 'Please enter email and password');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) Alert.alert('Login Failed', error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#1A0508', '#0A0A0A']} style={StyleSheet.absoluteFillObject} />
      <View style={s.circle} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <View style={s.logo}><Text style={{ fontSize: 40 }}>🎓</Text></View>
            <Text style={s.appName}>Student Union</Text>
            <Text style={s.subtitle}>Official Student Union Platform</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Welcome Back</Text>
            <Text style={s.cardSub}>Sign in with your edu email</Text>

            <Text style={s.label}>EDU EMAIL</Text>
            <TextInput style={s.input} placeholder="name@stu.university.edu.cn" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

            <Text style={s.label}>PASSWORD</Text>
            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Enter password" placeholderTextColor={COLORS.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!show} />
              <TouchableOpacity style={s.eye} onPress={() => setShow(!show)}>
                <Text style={{ fontSize: 18 }}>{show ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
              <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>SIGN IN</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <View style={s.divRow}>
              <View style={s.divLine} /><Text style={s.divText}>No account?</Text><View style={s.divLine} />
            </View>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={s.outlineBtn}>
                <Text style={s.outlineBtnText}>Create Account</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <Text style={s.footer}>For enrolled students with a valid edu email only</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  circle: { position: 'absolute', top: -120, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.primary, opacity: 0.08 },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingTop: 80, paddingBottom: 40, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: SPACING.xxl },
  logo: { width: 80, height: 80, borderRadius: RADIUS.lg, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.primary },
  appName: { fontSize: SIZES.xxxl, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 2 },
  subtitle: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  cardSub: { fontSize: SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  label: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs, letterSpacing: 0.8, marginTop: SPACING.base },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, fontSize: SIZES.base, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  eye: { padding: SPACING.sm, backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, height: 52, justifyContent: 'center' },
  btn: { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: SPACING.xl },
  btnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: SIZES.base, fontWeight: '700', color: '#fff', letterSpacing: 3 },
  divRow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.lg, gap: SPACING.sm },
  divLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  divText: { fontSize: SIZES.sm, color: COLORS.textMuted },
  outlineBtn: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: SPACING.md, alignItems: 'center' },
  outlineBtnText: { fontSize: SIZES.base, fontWeight: '600', color: COLORS.primary },
  footer: { textAlign: 'center', marginTop: SPACING.xl, fontSize: SIZES.xs, color: COLORS.textMuted },
});
`);

// ── app/(auth)/register.tsx ───────────────────────────────────────────────────
write('app/(auth)/register.tsx', `import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { router, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

const ALLOWED = '@stu.';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  async function handle() {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Reminder', 'Please fill all fields'); return;
    }
    if (!email.toLowerCase().includes(ALLOWED) || !email.includes('.edu')) {
      Alert.alert('Invalid Email', 'Please use your school edu email (xxx@stu.xx.edu.cn)'); return;
    }
    if (password.length < 8) { Alert.alert('Too Short', 'Password must be at least 8 characters'); return; }
    if (password !== confirm) { Alert.alert('Mismatch', 'Passwords do not match'); return; }

    setLoading(true);
    const { error } = await signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);
    if (error) Alert.alert('Register Failed', error.message.includes('already registered') ? 'Email already registered, please sign in' : error.message);
    else router.replace('/(auth)/verify');
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={['#1A0508', '#0A0A0A']} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={{ marginBottom: SPACING.lg }}>
              <Text style={{ color: COLORS.primary, fontSize: SIZES.md }}>Back to Sign In</Text>
            </TouchableOpacity>
          </Link>

          <Text style={s.title}>Create Account</Text>
          <Text style={s.sub}>Join Student Union, connect campus life</Text>

          <View style={s.card}>
            {[
              { label: 'FULL NAME', value: name, set: setName, ph: 'Your real name', kb: 'default' as const, sec: false },
              { label: 'EDU EMAIL', value: email, set: setEmail, ph: 'xxx@stu.university.edu.cn', kb: 'email-address' as const, sec: false },
              { label: 'PASSWORD (8+ chars)', value: password, set: setPassword, ph: 'Set a password', kb: 'default' as const, sec: true },
              { label: 'CONFIRM PASSWORD', value: confirm, set: setConfirm, ph: 'Repeat password', kb: 'default' as const, sec: true },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: SPACING.base }}>
                <Text style={s.label}>{f.label}</Text>
                <TextInput
                  style={[s.input, f.label === 'CONFIRM PASSWORD' && confirm && password !== confirm && { borderColor: COLORS.error }]}
                  placeholder={f.ph} placeholderTextColor={COLORS.textMuted}
                  value={f.value} onChangeText={f.set}
                  keyboardType={f.kb} secureTextEntry={f.sec} autoCapitalize="none"
                />
                {f.label === 'CONFIRM PASSWORD' && confirm && password !== confirm && (
                  <Text style={{ color: COLORS.error, fontSize: SIZES.xs, marginTop: 4 }}>Passwords do not match</Text>
                )}
              </View>
            ))}

            <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handle} disabled={loading}>
              <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Register</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={s.terms}>By registering you agree to our Terms and Privacy Policy</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  sub: { fontSize: SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border },
  label: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginBottom: SPACING.xs, letterSpacing: 0.8 },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, fontSize: SIZES.base, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  btn: { borderRadius: RADIUS.md, overflow: 'hidden', marginTop: SPACING.md },
  btnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: SIZES.base, fontWeight: '700', color: '#fff', letterSpacing: 1 },
  terms: { textAlign: 'center', marginTop: SPACING.base, fontSize: SIZES.xs, color: COLORS.textMuted, lineHeight: 18 },
});
`);

// ── app/(auth)/verify.tsx ─────────────────────────────────────────────────────
write('app/(auth)/verify.tsx', `import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function VerifyScreen() {
  return (
    <View style={s.container}>
      <LinearGradient colors={['#1A0508', '#0A0A0A']} style={StyleSheet.absoluteFillObject} />
      <View style={s.content}>
        <View style={s.icon}><Text style={{ fontSize: 50 }}>📬</Text></View>
        <Text style={s.title}>Verify Your Email</Text>
        <Text style={s.desc}>
          We sent a verification link to your edu email.{'\n\n'}
          Click the link in the email to complete registration, then come back to sign in.
        </Text>
        <View style={s.tips}>
          <Text style={s.tipsTitle}>📋 Notes</Text>
          <Text style={s.tip}>• Email may take a few minutes to arrive</Text>
          <Text style={s.tip}>• Check your spam folder</Text>
          <Text style={s.tip}>• Verification link expires in 24 hours</Text>
        </View>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/(auth)/login')}>
          <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnGrad}>
            <Text style={s.btnText}>Already Verified, Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, alignItems: 'center' },
  icon: { width: 100, height: 100, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
  title: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.base, textAlign: 'center' },
  desc: { fontSize: SIZES.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: SPACING.xl },
  tips: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, width: '100%', marginBottom: SPACING.xl },
  tipsTitle: { fontSize: SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  tip: { fontSize: SIZES.md, color: COLORS.textSecondary, marginBottom: SPACING.xs, lineHeight: 22 },
  btn: { width: '100%', borderRadius: RADIUS.md, overflow: 'hidden' },
  btnGrad: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: SIZES.base, fontWeight: '700', color: '#fff', letterSpacing: 1 },
});
`);

// ── app/(tabs)/_layout.tsx ────────────────────────────────────────────────────
write('app/(tabs)/_layout.tsx', `import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator, Text } from 'react-native';
import { COLORS } from '../../constants/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Home: '🏠', News: '📢', Events: '📅', Handbook: '📖', Profile: '👤' };
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{icons[label]}</Text>
      <Text style={{ fontSize: 10, color: focused ? COLORS.primary : COLORS.textMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}><ActivityIndicator color={COLORS.primary} /></View>;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border, borderTopWidth: 1, height: 70, paddingBottom: 0 }, tabBarShowLabel: false }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} /> }} />
      <Tabs.Screen name="news" options={{ tabBarIcon: ({ focused }) => <TabIcon label="News" focused={focused} /> }} />
      <Tabs.Screen name="events" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Events" focused={focused} /> }} />
      <Tabs.Screen name="handbook" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Handbook" focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon label="Profile" focused={focused} /> }} />
    </Tabs>
  );
}
`);

// ── app/(tabs)/index.tsx (Home) ────────────────────────────────────────────────
write('app/(tabs)/index.tsx', `import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Article = { id: string; title: string; summary: string | null; category: string; created_at: string };
type Event = { id: string; title: string; location: string | null; start_time: string };

export default function HomeScreen() {
  const { profile } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('articles').select('id,title,summary,category,created_at').eq('is_published', true).order('created_at', { ascending: false }).limit(5),
      supabase.from('events').select('id,title,location,start_time').eq('is_published', true).gte('start_time', new Date().toISOString()).order('start_time').limit(3),
    ]);
    setArticles(a || []);
    setEvents(e || []);
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const catColor: Record<string, string> = { notice: '#EF4444', news: '#3B82F6', event_news: '#10B981', general: '#6B7280' };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Hello, {profile?.name || 'Student'} 👋</Text>
            <Text style={s.tagline}>Student Union Official Platform</Text>
          </View>
          <View style={s.badge}><Text style={{ fontSize: 24 }}>🎓</Text></View>
        </View>

        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /> : (
          <>
            {/* Upcoming Events */}
            {events.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>📅 Upcoming Events</Text>
                {events.map(ev => (
                  <View key={ev.id} style={s.eventCard}>
                    <View style={s.eventDate}>
                      <Text style={s.eventDay}>{new Date(ev.start_time).getDate()}</Text>
                      <Text style={s.eventMon}>{new Date(ev.start_time).toLocaleDateString('en', { month: 'short' })}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.eventTitle} numberOfLines={2}>{ev.title}</Text>
                      {ev.location && <Text style={s.eventLoc}>📍 {ev.location}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Latest News */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>📢 Latest Announcements</Text>
              {articles.map(a => (
                <TouchableOpacity key={a.id} style={s.articleCard} activeOpacity={0.8}>
                  <View style={[s.catDot, { backgroundColor: catColor[a.category] || '#6B7280' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.articleTitle} numberOfLines={2}>{a.title}</Text>
                    {a.summary && <Text style={s.articleSummary} numberOfLines={1}>{a.summary}</Text>}
                    <Text style={s.articleDate}>{new Date(a.created_at).toLocaleDateString()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, paddingBottom: SPACING.md },
  greeting: { fontSize: SIZES.xl, fontWeight: '700', color: COLORS.textPrimary },
  tagline: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 2 },
  badge: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  eventDate: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  eventDay: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.primary },
  eventMon: { fontSize: SIZES.xs, color: COLORS.primary },
  eventTitle: { fontSize: SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 20 },
  eventLoc: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  articleCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.sm },
  catDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  articleTitle: { fontSize: SIZES.sm, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 20 },
  articleSummary: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  articleDate: { fontSize: SIZES.xs, color: COLORS.textMuted, marginTop: 4 },
});
`);

// ── app/(tabs)/news.tsx ────────────────────────────────────────────────────────
write('app/(tabs)/news.tsx', `import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Article = { id: string; title: string; summary: string | null; category: string; view_count: number; created_at: string };
const CATS = [{ k: 'all', l: 'All' }, { k: 'notice', l: 'Notices' }, { k: 'news', l: 'News' }, { k: 'event_news', l: 'Events' }];
const catColor: Record<string, string> = { notice: '#EF4444', news: '#3B82F6', event_news: '#10B981', general: '#6B7280' };

export default function NewsScreen() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { fetch(); }, [cat]);

  async function fetch() {
    setLoading(true);
    let q = supabase.from('articles').select('id,title,summary,category,view_count,created_at').eq('is_published', true).order('created_at', { ascending: false });
    if (cat !== 'all') q = q.eq('category', cat);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await fetch(); setRefreshing(false); }
  const filtered = items.filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Announcements</Text>
        <TextInput style={s.search} placeholder="Search..." placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
        <View style={s.filterRow}>
          {CATS.map(c => (
            <TouchableOpacity key={c.k} style={[s.filterBtn, cat === c.k && s.filterBtnOn]} onPress={() => setCat(c.k)}>
              <Text style={[s.filterTxt, cat === c.k && { color: '#fff' }]}>{c.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {loading ? <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} /> : (
        <FlatList data={filtered} keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No announcements found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} activeOpacity={0.8}>
              <View style={s.cardTop}>
                <View style={[s.catBadge, { backgroundColor: (catColor[item.category] || '#6B7280') + '22' }]}>
                  <Text style={[s.catTxt, { color: catColor[item.category] || '#6B7280' }]}>{item.category.toUpperCase()}</Text>
                </View>
                <Text style={s.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={s.cardTitle}>{item.title}</Text>
              {item.summary && <Text style={s.cardSum} numberOfLines={2}>{item.summary}</Text>}
              <Text style={s.views}>👀 {item.view_count}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  search: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: SIZES.sm, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  filterRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  filterBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterTxt: { fontSize: SIZES.xs, fontWeight: '500', color: COLORS.textSecondary },
  list: { padding: SPACING.lg, gap: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  catBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  catTxt: { fontSize: SIZES.xs, fontWeight: '600' },
  date: { fontSize: SIZES.xs, color: COLORS.textMuted },
  cardTitle: { fontSize: SIZES.base, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.xs, lineHeight: 22 },
  cardSum: { fontSize: SIZES.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  views: { fontSize: SIZES.xs, color: COLORS.textMuted },
});
`);

// ── app/(tabs)/events.tsx ─────────────────────────────────────────────────────
write('app/(tabs)/events.tsx', `import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Event = { id: string; title: string; description: string; location: string | null; start_time: string; end_time: string; max_participants: number | null; registration_deadline: string | null };

export default function EventsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: ev }, { data: reg }] = await Promise.all([
      supabase.from('events').select('*').eq('is_published', true).order('start_time'),
      user ? supabase.from('event_registrations').select('event_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    ]);
    setEvents(ev || []);
    setRegistered(new Set((reg || []).map((r: any) => r.event_id)));
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  async function toggleReg(eventId: string) {
    if (!user) return;
    if (registered.has(eventId)) {
      await supabase.from('event_registrations').delete().eq('event_id', eventId).eq('user_id', user.id);
      setRegistered(prev => { const s = new Set(prev); s.delete(eventId); return s; });
      Alert.alert('Cancelled', 'Registration cancelled');
    } else {
      const { error } = await supabase.from('event_registrations').insert({ event_id: eventId, user_id: user.id });
      if (error) Alert.alert('Error', error.message);
      else { setRegistered(prev => new Set([...prev, eventId])); Alert.alert('Success', 'You are registered!'); }
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}><Text style={s.title}>Events</Text></View>
      {loading ? <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} /> : (
        <FlatList data={events} keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={s.list}
          ListEmptyComponent={<Text style={s.empty}>No upcoming events</Text>}
          renderItem={({ item }) => {
            const isReg = registered.has(item.id);
            const past = new Date(item.start_time) < new Date();
            return (
              <View style={s.card}>
                <Text style={s.cardTitle}>{item.title}</Text>
                {item.location && <Text style={s.meta}>📍 {item.location}</Text>}
                <Text style={s.meta}>🗓 {fmt(item.start_time)}</Text>
                {item.registration_deadline && <Text style={s.meta}>⏰ Register by: {new Date(item.registration_deadline).toLocaleDateString()}</Text>}
                <Text style={s.desc} numberOfLines={3}>{item.description}</Text>
                {!past && (
                  <TouchableOpacity style={[s.regBtn, isReg && s.regBtnOn]} onPress={() => toggleReg(item.id)}>
                    <Text style={[s.regTxt, isReg && s.regTxtOn]}>{isReg ? '✓ Registered — Cancel' : 'Register Now'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary },
  list: { padding: SPACING.lg, gap: SPACING.md },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  meta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: 4 },
  desc: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 20 },
  regBtn: { marginTop: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: SPACING.sm, alignItems: 'center' },
  regBtnOn: { backgroundColor: COLORS.primarySoft },
  regTxt: { fontSize: SIZES.sm, fontWeight: '600', color: COLORS.primary },
  regTxtOn: { color: COLORS.primary },
});
`);

// ── app/(tabs)/handbook.tsx ───────────────────────────────────────────────────
write('app/(tabs)/handbook.tsx', `import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Chapter = { id: string; title: string; order_index: number; content_type: string; content_body: string | null; parent_id: string | null };

export default function HandbookScreen() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selected, setSelected] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('handbook_chapters').select('*').eq('is_published', true).order('order_index').then(({ data }) => {
      setChapters(data || []);
      setLoading(false);
    });
  }, []);

  const roots = chapters.filter(c => !c.parent_id);
  const children = (id: string) => chapters.filter(c => c.parent_id === id);

  if (selected) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <TouchableOpacity style={s.back} onPress={() => setSelected(null)}>
          <Text style={{ color: COLORS.primary, fontSize: SIZES.md }}>← Back</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          <Text style={s.articleTitle}>{selected.title}</Text>
          <Text style={s.articleBody}>{selected.content_body || 'No content available.'}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}><Text style={s.title}>Student Handbook</Text></View>
      {loading ? <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} /> : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
          {roots.map(root => (
            <View key={root.id} style={s.section}>
              <View style={s.rootCard}>
                <Text style={s.rootTitle}>📂 {root.title}</Text>
              </View>
              {children(root.id).map(ch => (
                <TouchableOpacity key={ch.id} style={s.childCard} onPress={() => setSelected(ch)}>
                  <Text style={s.childTitle}>📄 {ch.title}</Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {roots.length === 0 && <Text style={s.empty}>No handbook content yet</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary },
  section: { marginBottom: SPACING.lg },
  rootCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.primary, marginBottom: SPACING.sm },
  rootTitle: { fontSize: SIZES.base, fontWeight: '700', color: COLORS.primary },
  childCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  childTitle: { fontSize: SIZES.sm, color: COLORS.textPrimary, flex: 1 },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
  back: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  articleTitle: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  articleBody: { fontSize: SIZES.base, color: COLORS.textSecondary, lineHeight: 26 },
});
`);

// ── app/(tabs)/profile.tsx ────────────────────────────────────────────────────
write('app/(tabs)/profile.tsx', `import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLORS, SIZES, SPACING, RADIUS } from '../../constants/theme';

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [studentId, setStudentId] = useState(profile?.student_id || '');
  const [faculty, setFaculty] = useState(profile?.faculty || '');
  const [major, setMajor] = useState(profile?.major || '');

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ name, student_id: studentId, faculty, major }).eq('id', user!.id);
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else { await refreshProfile(); setEditing(false); Alert.alert('Saved', 'Profile updated successfully'); }
  }

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  const roleLabel = { super_admin: 'Super Admin', admin: 'Admin', student: 'Student' }[profile?.role || 'student'];
  const initial = (profile?.name || user?.email || '?')[0].toUpperCase();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A0508', '#0A0A0A']} style={s.headerBg}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{initial}</Text></View>
          <Text style={s.name}>{profile?.name || 'Student'}</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={s.rolePill}><Text style={s.roleTxt}>{roleLabel}</Text></View>
        </LinearGradient>

        <View style={s.content}>
          {editing ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Edit Profile</Text>
              {[
                { label: 'Name', val: name, set: setName },
                { label: 'Student ID', val: studentId, set: setStudentId },
                { label: 'Faculty', val: faculty, set: setFaculty },
                { label: 'Major', val: major, set: setMajor },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: SPACING.sm }}>
                  <Text style={s.label}>{f.label.toUpperCase()}</Text>
                  <TextInput style={s.input} value={f.val} onChangeText={f.set} placeholderTextColor={COLORS.textMuted} placeholder={f.label} />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={{ color: COLORS.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>My Info</Text>
              {[
                { label: 'Name', val: profile?.name },
                { label: 'Student ID', val: profile?.student_id },
                { label: 'Faculty', val: profile?.faculty },
                { label: 'Major', val: profile?.major },
                { label: 'Campus', val: profile?.campus },
              ].map(row => (
                <View key={row.label} style={s.row}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                  <Text style={s.rowVal}>{row.val || '—'}</Text>
                </View>
              ))}
              <TouchableOpacity style={s.editBtn} onPress={() => { setName(profile?.name || ''); setStudentId(profile?.student_id || ''); setFaculty(profile?.faculty || ''); setMajor(profile?.major || ''); setEditing(true); }}>
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={s.signOutBtn} onPress={confirmSignOut}>
            <Text style={s.signOutTxt}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBg: { alignItems: 'center', paddingTop: SPACING.xl, paddingBottom: SPACING.xxl },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md, borderWidth: 3, borderColor: COLORS.primaryLight },
  avatarTxt: { fontSize: 36, fontWeight: '700', color: '#fff' },
  name: { fontSize: SIZES.xxl, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  email: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  rolePill: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.primary },
  roleTxt: { fontSize: SIZES.xs, fontWeight: '600', color: COLORS.primary, letterSpacing: 1 },
  content: { padding: SPACING.lg },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.lg },
  cardTitle: { fontSize: SIZES.md, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { fontSize: SIZES.sm, color: COLORS.textSecondary },
  rowVal: { fontSize: SIZES.sm, color: COLORS.textPrimary },
  editBtn: { marginTop: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: SPACING.sm, alignItems: 'center' },
  label: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginBottom: 4, letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: SIZES.sm, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  cancelBtn: { flex: 1, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveBtn: { flex: 1, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, paddingVertical: SPACING.sm, alignItems: 'center' },
  signOutBtn: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.error, paddingVertical: SPACING.base, alignItems: 'center' },
  signOutTxt: { fontSize: SIZES.base, fontWeight: '600', color: COLORS.error },
});
`);

console.log('\n✅ All files written successfully!');
