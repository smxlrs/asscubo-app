import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { FONTS, RADIUS, SHADOWS } from '../../constants/theme';

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

const LOCALIZED = {
  zh: {
    headerTitle: '实用链接',
    navTitle: '便捷服务导航',
    navSub: '收录博洛尼亚大学及留学意大利生活、居留办理常用的官方网站，助力日常学术和行政事务办理。',
    errTitle: '错误',
    errCannotOpen: '无法打开此链接',
    errException: '打开链接时发生异常',
    
    cat1: '学联与公共服务',
    link1_title: '学联官方网站',
    link1_desc: '博洛尼亚大学中国学联官方服务与资讯平台',
    link2_title: '学联官方邮箱',
    link2_desc: '向学联反馈建议、咨询合作及获取帮助的官方通道',
    link3_title: '全意学联官网',
    link3_desc: '意大利中国学生学者联谊会官方网站',
    
    cat2: '博洛尼亚大学',
    link4_title: '博洛尼亚大学官网',
    link4_desc: '博大主页，办理注册、查询课程和学术资讯',
    link5_title: '国际学生办公室',
    link5_desc: '提供博大入学流程、国际学历评估、签证及居留申请的官方咨询与支持',
    link6_title: '各专业秘书处',
    link6_desc: '查询和联系博大各个校区及专业学生秘书处（Segreterie Studenti）的官方指南',
    link7_title: 'ER.GO 奖学金官网',
    link7_desc: '艾米利亚-罗马涅大区学生福利、助学金与宿舍申请',
    
    cat3: '生活与居留行政',
    link8_title: '意大利居留进度查询',
    link8_desc: '查询警局（Questura）居留卡制作进度的官方平台',
    link9_title: '邮局大信封进度',
    link9_desc: '使用居留信封条形码及密码查询初审和按指纹时间',
    link10_title: '博洛尼亚取居留查询与预约',
    link10_desc: '博洛尼亚警局取居留状态查询及预约平台',
    link11_title: '税务局官网',
    link11_desc: '申请和查询个人税号（Codice Fiscale）等税务信息',
  },
  'zh-Hant': {
    headerTitle: '實用鏈接',
    navTitle: '便捷服務導航',
    navSub: '收錄博洛尼亞大學及留學意大利生活、居留辦理常用的官方網站，助力日常學術和行政事務辦理。',
    errTitle: '錯誤',
    errCannotOpen: '無法打開此鏈接',
    errException: '打開鏈接時發生異常',
    
    cat1: '學聯與公共服務',
    link1_title: '學聯官方網站',
    link1_desc: '博洛尼亞大學中國學聯官方服務與資訊平台',
    link2_title: '學聯官方郵箱',
    link2_desc: '向學聯反饋建議、諮詢合作及獲取幫助的官方通道',
    link3_title: '全意學聯官網',
    link3_desc: '意大利中國學生學者聯誼會官方網站',
    
    cat2: '博洛尼亞大學',
    link4_title: '博洛尼亞大學官網',
    link4_desc: '博大主頁，辦理註冊、查詢課程和學術資訊',
    link5_title: '國際學生辦公室',
    link5_desc: '提供博大入學流程、國際學歷評估、簽證及居留申請的官方諮詢與支持',
    link6_title: '各專業秘書處',
    link6_desc: '查詢和聯繫博大各個校區及專業學生秘書處（Segreterie Studenti）的官方指南',
    link7_title: 'ER.GO 獎學金官網',
    link7_desc: '艾米利亞-羅馬涅大區學生福利、助學金與宿舍申請',
    
    cat3: '生活與居留行政',
    link8_title: '意大利居留進度查詢',
    link8_desc: '查詢警局（Questura）居留卡製作進度的官方平台',
    link9_title: '郵局大信封進度',
    link9_desc: '使用居留信封條形碼及密碼查詢初審和按指紋時間',
    link10_title: '博洛尼亞取居留查詢與預約',
    link10_desc: '博洛尼亞警局取居留狀態查詢及預約平台',
    link11_title: '稅務局官網',
    link11_desc: '申請和查詢個人稅號（Codice Fiscale）等稅務信息',
  },
  en: {
    headerTitle: 'Useful Links',
    navTitle: 'Quick Service Nav',
    navSub: 'Collection of official websites frequently used for University of Bologna and living/permit applications in Italy, assisting with daily academic and administrative affairs.',
    errTitle: 'Error',
    errCannotOpen: 'Unable to open this link',
    errException: 'An error occurred while opening the link',
    
    cat1: 'CSSA & Public Services',
    link1_title: 'CSSA Official Website',
    link1_desc: 'Official service and information platform of ASSCUBO',
    link2_title: 'CSSA Official Email',
    link2_desc: 'Official channel to feedback suggestions, consult partnerships, and get help',
    link3_title: 'All-Italy CSSA Website',
    link3_desc: 'Official website of the Chinese Students and Scholars Association in Italy',
    
    cat2: 'University of Bologna',
    link4_title: 'UniBo Official Website',
    link4_desc: 'University of Bologna home page, manage enrollment, query courses, and academic info',
    link5_title: 'International Desk',
    link5_desc: 'Official support and advice on UniBo registration, international degree evaluation, visa & residence permit',
    link6_title: 'Student Administration Offices',
    link6_desc: 'Official directory to check and contact Student Administration Offices (Segreterie Studenti) for all campuses',
    link7_title: 'ER.GO Scholarship',
    link7_desc: 'Regional Authority for the Right to Higher Education (Emilia-Romagna) for scholarships, grants and accommodation',
    
    cat3: 'Life & Residence Admin',
    link8_title: 'Permit Progress Inquiry',
    link8_desc: 'Official platform to track the production progress of residence permit cards (Questura)',
    link9_title: 'Post Office Envelope Progress',
    link9_desc: 'Use barcode and password from your envelope receipt to query initial verification and fingerprint schedule',
    link10_title: 'Bologna Permit Pickup & Booking',
    link10_desc: 'Inquiry and booking platform for picking up residence permits at Bologna Police Station',
    link11_title: 'Revenue Agency (Agenzia Entrate)',
    link11_desc: 'Apply and query tax code (Codice Fiscale) and other tax information',
  },
  it: {
    headerTitle: 'Link Utili',
    navTitle: 'Navigazione Rapida Servizi',
    navSub: 'Raccolta di siti web ufficiali frequentemente utilizzati per l\'Università di Bologna e per le pratiche di soggiorno in Italia, a supporto degli affari accademici e amministrativi quotidiani.',
    errTitle: 'Errore',
    errCannotOpen: 'Impossibile aprire questo link',
    errException: 'Si è verificato un errore durante l\'apertura del link',
    
    cat1: 'ASSCUBO & Servizi Pubblici',
    link1_title: 'Sito Ufficiale ASSCUBO',
    link1_desc: 'Piattaforma ufficiale di servizi e informazioni di ASSCUBO',
    link2_title: 'Email Ufficiale ASSCUBO',
    link2_desc: 'Canale ufficiale per feedback, suggerimenti, collaborazioni e supporto',
    link3_title: 'Sito Ufficiale CSSA Italia',
    link3_desc: 'Sito ufficiale dell\'Unione degli Studenti e Studiosi Cinesi in Italia',
    
    cat2: 'Università di Bologna',
    link4_title: 'Sito Ufficiale UniBo',
    link4_desc: 'Home page dell\'Università di Bologna, immatricolazione, esami e informazioni accademiche',
    link5_title: 'Ufficio Studenti Internazionali',
    link5_desc: 'Supporto e consulenza ufficiale su immatricolazione UniBo, valutazione titolo di studio estero, visto e permesso di soggiorno',
    link6_title: 'Segreterie Studenti',
    link6_desc: 'Guida ufficiale per consultare e contattare le Segreterie Studenti di tutti i campus',
    link7_title: 'Borse di studio ER.GO',
    link7_desc: 'Azienda Regionale per il Diritto agli Studi Superiori (Emilia-Romagna) per borse di studio, alloggi e agevolazioni',
    
    cat3: 'Vita & Soggiorno Amministrativo',
    link8_title: 'Stato Permesso di Soggiorno',
    link8_desc: 'Piattaforma ufficiale per verificare lo stato di rilascio del permesso di soggiorno (Questura)',
    link9_title: 'Stato Lettera Assicurata Poste',
    link9_desc: 'Utilizza codice a barre e password della ricevuta per controllare i tempi di istruttoria e appuntamento impronte',
    link10_title: 'Consegna Permessi Bologna',
    link10_desc: 'Piattaforma per la verifica dello stato di consegna e prenotazione ritiro del permesso di soggiorno a Bologna',
    link11_title: 'Agenzia delle Entrate',
    link11_desc: 'Richiesta e verifica del codice fiscale e altre informazioni fiscali',
  }
};

