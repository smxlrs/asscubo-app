import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const { colors } = useTheme();

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
        
        {/* Trilingual Notice */}
        <View style={[styles.langNoticeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.langNoticeText, { color: colors.textSecondary }]}>
            有关隐私政策的英语和意大利语版，您可在中文版的下方找到。{"\n"}
            For the English and Italian versions of the Privacy Policy, please scroll down below the Chinese version.{"\n"}
            Le versioni in inglese e italiano dell'Informativa sulla Privacy sono disponibili scorrendo sotto la versione cinese.
          </Text>
        </View>

        {/* Chinese Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>引言与特别提示</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            本隐私政策已于 2026 年 6 月 24 日更新并生效。{"\n"}
            请花一些时间熟悉我们的隐私政策，如果您有任何问题，请联系我们。{"\n"}
            本隐私政策适用于博洛尼亚大学中国学生学者联谊会（以下简称“学联”或“我们”）开发并运营的移动端应用“博学”（以下简称“本软件”或“本平台”）。我们非常重视您的隐私。本隐私政策在制定时充分考虑到您的需求，您全面了解我们对个人信息的收集和使用惯例，同时确保您最终能控制提供给我们的个人信息，这一点至关重要。本隐私政策规定我们如何收集、使用、披露、处理和存储您使用本软件提供给我们的信息。本隐私政策下“个人信息”指以电子或者其他方式记录的与已识别或者可识别的自然人有关的各种信息，不包括匿名化处理后的信息。我们将严格遵守本隐私政策来使用这些信息。为了向您提供本软件的各功能所对应的服务，我们会出于本隐私政策所述的以下目的，在您使用某些功能时，分别收集和使用您的以下各类信息。每项所对应的个人信息是否收集取决于您是否使用该项功能对应的服务，如果您不开启该项功能，则我们将不收集该项功能下对应的个人信息。但如果您不提供相关个人信息，我们可能无法向您提供该项个人信息对应功能的服务，也无法回应您遇到的问题。
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
            我们非常重视个人信息的安全与保密，我们将遵循合法、正当、必要和诚信的原则使用您所授权的个人信息。我们在此向您保证：我们不会将您的个人数据出售、出租或以任何商业方式提供给任何第三方。除非在下列情形中，我们不会向任何第三方共享或转让您的个人信息：{"\n"}
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
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• 访问并获取记录：</Text>基于您的合法合规书面要求及相关适用法律的规定，我们可向您免费提供一份我们已收集并处理的关于您个人信息的相关信息副本及历史记录。如您频繁、重复或无正当理由地提出同类请求，我们可能在相关适用法律允许的范围内，合理拒绝响应该请求。{"\n"}{"\n"}
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
            如果您对本隐私政策或本平台的数据处理惯例有任何疑问、意见、建议，或需要行使您的 GDPR 个人信息主体权利，包括但不限于要求查询、更正、限制处理或永久删除您的个人账户及关联的全部个人数据，请通过以下方式联系学联：{"\n"}
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
            This Privacy Policy was last updated and became effective on June 24, 2026.{"\n"}
            Please take a few moments to thoroughly familiarize yourself with our Privacy Policy. If you have any questions, concerns, or feedback, please contact us immediately.{"\n"}
            This Privacy Policy applies to the mobile application "Boxue" (hereinafter referred to as "the Software" or "Boxue") developed, operated, and maintained by the Chinese Students and Scholars Association of the University of Bologna (hereinafter referred to as "ASSCUBO", "the Association", "we", "us", or "our"). We take your personal privacy extremely seriously. In drafting this Privacy Policy, we have fully considered your privacy preferences, expectations, and requirements. It is of paramount importance that you achieve a comprehensive and transparent understanding of our personal data collection, processing, and usage practices, while ensuring that you ultimately retain absolute, granular control over the personal information you choose to provide to us. This policy outlines how we collect, use, disclose, process, transmit, and store the information you submit when using Boxue. Under this policy, "Personal Information" refers to any information recorded electronically or through other means that relates to an identified or identifiable natural person, excluding anonymized data. We strictly adhere to this Privacy Policy in processing and utilizing such information. To deliver the various features and services of Boxue, we will collect and use your personal information for the specific purposes described herein. Whether specific categories of personal information are collected depends entirely on whether you utilize the corresponding feature or service. If you do not enable or use a specific functionality, we will not collect any corresponding personal information. However, please be advised that if you choose not to provide the requested personal information, we may not be able to offer you the corresponding services, nor will we be able to respond to or resolve any technical or service issues you encounter.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. How We Collect and Use Your Personal Information & System Permissions</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>(A) Circumstances under which you must authorize us to collect and use your personal information:</Text>{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Account Registration and Identity Authentication:</Text> When you choose to register and log in to your Boxue account, in order to complete account creation, verify your membership status, and maintain the basic operational status of your account, we require you to provide information including but not limited to your email address, a secure password, and optionally a self-defined nickname and custom profile photo/avatar. During this process, this data is transmitted to our secure cloud servers (hosted by Supabase) for persistent storage. If you refuse to provide an email address or set a password, you will not be able to complete the registration process or use privileges that require login credentials (such as the online registration system for association activities).{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Device Identification and Push Notifications:</Text> To deliver real-time, accurate, and vital announcements, notifications, or newsletters published by ASSCUBO, we will access your device's Expo Push Token via the Expo SDK interface after the app launches and you grant system-level notification permissions. This token is stored securely in our database and is used strictly for routing cloud message delivery requests. It will never be used for commercial marketing, advertising profiling, or shared with third-party tracking networks.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. Anonymous Search Query and Caching Mechanisms:</Text> When you use the convenient public transit locator, train status tracker, or empty classroom queries within Boxue, we process your search requests locally on your device. We solemnly declare that, except for the temporary in-memory cache required for local execution, we do not log, track, or compile your search histories or build any behavioral profiles linked to your identity. All queries are handled in a strictly de-identified manner.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>4. User-Generated Content & Multimedia Uploads:</Text> For authorized ASSCUBO administrators to upload descriptive images/media alongside notices, or for regular users uploading bug report screenshots or editing profile photos, the platform will request system permissions to access your camera and photo library. Selected media files are securely uploaded and hosted in Supabase Storage buckets for distribution and download. You retain the right to delete your content at any time, which permanently removes the associated media files from our storage.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>5. Geolocation Permission (GPS) Notice:</Text> When you tap the positioning icon in the transit module to center the map and find the nearest bus stops, the platform will request system-level GPS location access. We make the most solemn pledge: this geolocation processing is restricted entirely to your local device sandbox for real-time map rendering. We never upload, store, or share your coordinates with our cloud servers or any third parties, and we do not track your movements. You can revoke this permission anytime via your system settings without affecting other features.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>6. Photo Library Access:</Text> Photo library read and write access is requested solely to allow you to select a profile avatar or upload screenshots for feedback. We only access the specific image you explicitly choose to upload. The platform will never scan, index, analyze, or retrieve other photos or media in your device library in the background.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>7. Camera Permission Disclaimer:</Text> To comply with configurations and security requirements of major app stores (e.g., Apple App Store, Google Play Store), camera permission declarations may be included in our application metadata to prevent build deployment errors. However, we explicitly state that the actual app interface contains no active camera capturing logic. We do not, under any circumstance, activate your camera or record any real-time video/photo feeds.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>8. System Notifications Channel:</Text> When the app requests notification authorization, a custom notification channel named "常规通知" (General Notifications) is registered on Android. This channel operates under default system priorities. You have complete control to customize its priority, sound, lock-screen visibility, or disable it entirely via your phone's system settings.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. How We Share, Transfer, and Disclose Your Personal Information</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            We place the highest value on the confidentiality and security of your personal data. We strictly follow the principles of lawfulness, fairness, necessity, and integrity in utilizing the personal information you authorize. We hereby guarantee that we will never sell, lease, or commercially exploit your personal data in any way to third parties. We will not share, transfer, or disclose your personal information with any third party except under the following specific circumstances:{"\n"}
            1. Upon obtaining your explicit prior consent or authorization;{"\n"}
            2. In accordance with applicable laws, regulations, legal procedures, litigation requirements, or mandatory administrative or judicial enforcement requests;{"\n"}
            3. To the extent required or permitted by law, to protect the vital interests, safety, property, or life of ASSCUBO, its members, users of the platform, or the general public;{"\n"}
            4. In the event of an ASSCUBO leadership transition, committee restructuring, or association dissolution involving a change in the management and maintenance entity of the Software/Platform. If personal information transfer is required during such transitions, we will demand that the successor entity continue to be bound by this Privacy Policy, or otherwise require them to seek your explicit consent again.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. How We Store and Protect Your Personal Information</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            We employ industry-standard, reasonable, and feasible security protection measures to safeguard the personal information you provide, preventing unauthorized access, disclosure, use, alteration, damage, or loss of your data. All network communications are encrypted via HTTPS, and data is stored securely in encrypted databases hosted on Supabase servers. Access controls are strictly managed at both physical and logical levels.{"\n"}
            Please understand that despite our rigorous efforts, no transmission of data over the internet or wireless networks can be guaranteed to be 100% secure. If a security breach occurs and our physical, technical, or administrative defenses are compromised, resulting in unauthorized access, disclosure, alteration, or destruction of data, we will promptly inform you in accordance with legal requirements. This notification will details the nature and possible impact of the event, the remediation steps we have taken or will take, suggestions on how you can mitigate risks, and available remedies. We will also report the incident to regulatory authorities within the legally prescribed timeframe.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. How You Manage Your Personal Information and Exercise Your GDPR Rights</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Under the European Union's General Data Protection Regulation (GDPR) and other applicable data protection laws, you possess legal rights regarding your personal information, including the right of access, rectification, erasure, and restriction of processing.{"\n"}
            We deeply recognize that every individual's concerns and expectations regarding privacy protection vary. Therefore, we provide multiple channels and configuration settings within the platform to allow you to flexibly control, restrict, and manage how we collect, use, and process your personal information. These rights are subject to applicable legal frameworks, and may be restricted by specific exclusions and exceptions defined under relevant regulations. Specifically:{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Right to be Informed:</Text> You have the right to receive clear, transparent, public, and easily understandable information and explanations regarding how we collect, use, store, process, and protect your personal information, and what statutory rights you possess. This is the primary objective of this Privacy Policy.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Right of Access and Portability:</Text> Upon your written request, we will provide a copy and historical record of the personal data we have collected and processed concerning you, free of charge. If you make excessive, repetitive, or unreasonable requests, we reserve the right to charge a reasonable administrative fee based on actual technical service and labor costs, to the extent permitted by law.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Right to Rectification:</Text> If you believe that any personal information we hold about you is inaccurate, incomplete, or outdated, you have the right to request that we correct, supplement, or update it immediately. You can also perform such corrections directly within the settings menu.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Account Cancellation and Permanent Erasure:</Text> You have the right to request the deletion of your account at any time via the "Profile" settings page. Once you confirm the permanent cancellation of your account, we will completely purge all your credentials, registration email, nickname, profile images, and event registrations from the Supabase database. This operation is executed as a database "Hard Delete" and is completely irreversible.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Right to Withdraw Consent:</Text> You can withdraw your consent at any time by disabling location services, photo library access, notifications, or camera declarations in your device settings. Once consent is withdrawn, we will cease providing the services linked to those permissions, but this will not affect the lawfulness of any processing carried out prior to the withdrawal.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Protection of Minor's Information</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Although the Software is primarily designed for higher education students and scholars, we are committed to protecting the privacy of minors. We do not knowingly collect, store, or process any personal data of minors. If you are under the age of 18, you must read this Privacy Policy in its entirety under the guidance and supervision of your parent or legal guardian before downloading, registering, or using the Software. You must obtain explicit consent from your guardian before submitting any personal data. If your guardian objects to this policy, you must immediately stop using and uninstall the Software. If you believe we have inadvertently collected information from a minor without guardian consent, please contact us immediately so we can verify and delete the data.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Amendments to the Privacy Policy</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            We reserve the right to modify, amend, or supplement this Privacy Policy at any time without individual notice to adapt to changes in app features, database configurations, third-party APIs, or data protection laws (such as GDPR and Italian privacy regulations). Any revised policy will become effective immediately upon publication on the platform, superseding previous versions. We recommend that you check this page periodically to stay informed about our data handling practices. Your continued use of the Software after any updates indicates your complete and unconditional acceptance of the revised Privacy Policy.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Contact Us</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            If you have any questions, feedback, suggestions, or wish to exercise your GDPR rights, please contact the ASSCUBO security group:{"\n"}
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
            La presente Informativa sulla Privacy è stata aggiornata ed è entrata in vigore il 24 giugno 2026. Si prega di dedicare il tempo necessario a familiarizzare con le nostre pratiche sulla privacy; in caso di domande, dubbi o feedback, non esitate a contattarci immediatamente.{"\n"}
            La presente Informativa si applica all'applicazione mobile "Boxue" (di seguito denominata "il Software" o "Boxue") sviluppata, gestita e mantenuta dall'Associazione di Studenti e Studiosi Cinesi dell'Università di Bologna (di seguito denominata "ASSCUBO", "l'Associazione", "noi", "ci" o "nostro"). Attribuiamo la massima importanza alla tutela della privacy dei nostri utenti. Questa informativa è stata redatta tenendo conto delle vostre esigenze ed aspettative; è essenziale che comprendiate appieno le modalità di raccolta, trattamento e utilizzo delle informazioni personali, garantendo al contempo il controllo finale sui dati forniti. Regola il modo in cui raccogliamo, utilizziamo, divulghiamo, elaboriamo, trasmettiamo e memorizziamo i dati forniti durante l'uso di Boxue. Ai fini della presente informativa, per "Informazioni Personali" si intende qualsiasi dato registrato elettronicamente o con altri mezzi che riguardi una persona fisica identificata o identificabile, esclusi i dati resi anonimi. Utilizzeremo tali dati esclusivamente in conformità con la presente Informativa. Al fine di fornire i servizi corrispondenti alle varie funzionalità di Boxue, raccoglieremo e utilizzeremo i vostri dati personali per le finalità descritte di seguito. La raccolta dipende dall'uso delle singole funzioni; se non utilizzate una determinata funzionalità, i relativi dati non verranno raccolti. Tuttavia, il mancato conferimento di tali dati potrebbe impedirci di fornire il relativo servizio o di rispondere alle vostre segnalazioni.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Dati Raccolti e Utilizzo dei Permessi</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>(A) Circostanze in cui è necessario autorizzare la raccolta e l'utilizzo dei dati personali:</Text>{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Registrazione dell'Account e Autenticazione dell'Identità:</Text> Quando decidete di registrarvi e accedere al vostro account Boxue, al fine di completare la creazione dell'account, verificare il vostro stato di membro e mantenere lo stato operativo di base dell'account, richiediamo di fornire informazioni quali l'indirizzo e-mail, una password sicura e, facoltativamente, un nickname personalizzato e un'immagine del profilo/avatar. Questo processo comporta la trasmissione e la memorizzazione persistente di tali dati sui nostri server cloud sicuri gestiti tramite Supabase. In caso di rifiuto a fornire l'e-mail o la password, non sarà possibile completare la registrazione o accedere alle funzionalità riservate (come il sistema di iscrizione online alle attività dell'associazione).{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Identificazione del Dispositivo e Notifiche Push:</Text> Per inviare comunicazioni importanti, annunci ufficiali o articoli in tempo reale pubblicati da ASSCUBO, acquisiremo l'Expo Push Token del vostro dispositivo tramite l'interfaccia Expo SDK previo vostro consenso alle notifiche di sistema. Questo token viene memorizzato in modo sicuro nel nostro database ed è utilizzato esclusivamente per l'instradamento degli avvisi. Non sarà mai impiegato per scopi di marketing commerciale, profilazione pubblicitaria o condiviso con reti di tracciamento di terze parti.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. Query di Ricerca Anonime e Meccanismi di Caching:</Text> Quando utilizzate gli strumenti per il controllo dei trasporti pubblici locali, dello stato dei treni in tempo reale o delle aule libere all'interno di Boxue, le richieste vengono elaborate interamente sul vostro dispositivo locale. Dichiariamo solennemente che, ad eccezione della cache temporanea in memoria richiesta per l'esecuzione sul dispositivo, non registriamo, tracciamo o compiliamo la cronologia delle vostre ricerche e non costruiamo profili comportamentali. Tutte le query sono gestite in modo completamente anonimo.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>4. Caricamento di Contenuti Generati dall'Utente e File Multimediali:</Text> Per consentire agli amministratori ASSCUBO di allegare immagini descrittive agli annunci o agli utenti comuni di caricare screenshot di feedback e modificare l'avatar del profilo, la piattaforma richiederà l'accesso alla fotocamera e alla galleria fotografica. I file selezionati verranno caricati e ospitati in modo sicuro nei bucket di archiviazione Supabase per la distribuzione. L'utente ha il diritto di eliminare i propri contenuti in qualsiasi momento, rimuovendo definitivamente i file dai nostri server.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>5. Autorizzazione alla Geolocalizzazione (GPS):</Text> Quando toccate l'icona di posizionamento nella mappa dei trasporti, il Software utilizzerà l'accesso GPS di sistema previa vostra autorizzazione. Promettiamo solennemente che l'elaborazione dei dati geografici avviene esclusivamente nella sandbox locale del vostro dispositivo per il rendering in tempo reale sulla mappa. Non carichiamo, memorizziamo o condividiamo le vostre coordinate con i nostri server cloud o con terze parti, né tracciamo i vostri spostamenti. Potete revocare questa autorizzazione in qualsiasi momento dalle impostazioni del telefono senza compromettere l'uso di altre funzioni.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>6. Accesso alla Galleria Fotografica:</Text> L'autorizzazione di lettura/scrittura della galleria è richiesta solo quando selezionate esplicitamente un file da caricare (es. feedback, avatar). Non effettuiamo alcuna scansione, indicizzazione o recupero in background di altre immagini nella memoria del dispositivo.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>7. Dichiarazione sull'Uso della Fotocamera:</Text> Per soddisfare i requisiti di configurazione e sicurezza degli app store (es. Google Play Store, Apple App Store), i file di configurazione potrebbero includere la dichiarazione di accesso alla fotocamera per evitare errori di compilazione. Specifichiamo tuttavia che l'applicazione non contiene codice attivo per l'attivazione della fotocamera o la registrazione di video/foto in nessun modulo operativo. Non attiviamo in alcun caso la fotocamera del vostro dispositivo.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>8. Canali di Notifica di Sistema:</Text> Quando l'applicazione richiede l'autorizzazione alle notifiche, viene registrato su Android un canale personalizzato denominato "常规通知" (Notifiche Generali). Questo canale opera con le priorità di sistema standard. Potete personalizzarne la priorità, il suono, la visibilità sulla schermata di blocco o disattivarlo completamente tramite le impostazioni di sistema del dispositivo.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Condivisione, Trasferimento e Divulgazione delle Informazioni</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Attribuiamo il massimo valore alla riservatezza e alla sicurezza dei vostri dati personali. Seguiamo rigorosamente i principi di liceità, correttezza, necessità e trasparenza nell'utilizzo delle informazioni personali da voi autorizzate. Garantiamo che non venderemo, affitteremo o sfrutteremo commercialmente in alcun modo i vostri dati personali a terzi. Non condivideremo, trasferiremo o divulgheremo i vostri dati personali a terzi tranne che nei seguenti casi specifici:{"\n"}
            1. Previo vostro consenso o autorizzazione esplicita;{"\n"}
            2. In conformità con le leggi, i regolamenti applicabili, le procedure legali o su richiesta obbligatoria delle autorità giudiziarie o amministrative competenti;{"\n"}
            3. Nei limiti richiesti o consentiti dalla legge, per proteggere la sicurezza, i beni o la vita dell'ASSCUBO, dei suoi membri, degli utenti della piattaforma o del pubblico;{"\n"}
            4. In caso di rinnovo delle cariche dell'ASSCUBO, riorganizzazione del comitato o scioglimento dell'associazione che comporti il trasferimento del Software/Piattaforma a un XML di terze parti. In tal caso, richiederemo che il successore continui a essere vincolato dalla presente Informativa, o altrimenti che richieda nuovamente il vostro consenso esplicito.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Sicurezza e Conservazione dei Dati Personali</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Adottiamo misure di sicurezza adeguate, ragionevoli e conformi agli standard del settore per proteggere le informazioni personali fornite, prevenendo l'accesso non autorizzato, la divulgazione, l'uso, la modifica, il danneggiamento o la perdita dei dati. Tutte le comunicazioni di rete sono crittografate tramite HTTPS e i dati vengono memorizzati in modo sicuro in database crittografati ospitati sui server Supabase. L'accesso è controllato rigorosamente a livello fisico e logico.{"\n"}
            Si prega di comprendere che, nonostante i nostri sforzi, nessuna trasmissione di dati su Internet o reti wireless può essere garantita come sicura al 100%. In caso di violazione della sicurezza e compromissione delle nostre difese fisiche, tecniche o amministrative, vi informeremo tempestivamente in conformità con i requisiti di legge. Questa notifica includerà i dettagli dell'evento, le misure che abbiamo adottato o adotteremo per rimediare, i suggerimenti per ridurre al minimo i rischi e i rimedi disponibili. Segnaleremo inoltre l'incidente alle autorità di vigilanza entro i termini prescritti dalla legge.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Gestione delle Informazioni Personali e Diritti GDPR</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Ai sensi del Regolamento Generale sulla Protezione dei Dati (GDPR) dell'Unione Europea e di altre leggi applicabili, l'utente gode dei diritti legali riguardanti i propri dati personali, inclusi i diritti di accesso, rettifica, cancellazione e limitazione del trattamento.{"\n"}
            Riconosciamo che le preoccupazioni e le aspettative di ciascun individuo riguardo alla protezione della privacy variano. Pertanto, forniamo molteplici canali e impostazioni di configurazione all'interno della piattaforma per consentirvi di controllare e gestire in modo flessibile il modo in cui raccogliamo e trattiamo i vostri dati. Tali diritti sono soggetti alle normative applicabili e possono essere limitati da specifiche esclusioni. In particolare:{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Diritto all'Informazione:</Text> Avete il diritto di ricevere informazioni chiare, trasparenti e facilmente comprensibili sulle modalità di raccolta, utilizzo, conservazione e protezione dei vostri dati. Questo è l'obiettivo principale di questa informativa.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Diritto di Accesso e Portabilità:</Text> Su vostra richiesta scritta, forniremo una copia e lo storico dei dati personali da noi raccolti, gratuitamente. In caso di richieste eccessive, ripetitive o infondate, ci riserviamo il diritto di addebitare un costo amministrativo ragionevole basato sulle spese effettive di elaborazione.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Diritto di Rettifica:</Text> Se ritenete che i dati in nostro possesso siano imprecisi, incompleti o obsoleti, avete il diritto di richiederne la correzione o l'integrazione immediata. Potete effettuare tali modifiche anche direttamente dal menu delle impostazioni.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Cancellazione dell'Account (Diritto all'Oblio):</Text> Avete il diritto di richiedere la cancellazione permanente del vostro account dalla pagina "Profilo". Una volta confermata la cancellazione, elimineremo definitivamente le credenziali, l'e-mail, il nickname, le immagini del profilo e le iscrizioni agli eventi dal database Supabase. Questa operazione viene eseguita come "Hard Delete" e non è reversibile.{"\n"}{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>• Revoca del Consenso:</Text> È possibile revocare il consenso in qualsiasi momento disattivando i servizi di localizzazione, l'accesso alla galleria, le notifiche o la fotocamera nelle impostazioni del dispositivo. La revoca non pregiudica la liceità del trattamento basata sul consenso prima della revoca.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Tutela dei Dati dei Minori</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Sebbene il Software sia destinato principalmente a studenti e studiosi universitari, ci impegniamo a proteggere la privacy dei minori. Non raccogliamo consapevolmente dati personali di minori. Se avete meno di 18 anni, dovete leggere la presente Informativa insieme ai vostri genitori o tutori legali prima di scaricare, registrarvi o utilizzare il Software. È necessario ottenere il consenso esplicito dei genitori prima di inviare dati personali. In caso contrario, l'uso deve essere interrotto immediatamente. Se ritenete che abbiamo raccolto involontariamente dati di un minore senza consenso, contattateci per la cancellazione immediata.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Modifiche e Revisioni dell'Informativa</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Ci riserviamo il diritto di modificare o integrare la presente Informativa in qualsiasi momento e senza preavviso individuale, per adeguarci a variazioni del Software, del database o delle normative vigenti (come GDPR e leggi italiane). Le modifiche saranno efficaci immediatamente dopo la pubblicazione sulla piattaforma. Si consiglia di verificare periodicamente questa pagina. L'uso continuato del Software dopo la pubblicazione delle modifiche costituisce accettazione implicita delle stesse.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Contact Us / Contatti</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Per domande, feedback o per esercitare i diritti previsti dal GDPR, contattare il team ASSCUBO:{"\n"}
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
  langNoticeCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  langNoticeText: {
    fontSize: 14,
    lineHeight: 22,
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
