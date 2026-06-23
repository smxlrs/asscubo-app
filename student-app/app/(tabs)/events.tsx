import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

type Event = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  cover_image: string | null;
  registration_deadline: string | null;
  _registration_count?: number;
  _user_registered?: boolean;
};

const LOCALIZED = {
  zh: {
    title: '📅 活动中心',
    subtitle: '报名参加学联活动，丰富校园生活',
    noEvents: '暂无活动，敬请期待',
    past: '已结束',
    registered: '✓ 已报名',
    limit: '👥 限额 {limit} 人',
    registerNow: '立即报名',
    cancelRegistration: '取消报名',
    loginRequired: '请先登录',
    loginRequiredDesc: '报名参加活动需要先登录您的账号。',
    cancelSuccess: '已成功取消报名',
    registerSuccess: '已成功报名，请按时参加活动！',
    alreadyRegistered: '您已经报名过此活动了',
    registerSuccessTitle: '报名成功 🎉',
    cancelledTitle: '已取消',
  },
  'zh-Hant': {
    title: '📅 活動中心',
    subtitle: '報名參加學聯活動，豐富校園生活',
    noEvents: '暫無活動，敬請期待',
    past: '已結束',
    registered: '✓ 已報名',
    limit: '👥 限額 {limit} 人',
    registerNow: '立即報名',
    cancelRegistration: '取消報名',
    loginRequired: '請先登錄',
    loginRequiredDesc: '報名參加活動需要先登錄您的帳號。',
    cancelSuccess: '已成功取消報名',
    registerSuccess: '已成功報名，請按時參加活動！',
    alreadyRegistered: '您已經報名過此活動了',
    registerSuccessTitle: '報名成功 🎉',
    cancelledTitle: '已取消',
  },
  en: {
    title: '📅 Events Center',
    subtitle: 'Join CSSA events to enrich your campus life',
    noEvents: 'No events yet, stay tuned!',
    past: 'Ended',
    registered: '✓ Registered',
    limit: '👥 Limit {limit} people',
    registerNow: 'Register Now',
    cancelRegistration: 'Cancel Registration',
    loginRequired: 'Login Required',
    loginRequiredDesc: 'You need to log in to register for this event.',
    cancelSuccess: 'Successfully cancelled registration',
    registerSuccess: 'Successfully registered! Please attend on time.',
    alreadyRegistered: 'You have already registered for this event',
    registerSuccessTitle: 'Registered Successfully 🎉',
    cancelledTitle: 'Cancelled',
  },
  it: {
    title: '📅 Centro Eventi',
    subtitle: 'Partecipa agli eventi ASSCUBO per arricchire la vita universitaria',
    noEvents: 'Nessun evento ancora, resta sintonizzato!',
    past: 'Terminato',
    registered: '✓ Iscritto',
    limit: '👥 Limite {limit} persone',
    registerNow: 'Iscriviti Ora',
    cancelRegistration: 'Annulla Iscrizione',
    loginRequired: 'Accesso Richiesto',
    loginRequiredDesc: 'Devi accedere per iscriverti a questo evento.',
    cancelSuccess: 'Iscrizione annullata con successo',
    registerSuccess: 'Iscritto con successo! Si prega di partecipare in tempo.',
    alreadyRegistered: 'Ti sei già iscritto a questo evento',
    registerSuccessTitle: 'Iscritto con Successo 🎉',
    cancelledTitle: 'Annullato',
  }
};

