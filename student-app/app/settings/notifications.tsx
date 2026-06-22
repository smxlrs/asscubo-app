import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const PREFS_KEYS = {
  globalEnabled: '@ag_notification_global',
  dndEnabled: '@ag_notification_dnd',
  soundEnabled: '@ag_notification_sound',
  vibrationEnabled: '@ag_notification_vibration',
  events: '@ag_notification_events',
  academic: '@ag_notification_academic',
  life: '@ag_notification_life',
  general: '@ag_notification_general',
  articles: '@ag_notification_articles',
};

export default function NotificationSettingsScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const [preferences, setPreferences] = useState({
    globalEnabled: true,
    dndEnabled: false,
    soundEnabled: true,
    vibrationEnabled: true,
    events: true,
    academic: true,
    life: true,
    general: true,
    articles: true,
  });

  useEffect(() => {
    async function loadPreferences() {
      try {
        const stored = await Promise.all([
          AsyncStorage.getItem(PREFS_KEYS.globalEnabled),
          AsyncStorage.getItem(PREFS_KEYS.dndEnabled),
          AsyncStorage.getItem(PREFS_KEYS.soundEnabled),
          AsyncStorage.getItem(PREFS_KEYS.vibrationEnabled),
          AsyncStorage.getItem(PREFS_KEYS.events),
          AsyncStorage.getItem(PREFS_KEYS.academic),
          AsyncStorage.getItem(PREFS_KEYS.life),
          AsyncStorage.getItem(PREFS_KEYS.general),
          AsyncStorage.getItem(PREFS_KEYS.articles),
        ]);

        const loadedPrefs = {
          globalEnabled: stored[0] !== 'false',
          dndEnabled: stored[1] === 'true',
          soundEnabled: stored[2] !== 'false',
          vibrationEnabled: stored[3] !== 'false',
          events: stored[4] !== 'false',
          academic: stored[5] !== 'false',
          life: stored[6] !== 'false',
          general: stored[7] !== 'false',
          articles: stored[8] !== 'false',
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

  const toggleSwitch = async (category: keyof typeof preferences) => {
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

  const isDimmable = (category: keyof typeof preferences) => {
    return !preferences.globalEnabled && category !== 'globalEnabled';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>通知设置</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section 1: General Notification Settings */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>基础通知管理</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Global Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>允许接收推送</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>开启后可接收学联发送的重要通知消息</Text>
            </View>
            <Switch
              value={preferences.globalEnabled}
              onValueChange={() => toggleSwitch('globalEnabled')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.globalEnabled ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* DND Switch */}
          <View style={[styles.row, isDimmable('dndEnabled') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>夜间免打扰模式</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>22:00 至次日 08:00 期间自动静音推送消息</Text>
            </View>
            <Switch
              disabled={isDimmable('dndEnabled')}
              value={preferences.dndEnabled}
              onValueChange={() => toggleSwitch('dndEnabled')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.dndEnabled && !isDimmable('dndEnabled') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Section 2: WeChat Articles Notification */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>微信文章通知</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Articles Switch */}
          <View style={[styles.row, isDimmable('articles') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="newspaper-variant-outline" size={22} color="#07C160" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>文章通知</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>微信公众号文章等精选长文更新通知</Text>
            </View>
            <Switch
              disabled={isDimmable('articles')}
              value={preferences.articles}
              onValueChange={() => toggleSwitch('articles')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.articles && !isDimmable('articles') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Section 3: Subscription Categories */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>消息类别订阅</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Events Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, isDimmable('events') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="calendar-star" size={22} color="#EF4444" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>学联活动</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>包括讲座、晚会、出游、聚餐等活动通知</Text>
            </View>
            <Switch
              disabled={isDimmable('events')}
              value={preferences.events}
              onValueChange={() => toggleSwitch('events')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.events && !isDimmable('events') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* Academic Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, isDimmable('academic') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="book-open-variant" size={22} color="#3B82F6" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>学术资讯</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>包括博大考试日历、教务指南、学术公告</Text>
            </View>
            <Switch
              disabled={isDimmable('academic')}
              value={preferences.academic}
              onValueChange={() => toggleSwitch('academic')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.academic && !isDimmable('academic') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* Life Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, isDimmable('life') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="compass-outline" size={22} color="#10B981" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>生活辅助</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>包括租房防骗、吃喝玩乐、生活指南与问答</Text>
            </View>
            <Switch
              disabled={isDimmable('life')}
              value={preferences.life}
              onValueChange={() => toggleSwitch('life')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.life && !isDimmable('life') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* General Switch */}
          <View style={[styles.row, isDimmable('general') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="bulletin-board" size={22} color="#F59E0B" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>综合通知</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>学联日常通告、平台更新与其他重要事务</Text>
            </View>
            <Switch
              disabled={isDimmable('general')}
              value={preferences.general}
              onValueChange={() => toggleSwitch('general')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.general && !isDimmable('general') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Section 4: Alert Types */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>提醒方式设置</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Sound Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, isDimmable('soundEnabled') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="volume-high" size={22} color="#14B8A6" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>声音提示</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>接收通知时播放提示音</Text>
            </View>
            <Switch
              disabled={isDimmable('soundEnabled')}
              value={preferences.soundEnabled}
              onValueChange={() => toggleSwitch('soundEnabled')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.soundEnabled && !isDimmable('soundEnabled') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>

          {/* Vibration Switch */}
          <View style={[styles.row, isDimmable('vibrationEnabled') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="vibrate" size={22} color="#6366F1" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>震动提示</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>接收通知时进行物理震动提醒</Text>
            </View>
            <Switch
              disabled={isDimmable('vibrationEnabled')}
              value={preferences.vibrationEnabled}
              onValueChange={() => toggleSwitch('vibrationEnabled')}
              trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
              thumbColor={preferences.vibrationEnabled && !isDimmable('vibrationEnabled') ? colors.primaryLight : '#F3F4F6'}
            />
          </View>
        </View>
        
        <Text style={styles.hintText}>
          提示：关闭消息推送主开关后，分类订阅与提醒设置将自动失效并静默。
        </Text>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 24,
  },
  sectionHeaderContainer: {
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disabledRow: {
    opacity: 0.4,
  },
  iconWrapper: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  labelCol: {
    flex: 1,
    paddingRight: 16,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSubLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  hintText: {
    fontSize: 11,
    color: '#8A8A8F',
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: 20,
    textAlign: 'center',
  },
});
