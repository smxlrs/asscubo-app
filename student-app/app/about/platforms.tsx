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

export default function OfficialPlatformsScreen() {
  const { colors, isDark } = useTheme();
  const [wechatQrVisible, setWechatQrVisible] = useState(false);

  const handleAction = async (item: PlatformItem) => {
    if (item.type === 'qr') {
      setWechatQrVisible(true);
    } else if (item.type === 'link') {
      try {
        const canOpen = await Linking.canOpenURL(item.target);
        if (canOpen) {
          await Linking.openURL(item.target);
        } else {
          Alert.alert('提示', '请先在您的手机上安装相关客户端');
        }
      } catch (error) {
        console.warn('Failed to open platform link:', error);
        Alert.alert('错误', '无法打开此链接');
      }
    } else if (item.type === 'copy') {
      Alert.alert(
        '社区搜索指南',
        `请打开相应的客户端，搜索账号/名称：\n\n【 ${item.target} 】\n\n即可找到并关注我们！`,
        [{ text: '我知道了' }]
      );
    }
  };

  const platforms: PlatformItem[] = [
    {
      name: '微信公众号',
      type: 'qr',
      target: '博洛尼亚大学中国学联',
      displayId: '微信公众号：博洛尼亚大学中国学联',
      desc: '学联官方信息发布主渠道，同步更新各类讲座、活动报名、学术求助和新生指引图文。',
      icon: 'wechat',
      brandColor: '#07C160',
      buttonText: '显示公众号二维码',
    },
    {
      name: '小红书官方号',
      type: 'link',
      target: 'https://xhslink.com/m/5DePpUfheTj',
      displayId: '小红书号：ASSCUBO',
      desc: '博大本地保姆级生活攻略、校园资讯和精美图文分享，让你快速融入当地生活。',
      icon: 'compass-outline',
      brandColor: '#FE2C55',
      buttonText: '访问小红书主页',
    },
    {
      name: '哔哩哔哩官方号',
      type: 'link',
      target: 'https://space.bilibili.com/485316728',
      desc: '视频分享与活动直播平台，发布新生指引视频、讲座回放及学联宣传视频。',
      icon: 'television-play',
      brandColor: '#00AEEC',
      buttonText: '访问 B 站主页',
    },
    {
      name: '新浪微博官方号',
      type: 'link',
      target: 'http://www.weibo.com/asscubo',
      desc: '官方微博，同步分享留学生校园动态、日常活动及公告信息。',
      icon: 'weibo',
      iconFamily: 'AntDesign',
      brandColor: '#E6162D',
      buttonText: '关注官方微博',
    },
    {
      name: 'QQ 官方交流群',
      type: 'link',
      target: 'https://qun.qq.com/universal-share/share?ac=1&authKey=n5KIIA2WO1P0wiOFQYgjge0KYlZVb9oKxx1tJjMT9Z5XRff79wZqBYyOR3rAU1mr&busi_data=eyJncm91cENvZGUiOiI3OTQ3NTc5OTQiLCJ0b2tlbiI6IjcxZW9ZSU55dzg2NWRBTy83cmZUWFY0TzdyRmQwYkVDcEFTb2ZmQldvZ1l6YTJQaUdRNEUyVzN6OFVtZEJ3by8iLCJ1aW4iOiIzNDYwNjcyMDUifQ%3D%3D&data=3zBISfNwfadCsIhi-z6x8_4VTouVT50ie-amAksss7O89gk9K4-iU_8bG4clTJXEjKq1w1cUJvYKbPJO5LYz7Q&svctype=4&tempid=h5_group_info',
      displayId: 'QQ群号：794757994',
      desc: '学联官方新生与在校生大群，提供及时答疑、学术互助 and 本地生活经验交流。',
      icon: 'qqchat',
      brandColor: '#12B7F5',
      buttonText: '一键加入 QQ 群',
    },
    {
      name: 'Facebook 主页',
      type: 'link',
      target: 'https://www.facebook.com/profile.php?id=100044394516048',
      desc: '对外交流及本地官方事务联系平台，促进与当地社会、学校机构及友好协会的互动。',
      icon: 'facebook',
      brandColor: '#1877F2',
      buttonText: '访问脸书主页',
    },
    {
      name: 'Instagram 官方账号',
      type: 'link',
      target: 'https://www.instagram.com/asscubo/',
      desc: '分享学联活动的精彩现场照片、短视频及本地日常动态，展示留学生的青春风采。',
      icon: 'instagram',
      brandColor: '#E1306C',
      buttonText: '关注我们的 INS',
    },
    {
      name: 'Discord 交流社区',
      type: 'link',
      target: 'https://discord.gg/UkzWbzCYKY',
      desc: '专为博大学子打造的即时聊天社区。设有生活求助、选课攻略、租房交易、游戏娱乐等专属频道。',
      icon: 'discord',
      iconFamily: 'FontAwesome5',
      brandColor: '#5865F2',
      buttonText: '加入社区服务器',
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>公众平台</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.introHeader}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>加入学联社区</Text>
          <Text style={[styles.introSub, { color: colors.textSecondary }]}>
            关注博洛尼亚大学中国学联的各大公众平台，加入我们的留学生社群，获取最及时的通知，并与数千名学长学姐、新生伙伴实时在线互动！
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
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>微信公众平台</Text>
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
              <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>博洛尼亚大学中国学联</Text>
              <Text style={[styles.qrDesc, { color: colors.textSecondary }]}>
                请使用微信扫描上方二维码，或截图保存图片至相册在微信中扫码关注。
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
