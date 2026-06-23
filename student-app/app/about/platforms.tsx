import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Alert, Modal, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

type PlatformItem = {
  name: string;
  type: 'link' | 'copy' | 'qr';
  target: string; // URL or copy content
  displayId?: string; // shown to user if copy type
  desc: string;
  icon: string;
  iconFamily?: 'MaterialCommunityIcons' | 'FontAwesome5' | 'AntDesign';
  brandColor: string;
  buttonText: string;
};

const LOCALIZED = {
  zh: {
    headerTitle: '公众平台',
    introTitle: '加入学联社区',
    introSub: '关注博洛尼亚大学中国学联的各大公众平台，加入我们的留学生社群，获取最及时的通知，并与数千名学长学姐、新生伙伴实时在线互动！',
    alertTip: '提示',
    installClient: '请先在您的手机上安装相关客户端',
    alertError: '错误',
    cannotOpen: '无法打开此链接',
    searchGuideTitle: '社区搜索指南',
    searchGuideMsg: '请打开相应的客户端，搜索账号/名称：\n\n【 {target} 】\n\n即可找到并关注我们！',
    gotIt: '我知道了',
    wechatModalTitle: '微信公众平台',
    wechatName: '博洛尼亚大学中国学联',
    wechatScanMsg: '请使用微信扫描上方二维码，或截图保存图片至相册在微信中扫码关注。',
    
    wechatPub: '微信公众号',
    wechatPubDesc: '学联官方信息发布主渠道，同步更新各类讲座、活动报名、学术求助和新生指引图文。',
    wechatPubBtn: '显示公众号二维码',
    wechatId: '微信公众号：博洛尼亚大学中国学联',
    
    xiaohongshu: '小红书官方号',
    xiaohongshuDesc: '博大本地保姆级生活攻略、校园资讯和精美图文分享，让你快速融入当地生活。',
    xiaohongshuBtn: '访问小红书主页',
    redId: '小红书号：ASSCUBO',
    
    bilibili: '哔哩哔哩官方号',
    bilibiliDesc: '视频分享与活动直播平台，发布新生指引视频、讲座回放及学联宣传视频。',
    bilibiliBtn: '访问 B 站主页',
    
    weibo: '新浪微博官方号',
    weiboDesc: '官方微博，同步分享留学生校园动态、日常活动及公告信息。',
    weiboBtn: '关注官方微博',
    
    qqGroup: 'QQ 官方交流群',
    qqGroupDesc: '学联官方新生与在校生大群，提供及时答疑、学术互助 and 本地生活经验交流。',
    qqGroupBtn: '一键加入 QQ 群',
    qqGroupId: 'QQ群号：794757994',
    
    facebook: 'Facebook 主页',
    facebookDesc: '对外交流及本地官方事务联系平台，促进与当地社会、学校机构及友好协会的互动。',
    facebookBtn: '访问脸书主页',
    
    instagram: 'Instagram 官方账号',
    instagramDesc: '分享学联活动的精彩现场照片、短视频及本地日常动态，展示留学生的青春风采。',
    instagramBtn: '关注我们的 INS',
    
    discord: 'Discord 交流社区',
    discordDesc: '专为博大学子打造的即时聊天社区。设有生活求助、选课攻略、租房交易、游戏娱乐等专属频道。',
    discordBtn: '加入社区服务器',
  },
  'zh-Hant': {
    headerTitle: '公眾平台',
    introTitle: '加入學聯社區',
    introSub: '關注博洛尼亞大學中國學聯的各大公眾平台，加入我們的留學生社群，獲取最及時的通知，並與數千名學長學姐、新生夥伴實時在線互動！',
    alertTip: '提示',
    installClient: '請先在您的手機上安裝相關客戶端',
    alertError: '錯誤',
    cannotOpen: '無法打開此鏈接',
    searchGuideTitle: '社區搜索指南',
    searchGuideMsg: '請打開相應的客戶端，搜索帳號/名稱：\n\n【 {target} 】\n\n即可找到並關注我們！',
    gotIt: '我知道了',
    wechatModalTitle: '微信公眾平台',
    wechatName: '博洛尼亞大學中國學聯',
    wechatScanMsg: '請使用微信掃描上方二維碼，或截圖保存圖片至相冊在微信中掃碼關注。',
    
    wechatPub: '微信公眾號',
    wechatPubDesc: '學聯官方信息發布主渠道，同步更新各類講座、活動報名、學術求助和新生指引圖文。',
    wechatPubBtn: '顯示公眾號二維碼',
    wechatId: '微信公眾號：博洛尼亞大學中國學聯',
    
    xiaohongshu: '小紅書官方號',
    xiaohongshuDesc: '博大本地保姆級生活攻略、校園資訊和精美圖文分享，讓你快速融入當地生活。',
    xiaohongshuBtn: '訪問小紅書主頁',
    redId: '小紅書號：ASSCUBO',
    
    bilibili: '嗶哩嗶哩官方號',
    bilibiliDesc: '視頻分享與活動直播平台，發布新生指引視頻、講座回放及學聯宣傳視頻。',
    bilibiliBtn: '訪問 B 站主頁',
    
    weibo: '新浪微博官方號',
    weiboDesc: '官方微博，同步分享留學生校園動態、日常活動及公告信息。',
    weiboBtn: '關注官方微博',
    
    qqGroup: 'QQ 官方交流群',
    qqGroupDesc: '學聯官方新生與在校生大群，提供及時答疑、學術互助及本地生活經驗交流。',
    qqGroupBtn: '一鍵加入 QQ 群',
    qqGroupId: 'QQ群號：794757994',
    
    facebook: 'Facebook 主頁',
    facebookDesc: '對外交流及本地官方事務聯繫平台，促進與當地社會、學校機構及友好協會的互動。',
    facebookBtn: '訪問臉書主頁',
    
    instagram: 'Instagram 官方帳號',
    instagramDesc: '分享學聯活動的精彩現場照片、短視頻及本地日常動態，展示留學生的青春風采。',
    instagramBtn: '關注我們的 INS',
    
    discord: 'Discord 交流社區',
    discordDesc: '專為博大學子打造的即時聊天社區。設有生活求助、選課攻略、租房交易、遊戲娛樂等專屬頻道。',
    discordBtn: '加入社區伺服器',
  },
  en: {
    headerTitle: 'Official Platforms',
    introTitle: 'Join CSSA Community',
    introSub: 'Follow ASSCUBO on our official platforms and join our student community to get the latest notices and interact with thousands of seniors and freshers in real-time!',
    alertTip: 'Notice',
    installClient: 'Please install the corresponding client application first',
    alertError: 'Error',
    cannotOpen: 'Unable to open this link',
    searchGuideTitle: 'Community Search Guide',
    searchGuideMsg: 'Please open the app and search for the account/name:\n\n【 {target} 】\n\nto find and follow us!',
    gotIt: 'Got it',
    wechatModalTitle: 'WeChat Official Account',
    wechatName: 'ASSCUBO',
    wechatScanMsg: 'Please use WeChat to scan the QR code above, or save the image to your album and scan in WeChat.',
    
    wechatPub: 'WeChat Official Account',
    wechatPubDesc: 'Primary channel for official notices, lectures, event registration, academic support, and student guides.',
    wechatPubBtn: 'Show QR Code',
    wechatId: 'WeChat ID: 博洛尼亚大学中国学联',
    
    xiaohongshu: 'Xiaohongshu (RED)',
    xiaohongshuDesc: 'Local life guides, campus info, and beautiful photo sharing to help you quickly integrate into Bologna.',
    xiaohongshuBtn: 'Visit RED Homepage',
    redId: 'RED ID: ASSCUBO',
    
    bilibili: 'Bilibili Official',
    bilibiliDesc: 'Video sharing and live broadcasting platform, including new student video guides, lecture playbacks, and promos.',
    bilibiliBtn: 'Visit Bilibili Homepage',
    
    weibo: 'Weibo Official',
    weiboDesc: 'Official Weibo, sharing campus news, daily activities, and official notices for international students.',
    weiboBtn: 'Follow Official Weibo',
    
    qqGroup: 'QQ Freshers Group',
    qqGroupDesc: 'Official group for freshers and current students, providing Q&A, academic support, and local experience exchange.',
    qqGroupBtn: 'Join QQ Group',
    qqGroupId: 'QQ Group ID: 794757994',
    
    facebook: 'Facebook Page',
    facebookDesc: 'External communication and official local contact channel, fostering interaction with local society and institutions.',
    facebookBtn: 'Visit Facebook Page',
    
    instagram: 'Instagram Official',
    instagramDesc: 'Photos and short videos of CSSA events and local daily updates, displaying the vibrant student life.',
    instagramBtn: 'Follow Instagram',
    
    discord: 'Discord Community',
    discordDesc: 'Instant messaging community built for UniBo students. Includes channels for study help, housing, gaming, etc.',
    discordBtn: 'Join Discord Server',
  },
  it: {
    headerTitle: 'Canali Ufficiali',
    introTitle: 'Unisciti alla Community',
    introSub: 'Segui ASSCUBO sui nostri canali ufficiali e unisciti alla community di studenti per ricevere gli avvisi ed interagire in tempo reale con migliaia di colleghi!',
    alertTip: 'Avviso',
    installClient: 'Si prega di installare prima l\'applicazione corrispondente',
    alertError: 'Errore',
    cannotOpen: 'Impossibile aprire questo link',
    searchGuideTitle: 'Guida alla Ricerca',
    searchGuideMsg: 'Apri l\'app e cerca l\'account/nome:\n\n【 {target} 】\n\nper trovarci e seguirci!',
    gotIt: 'Ho capito',
    wechatModalTitle: 'Account Ufficiale WeChat',
    wechatName: 'ASSCUBO',
    wechatScanMsg: 'Usa WeChat per scansionare il codice QR, o salva l\'immagine sul telefono per scansionarla da WeChat.',
    
    wechatPub: 'Account Ufficiale WeChat',
    wechatPubDesc: 'Canale principale per notizie ufficiali, seminari, iscrizioni a eventi, supporto accademico e guide studentesche.',
    wechatPubBtn: 'Mostra Codice QR',
    wechatId: 'ID WeChat: 博洛尼亚大学中国学联',
    
    xiaohongshu: 'Xiaohongshu (RED)',
    xiaohongshuDesc: 'Guide sulla vita locale, informazioni sul campus e condivisione di foto per integrarsi rapidamente a Bologna.',
    xiaohongshuBtn: 'Visita la pagina RED',
    redId: 'ID RED: ASSCUBO',
    
    bilibili: 'Canale Bilibili',
    bilibiliDesc: 'Piattaforma di condivisione video e live stream, comprese guide per matricole, repliche di seminari e promo.',
    bilibiliBtn: 'Visita Bilibili',
    
    weibo: 'Weibo Ufficiale',
    weiboDesc: 'Weibo ufficiale, condivisione di notizie del campus, attività quotidiane e avvisi per studenti internazionali.',
    weiboBtn: 'Segui Weibo Ufficiale',
    
    qqGroup: 'Gruppo QQ Matricole',
    qqGroupDesc: 'Gruppo ufficiale per matricole e studenti attuali, per domande, supporto accademico e scambio di esperienze.',
    qqGroupBtn: 'Entra nel Gruppo QQ',
    qqGroupId: 'ID Gruppo QQ: 794757994',
    
    facebook: 'Pagina Facebook',
    facebookDesc: 'Canale di comunicazione esterna e contatti istituzionali locali, per favorire l\'interazione con la società locale.',
    facebookBtn: 'Visita Pagina Facebook',
    
    instagram: 'Instagram Ufficiale',
    instagramDesc: 'Foto e brevi video degli eventi ASSCUBO e aggiornamenti quotidiani locali sulla vita studentesca.',
    instagramBtn: 'Segui su Instagram',
    
    discord: 'Community Discord',
    discordDesc: 'Community di messaggistica istantanea per studenti UniBo. Canali per studio, alloggio, giochi, ecc.',
    discordBtn: 'Entra nel Server Discord',
  }
};