export default function EventsScreen() {
  const { user } = useAuth();
  const { colors, isDark, t, language } = useTheme();
  const localized = LOCALIZED[language] || LOCALIZED.zh;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);

  async function fetchEvents() {
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('start_time', { ascending: true });

    if (!eventsData) { setLoading(false); return; }

    let myEventIds = new Set<string>();
    if (user) {
      const { data: myRegs } = await supabase
        .from('event_registrations')
        .select('event_id')
        .eq('user_id', user.id)
        .eq('status', 'confirmed');
      myEventIds = new Set(myRegs?.map(r => r.event_id) || []);
    }

    setEvents(eventsData.map(e => ({
      ...e,
      _user_registered: myEventIds.has(e.id),
    })));
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { fetchEvents(); }, [user]);

  async function handleRegister(eventId: string, isRegistered: boolean) {
    if (!user) {
      Alert.alert(
        localized.loginRequired,
        localized.loginRequiredDesc,
        [
          { text: t('cancel') || '取消', style: 'cancel' },
          { text: t('goToLogin') || '去登录', onPress: () => router.push('/(auth)/login') }
        ]
      );
      return;
    }
    setRegistering(eventId);

    if (isRegistered) {
      const { error } = await supabase
        .from('event_registrations')
        .update({ status: 'cancelled' })
        .eq('event_id', eventId)
        .eq('user_id', user.id);
      if (!error) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, _user_registered: false } : e));
        Alert.alert(localized.cancelledTitle, localized.cancelSuccess);
      }
    } else {
      const { error } = await supabase
        .from('event_registrations')
        .upsert({ event_id: eventId, user_id: user.id, status: 'confirmed' });
      if (!error) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, _user_registered: true } : e));
        Alert.alert(localized.registerSuccessTitle, localized.registerSuccess);
      } else if (error.code === '23505') {
        Alert.alert(t('tip') || '提示', localized.alreadyRegistered);
      }
    }
    setRegistering(null);
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    if (language === 'zh' || language === 'zh-Hant') {
      return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    return d.toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', options);
  }

  function isPast(dateStr: string) {
    return new Date(dateStr) < new Date();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{localized.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{localized.subtitle}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{localized.noEvents}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const past = isPast(item.end_time);
            return (
              <View style={[
                styles.card, 
                { backgroundColor: colors.surface, borderColor: colors.border },
                past && styles.cardPast
              ]}>
                {past && (
                  <View style={[styles.pastBanner, { backgroundColor: colors.textMuted }]}>
                    <Text style={styles.pastText}>{localized.past}</Text>
                  </View>
                )}
                {item._user_registered && !past && (
                  <View style={[styles.registeredBadge, { backgroundColor: colors.success + '25' }]}>
                    <Text style={[styles.registeredText, { color: colors.success }]}>{localized.registered}</Text>
                  </View>
                )}
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoText, { color: colors.textSecondary }]}>🕐 {formatDateTime(item.start_time)}</Text>
                </View>
                {item.location && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>📍 {item.location}</Text>
                  </View>
                )}
                {item.max_participants && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                      {localized.limit.replace('{limit}', String(item.max_participants))}
                    </Text>
                  </View>
                )}
                {!past && (
                  <TouchableOpacity
                    style={[
                      styles.registerBtn,
                      { backgroundColor: colors.primary },
                      item._user_registered && [styles.unregisterBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }],
                    ]}
                    onPress={() => handleRegister(item.id, !!item._user_registered)}
                    disabled={registering === item.id}
                    activeOpacity={0.85}
                  >
                    {registering === item.id ? (
                      <ActivityIndicator color={item._user_registered ? colors.textPrimary : "#fff"} size="small" />
                    ) : (
                      <Text style={[
                        styles.registerBtnText, 
                        { color: '#FFFFFF' },
                        item._user_registered && { color: colors.textPrimary }
                      ]}>
                        {item._user_registered ? localized.cancelRegistration : localized.registerNow}
                      </Text>
                    )}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, paddingBottom: SPACING.base },
  title: { fontSize: SIZES.xl, fontFamily: FONTS.bold },
  subtitle: { fontSize: SIZES.sm, fontFamily: FONTS.regular, marginTop: 2 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 20 },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPast: { opacity: 0.6 },
  pastBanner: {
    position: 'absolute',
    top: 12,
    right: -20,
    paddingHorizontal: 28,
    paddingVertical: 3,
    transform: [{ rotate: '35deg' }],
  },
  pastText: { fontSize: SIZES.xs, fontFamily: FONTS.bold, color: '#FFF' },
  registeredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  registeredText: { fontSize: SIZES.xs, fontFamily: FONTS.bold },
  cardTitle: { fontSize: SIZES.base, fontFamily: FONTS.bold, marginBottom: SPACING.xs },
  cardDesc: { fontSize: SIZES.sm, fontFamily: FONTS.regular, lineHeight: 18, marginBottom: SPACING.sm },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoText: { fontSize: SIZES.sm, fontFamily: FONTS.regular },
  registerBtn: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  unregisterBtn: { borderWidth: 1 },
  registerBtnText: { fontSize: SIZES.sm, fontFamily: FONTS.bold },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.base, fontFamily: FONTS.regular },
});
