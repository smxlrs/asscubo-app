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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>引言与特别提示</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            本隐私政策已于 2026 年 6 月 24 日更新并生效。{"\n"}
            请花一些时间熟悉我们的隐私政策，如果您有任何问题，请联系我们。{"\n"}
            本隐私政策适用于博洛尼亚大学中国学生学者联谊会（以下简称“学联”、“我们”或“本平台”）开发并运营的移动端应用“博学”（以下简称“本软件”或“博学”）。我们非常重视您的隐私。本隐私政策在制定时充分考虑到您的需求，您全面了解我们的个人信息收集和使用惯例，同时确保您最终能控制提供给我们的个人信息，这一点至关重要。本隐私政策规定我们如何收集、使用、披露、处理和存储您使用博学提供给我们的信息。本隐私政策下“个人信息”指以电子或者其他方式记录的与已识别或者可识别的自然人有关的各种信息，不包括匿名化处理后的信息。我们将严格遵守本隐私政策来使用这些信息。为了向您提供博学的各功能所对应的服务，我们会出于本隐私政策所述的以下目的，在您使用某些功能时，分别收集和使用您的以下各类信息。每项所对应的个人信息是否收集取决于您是否使用该项功能对应的服务，如果您不开启该项功能，则我们将不收集该项功能下对应的个人信息。但如果您不提供相关个人信息，我们可能无法向您提供该项个人信息对应功能的服务，也无法回应您遇到的问题。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>一、 我们如何收集和使用您的个人信息与系统权限使用明示</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>（一）您须授权我们收集和使用您个人信息的情形：</Text>{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. 账户注册服务与身份认证：</Text>当您选择注册并登录您的博学账户时，为了完成账户的创建、核实您的成员身份并维持账户的基本运行状态，我们需要您提供包括但不限于您的电子邮件地址、安全密码以及由您自愿填写的个性化昵称、自定义头像图片文件。在此过程中，我们会将该等数据传输至我们的安全云端服务器（Supabase）并作持久化存储。如您拒绝提供邮箱或设定密码，将无法完成注册流程并使用需要登录凭证的特权功能（例如活动在线报名系统等）。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. 设备识别、推送通知与触达服务：</Text>为了在学联发布重大公告、临时通知或动态文章时向您进行实时的精准推送，在您启动应用并取得您的系统推送授权后，我们会通过 Expo SDK 接口获取您的设备推送令牌（Expo Push Token）并将之安全存储至我们的数据库中。该推送令牌在且仅在接收云端消息发布请求时被用于识别接收目标，不会被用于任何商业营销或第三方广告画像。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. 匿名服务查询与缓存机制：</Text>当您在应用内使用“公交查询/公交定位”、“按车次/站台查询火车实时状态”以及“空教室占用情况查询”等便捷公共工具时，我们可能在设备本地生成并处理您的即时搜索请求。我们声明，除了设备本地运行所需的内存缓存外，我们绝不在云端服务器留存您的查询记录、浏览痕迹或建立任何能够关联至您个人身份的使用行为模型，您的该等查询行为在底层完全以去标识化的方式处理。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>4. 用户自主发布、图片上传及多媒体存储服务：</Text>针对被授权的学联管理员用户，为了支持其在发布通知或公告时附带直观的多媒体图文展示，或者普通用户在使用意见反馈系统、上传并修改个人头像时，我们会在经过您明确授权并打开系统相册或相机读写权限后，收集您选定的图像、视频等多媒体文件。该等文件将被安全上传并托管于 Supabase 存储空间（Storage Bucket）中以向您和相关用户进行下载分发。您有权随时删除您发布的内容，此时该等媒体文件将被彻底移除。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>5. 地理位置权限（GPS定位服务）明示：</Text>当您在公交查询模块中点击地图上的定位图示时，为了帮您定位当前所处的位置以展现最近的公交站点，本平台在获得您的显式系统级定位权限授权后，将在前端获取您当前设备的 GPS 经纬度位置信息。我们在此做出最严肃的承诺：该定位数据处理过程完全限制在您手机设备的本地沙盒中，仅用于地图上代表您当前坐标的蓝色图标记号的渲染和方向计算。我们绝不会将您的任何实时或历史地理位置坐标上传、共享或存储至任何云端服务器或第三方，亦不用于任何商业位置追踪。您可以通过系统“设置 - 权限管理”随时随地关闭定位授权，这不会影响您使用其他功能。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>6. 相册权限（Photo Library）与存储读写：</Text>为使您能够从设备本地相册选择图片作为您的头像、上传故障排查截图反馈，或者让管理员用户上传通知配图，本平台会向您申请相册读取及写入权限。我们只会在您显式点击从相册选取并上传的触发动作时，读取您主动选择并授权的那一张图片。我们绝不会在您不知情的情况下，以任何后台静默方式扫描、分析、抓取或读取您相册中的其他无关照片。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>7. 相机权限（Camera）相关免责声明：</Text>为了符合各大应用商店（如 Google Play、Apple App Store）的底层打包配置与权限合规声明，本平台的元配置文件中可能包含了对相机相关硬件调用的前置声明，以避免提交包体审核时因缺少配置文件配置而报错。我们在此向您明示：本平台的具体业务逻辑中不提供任何通过相机拍照、视频录制、条码扫描等实际操作入口。我们在任何场景下均绝不会、也无法以任何方式悄悄激活您的摄像头或收集任何源于相机的实时图像与视频流数据。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>8. 手机系统通知权限（Notifications）与默认通知类别：</Text>在您首次启动本平台，或在其需要通过通知中心通知您新消息时，系统将弹出通知授权框。经您授权后，我们将能向您的设备发送推送通知。需要特别声明的是，我们已在 Android 系统中针对本平台定制并注册了名为“常规通知”的通知类别（Notification Channel），其在系统级系统默认显示。您可随时通过手机的系统设置对该通知类别的优先级、声音、锁屏显示等进行完全定制或直接彻底关闭。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>二、 我们如何共享、转让、公开披露您的个人信息</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            我们非常重视个人信息的安全与保密，我们将遵循合法、正当、必要 and 诚信的原则使用您所授权的个人信息。我们在此向您保证：我们不会将您的个人数据出售、出租或以任何商业方式提供给任何第三方。除非在下列情形中，我们不会向任何第三方共享或转让您的个人信息：{"\n"}
            1. 获得您的明确同意或授权后；{"\n"}
            2. 根据法律法规规定、诉讼争议解决需要，或司法机关、行政机关等有权机关依法提出的强制性要求；{"\n"}
            3. 在法律要求或允许的范围内，为保护学联、学联成员及广大本平台的生命、财产安全或社会公共利益所必需；{"\n"}
            4. 在涉及学联换届、重组或解散等涉及本软件/本平台管理和维护主体变更的情形时，如涉及到个人信息转让，我们会要求新的持有您个人信息的组织继续受本隐私政策的约束，否则我们将要求该组织重新向您征求授权同意。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>三、 我们如何存储和保护您的个人信息安全</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            我们会采取符合业界标准的、合理可行的安全防护措施保护您提供的个人信息，以防止您的个人信息遭到未经授权的访问、公开披露、使用、修改、损坏或丢失。我们的所有网络通信数据均通过 HTTPS 协议加密传输，且数据被加密持久化存储在 Supabase 所托管的安全云端服务器中。我们对数据库访问权限实施最严格的物理与逻辑隔离控制。{"\n"}
            请您知悉并理解，互联网环境并非百分之百安全，我们将尽全力保障您发送给我们的任何信息的安全性。如果我们的物理、技术或管理防护设施遭到破坏，导致信息被非授权访问、公开披露、篡改或毁损，以致您的合法权益受损，我们将按照法律法规的要求，及时向您告知安全事件的基本情况和可能的影响、我们已采取或将要采取的处置措施、您可自主防范和降低风险的建议和对您的补救措施，并在法定时限内向监管部门上报。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>四、 您如何管理您的个人信息及行使 GDPR 权利</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            根据欧洲通用数据保护条例（GDPR）及其他适用法律法规，您对您的个人信息享有合法的访问、更正、删除等权利。{"\n"}
            我们深切地意识到每个人对隐私权的关注与保护诉求各不相同。因此，我们提供了一些示例与多维度的管控渠道，说明本平台提供的各种途径，供您进行灵活的自主选择，以限制我们对您个人信息的收集、使用、披露或处理，并对您的隐私权及安全设置进行精细化控制。这些权利将在最大程度上受到相关法律的保障，但也可能受到适用法律法规所明文规定的特定排除和例外情况的限制。具体而言：{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• 获得清晰知情权：</Text>就我们如何收集、使用、储存、处理您的个人信息以及您在隐私政策下所拥有的法定权利，您有权获得清晰、透明、公开且易于理解的信息与解释说明。这即是本隐私政策的主要宗旨与核心目的所在。{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• 访问并获取记录：</Text>基于您的合法合规书面要求及相关适用法律的规定，我们可向您免费提供一份我们已收集并处理的关于您个人信息的相关信息副本及历史记录。如您频繁、重复或超期提出对于相关信息的其他不合理请求，我们可能会在相关适用法律允许的前提下，根据实际所需的系统运维和人工管理成本，向您收取一笔合理且必要的技术服务费用。{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• 更正与完善：</Text>如果您认为我们所持久化持有的任何关于您的个人资料信息是不正确的、不完整的、或存在滞后失效的，您有权要求我们基于具体的使用目的与系统完整性进行及时的更正、补充与完善，您亦可通过相关设置菜单自行操作。{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• 账户注销与数据彻底抹除：</Text>您有权随时在「个人资料」设置页面中提交账户注销申请。一旦您确认注销并永久删除账户，我们将立即彻底抹除您在 Supabase 数据库中的所有登录凭证、注册邮箱、昵称、历史头像文件以及您报名的所有学联活动记录。该项操作在底层数据库中为硬删除（Hard Delete），一旦执行将绝对无法撤销或恢复。{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• 撤回授权：</Text>您可以通过关闭手机系统的 GPS 定位、相册访问、通知或相机声明等权限来随时撤回您的授权。当您撤回授权后，我们无法继续为您提供撤回授权所对应的特定功能服务，但这不影响您在此之前基于您的授权而已开展的个人信息处理的合法性。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>五、 未成年人信息保护</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            本软件主要面向高等教育学生及学者群体，但我们同样高度重视未成年人的个人信息保护。我们承诺绝不在明知的情况下主动收集、存储或保留任何未成年人的个人敏感信息。如果您是未满18周岁的未成年人，在您下载、注册、登录或实际使用本软件的各项功能与服务前，您必须在您的监护人的全程陪同、指导下共同仔细阅读本隐私政策的全部条款。您在使用本平台前，必须获得您的监护人对您提交个人信息的显式同意与明确认可。如果您的监护人不同意本隐私政策或拒绝提供未成年人使用本平台所必须的个人基础资料，您应当立即终止使用并卸载本软件。如果您或您的监护人认为我们在未获同意的情况下无意收集了未成年人的个人数据，请立即根据第七条联系我们，以便我们在核实后立即从服务器中将相关数据彻底删除。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>六、 本隐私政策的变更与修订</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            本隐私政策条款可能会根据本平台功能模块的增减、后台云数据库升级、底层第三方接口变动以及适用的数据保护法律（包括但不限于 GDPR 及意大利个人信息保护法）的最新修订，由学联在未提前个别通知您的情况下随时进行更正、行为限制、修改或补充。修订后的隐私政策一经在本平台公布即自动生效，并直接取代原有的隐私政策条款。我们强烈建议您定期、主动访问本隐私政策页面并重新阅读相关条款，以确保您能全面、及时地掌握本软件最新的隐私安全处理方针。若您在本隐私政策公布任何修订或更新后，继续登录、访问或以任何形式使用本软件所提供的各项功能、便捷小工具与系统接口，即表示您已充分阅读、完全理解并无保留地接受了修改后的新隐私政策的全部内容及约束。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>七、 联系我们</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            如果您对本隐私政策或本平台的数据处理惯例有任何疑问、意见、建议，或需要行使您的 GDPR 个人信息主体权利，包括但不限于要求查询、更正、限制处理或永久删除您的个人账户及关联的全部个人数据，请通过以下方式联系学联安全小组：{"\n"}
            博洛尼亚大学中国学生学者联谊会 (ASSCUBO){"\n"}
            电子邮箱：
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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Introduction & Special Notices</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            This Privacy Policy was updated and became effective on June 24, 2026.{"\n"}
            Please take some time to familiarize yourself with our privacy policy, and if you have any questions, please contact us. This Privacy Policy applies to the mobile application "Boxue" (hereinafter referred to as "the Software" or "Boxue") developed and operated by the Chinese Students and Scholars Association of the University of Bologna (hereinafter referred to as "ASSCUBO", "we", "us", or "our"). We value your privacy. It is crucial that you fully understand our collection and use of personal information, and ensure you retain control over the information you provide. This policy governs how we collect, use, process, disclose, and store your personal information when using our services. Under this framework, "Personal Information" refers to any data recorded electronically or otherwise that relates to an identified or identifiable natural person, specifically excluding anonymized datasets. We commit to utilizing all gathered materials strictly in compliance with the mandates laid out within this Agreement.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Data We Collect & System Permissions Usage</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Account Registration & Authentication: When you register, we collect and store your email address, password, nickname, and profile avatar securely on Supabase servers. Denial of this information will restrict access to authenticated services (like event sign-ups).{"\n"}
            2. Push Notifications & Touchpoint Services: With your permission, we store your Expo Push Token to deliver official announcements and updates. It is used strictly for routing system alerts.{"\n"}
            3. Anonymous Query Utility Services: Bus locations, train timetables, and empty classrooms query requests are processed locally or in memory. We do not build personal identifiers or track your query history on our servers.{"\n"}
            4. User-Generated Content Uploads: To support multi-media posts or custom profile avatars, we request access to storage/camera to read and upload select images to Supabase Storage. You can delete your content at any time.{"\n"}
            5. Geolocation Permission (GPS): The bus map centers on your position using GPS upon your explicit consent. Positioning processing takes place strictly inside the local sandbox on your device and is never uploaded, stored, or shared with cloud servers or third parties. Revocation of this permission can be done anytime via device system settings.{"\n"}
            6. Photo Library Access: Album read/write permissions are requested solely when you trigger image uploads (e.g. feedback, avatar). We never scan or access other files in your library.{"\n"}
            7. Camera Permission Declaration: Device config files include camera access declarations to satisfy app store submission criteria. The actual app logic does not activate or record camera video/audio in any scenario.{"\n"}
            8. Notification Channel Settings: A notification channel named "常规通知" (General Notifications) is created on Android. You can control notifications via system settings.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Sharing, Transferring, and Disclosing Information</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            We do not sell, rent, or commercialize your personal information with third parties. Sharing only occurs upon your explicit consent, to comply with applicable laws/regulations, or in cases of judicial enforcement.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Data Security & Storage</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            We protect your data using industry-standard SSL encryption for transport and database level isolation. In the event of a security breach, users will be notified immediately according to standard administrative guidelines.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. GDPR Rights & Deletion</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Under the GDPR, you have the right to access, rectify, and erase your personal information. You can permanently delete your account in the Profile screen. Once deleted, your records are immediately purged from our servers and cannot be recovered.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Contact Us</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Introduzione e Avvisi Speciali</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Ti invitiamo a dedicare un po' di tempo a comprendere la nostra informativa e a contattarci in caso di domande. La presente Informativa si applica all'applicazione mobile "Boxue" (di seguito denominata "il Software" o "Boxue") sviluppata e gestita dall'Associazione degli Studenti e Studiosi Cinesi dell'Università di Bologna (di seguito denominata "ASSCUBO", "noi" o "nostro"). Rispettiamo la tua privacy ed è essenziale che tu mantenga il controllo sulle tue informazioni personali. Ai sensi di questo documento, per "Dati Personali" si intende qualsiasi informazione registrata elettronicamente o in altro modo relativa a una persona fisica identificata o identificabile, esclusi i dati resi anonimi.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Dati Raccolti e Utilizzo dei Permessi</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            1. Registrazione e Autenticazione: Raccogliamo indirizzo e-mail, password, nickname e avatar memorizzandoli in sicurezza su Supabase. La negazione di questi dati impedisce l'iscrizione a determinati servizi (come gli eventi).{"\n"}
            2. Notifiche Push: Memorizziamo il Token Expo Push previa autorizzazione per inviarti annunci ufficiali. Viene utilizzato esclusivamente per inoltrare messaggi di sistema.{"\n"}
            3. Servizi di Query Anonimi: Le interrogazioni sugli autobus, sui treni o sulle aule libere vengono elaborate localmente. Non creiamo profili né tracciamo la cronologia delle tue ricerche.{"\n"}
            4. Caricamento File dell'Utente: Richiediamo l'accesso all'album per consentirti di selezionare e caricare immagini per avatar o feedback a Supabase Storage. Puoi rimuovere i file caricati quando vuoi.{"\n"}
            5. Posizione Geografica (GPS): La mappa dell'autobus centra la tua posizione tramite GPS solo previo tuo consenso. L'elaborazione avviene unicamente a livello locale e non viene mai caricata su server cloud o condivisa con terzi.{"\n"}
            6. Libreria Foto: I permessi di lettura/scrittura vengono utilizzati solo quando selezioni un'immagine. Non eseguiamo scansioni di altri file multimediali.{"\n"}
            7. Autorizzazione Fotocamera: Le impostazioni del pacchetto includono la dichiarazione per la fotocamera solo per conformità con le linee guida degli store. L'applicazione non attiva né registra immagini in nessuna circostanza.{"\n"}
            8. Impostazioni Notifiche: Un canale denominato "常规通知" (Notifiche Generali) viene creato su Android. Puoi configurarlo liberamente nelle impostazioni del dispositivo.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Condivisione e Divulgazione</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Non vendiamo né cediamo i tuoi dati a terzi. La condivisione dei dati personali avviene solo su esplicito consenso dell'interessato o per adempiere a requisiti di legge o ordine giudiziario.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Sicurezza e Conservazione dei Dati</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Proteggiamo i tuoi dati utilizzando crittografia SSL avanzata. In caso di violazioni di sicurezza, l'Associazione si impegna a notificare tempestivamente gli interessati secondo le linee guida stabilite.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Diritti GDPR ed Eliminazione</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Ai sensi del GDPR, hai il diritto di accesso, rettifica e cancellazione dei tuoi dati. Puoi eliminare definitivamente il tuo account dalla schermata del profilo personale. I record verranno rimossi definitivamente senza possibilità di recupero.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Contattaci</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  langSection: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 22,
    marginBottom: 10,
  },
  detailParagraph: {
    fontSize: 16,
    lineHeight: 28,
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
});
