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

const LOCALIZED = {
  zh: {
    headerTitle: '通知设置',
    sectionBase: '基础通知管理',
    globalLabel: '允许接收推送',
    globalSub: '开启后可接收学联发送的重要通知消息',
    dndLabel: '夜间免打扰模式',
    dndSub: '22:00 至次日 08:00 期间自动静音推送消息',
    sectionWechat: '微信文章通知',
    articlesLabel: '文章通知',
    articlesSub: '微信公众号文章等精选长文更新通知',
    sectionCategories: '消息类别订阅',
    eventsLabel: '学联活动',
    eventsSub: '包括讲座、晚会、出游、聚餐等活动通知',
    academicLabel: '学术资讯',
    academicSub: '包括博大考试日历、教务指南、学术公告',
    lifeLabel: '生活辅助',
    lifeSub: '包括租房防骗、吃喝玩乐、生活指南与问答',
    generalLabel: '综合通知',
    generalSub: '学联日常通告、平台更新与其他重要事务',
    sectionAlerts: '提醒方式设置',
    soundLabel: '声音提示',
    soundSub: '接收通知时播放提示音',
    vibrateLabel: '震动提示',
    vibrateSub: '接收通知时进行物理震动提醒',
    hint: '提示：关闭消息推送主开关后，分类订阅与提醒设置将自动失效并静默。',
  },
  'zh-Hant': {
    headerTitle: '通知設置',
    sectionBase: '基礎通知管理',
    globalLabel: '允許接收推送',
    globalSub: '開啟後可接收學聯發送的重要通知消息',
    dndLabel: '夜間免打擾模式',
    dndSub: '22:00 至次日 08:00 期間自動靜音推送消息',
    sectionWechat: '微信文章通知',
    articlesLabel: '文章通知',
    articlesSub: '微信公眾號文章等精選長文更新通知',
    sectionCategories: '消息類別訂閱',
    eventsLabel: '學聯活動',
    eventsSub: '包括講座、晚會、出遊、聚餐等活動通知',
    academicLabel: '學術資訊',
    academicSub: '包括博大考試日曆、教務指南、學術公告',
    lifeLabel: '生活輔助',
    lifeSub: '包括租房防騙、吃喝玩樂、生活指南與問答',
    generalLabel: '綜合通知',
    generalSub: '學聯日常通告、平台更新與其他重要事務',
    sectionAlerts: '提醒方式設置',
    soundLabel: '聲音提示',
    soundSub: '接收通知時播放提示音',
    vibrateLabel: '震動提示',
    vibrateSub: '接收通知時進行物理震動提醒',
    hint: '提示：關閉消息推送主開關後，分類訂閱與提醒設置將自動失效並靜默。',
  },
  en: {
    headerTitle: 'Notification Settings',
    sectionBase: 'General Controls',
    globalLabel: 'Allow Push Notifications',
    globalSub: 'Receive important updates and announcements from ASSCUBO',
    dndLabel: 'Do Not Disturb',
    dndSub: 'Mute push notifications automatically between 22:00 and 08:00',
    sectionWechat: 'Articles Notification',
    articlesLabel: 'Article Notifications',
    articlesSub: 'Get updates for select long articles and WeChat newsletters',
    sectionCategories: 'Category Subscription',
    eventsLabel: 'CSSA Events',
    eventsSub: 'Includes notifications for lectures, galas, trips, and parties',
    academicLabel: 'Academic Information',
    academicSub: 'Includes exam calendars, study guides, and academic notices',
    lifeLabel: 'Life & Local Guide',
    lifeSub: 'Includes housing safety guides, eating out, and local FAQs',
    generalLabel: 'General Announcements',
    generalSub: 'Includes daily CSSA notices, app updates, and administrative issues',
    sectionAlerts: 'Alert Style',
    soundLabel: 'Play Sound',
    soundSub: 'Play notification sounds upon receiving messages',
    vibrateLabel: 'Vibrate',
    vibrateSub: 'Vibrate device upon receiving messages',
    hint: 'Notice: If the main switch is disabled, all category subscriptions and alert styles will be muted.',
  },
  it: {
    headerTitle: 'Impostazioni Notifiche',
    sectionBase: 'Controlli Generali',
    globalLabel: 'Consenti Notifiche Push',
    globalSub: 'Ricevi aggiornamenti importanti e annunci da ASSCUBO',
    dndLabel: 'Non Disturbare',
    dndSub: 'Silenzia le notifiche automaticamente dalle 22:00 alle 08:00',
    sectionWechat: 'Notifiche Articoli',
    articlesLabel: 'Notifiche Articoli',
    articlesSub: 'Ricevi aggiornamenti per articoli selezionati e newsletter WeChat',
    sectionCategories: 'Iscrizioni alle Categorie',
    eventsLabel: 'Eventi ASSCUBO',
    eventsSub: 'Notifiche per seminari, feste, gite e cene',
    academicLabel: 'Informazioni Accademiche',
    academicSub: 'Notifiche per calendario esami, guide e avvisi UniBo',
    lifeLabel: 'Guida alla Vita',
    lifeSub: 'Guida per affitti, tempo libero, FAQ e consigli locali',
    generalLabel: 'Annunci Generali',
    generalSub: 'Notifiche per comunicazioni ASSCUBO, aggiornamenti app ed eventi amministrativi',
    sectionAlerts: 'Tipo di Avviso',
    soundLabel: 'Riproduci Suono',
    soundSub: 'Riproduci suono alla ricezione di notifiche',
    vibrateLabel: 'Vibrazione',
    vibrateSub: 'Attiva vibrazione alla ricezione di notifiche',
    hint: 'Nota: se l\'interruttore principale è disattivato, tutte le iscrizioni alle categorie e i tipi di avviso verranno silenziati.',
  }
};

export default function NotificationSettingsScreen() {
  const { colors, isDark, language } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;
  
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
      await AsyncStorage.setItem(PREFS_KEYS[category], String(newValue));

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.headerTitle}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section 1: General Notification Settings */}
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.sectionBase}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Global Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.globalLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.globalSub}</Text>
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
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.dndLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.dndSub}</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.sectionWechat}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Articles Switch */}
          <View style={[styles.row, isDimmable('articles') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="newspaper-variant-outline" size={22} color="#07C160" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.articlesLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.articlesSub}</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.sectionCategories}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Events Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, isDimmable('events') && styles.disabledRow]}>
            <View style={styles.iconWrapper}>
              <MaterialCommunityIcons name="calendar-star" size={22} color="#EF4444" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.eventsLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.eventsSub}</Text>
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
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.academicLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.academicSub}</Text>
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
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.lifeLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.lifeSub}</Text>
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
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.generalLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.generalSub}</Text>
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
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{localized.sectionAlerts}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Sound Switch */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, isDimmable('soundEnabled') && styles.disabledRow]}>
            <View style={iconWrapperStyle(colors.background)}>
              <MaterialCommunityIcons name="volume-high" size={22} color="#14B8A6" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.soundLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.soundSub}</Text>
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
            <View style={iconWrapperStyle(colors.background)}>
              <MaterialCommunityIcons name="vibrate" size={22} color="#6366F1" />
            </View>
            <View style={styles.labelCol}>
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{localized.vibrateLabel}</Text>
              <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{localized.vibrateSub}</Text>
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
        
        <Text style={[styles.hintText, { color: colors.textSecondary }]}>
          {localized.hint}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const iconWrapperStyle = (bgColor: string) => {
  return [styles.iconWrapper, { backgroundColor: 'transparent' }];
};

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
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: 20,
    textAlign: 'center',
  },
});
