import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getAllowedSignupDomains, FALLBACK_SIGNUP_DOMAINS } from '../../lib/signupDomains';
export default function SupportedEmailDomainsScreen() {
  const { colors } = useTheme(); const [domains, setDomains] = useState(FALLBACK_SIGNUP_DOMAINS); const [loading, setLoading] = useState(true);
  useEffect(() => { getAllowedSignupDomains().then(setDomains).finally(() => setLoading(false)); }, []);
  const groups = domains.reduce<Record<string, string[]>>((out, item) => { (out[item.institution] ||= []).push(item.domain); return out; }, {});
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><View style={[styles.header, { borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} /></Pressable><Text style={[styles.title, { color: colors.textPrimary }]}>支持的邮箱域名</Text><View style={styles.placeholder} /></View><ScrollView contentContainerStyle={styles.content}><Text style={[styles.intro, { color: colors.textPrimary }]}>目前支持的邮箱域名：</Text>{loading ? <ActivityIndicator color={colors.primary} /> : Object.entries(groups).map(([institution, items]) => <View key={institution} style={styles.group}><Text style={[styles.institution, { color: colors.textPrimary }]}>{institution}</Text>{items.map((domain) => <Text key={domain} style={[styles.domain, { color: colors.textSecondary }]}>-@{domain}</Text>)}</View>)}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, header: { height: 56, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }, back: { padding: 8 }, placeholder: { width: 40 }, title: { fontSize: 18, fontWeight: '700' }, content: { padding: 24 }, intro: { fontSize: 18, fontWeight: '700', marginBottom: 24 }, group: { marginBottom: 24 }, institution: { fontSize: 16, fontWeight: '700', marginBottom: 8 }, domain: { fontSize: 15, lineHeight: 28 } });
