const fs = require('fs');
const path = require('path');

const APP = 'i:/PARTTIME/AG/student-app/app';

const files = {
  '(auth)/login.tsx': `import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from "../../constants/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Tips", "Please enter email and password");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert("Login failed", error.message === "Invalid login credentials" ? "Wrong email or password" : error.message);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1A0508", "#0F0F0F"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.accentCircle} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoContainer}><Text style={styles.logoEmoji}>{"\\u{1f393}"}</Text></View>
            <Text style={styles.appName}>Student Union</Text>
            <Text style={styles.subtitle}>Official Student Union Platform</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in with your edu email</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EDU EMAIL</Text>
              <TextInput style={styles.input} placeholder="your.name@stu.edu.cn" placeholderTextColor={COLORS.textMuted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="Enter password" placeholderTextColor={COLORS.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete="password" />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={styles.eyeText}>{showPassword ? "\\u{1f648}" : "\\u{1f441}\\ufe0f"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={[styles.loginButton, loading && styles.loginButtonDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginGradient}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>SIGN IN</Text>}
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>No account?</Text>
              <View style={styles.dividerLine} />
            </View>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.registerButton} activeOpacity={0.8}>
                <Text style={styles.registerButtonText}>Create Account</Text>
              </TouchableOpacity>
            </Link>
          </View>
          <Text style={styles.footer}>For enrolled students with a valid edu email only</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  accentCircle: { position: "absolute", top: -120, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: COLORS.primary, opacity: 0.08 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingTop: 80, paddingBottom: 40, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: SPACING.xxl },
  logoContainer: { width: 80, height: 80, borderRadius: RADIUS.lg, backgroundColor: COLORS.primarySoft, justifyContent: "center", alignItems: "center", marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.primary },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: SIZES.xxxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, letterSpacing: 2 },
  subtitle: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: SPACING.xs },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: SIZES.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  cardSubtitle: { fontSize: SIZES.md, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  inputGroup: { marginBottom: SPACING.base },
  label: { fontSize: SIZES.sm, fontFamily: FONTS.medium, color: COLORS.textSecondary, marginBottom: SPACING.xs, letterSpacing: 0.8 },
  input: { backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, paddingHorizontal: SPACING.base, paddingVertical: SPACING.md, fontSize: SIZES.base, fontFamily: FONTS.regular, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  eyeButton: { padding: SPACING.sm, backgroundColor: COLORS.surfaceElevated, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, height: 52, justifyContent: "center" },
  eyeText: { fontSize: 18 },
  loginButton: { borderRadius: RADIUS.md, overflow: "hidden", marginTop: SPACING.md },
  loginButtonDisabled: { opacity: 0.6 },
  loginGradient: { paddingVertical: SPACING.base, alignItems: "center", justifyContent: "center", height: 52 },
  loginButtonText: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: "#FFFFFF", letterSpacing: 3 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: SPACING.lg, gap: SPACING.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textMuted },
  registerButton: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: SPACING.md, alignItems: "center" },
  registerButtonText: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, color: COLORS.primary },
  footer: { textAlign: "center", marginTop: SPACING.xl, fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
`,

  '(auth)/verify.tsx': `import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from "../../constants/theme";

export default function VerifyScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1A0508", "#0F0F0F"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{"\\u{1f4ec}"}</Text>
        </View>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.description}>
          We sent a verification link to your edu email.{"\n\n"}
          Click the link in the email to complete registration, then come back to sign in.
        </Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>{"\\u{1f4cb}"} Notes</Text>
          <Text style={styles.tipText}>{"\\u2022"} Email may take a few minutes to arrive</Text>
          <Text style={styles.tipText}>{"\\u2022"} Check your spam folder</Text>
          <Text style={styles.tipText}>{"\\u2022"} Verification link expires in 24 hours</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.85}>
          <LinearGradient colors={[COLORS.primaryLight, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
            <Text style={styles.buttonText}>Already verified, Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: SPACING.xl, alignItems: "center" },
  iconContainer: { width: 100, height: 100, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, justifyContent: "center", alignItems: "center", marginBottom: SPACING.xl },
  icon: { fontSize: 50 },
  title: { fontSize: SIZES.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.base, textAlign: "center" },
  description: { fontSize: SIZES.base, fontFamily: FONTS.regular, color: COLORS.textSecondary, textAlign: "center", lineHeight: 24, marginBottom: SPACING.xl },
  tipCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, width: "100%", marginBottom: SPACING.xl },
  tipTitle: { fontSize: SIZES.md, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  tipText: { fontSize: SIZES.md, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginBottom: SPACING.xs, lineHeight: 22 },
  button: { width: "100%", borderRadius: RADIUS.md, overflow: "hidden" },
  buttonGradient: { paddingVertical: SPACING.base, alignItems: "center", height: 52, justifyContent: "center" },
  buttonText: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: "#FFFFFF", letterSpacing: 1 },
});
`,

  '(tabs)/announcements.tsx': `import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from "../../constants/theme";

type Article = { id: string; title: string; summary: string | null; category: string; cover_image: string | null; view_count: number; created_at: string; };

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "notice", label: "Notices" },
  { key: "news", label: "News" },
  { key: "event_news", label: "Events" },
];

export default function AnnouncementsScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { fetchArticles(); }, [category]);

  async function fetchArticles() {
    setLoading(true);
    let query = supabase.from("articles").select("id,title,summary,category,cover_image,view_count,created_at").eq("is_published", true).order("created_at", { ascending: false });
    if (category !== "all") query = query.eq("category", category);
    const { data } = await query;
    setArticles(data || []);
    setLoading(false);
  }

  async function onRefresh() { setRefreshing(true); await fetchArticles(); setRefreshing(false); }

  const filtered = articles.filter(a => !search || a.title.toLowerCase().includes(search.toLowerCase()));

  const categoryColor: Record<string, string> = { notice: "#EF4444", news: "#3B82F6", event_news: "#10B981", general: "#6B7280" };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements</Text>
        <TextInput style={styles.searchInput} placeholder="Search..." placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
        <View style={styles.filterRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.key} style={[styles.filterBtn, category === c.key && styles.filterBtnActive]} onPress={() => setCategory(c.key)}>
              <Text style={[styles.filterText, category === c.key && styles.filterTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No announcements found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.categoryBadge, { backgroundColor: categoryColor[item.category] + "22" }]}>
                  <Text style={[styles.categoryText, { color: categoryColor[item.category] }]}>{item.category.toUpperCase()}</Text>
                </View>
                <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.summary && <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>}
              <Text style={styles.viewCount}>{"\\u{1f440}"} {item.view_count} views</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: SIZES.xxl, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  searchInput: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  filterRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: SIZES.xs, fontFamily: FONTS.medium, color: COLORS.textSecondary },
  filterTextActive: { color: "#fff" },
  list: { padding: SPACING.lg, gap: SPACING.md },
  empty: { textAlign: "center", color: COLORS.textMuted, fontFamily: FONTS.regular, marginTop: SPACING.xxl },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.sm },
  categoryBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  categoryText: { fontSize: SIZES.xs, fontFamily: FONTS.semiBold, letterSpacing: 0.5 },
  dateText: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
  cardTitle: { fontSize: SIZES.base, fontFamily: FONTS.semiBold, color: COLORS.textPrimary, marginBottom: SPACING.xs, lineHeight: 22 },
  cardSummary: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  viewCount: { fontSize: SIZES.xs, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
`,
};

let allOk = true;
for (const [rel, content] of Object.entries(files)) {
  const fullPath = path.join(APP.replace(/\//g, path.sep), rel.replace(/\//g, path.sep));
  try {
    fs.writeFileSync(fullPath, content, { encoding: 'utf8' });
    console.log('OK:', rel);
  } catch(e) {
    console.error('FAIL:', rel, e.message);
    allOk = false;
  }
}
console.log(allOk ? 'All files written successfully!' : 'Some files failed!');