export default function UsefulLinksScreen() {
  const { colors, isDark, language } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  const handleOpenLink = async (item: LinkItem) => {
    try {
      const canOpen = await Linking.canOpenURL(item.url);
      if (canOpen) {
        await Linking.openURL(item.url);
      } else {
        Alert.alert(localized.errTitle, localized.errCannotOpen);
      }
    } catch (error) {
      console.warn('Failed to open link:', error);
      Alert.alert(localized.errTitle, localized.errException);
    }
  };

  const categories: LinkCategory[] = [
    {
      title: localized.cat1,
      items: [
        {
          title: localized.link1_title,
          desc: localized.link1_desc,
          url: 'https://asscubo.it',
          icon: 'web',
          color: '#A31621',
        },
        {
          title: localized.link2_title,
          desc: localized.link2_desc,
          url: 'mailto:unibo@cssui.org',
          icon: 'email-outline',
          color: '#D87A80',
        },
        {
          title: localized.link3_title,
          desc: localized.link3_desc,
          url: 'https://www.cssui.org/',
          icon: 'flag-outline',
          color: '#0EA5E9',
        },
      ],
    },
    {
      title: localized.cat2,
      items: [
        {
          title: localized.link4_title,
          desc: localized.link4_desc,
          url: 'https://www.unibo.it',
          icon: 'school-outline',
          color: '#3B82F6',
        },
        {
          title: localized.link5_title,
          desc: localized.link5_desc,
          url: 'https://www.unibo.it/it/ateneo/contatti/contatti-per-studentesse-e-studenti-internazionali',
          icon: 'earth',
          color: '#0284C7',
        },
        {
          title: localized.link6_title,
          desc: localized.link6_desc,
          url: 'https://www.unibo.it/it/studiare/iscrizioni-tasse-e-altre-procedure/lauree-e-lauree-magistrali/segreterie-studenti',
          icon: 'account-box-multiple-outline',
          color: '#4F46E5',
        },
        {
          title: localized.link7_title,
          desc: localized.link7_desc,
          url: 'https://www.er-go.it',
          icon: 'bank-outline',
          color: '#10B981',
        },
      ],
    },
    {
      title: localized.cat3,
      items: [
        {
          title: localized.link8_title,
          desc: localized.link8_desc,
          url: 'https://questure.poliziadistato.it/stranieri/',
          icon: 'card-account-details-outline',
          color: '#F59E0B',
        },
        {
          title: localized.link9_title,
          desc: localized.link9_desc,
          url: 'https://www.portaleimmigrazione.it/eli2immigrazioneweb/pagine/startpage.aspx',
          icon: 'mailbox-outline',
          color: '#EC4899',
        },
        {
          title: localized.link10_title,
          desc: localized.link10_desc,
          url: 'https://www.questura.bologna.it/verifica',
          icon: 'calendar-check-outline',
          color: '#3B82F6',
        },
        {
          title: localized.link11_title,
          desc: localized.link11_desc,
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
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.headerTitle}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introHeader}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>{localized.navTitle}</Text>
          <Text style={[styles.introSub, { color: colors.textSecondary }]}>
            {localized.navSub}
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
  cardArrow: {
    alignSelf: 'center',
  },
});
