import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const LOCALIZED = {
  zh: {
    title: '平台简介',
    subtitle: '一站式校园和本地生活服务平台',
    
    sec1Title: '一、 平台愿景与定位',
    sec1Body: '“博学” (Boxue / ASSCUBO App) 是由博洛尼亚大学中国学生学者联谊会（ASSCUBO / 学联）倾力研发并维护的一站式校园学术辅助与本地生活服务移动端平台。平台本着非商业性、纯公益性的宗旨，旨在为在博洛尼亚以及意大利周边地区的中国留学生、学者、科研人员及华人同胞提供打破“信息差”的数字化载体。通过整合校园公告、便利学术工具、公共交通指引和学联活动资源，我们期望将平台打造成全场景覆盖的高效率一站式生活伴侣。',
    
    sec2Title: '二、 核心功能板块明细',
    
    feat1Title: '资讯通达与活动报名',
    feat1Body: '实时同步学联动态通告与官方微信公众号的精选实用文章，确保学术讲座、领事服务、安全提醒及生活指南的第一时间触达。同时内置活动线上报名系统，支持活动预览、快速预约报名、行程记录生成，让您轻松参与学联组织的各类文体与学术交流活动。',
    
    feat2Title: '新生指南与学术工具箱',
    feat2Body: '集成由学联历届学长学姐精心编写整理的《博洛尼亚大学新生手册》及办事指引，涵盖居留办理、税号申请、租房医疗、校园卡办理等高频问题。内置意汉/汉意便捷词典及意语动词变位查询，助力跨越语言门槛。',
    
    feat3Title: '智慧校园与空教室/自习室查询',
    feat3Body: '实时对接博洛尼亚大学官方排课数据，提供便捷的“空教室/讨论室”实时占用情况查询，是考前冲刺自习、学术讨论的最佳助手。支持查看各大图书馆与自习室的开放时间、座位余量并提供一键定位预约功能。',
    
    feat4Title: '公共交通与出行指引',
    feat4Body: '集成博洛尼亚及艾米利亚-罗马涅大区的实时公交出行助手，支持在线检索车次到站倒计时、规划换乘路线。地图选点功能结合设备本地定位，直观呈现周边的公交站点及车辆分布，为您提供丝滑的出行体验。',
    
    feat5Title: '汇率与常用办事链接',
    feat5Body: '实时换算今日最新欧元对人民币汇率，方便财务规划。精选博大教务系统（AlmaEsami）、居留预约平台（CupSubito）、学联官方网站及常用日常办事入口，一键直达，告别繁琐搜索。',
    
    sec3Title: '三、 技术亮点与用户体验',
    sec3Body: '本平台使用现代混合开发框架进行构建，界面设计遵循极致简约与高质感美学。支持轻量化与深色模式（Dark Mode）的智能无缝适配。工具箱卡片支持流畅的拖拽手势重排排序，让您可以根据个人高频使用习惯个性化定制首屏工具布局。所有敏感权限（如 GPS 定位、相册读写等）均严格限制于设备沙盒本地处理，符合欧洲通用数据保护条例（GDPR）的严苛合规要求，并提供一键注销并永久抹除账户的高安全隐私机制。',
    
    sec4Title: '四、 关于学联 (ASSCUBO)',
    sec4Body: '博洛尼亚大学中国学生学者联谊会（Associazione di Studenti e Studiosi Cinesi dell\'Università di Bologna）是在意大利内政部正式注册的非营利性中国学生学者组织，也是接受中国驻意大利大使馆科教处指导的学生团体。学联自成立以来，始终秉承致力于促进中国留学生同当地学生之间的交流并维护在意留学生的权益；为就读于博洛尼亚大学的留学生提供必要的帮助与服务；为广大留学生营造良好的学习环境的宗旨。博学平台是我们践行数字化便利服务的重要载体，欢迎每一位在博学子向我们反馈宝贵的使用意见。'
  },
  'zh-Hant': {
    title: '平台簡介',
    subtitle: '一站式校園和本地生活服務平台',
    
    sec1Title: '一、 平台願景與定位',
    sec1Body: '“博學” (Boxue / ASSCUBO App) 是由博洛尼亞大學中國學生學者聯誼會（ASSCUBO / 學聯）傾力研發並維護的一站式校園學術輔助與本地生活服務移動端平台。平台本著非商業性、純公益性的宗旨，旨在為在博洛尼亞以及意大利周邊地區的中國留學生、學者、科研人員及華人同胞提供打破“信息差”的數字化載體。通過整合校園公告、便利學術工具、公共交通指引和學聯活動資源，我們期望將平台打造成全場景覆蓋的高效率一站式生活伴侶。',
    
    sec2Title: '二、 核心功能板塊明細',
    
    feat1Title: '資訊通達與活動報名',
    feat1Body: '實時同步學聯動態通告與官方微信公眾號的精選實用文章，確保學術講座、領事服務、安全提醒及生活指南的第一時間觸達。同時內置活動線上報名系統，支持活動預覽、快速預約報名、行程記錄生成，讓您輕鬆參與學聯組織的各類文體與學術交流活動。',
    
    feat2Title: '新生指南與學術工具箱',
    feat2Body: '集成由學聯歷屆學長學姐精心編寫整理的《博洛尼亞大學新生手冊》及辦事指引，涵蓋居留辦理、稅號申請、租房醫療、校園卡辦理等高頻問題。內置意漢/漢意便捷詞典及意語動詞變位查詢，助力跨越語言門檻。',
    
    feat3Title: '智慧校園與空教室/自習室查詢',
    feat3Body: '實時對接博洛尼亞大學官方排課數據，提供便捷的“空教室/討論室”實時佔用情況查詢，是考前衝刺自習、學術討論的最佳助手。支持查看各大圖書館與自習室的開放時間、座位餘量並提供一鍵定位預約功能。',
    
    feat4Title: '公共交通與出行指引',
    feat4Body: '集成博洛尼亞及艾米利亞-羅馬涅大區的實時公交出行助手，支持在線檢索車次到站倒計時、規劃換乘路線。地圖選點功能結合設備本地定位，直觀呈現周邊的公交站點及車輛分布，為您提供絲滑的出行體驗。',
    
    feat5Title: '匯率與常用辦事鏈接',
    feat5Body: '實時換算今日最新歐元對人民幣匯率，方便財務規劃。精選博大教務系統（AlmaEsami）、居留預約平台（CupSubito）、學聯官方網站及常用日常辦事入口，一鍵直達，告別繁瑣搜尋。',
    
    sec3Title: '三、 技術亮點與用戶體驗',
    sec3Body: '本平台使用現代混合開發框架進行建構，界面設計遵循極致簡約與高質感美學。支持輕量化與深色模式（Dark Mode）的智能無縫適配。工具箱卡片支持流暢的拖拽手勢重排排序，讓您可以根據個人高頻使用習慣個性化定制首屏工具布局。所有敏感權限（如 GPS 定位、相冊讀寫等）均嚴格限制於設備沙盒本地處理，符合歐洲通用數據保護條例（GDPR）的嚴苛合規要求，並提供一鍵註銷並永久抹除帳戶的高安全隱私機制。',
    
    sec4Title: '四、 關於學聯 (ASSCUBO)',
    sec4Body: '博洛尼亞大學中国学生学者联谊会（Associazione di Studenti e Studiosi Cinesi dell\'Università di Bologna）是在意大利內政部正式註冊的非營利性中國學生學者組織，也是接受中國駐意大利大使館科教處指導的學生團體。學聯自成立以來，始終秉承致力於促進中國留學生同當地學生之間的交流並維護在意留學生的權益；為就讀於博洛尼亞大學的留學生提供必要的幫助與服務；為廣大留學生營造良好的學習環境的宗旨。博學平台是我們踐行數位化便利服務重要載體，歡迎每一位在博學子向我們反饋寶貴的使用意見。'
  },
  en: {
    title: 'Platform Intro',
    subtitle: 'One-stop Campus & Local Life Service Platform',
    
    sec1Title: '1. Vision & Positioning',
    sec1Body: '"Boxue" (ASSCUBO App) is a one-stop campus assistance and local life service mobile platform initiated, developed, and maintained by the Chinese Students and Scholars Association of the University of Bologna (ASSCUBO). Operating as a strictly non-commercial, public benefit project, it aims to eliminate the "information gap" for Chinese students, visiting scholars, researchers, and fellow citizens in Bologna and surrounding areas in Italy. By integrating campus circulars, utility toolkits, transit directories, and CSSA events resources, we hope to establish a highly efficient daily life companion.',
    
    sec2Title: '2. Core Features Breakdown',
    
    feat1Title: 'Announcements & Event Registrations',
    feat1Body: 'Syncs notices and curated articles from our official WeChat channels to bring academic seminars, consular updates, safety reminders, and local tips instantly to your screen. Features an integrated event booking flow for previewing and reserving seats at ASSCUBO sports, cultural, or networking meetups.',
    
    feat2Title: 'Handbooks & Academic Utilities',
    feat2Body: 'Features the "UniBo Freshmen Guidebook" prepared by previous graduates, covering residency permit (Soggiorno) filings, tax code (Codice Fiscale) applications, housing, health, and campus badges. Includes an Italian-Chinese dictionary and verb conjugations to bypass language gaps.',
    
    feat3Title: 'Smart Campus & Empty Classrooms',
    feat3Body: 'Connects to official UniBo schedules to provide real-time status of empty classrooms and study halls, aiding group discussions and exam preparations. Shows library seating availability, opening hours, and one-click booking portals.',
    
    feat4Title: 'Bologna Transit Helpers',
    feat4Body: 'Integrates bus line tracking for Bologna and the Emilia-Romagna region, displaying real-time arrival counts and transfer routes. A custom map widget leverages local device GPS to locate nearby bus stops and vehicle distributions.',
    
    feat5Title: 'Currency & Essential Portals',
    feat5Body: 'Provides live EUR/CNY exchange rate updates for financial planning. Curates essential administrative bookmarks (such as AlmaEsami, CupSubito, and official CSSA portals) for swift, one-tap navigation.',
    
    sec3Title: '3. Technical Notes & UX Highlights',
    sec3Body: 'Built on a modern cross-platform hybrid architecture, Boxue features visual assets structured on premium minimalist layouts. Supports seamless automated adaptivity for Light/Dark modes. The tools menu includes custom reordering gestures, enabling users to re-layout their dashboard. High-security sandboxing ensures all sensitive inputs (e.g. location, photos) process locally under strict GDPR requirements.',
    
    sec4Title: '4. About ASSCUBO',
    sec4Body: 'The Chinese Students and Scholars Association of the University of Bologna (Associazione di Studenti e Studiosi Cinesi dell\'Università di Bologna) is an officially registered non-profit student association. Since inception, we strive to safeguard the rights of Chinese scholars and students, promote intercultural exchanges, and consolidate relationships between Chinese and Italian youth. Boxue Platform is our key digital milestone, and we welcome all feedbacks and inquiries.'
  },
  it: {
    title: 'Informazioni sulla Piattaforma',
    subtitle: 'Piattaforma One-Stop per la Vita Accademica e Quotidiana',
    
    sec1Title: '1. Vision e Posizionamento',
    sec1Body: '"Boxue" (ASSCUBO App) è una piattaforma mobile one-stop per l\'assistenza accademica e i servizi di vita quotidiana a Bologna, sviluppata e gestita dall\'Associazione di Studenti e Studiosi Cinesi dell\'Università di Bologna (ASSCUBO). Trattandosi di un progetto no-profit e orientato esclusivamente alla pubblica utilità, mira a superare il "divario informativo" per studenti, ricercatori e cittadini cinesi a Bologna e dintorni. Integrando annunci del campus, strumenti utili, orari dei trasporti pubblici e risorse dell\'associazione, puntiamo a stabilire un assistente quotidiano completo.',
    
    sec2Title: '2. Panoramica delle Funzionalità Chiave',
    
    feat1Title: 'Avvisi e Prenotazioni Eventi',
    feat1Body: 'Sincronizza gli avvisi e le notizie dai canali WeChat ufficiali per ricevere istantaneamente notizie su seminari, affari consolari, avvisi di sicurezza e guide utili. Include un modulo di prenotazione eventi per iscriversi in modo rapido e sicuro a eventi sportivi, culturali o di networking organizzati da ASSCUBO.',
    
    feat2Title: 'Guida per le Matricole e Dizionario',
    feat2Body: 'Include la "Guida Matricole dell\'Università di Bologna" curata dai neolaureati dell\'associazione, che copre il rilascio del permesso di soggiorno, codice fiscale, alloggio, sanità e badge universitari. Include anche un dizionario italiano-cinese con coniugatore dei verbi.',
    
    feat3Title: 'Campus Intelligente e Aule Libere',
    feat3Body: 'Si collega agli orari ufficiali di UniBo per fornire in tempo reale lo stato delle aule studio e aule libere, ideale per lo studio pre-esami e discussioni di gruppo. Mostra posti liberi, orari delle biblioteche e portali di prenotazione.',
    
    feat4Title: 'Trasporto Pubblico TPER Bologna',
    feat4Body: 'Integra il tracciamento dei bus per Bologna e la regione Emilia-Romagna, mostrando i minuti di arrivo in tempo reale e percorsi. Una mappa interattiva sfrutta il GPS del dispositivo locale per trovare le fermate più vicine.',
    
    feat5Title: 'Tasso di Cambio e Collegamenti Utili',
    feat5Body: 'Fornisce aggiornamenti in tempo reale sul tasso di cambio EUR/CNY per la pianificazione finanziaria. Raccoglie collegamenti essenziali per svariate esigenze (come AlmaEsami, CupSubito e portale ASSCUBO) per un accesso con un singolo tocco.',
    
    sec3Title: '3. Note Tecniche e UX',
    sec3Body: 'Costruito su architettura ibrida cross-platform, Boxue presenta un design minimalista e moderno con supporto nativo al Dark Mode. Consente di riordinare le icone dei tool tramite trascinamento (drag and drop) per una schermata personalizzata. Nel rispetto del GDPR, tutti i permessi critici (come posizione e foto) vengono gestiti localmente e in sicurezza.',
    
    sec4Title: '4. Informazioni su ASSCUBO',
    sec4Body: 'L\'Associazione di Studenti e Studiosi Cinesi dell\'Università di Bologna è un\'associazione studentesca senza scopo di lucro ufficialmente registrata presso l\'Ateneo. Dalla sua fondazione, l\'associazione si impegna a tutelare i diritti di studenti e studiosi, promuovere scambi interculturali e consolidare le relazioni di amicizia tra giovani cinesi e italiani. La Piattaforma Boxue rappresenta una pietra miliare digitale per l\'erogazione di servizi utili, e accogliamo con favore suggerimenti e feedback.'
  }
};

