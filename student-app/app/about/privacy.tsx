import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const { colors, t } = useTheme();

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>隐私政策 / Privacy Policy</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>隐私政策 / Privacy Policy / Informativa sulla Privacy</Text>
        
        {/* Chinese Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>一、 我们收集的数据</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. 账户信息：当您注册账号时，我们会收集您的邮箱地址、密码以及您填写的昵称、头像。{"\n"}
            2. 设备与通知信息：为了向您推送重要的学联公告与动态通知，我们会在您授权后收集并存储您的 Expo 推送 Token（Push Token）。{"\n"}
            3. 匿名使用数据：在您使用按车次查询或空教室等工具时，我们仅处理必要的即时查询请求，不收集您的地理位置或浏览轨迹。{"\n"}
            4. 用户发布内容与媒体文件：为了便于学联管理员发布带有图文的通知，当授权用户上传图片时，我们会收集并安全存储您上传的媒体文件于 Supabase 存储空间中。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>二、 数据的使用与安全</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            我们收集的数据仅用于为您提供本App的核心功能（身份认证、发布信息展示、活动报名和通知提醒）。所有数据均通过加密通道传输并安全存储在 Supabase 托管的云数据库中。我们绝不会将您的个人数据出售或共享给任何第三方。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>三、 GDPR 您的权利与账户删除</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            根据欧洲通用数据保护条例（GDPR），您对个人数据享有访问权、更正权和删除权。{"\n"}
            您随时可以在「个人资料」设置页面中注销并永久删除您的账户。一旦确认删除，您的登录凭证、个人资料、头像以及活动报名信息将被立即从 Supabase 数据库中彻底抹除，不可恢复。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>四、 联系我们</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            如果您对本隐私政策有任何疑问，或需要行使您的 GDPR 权利，请通过以下方式联系学联管理员：{"\n"}
            博洛尼亚大学中国学生学者联谊会 (ASSCUBO){"\n"}
            电子邮件：
            <Text
              style={{ textDecorationLine: 'underline', color: colors.primary }}
              onPress={() => Linking.openURL('mailto:segreteria@asscubo.it')}
            >
              segreteria@asscubo.it
            </Text>
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* English Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Data We Collect</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Account Information: When you register, we collect your email address, password, nickname, and profile avatar.{"\n"}
            2. Device & Notification Info: To send you important announcements, we collect your Expo Push Token upon your explicit authorization.{"\n"}
            3. Usage Data: Tools like train status or empty classrooms process real-time queries locally or anonymously and do not track your location or browsing history.{"\n"}
            4. User-generated Content & Media: To allow authorized users to publish notices with visual content, we collect and store media files you upload securely within our Supabase Storage Bucket.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Data Usage & Security</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Your data is used solely to provide core services (authentication, posts/events feed, registration, and notifications). All information is transmitted securely via SSL and stored in our hosted Supabase database. We do not sell or share your personal data with any third parties.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. GDPR Rights & Deletion</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Under the General Data Protection Regulation (GDPR), you have the right to access, rectify, and erase your personal data.{"\n"}
            You can request permanent account deletion at any time in the "Personal Profile" settings. Once initiated, all account records, nickname, avatar, and event signups will be immediately and irrevocably erased from our database.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Contact Us</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            If you have any questions regarding this Privacy Policy or wish to exercise your GDPR rights, please contact us at:{"\n"}
            Chinese Students and Scholars Association of the University of Bologna (ASSCUBO){"\n"}
            Email:{' '}
            <Text
              style={{ textDecorationLine: 'underline', color: colors.primary }}
              onPress={() => Linking.openURL('mailto:segreteria@asscubo.it')}
            >
              segreteria@asscubo.it
            </Text>
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Italian Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Dati Raccolti</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Informazioni sull'account: quando ti registri, raccogliamo il tuo indirizzo e-mail, la password, il nickname e l'avatar del profilo.{"\n"}
            2. Notifiche e Dispositivo: per inviarti comunicazioni e annunci importanti dall'associazione, raccogliamo il tuo Token di Notifica Expo previa tua autorizzazione.{"\n"}
            3. Dati di Utilizzo: strumenti come lo stato dei treni o le aule libere elaborano query in tempo reale in modo locale o anonimo e non tracciano la tua posizione o cronologia di navigazione.{"\n"}
            4. Contenuti e Media dell'Utente: Per consentire agli amministratori autorizzati di pubblicare avvisi con immagini, raccogliamo e memorizziamo i file multimediali caricati in modo sicuro nel nostro Storage Bucket di Supabase.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Utilizzo e Sicurezza dei Dati</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            I tuoi dati vengono utilizzati esclusivamente per fornire i servizi principali dell'App (autenticazione, feed di notizie/eventi, iscrizioni e notifiche). Tutte le informazioni sono trasmesse in modo sicuro tramite crittografia SSL e memorizzate nel nostro database cloud ospitato su Supabase. Non vendiamo né condividiamo i tuoi dati personali con terze parti.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Diritti GDPR ed Eliminazione</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            In conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR), hai il diritto di accedere, rettificare ed eliminare i tuoi dati personali.{"\n"}
            Puoi richiedere l'eliminazione permanente del tuo account in qualsiasi momento nella pagina "Profilo Personale". Una volta avviata la procedura, tutti i dati di accesso, nickname, avatar e iscrizioni agli eventi saranno rimossi immediatamente e irrevocabilmente dal nostro database.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Contattaci</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Se hai domande sulla presente Informativa sulla Privacy o desideri esercitare i tuoi diritti GDPR, ti preghiamo di contattarci a:{"\n"}
            Associazione di Studenti e Studiosi Cinesi dell'Università di Bologna (ASSCUBO){"\n"}
            E-mail:{' '}
            <Text
              style={{ textDecorationLine: 'underline', color: colors.primary }}
              onPress={() => Linking.openURL('mailto:segreteria@asscubo.it')}
            >
              segreteria@asscubo.it
            </Text>
          </Text>
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  content: {
    padding: 24,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  langSection: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 6,
  },
  detailParagraph: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
});