export default function OfficialPlatformsScreen() {
  const { colors, isDark, language } = useTheme();
  const [wechatQrVisible, setWechatQrVisible] = useState(false);
  const localized = LOCALIZED[language as keyof typeof LOCALIZED] || LOCALIZED.zh;

  const handleAction = async (item: PlatformItem) => {
    if (item.type === 'qr') {
      setWechatQrVisible(true);
    } else if (item.type === 'link') {
      try {
        const canOpen = await Linking.canOpenURL(item.target);
        if (canOpen) {
          await Linking.openURL(item.target);
        } else {
          Alert.alert(localized.alertTip, localized.installClient);
        }
      } catch (error) {
        console.warn('Failed to open platform link:', error);
        Alert.alert(localized.alertError, localized.cannotOpen);
      }
    } else if (item.type === 'copy') {
      Alert.alert(
        localized.searchGuideTitle,
        localized.searchGuideMsg.replace('{target}', item.target),
        [{ text: localized.gotIt }]
      );
    }
  };

  const platforms: PlatformItem[] = [
    {
      name: localized.wechatPub,
      type: 'qr',
      target: '博洛尼亚大学中国学联',
      displayId: localized.wechatId,
      desc: localized.wechatPubDesc,
      icon: 'wechat',
      brandColor: '#07C160',
      buttonText: localized.wechatPubBtn,
    },
    {
      name: localized.xiaohongshu,
      type: 'link',
      target: 'https://xhslink.com/m/5DePpUfheTj',
      displayId: localized.redId,
      desc: localized.xiaohongshuDesc,
      icon: 'compass-outline',
      brandColor: '#FE2C55',
      buttonText: localized.xiaohongshuBtn,
    },
    {
      name: localized.bilibili,
      type: 'link',
      target: 'https://space.bilibili.com/485316728',
      desc: localized.bilibiliDesc,
      icon: 'television-play',
      brandColor: '#00AEEC',
      buttonText: localized.bilibiliBtn,
    },
    {
      name: localized.weibo,
      type: 'link',
      target: 'http://www.weibo.com/asscubo',
      desc: localized.weiboDesc,
      icon: 'weibo',
      iconFamily: 'AntDesign',
      brandColor: '#E6162D',
      buttonText: localized.weiboBtn,
    },
    {
      name: localized.qqGroup,
      type: 'link',
      target: 'https://qun.qq.com/universal-share/share?ac=1&authKey=n5KIIA2WO1P0wiOFQYgjge0KYlZVb9oKxx1tJjMT9Z5XRff79wZqBYyOR3rAU1mr&busi_data=eyJncm91cENvZGUiOiI3OTQ3NTc5OTQiLCJ0b2tlbiI6IjcxZW9ZSU55dzg2NWRBTy83cmZUWFY0TzdyRmQwYkVDcEFTb2ZmQldvZ1l6YTJQaUdRNEUyVzN6OFVtZEJ3by8iLCJ1aW4iOiIzNDYwNjcyMDUifQ%3D%3D&data=3zBISfNwfadCsIhi-z6x8_4VTouVT50ie-amAksss7O89gk9K4-iU_8bG4clTJXEjKq1w1cUJvYKbPJO5LYz7Q&svctype=4&tempid=h5_group_info',
      displayId: localized.qqGroupId,
      desc: localized.qqGroupDesc,
      icon: 'qqchat',
      brandColor: '#12B7F5',
      buttonText: localized.qqGroupBtn,
    },
    {
      name: localized.facebook,
      type: 'link',
      target: 'https://www.facebook.com/profile.php?id=100044394516048',
      desc: localized.facebookDesc,
      icon: 'facebook',
      brandColor: '#1877F2',
      buttonText: localized.facebookBtn,
    },
    {
      name: localized.instagram,
      type: 'link',
      target: 'https://www.instagram.com/asscubo/',
      desc: localized.instagramDesc,
      icon: 'instagram',
      brandColor: '#E1306C',
      buttonText: localized.instagramBtn,
    },
    {
      name: localized.discord,
      type: 'link',
      target: 'https://discord.gg/UkzWbzCYKY',
      desc: localized.discordDesc,
      icon: 'discord',
      iconFamily: 'FontAwesome5',
      brandColor: '#5865F2',
      buttonText: localized.discordBtn,
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{localized.headerTitle}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introHeader}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>{localized.introTitle}</Text>
          <Text style={[styles.introSub, { color: colors.textSecondary }]}>
            {localized.introSub}
          </Text>
        </View>

        {platforms.map((item, idx) => (
          <View key={idx} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: item.brandColor + '15' }]}>
                {item.iconFamily === 'FontAwesome5' ? (
                  <FontAwesome5 name={item.icon as any} size={26} color={item.brandColor} />
                ) : item.iconFamily === 'AntDesign' ? (
                  <AntDesign name={item.icon as any} size={28} color={item.brandColor} />
                ) : (
                  <MaterialCommunityIcons name={item.icon as any} size={28} color={item.brandColor} />
                )}
              </View>
              <View style={styles.cardHeaderDetails}>
                <Text style={[styles.cardName, { color: colors.textPrimary }]}>{item.name}</Text>
                {item.displayId && (
                  <Text style={[styles.cardSubText, { color: colors.textSecondary }]}>
                    {item.displayId}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: item.brandColor,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
              onPress={() => handleAction(item)}
            >
              <Text style={styles.actionButtonText}>{item.buttonText}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {/* WeChat QR Code Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={wechatQrVisible}
        onRequestClose={() => setWechatQrVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setWechatQrVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{localized.wechatModalTitle}</Text>
              <Pressable onPress={() => setWechatQrVisible(false)} style={styles.modalCloseButton}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <Image 
                source={require('../../assets/images/wechat_qr.jpg')} 
                style={styles.qrImage}
                resizeMode="contain" 
              />
              <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>{localized.wechatName}</Text>
              <Text style={[styles.qrDesc, { color: colors.textSecondary }]}>
                {localized.wechatScanMsg}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardHeaderDetails: {
    flex: 1,
  },
  cardName: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    marginBottom: 2,
  },
  cardSubText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    lineHeight: 18,
    marginBottom: 20,
  },
  actionButton: {
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    alignItems: 'center',
    width: '100%',
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: RADIUS.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  qrTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    marginBottom: 8,
    textAlign: 'center',
  },
  qrDesc: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
