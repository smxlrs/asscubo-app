import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type LinkItem = {
  title: string;
  desc: string;
  url: string;
  icon: string;
  color: string;
};

type LinkCategory = {
  title: string;
  items: LinkItem[];
};

export default function UsefulLinksScreen() {
  const { colors, isDark, t } = useTheme();

  const handleOpenLink = async (item: LinkItem) => {
    try {
      const canOpen = await Linking.canOpenURL(item.url);
      if (canOpen) {
        await Linking.openURL(item.url);
      } else {
        Alert.alert('错误', '无法打开此链接');
      }
    } catch (error) {
      console.warn('Failed to open link:', error);
      Alert.alert('错误', '打开链接时发生异常');
    }
  };

  const categories: LinkCategory[] = [
    {
      title: '学联与公共服务',
      items: [
        {
          title: '学联官方网站',
          desc: '博洛尼亚大学中国学联官方服务与资讯平台',
          url: 'https://asscubo.it',
          icon: 'web',
          color: '#A31621',
        },
        {
          title: '学联官方邮箱',
          desc: '向学联反馈建议、咨询合作及获取帮助的官方通道',
          url: 'mailto:unibo@cssui.org',
          icon: 'email-outline',
          color: '#D87A80',
        },
        {
          title: '全意学联官网',
          desc: '意大利中国学生学者联谊会官方网站',
          url: 'https://www.cssui.org/',
          icon: 'flag-outline',
          color: '#0EA5E9',
        },
      ],
    },
    {
      title: '博洛尼亚大学',
      items: [
        {
          title: '博洛尼亚大学官网',
          desc: '博大主页，办理注册、查询课程和学术资讯',
          url: 'https://www.unibo.it',
          icon: 'school-outline',
          color: '#3B82F6',
        },
        {
          title: '国际学生办公室',
          desc: '提供博大入学流程、国际学历评估、签证及居留申请的官方咨询和支持',
          url: 'https://www.unibo.it/it/ateneo/contatti/contatti-per-studentesse-e-studenti-internazionali',
          icon: 'earth',
          color: '#0284C7',
        },
        {
          title: '各专业秘书处',
          desc: '查询和联系博大各个校区及专业学生秘书处（Segreterie Studenti）的官方指南',
          url: 'https://www.unibo.it/it/studiare/iscrizioni-tasse-e-altre-procedure/lauree-e-lauree-magistrali/segreterie-studenti',
          icon: 'account-box-multiple-outline',
          color: '#4F46E5',
        },
        {
          title: 'ER.GO 奖学金官网',
          desc: '艾米利亚-罗马涅大区学生福利、助学金与宿舍申请',
          url: 'https://www.er-go.it',
          icon: 'bank-outline',
          color: '#10B981',
        },
      ],
    },
    {
      title: '生活与居留行政',
      items: [
        {
          title: '意大利居留进度查询',
          desc: '查询警局（Questura）居留卡制作进度的官方平台',
          url: 'https://questure.poliziadistato.it/stranieri/',
          icon: 'card-account-details-outline',
          color: '#F59E0B',
        },
        {
          title: '邮局大信封进度',
          desc: '使用居留信封条形码及密码查询初审和按指纹时间',
          url: 'https://www.portaleimmigrazione.it/eli2immigrazioneweb/pagine/startpage.aspx',
          icon: 'mailbox-outline',
          color: '#EC4899',
        },
        {
          title: '博洛尼亚地区取居留查询与预约',
          desc: '博洛尼亚警局取居留状态查询、补件及相关业务的预约预约平台',
          url: 'https://www.questura.bologna.it/verifica',
          icon: 'calendar-check-outline',
          color: '#3B82F6',
        },
        {
          title: '税务局官网',
          desc: '申请和查询个人税号（Codice Fiscale）等税务信息',
          url: 'https://www.agenziaentrate.gov.it',
          icon: 'calculator',
          color: '#64748B',
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={{
            width: 10,
            height: 10,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: colors.primaryLight,
            transform: [{ rotate: '45deg' }],
            marginHorizontal: 8,
            marginVertical: 4,
          }} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>实用链接</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introHeader}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>便捷服务导航</Text>
          <Text style={[styles.introSub, { color: colors.textSecondary }]}>
            收录博洛尼亚大学及留学意大利生活、居留办理常用的官方网站，助力日常学术和行政事务办理。
          </Text>
        </View>

        {categories.map((cat, catIdx) => (
          <View key={catIdx} style={styles.categoryBlock}>
            <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>{cat.title}</Text>
            {cat.items.map((item, itemIdx) => (
              <Pressable
                key={itemIdx}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
                onPress={() => handleOpenLink(item)}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.desc}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} style={styles.cardArrow} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  headerPlaceholder: {
    width: 50,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  introHeader: {
    marginBottom: 24,
  },
  introTitle: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    marginBottom: 8,
  },
  introSub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 20,
  },
  categoryBlock: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    marginBottom: 12,
    paddingLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardDetails: {
    flex: 1,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 16,
    marginBottom: 4,
  },
  cardUrl: {
    fontSize: 11,
    fontFamily: FONTS.regular,
  },
  cardArrow: {
    alignSelf: 'center',
  },
});
