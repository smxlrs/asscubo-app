import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS } from '../../constants/theme';

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

export default function EventsScreen() {
  const { user } = useAuth();
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

    // Check user registrations
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

  useEffect(() => { fetchEvents(); }, [user]); // Re-fetch user status when auth state changes

  async function handleRegister(eventId: string, isRegistered: boolean) {
    if (!user) {
      Alert.alert(
        '请先登录',
        '报名参加活动需要先登录您的账号。',
        [
          { text: '取消', style: 'cancel' },
          { text: '去登录', onPress: () => router.push('/(auth)/login') }
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
        Alert.alert('已取消', '已成功取消报名');
      }
    } else {
      const { error } = await supabase
        .from('event_registrations')
        .upsert({ event_id: eventId, user_id: user.id, status: 'confirmed' });
      if (!error) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, _user_registered: true } : e));
        Alert.alert('报名成功 🎉', '已成功报名，请按时参加活动！');
      } else if (error.code === '23505') {
        Alert.alert('提示', '您已经报名过此活动了');
      }
    }
    setRegistering(null);
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function isPast(dateStr: string) {
    return new Date(dateStr) < new Date();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 活动中心</Text>
        <Text style={styles.subtitle}>报名参加学联活动，丰富校园生活</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyText}>暂无活动，敬请期待</Text>
            </View>
          }
          renderItem={({ item }) => {
            const past = isPast(item.end_time);
            return (
              <View style={[styles.card, past && styles.cardPast]}>
                {past && (
                  <View style={styles.pastBanner}>
                    <Text style={styles.pastText}>已结束</Text>
                  </View>
                )}
                {item._user_registered && !past && (
                  <View style={styles.registeredBadge}>
                    <Text style={styles.registeredText}>✓ 已报名</Text>
                  </View>
                )}
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoText}>🕐 {formatDateTime(item.start_time)}</Text>
                </View>
                {item.location && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>📍 {item.location}</Text>
                  </View>
                )}
                {item.max_participants && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>👥 限额 {item.max_participants} 人</Text>
                  </View>
                )}
                {!past && (
                  <TouchableOpacity
                    style={[
                      styles.registerBtn,
                      item._user_registered && styles.unregisterBtn,
                    ]}
                    onPress={() => handleRegister(item.id, !!item._user_registered)}
                    disabled={registering === item.id}
                    activeOpacity={0.85}
                  >
                    {registering === item.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.registerBtnText}>
                        {item._user_registered ? '取消报名' : '立即报名'}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.base, paddingBottom: SPACING.base },
  title: { fontSize: SIZES.xl, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  subtitle: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 20 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
    overflow: 'hidden',
  },
  cardPast: { opacity: 0.6 },
  pastBanner: {
    position: 'absolute',
    top: 12,
    right: -20,
    backgroundColor: COLORS.textMuted,
    paddingHorizontal: 28,
    paddingVertical: 3,
    transform: [{ rotate: '35deg' }],
  },
  pastText: { fontSize: SIZES.xs, fontFamily: FONTS.bold, color: '#FFF' },
  registeredBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.success + '25',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  registeredText: { fontSize: SIZES.xs, fontFamily: FONTS.bold, color: COLORS.success },
  cardTitle: { fontSize: SIZES.base, fontFamily: FONTS.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  cardDesc: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary, lineHeight: 18, marginBottom: SPACING.sm },
  infoRow: { flexDirection: 'row', marginBottom: 4 },
  infoText: { fontSize: SIZES.sm, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  registerBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  unregisterBtn: { backgroundColor: COLORS.surfaceElevated, borderWidth: 1, borderColor: COLORS.border },
  registerBtnText: { fontSize: SIZES.sm, fontFamily: FONTS.bold, color: '#FFFFFF' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: { fontSize: SIZES.base, fontFamily: FONTS.regular, color: COLORS.textMuted },
});
