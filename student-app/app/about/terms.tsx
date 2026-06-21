import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>用户协议 / Terms of Service</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>用户协议 / Terms of Service / Condizioni d'Uso</Text>
        
        {/* Chinese Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>一、 条款接受</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            欢迎使用本App。通过下载、安装或使用本App，您即表示同意遵守并受本用户协议所有条款的约束。如果您不同意这些条款，请勿使用本App。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>二、 账户注册与安全</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. 账户注册：在使用特定功能（如活动报名）时，您需要提供真实有效的邮箱注册账户。{"\n"}
            2. 安全维护：您有责任保护您的账户登录凭证的安全。任何因您泄露密码而导致的损失，本平台不承担任何法律责任。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>三、 版权与知识产权</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. 版权归属：本App中包含的所有原创内容（如新生手册文字、界面设计、学联标志）的版权和知识产权均属于 **博洛尼亚大学中国学生学者联谊会**。未经明示的书面许可，任何个人或组织不得擅自复制、传播或商用。{"\n"}
            2. 第三方内容：本App中展示的部分公众号文章同步自微信平台，其版权归属于原作者或对应的公众号主体。本平台仅作公益展示，不作任何商业用途。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>四、 免责声明</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. 数据准确性：本App提供的工具（如火车车次实时状态查询、空教室查询等）数据来源于第三方公共服务平台，学联将尽最大努力保障信息的有效性，但不保证所有查询结果的绝对实时与准确。请您在出行或选择教室时以学校或火车站官方的物理布告牌信息为最终准则。{"\n"}
            2. 外部链接与图片：学联管理员在发布通知时可能包含外部链接或图片媒体。这些内容仅供便利参考，本平台不对任何第三方外部链接的安全性和内容的真实性承担法律责任。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>五、 适用法律</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            本协议的效力、解释、变更和争议解决均适用意大利共和国法律以及适用的欧洲联盟法规。
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* English Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Acceptance of Terms</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Welcome to our App. By downloading, installing, or using the App, you agree to be bound by these Terms of Service. If you do not agree, please do not use the App.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Account Registration & Security</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Registration: Certain features require you to register an account with a valid email address.{"\n"}
            2. Security: You are solely responsible for maintaining the confidentiality of your account credentials. We are not liable for any losses caused by unauthorized use of your credentials.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Copyright & Intellectual Property</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Ownership: All original content contained in the App (including text in the student handbook, layout designs, and logos) belongs to the **Chinese Students and Scholars Association of the University of Bologna (ASSCUBO)**. Unauthorized reproduction or commercial use is strictly prohibited.{"\n"}
            2. Third-Party Content: Some articles displayed in the App are synced from WeChat official accounts. Their copyrights belong to their respective original authors or publishers. The App displays them solely for public service and academic exchange, and not for commercial purposes.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Disclaimer of Warranties</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Data Accuracy: Utility tools (e.g. train status, empty classrooms) retrieve data from public third-party services. We strive to maintain updates but do not warrant absolute real-time accuracy. Please refer to official university/station boards for critical travel and study decisions.{"\n"}
            2. External Links & Media: Announcements published by administrators may contain external links or image attachments. These are provided for convenience only; we do not assume any legal responsibility for the security, accuracy, or integrity of third-party websites or files.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Governing Law</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            The validity, interpretation, and resolution of disputes under this agreement shall be governed by the laws of the Italian Republic and applicable European Union regulations.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Italian Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Accettazione dei Termini</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Benvenuti nella nostra App. Scaricando, installando o utilizzando l'App, l'utente accetta di essere vincolato dalle presenti Condizioni d'Uso. Se non si accettano tali termini, si prega di non utilizzare l'App.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Registrazione e Sicurezza dell'Account</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Registrazione dell'account: Per utilizzare determinate funzionalità (come l'iscrizione agli eventi), è necessario registrare un account fornendo un indirizzo email reale e valido.{"\n"}
            2. Sicurezza: L'utente è responsabile della riservatezza delle proprie credenziali di accesso. La piattaforma non si assume alcuna responsabilità legale per eventuali perdite derivanti dalla divulgazione della password da parte dell'utente.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Diritto d'Autore e Proprietà Intellettuale</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Proprietà: Tutti i contenuti originali contenuti nell'App (inclusi i testi del manuale, layout e loghi) appartengono all'**Associazione di Studenti e Scholars Cinesi dell'Università di Bologna (ASSCUBO)**. La riproduzione o l'uso commerciale non autorizzati sono severamente vietati.{"\n"}
            2. Contenuti di Terze Parti: Alcuni articoli visualizzati sono sincronizzati da account ufficiali WeChat. I diritti d'autore appartengono ai rispettivi autori o editori. L'App li mostra esclusivamente per scopi di utilità pubblica e scambi accademici.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Esclusione di Responsabilità</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Accuratezza dei Dati: Gli strumenti di utilità (es. stato dei treni, aule libere) recuperano i dati da servizi pubblici di terze parti. L'Associazione si impegna al massimo ma non garantisce l'accuratezza in tempo reale. Fare riferimento alle bacheche ufficiali per decisioni critiche.{"\n"}
            2. Link Esterni e Media: Gli annunci pubblicati possono contenere link esterni o allegati multimediali. Questi sono forniti solo per comodità di riferimento; l'Associazione non si assume alcuna responsabilità per la sicurezza, accuratezza o integrità di siti web o file di terzi.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Legge Applicabile</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            La validità, l'interpretazione e la risoluzione delle controversie ai sensi del presente accordo sono disciplinate dalle leggi della Repubblica Italiana e dai regolamenti applicabili dell'Unione Europea.
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
