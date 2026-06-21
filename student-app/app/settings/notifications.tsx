import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

const PREFS_KEYS = {
  events: '@ag_notification_events',
  academic: '@ag_notification_academic',
  life: '@ag_notification_life',
  general: '@ag_notification_general',
};

export default function NotificationSettingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [preferences, setPreferences] = useState({
    events: true,
    academic: true,
    life: true,
    general: true,
  });

  useEffect(() => {
    async function loadPreferences() {
      try {
        const stored = await Promise.all([
          AsyncStorage.getItem(PREFS_KEYS.events),
          AsyncStorage.getItem(PREFS_KEYS.academic),
          AsyncStorage.getItem(PREFS_KEYS.life),
          AsyncStorage.getItem(PREFS_KEYS.general),
        ]);

        const loadedPrefs = {
          events: stored[0] !== 'false',
          academic: stored[1] !== 'false',
          life: stored[2] !== 'false',
          general: stored[3] !== 'false',
        };
        
        setPreferences(loadedPrefs);
      } catch (e) {
        console.warn('Failed to load notification settings:', e);
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const toggleSwitch = async (category: 'events' | 'academic' | 'life' | 'general') => {
    const newValue = !preferences[category];
    const newPrefs = { ...preferences, [category]: newValue };
    setPreferences(newPrefs);

    try {
      // 1. Save to local storage
      await AsyncStorage.setItem(PREFS_KEYS[category], String(newValue));

      // 2. Sync to Supabase profile metadata if logged in
      if (user) {
        await supabase.from('profiles').update({
          notification_preferences: newPrefs,
        }).eq('id', user.id);
      }
    } catch (e) {
      console.warn('Failed to save notification settings change:', e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>通知设置</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>消息类别订阅</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Events Switch */}
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>学联活动</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>包括讲座、晚会、出游、聚餐等活动通知</Text>
            </View>
            <Switch
              value={preferences.events}
              onValueChange={() => toggleSwitch('events')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.events ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* Academic Switch */}
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>学术资讯</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>包括博大考试日历、教务指南、学术公告</Text>
            </View>
            <Switch
              value={preferences.academic}
              onValueChange={() => toggleSwitch('academic')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.academic ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* Life Switch */}
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>生活辅助</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>包括租房防骗、吃喝玩乐、生活指南与问答</Text>
            </View>
            <Switch
              value={preferences.life}
              onValueChange={() => toggleSwitch('life')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.life ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* General Switch */}
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>综合通知</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>学联日常通告、平台更新与其他重要事务</Text>
            </View>
            <Switch
              value={preferences.general}
              onValueChange={() => toggleSwitch('general')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.general ? colors.primaryLight : '#F3F4F6'}
            />
          </View>
        </View>
        
        <Text style={styles.hintText}>
          提示：关闭某一类别通知后，App 将自动屏蔽该类别的离线推送横幅弹窗，避免对您的打扰。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
    marginVertical: 4,
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  labelCol: {
    flex: 1,
    paddingRight: 16,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  rowSubLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  hintText: {
    fontSize: 12,
    color: '#8A8A8F',
    lineHeight: 18,
    paddingHorizontal: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