export default function PlatformIntroScreen() {
  const { colors, t, language } = useTheme();
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.title}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.textDetailsContent}>
        <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{localized.title}</Text>
        <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>{localized.subtitle}</Text>
        
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Section 1: Vision */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{localized.sec1Title}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.sec1Body}</Text>
        </View>

        {/* Section 2: Features */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{localized.sec2Title}</Text>
          
          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{localized.feat1Title}</Text>
            <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.feat1Body}</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{localized.feat2Title}</Text>
            <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.feat2Body}</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{localized.feat3Title}</Text>
            <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.feat3Body}</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{localized.feat4Title}</Text>
            <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.feat4Body}</Text>
          </View>

          <View style={styles.featureItem}>
            <Text style={[styles.featureTitle, { color: colors.textPrimary }]}>{localized.feat5Title}</Text>
            <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.feat5Body}</Text>
          </View>
        </View>

        {/* Section 3: Technical Highlights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{localized.sec3Title}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.sec3Body}</Text>
        </View>

        {/* Section 4: About ASSCUBO */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{localized.sec4Title}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>{localized.sec4Body}</Text>
        </View>

        <View style={{ height: 40 }} />
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
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  textDetailsContent: {
    padding: 24,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 10,
  },
  section: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 8,
  },
  featureItem: {
    marginTop: 10,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(150, 150, 150, 0.3)',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailParagraph: {
    fontSize: 13.5,
    lineHeight: 22,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
});
