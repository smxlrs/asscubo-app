import React from 'react';
import { StyleSheet, Text, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsScreen() {
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>用户协议 / Terms of Service</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>用户协议 / Terms of Service / Condizioni d'Uso</Text>
        
        {/* Trilingual Notice */}
        <View style={[styles.langNoticeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.langNoticeText, { color: colors.textSecondary }]}>
            有关用户协议的英语和意大利语版，您可在中文版的下方找到。{"\n"}
            For the English and Italian versions of the User Agreement, please scroll down below the Chinese version.{"\n"}
            Le versioni in inglese e italiano dell'Accordo per gli Utenti sono disponibili scorrendo sotto la versione cinese.
          </Text>
        </View>

        {/* Chinese Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>特别提示与引言</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            欢迎您选择使用博学应用及相关数字化平台服务（以下简称“本平台”或“本软件”）。本用户使用协议（以下简称“本协议”）是您（以下称“用户”或“您”）与博洛尼亚大学中国学生学者联谊会（以下简称“学联”或“我们”）就您下载、安装、注册、登录、访问、使用本软件及享受我们提供的相关数字化资讯与公共服务所订立的具有完全法律效力的正式契约。{"\n"}
            我们在此特别提醒您，在您下载并启动本软件、或进行账户注册、数据查询等任何操作前，请您务必以极其审慎的态度阅读并充分理解本协议中的各项条款。当您实际开展下载、安装、注册、登录本软件、或以任何形式实际访问和使用本平台所涵盖的任何工具、资料或服务的行为时，即代表您已被视为已阅读、充分理解、且毫无保留地自愿接受并同意遵守本协议所有条款的法律约束。如果您不同意本协议的任何条款，或者您对本协议的条款内容持有任何不理解、不赞同或无法完全遵守的异议，请您立即停止下载、安装并卸载、清除本软件的全部数据，切勿进行任何实际的访问和使用。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>一、 账户注册、登录与账号安全规范</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. 账户注册条件与凭证：</Text>本软件的特定功能（包括但不限于学联活动在线报名、个人设置定制等）要求您在客户端通过真实的电子邮箱地址完成账户注册并设定独立的安全密码。您承诺在注册过程中提供的信息真实、有效且不带有任何欺骗性、误导性或侵犯第三方合法权利的成分。如您的相关注册数据发生变更，您有义务及时通过关于页面中的「个人资料」设置页面进行自主更新。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. 账号的专有权与保密责任：</Text>您所注册的账户仅供您本人以非商业性、公益性的目的使用，您不得将该账户以任何形式出租、出借、质押、赠与、转让或与任何第三方共享。您有责任完全保护您的账户登录凭证（包括邮箱地址、密码等）的安全和私密性。任何因您泄露密码、将密码透露给他人、或因您的设备遭到黑客攻击、木马侵入等由于您自身监管不力而导致的账户被盗用、数据泄露、名义报名失效、成员权限冒用等全部直接或间接损失，应由您自行承担，本学联在法律允许的最大范围内不承担任何法律责任及连带赔偿责任。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>二、 平台服务内容及第三方数据使用限制明示与免责说明</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. 数据来源与公益属性：</Text>本平台集成了多项用于便利日常校园生活的便捷小工具，包括但不限于“实时火车状态与站台查询”、“公交线路查询及定位”、“空教室占用情况查询”等。我们在此向您明示：该等小工具所展示的数据均实时、动态地检索自公共的第三方公开服务接口（例如意大利铁路系统公开数据源、博洛尼亚地方公共交通网络、学校官方排课与教室开放排表系统）。本平台仅基于方便学联成员的公益性原则提供数据的前端聚合展现，绝不代表我们对上述第三方数据的完整性、绝对准确性、绝对实时性或可用性做任何默示或明示的保证。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. 物理核对优先原则：</Text>鉴于网络延迟、第三方接口中断、服务器故障等不可抗力技术因素，本软件展示的数据结果仅供您在普通出行、学习规划时作为一般性便利参考。您在面临重要出行、考试、选课、重要学术会议等关键决策时，必须以相关火车站的实体物理站牌、学校官方公布的布告栏或学校教务系统的实时通知为唯一的最终执行准则。我们对于您因依赖本软件的数据差错、延迟、中断而引发的任何形式的迟到、误车、考试缺席等间接或直接损失，不承担任何法律责任。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. 外部链接之独立性：</Text>学联管理人员在发布学联通知、新闻或文章时，可能根据需要包含跳转至第三方网站的外部链接或图片媒体。这些链接和图片仅为方便参考而设。我们对任何第三方外部链接的安全状况、内容真实性、隐私政策或运营行为均无控制权，亦不承担任何法律责任。您访问该等链接的风险由您自身完全承担。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>三、 版权、知识产权与内容合规</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. 原创知识产权归属：</Text>本软件的整体界面设计、页面布局、图标按钮、学联官方标志（LOGO）以及由学联组织人员整理编写的诸如“新生手册”、“办事指南”等原创图文内容的版权和全部知识产权，均独占性地归属于 博洛尼亚大学中国学生学者联谊会。未经我们明确的、书面的前置授权许可，任何个人、团体或第三方机构不得擅自进行复制、传播、分发、镜像、反向工程、建立超链接或将其用于任何商业及盈利性目的。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. 微信公众号文章同步：</Text>本软件中展示的部分关于文章与资讯内容系通过接口自动同步或手动转载自学联的微信官方公众号。该等文章中包含的图文知识产权归属于原作者或对应的学联官方号主体。本软件中该部分的展示仅限于学联内部非商业性的公益信息共享，任何第三方不得擅自抓取、倒卖或用作他途。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>四、 用户行为规范与禁止性活动</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            您在使用本软件及本平台提供的各项服务时，必须严格遵守适用的中国法律法规、意大利共和国法律、适用的欧洲联盟法律法规（包括欧盟《数字服务法》、《通用数据保护条例》等）以及博洛尼亚大学的各项校园纪律与管理规定。您在此不可撤销地承诺：绝不利用本平台从事任何违反法律法规、危害计算机网络安全、损害学联公共声誉与形象、或侵犯任何第三方合法权益的活动。对于任何违反本规范的行为，本平台保留封禁账户、配合司法调查并追究法律责任的全部权利。具体禁止性活动与恶意行为包括但不限于：{"\n"}
            1. 上传、发布、传播、链接或通过其他方式向本平台输入任何具有诽谤性、欺诈性、侮辱性、暴力倾向、淫秽色情、种族或性别歧视、宗教偏激、侵害他人名誉权及隐私权、或损害学联及社会公共利益的内容；{"\n"}
            2. 恶意注册、租借、倒卖账户，或者利用本软件的系统设计缺陷、漏洞、外部插件、自动化脚本（如抢票机器人、爬虫程序）批量注册或自动获取学联活动报名资格，破坏其他同学平等、公正地参与学联活动与校园文化建设的权利；{"\n"}
            3. 对本平台的客户端软件进行反编译、反汇编、反向工程、拆解、调试或试图实施任何形式 of 系统破解，或试图探测、分析、窃取 Supabase 后台数据库连接凭证、系统接口设计及云服务器安全屏障；{"\n"}
            4. 利用本平台提供的意见反馈通道、多媒体发布通道发送任何未经许可的商业广告、促销链接、垃圾邮件、传销内容或包含计算机病毒、特洛伊木马、恶意监控程序的破坏性文件；{"\n"}
            5. 冒用学联管理员、学生干部、学校教务人员或其他成员的身份发布虚假公告、筹款或进行网络钓鱼、网络欺诈活动。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>五、 平台免责声明与服务终止</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. 系统现状与可用性担保免除：</Text>本平台所提供的各项数字化信息及辅助性查询小工具均按“现状”（As Is）及“现有”（As Available）状态向您呈现。学联在此以最明确的方式免除对于本软件运行稳定性、完全无差错性、无间断性、无漏洞性、完全兼容性、或无毒无害性所做出的任何形式的口头或书面担保。由于设备硬件故障、通信网络波动、云服务提供商（Supabase 等）维护、不可抗力事件等外部因素导致的系统宕机、数据同步失效、报名记录丢失或通信延迟，学联不承担任何民事赔偿责任。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. 间接损失免除：</Text>在适用的法律法规允许的最大限度内，本平台及学联的所有管理人员、志愿开发者，对于您因下载、安装、使用或无法使用本平台而引发的任何形式的直接的、间接的、附带的、特别的或后果性的损害、损失或开支（包括但不限于利润损失、商业中断、设备损毁、数据被动丢失、因行程信息差错造成的交通退改签费、时间成本损失或商誉损害等），均不承担任何连带赔偿责任。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. 服务的暂停与终止：</Text>本平台作为纯公益性项目，我们保留在无需向您做出前置通知或说明的情况下，根据服务器成本、运营策略变动等随时暂停、限制、修改、升级、或永久性终止本软件全部或部分服务的权利。如果本平台检测到或有合理理由怀疑您的账户存在安全隐患、进行禁止性活动或违反本协议的任何规定，我们有权在后台单方面、即时、且永久性地冻结、封锁或完全注销您的个人账户，并彻底抹除与之关联的所有云端数据，而无需向您或任何第三方承担任何告知义务、赔偿责任或解释说明。
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>六、 适用法律与争议管辖</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. 适用法律：</Text>本使用协议的订立、执行、效力、解释、履行、变更、终止以及因使用本平台服务而引发的一切纠纷与争议解决，均完全适用意大利共和国的实体法律规范，并参考适用的欧洲联盟通用法律条例。本协议任何条款若因与适用的强制性法律相抵触而导致部分无效，不影响其他条款的效力与继续履行。{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. 争议解决与管辖：</Text>凡因本协议的解释、效力或本软件服务的使用所引起的一切争议、矛盾或索赔，双方均应首先本着诚信、友好协商的原则沟通解决。若在争议发生之日起三十（30）天内双方无法通过协商解决该等争端，任何一方均有权将该等争议提交至本平台运营主体所在地，即意大利博洛尼亚地方有管辖权的人民法院（Tribunale di Bologna）通过正式法律诉讼渠道裁决解决。诉讼所产生的一切合理律师费、诉讼费、公证费和差旅成本将由败诉方全额承担。
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* English Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Introduction & Essential Notices</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Welcome to the Boxue application and its associated digital services (hereinafter referred to as "the Software" or "the Platform"). This Terms of Service agreement (hereinafter "Agreement") is a legally binding contract between you (the "User" or "you") and the Chinese Students and Scholars Association of the University of Bologna (hereinafter "ASSCUBO", "the Association", "we", "us", or "our") regarding your downloading, installing, registering, accessing, and utilizing the Software, as well as enjoying our digital information and public welfare services.{"\n"}
            We hereby remind you that before downloading, launching, registering, or querying data through the Software, you must read and fully understand the terms and conditions outlined in this Agreement. By downloading, installing, registering, logging in, or otherwise accessing and using any tools, information, or services provided on this Platform, you are deemed to have read, understood, and voluntarily agreed to be bound by the entirety of this Agreement. If you do not agree to any of these terms, or if you have any objections to the content or cannot comply with it fully, please cease all operations immediately, uninstall the Software, delete all associated cached data, and do not access or use the services.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Account Registration, Login, and Security</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Registration Prerequisites and Credentials:</Text> Certain features of the Software (including online registration for ASSCUBO activities and personalized settings) require you to register an account using a valid email address and establish a secure password. You promise that all information provided during registration is accurate, truthful, and does not contain deceptive, misleading, or infringing elements. You are responsible for updating your registration details promptly via the "Profile" settings page if any changes occur.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Exclusive Account Rights and Confidentiality:</Text> Your registered account is for your personal, non-commercial, and public welfare use only. You may not lease, lend, pledge, gift, transfer, or share your account with any third party. You are solely responsible for maintaining the confidentiality of your account credentials (email and password). Any loss, data leak, invalid registration, or misuse of credentials resulting from your failure to protect your login details, voluntary sharing of passwords, or device compromises (malware, hacking) shall be borne entirely by you. To the maximum extent permitted by law, ASSCUBO assumes no liability or compensatory responsibility.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Platform Services, Third-Party Data Disclaimers, and Usage Restrictions</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Data Sources and Public Welfare Nature:</Text> The Platform integrates several utility tools designed to facilitate daily campus life, including "real-time train status and platform queries", "bus route searches and positioning", and "empty classroom occupancy checks". We explicitly inform you that the data displayed by these tools is retrieved dynamically and in real time from external public API feeds (such as Italian rail public datasets, Bologna local public transit networks, and official university scheduling systems). The Platform acts solely as a front-end aggregator for the convenience of our members, and we make no warranties, express or implied, regarding the completeness, absolute accuracy, timeliness, or availability of such third-party data.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Priority of Physical Verification:</Text> Due to network latency, API disruptions, server downtime, or other force majeure factors, the data displayed in the Software is for general informational convenience only. For critical decisions (e.g., travel arrangements, exams, course registrations, or academic meetings), you must verify timetables and locations against physical station boards, official university bulletin boards, or real-time university portal notifications. ASSCUBO assumes no liability for any direct or indirect losses (including missed trains, exam absences, or lateness) resulting from reliance on the data.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. Independence of External Links:</Text> ASSCUBO administrators may include links or media leading to external third-party websites when publishing announcements or articles. These links are provided solely for reference. We have no control over, and assume no responsibility for, the safety, content, privacy policies, or business practices of any third-party websites. You access external links entirely at your own risk.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Copyright, Intellectual Property, and Content Compliance</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Original Intellectual Property Ownership:</Text> The graphic design, page layouts, icons, buttons, official ASSCUBO logos, and original written materials (such as the "New Student Handbook" or "Administrative Guide") prepared by the Association belong exclusively to the Chinese Students and Scholars Association of the University of Bologna. Without our prior written consent, no individual or organization may copy, distribute, mirror, reverse-engineer, hyperlink, or exploit these materials for commercial or profitable purposes.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. WeChat Official Account Syncing:</Text> Certain articles and newsletters displayed in the Software are synchronized or reproduced from ASSCUBO's official WeChat public account. The copyright of these articles belongs to the original authors or the respective ASSCUBO entities. The display of such content is strictly for non-commercial info sharing within the Association, and unauthorized harvesting or resale is prohibited.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. User Behavior Codes and Prohibited Activities</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            When using the Software and services, you must strictly comply with applicable Chinese laws, laws of the Italian Republic, European Union regulations (including the Digital Services Act and GDPR), and University of Bologna rules. You irrevocably promise not to use the Platform for activities that violate laws, compromise network security, damage ASSCUBO's reputation, or infringe on third-party rights. We reserve the right to freeze accounts, report to judicial authorities, and pursue legal liability for violations. Prohibited behaviors include but are not limited to:{"\n"}
            1. Uploading, posting, or transmitting defamatory, fraudulent, offensive, violent, obscene, discriminatory, or privacy-infringing content;{"\n"}
            2. Registering multiple accounts maliciously, renting or selling accounts, or using system bugs, exploits, external plug-ins, or automated scripts (such as registration bots or web scrapers) to manipulate event sign-ups;{"\n"}
            3. Decompiling, disassembling, reverse-engineering, or hacking the client software, or attempting to extract Supabase database credentials and bypass server security walls;{"\n"}
            4. Sending unauthorized commercial advertisements, promotions, spam, chain letters, or files containing computer viruses and malware through feedback channels or posting tools;{"\n"}
            5. Impersonating ASSCUBO administrators, student representatives, university staff, or other members to publish false notices, solicit funds, or engage in phishing.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Disclaimer of Warranties and Termination of Services</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Disclaimer of System Warranties:</Text> The Platform and its utilities are provided on an "as is" and "as available" basis. ASSCUBO explicitly disclaims all warranties, oral or written, express or implied, regarding the stability, error-free operation, compatibility, safety, or uninterrupted service of the Software. ASSCUBO assumes no liability for system downtime, data synchronization failures, lost registration records, or transmission delays caused by hardware failures, network fluctuations, service provider maintenance (e.g., Supabase), or force majeure.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Limitation of Consequential Damages:</Text> To the maximum extent permitted by law, ASSCUBO and its administrators or volunteer developers shall not be liable for any direct, indirect, incidental, special, or consequential damages (including loss of profits, business interruption, device damage, loss of data, travel ticket refund fees, or loss of goodwill) arising from the use or inability to use the Platform.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. Service Modification and Termination:</Text> As a public welfare project, we reserve the right to suspend, restrict, modify, upgrade, or permanently terminate any or all services without prior notice. If we suspect your account is involved in prohibited activities or violates this Agreement, we reserve the right to freeze or terminate your account and erase all associated data immediately without warning or liability.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Governing Law and Jurisdiction</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Governing Law:</Text> This Agreement and any disputes arising from your use of the Platform shall be governed by and construed in accordance with the laws of the Italian Republic and applicable European Union regulations. If any provision is found to be invalid or unenforceable, it shall not affect the validity of the remaining clauses.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Dispute Resolution:</Text> Any disputes arising from this Agreement shall be resolved through friendly consultation. If a resolution is not reached within thirty (30) days, either party may submit the dispute to the competent courts of Bologna, Italy (Tribunale di Bologna). The losing party shall bear all reasonable legal fees and litigation costs.
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Italian Section */}
        <View style={styles.langSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Introduzione e Avviso Importante</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Benvenuti nell'applicazione Boxue e nei relativi servizi digitali (di seguito denominati "il Software" o "la Piattaforma"). Le presenti Condizioni d'Uso (di seguito "Contratto") costituiscono un accordo legalmente vincolante tra voi (l' "Utente" o "voi") e l'Associazione di Studenti e Studiosi Cinesi dell'Università di Bologna (di seguito "ASSCUBO" o "noi") in merito allo scaricamento, installazione, registrazione, accesso e utilizzo del Software, nonché alla fruizione dei nostri servizi informativi e di pubblica utilità.{"\n"}
            Vi ricordiamo che prima di scaricare, avviare, registrarvi o consultare dati tramite il Software, dovete leggere e comprendere appieno le condizioni stabilite in questo Contratto. Scaricando, installando, registrandovi, accedendo o utilizzando la Piattaforma, accettate integralmente e senza riserve di essere vincolati da questo Contratto. Se non concordate con uno qualsiasi dei termini, o se avete obiezioni, dovete interrompere immediatamente ogni operazione, disinstallare il Software dal vostro dispositivo ed eliminare tutti i dati memorizzati.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Registrazione, Accesso e Sicurezza dell'Account</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Requisiti di Registrazione e Credenziali:</Text> Alcune funzionalità del Software (tra cui l'iscrizione online alle attività ASSCUBO e le impostazioni personalizzate) richiedono la registrazione di un account tramite un indirizzo e-mail valido e la creazione di una password sicura. Vi impegnate a fornire informazioni accurate, veritiere e non ingannevoli. Siete tenuti ad aggiornare tempestivamente i vostri dati tramite la pagina "Profilo" in caso di variazioni.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Diritti Esclusivi sull'Account e Riservatezza:</Text> Il vostro account è strettamente personale e riservato a fini non commerciali e di pubblica utilità. È vietato cedere, prestare, donare, trasferire o condividere l'account con terzi. Siete gli unici responsabili della riservatezza delle credenziali di accesso. Qualsiasi perdita, fuga di dati o abuso derivante dal mancato controllo delle credenziali o dalla condivisione delle password sarà a vostro carico. Nei limiti di legge, ASSCUBO non assume alcuna responsabilità.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Servizi della Piattaforma, Limitazione di Responsabilità dei Dati di Terze Parti e Restrizioni</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Fonti dei Dati e Natura No-Profit:</Text> La Piattaforma integra vari strumenti per facilitare la vita universitaria, come la ricerca dei treni, le linee dei bus e la disponibilità delle aule. Vi informiamo che tali dati sono recuperati in tempo reale da API pubbliche esterne (es. dataset ferroviari italiani, reti di trasporto locale di Bologna e sistemi universitari). La Piattaforma funge solo da aggregatore a scopo informativo no-profit e non rilascia alcuna garanzia circa l'accuratezza, completezza o tempestività dei dati.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Priorità della Verifica Fisica:</Text> A causa di latenze di rete, interruzioni delle API o problemi ai server, i dati mostrati nel Software sono solo indicativi. Per decisioni critiche (es. esami, lezioni, viaggi), l'utente è tenuto a verificare le informazioni tramite i monitor fisici o i canali ufficiali dell'ateneo o delle stazioni. ASSCUBO non risponde di eventuali danni o ritardi.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. Indipendenza dei Link Esterni:</Text> Gli amministratori possono inserire link a siti esterni nei loro annunci. Tali link sono forniti solo per comodità. Non abbiamo alcun controllo sulla sicurezza, il contenuto o le politiche sulla privacy dei siti esterni, il cui accesso è a vostro esclusivo rischio.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Diritto d'Autore, Proprietà Intellettuale e Conformità dei Contenuti</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Proprietà Intellettuale Originale:</Text> La grafica, i layout delle pagine, le icone, i loghi ufficiali ASSCUBO e i materiali scritti originali (es. la "Guida per i Nuovi Studenti") appartengono esclusivamente all'Associazione. Senza autorizzazione scritta, è vietato copiare, distribuire, decodificare o utilizzare tali materiali per fini commerciali o di lucro.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Sincronizzazione WeChat:</Text> Alcuni articoli e notizie nel Software sono sincronizzati dall'account ufficiale WeChat di ASSCUBO. La proprietà intellettuale appartiene ai rispettivi autori. L'uso di tali contenuti è limitato alla condivisione informativa interna e non commerciale.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Norme di Comportamento dell'Utente e Attività Vietate</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            Nell'uso del Software, dovete rispettare le leggi italiane, dell'Unione Europea (tra cui il Digital Services Act e il GDPR) e i regolamenti dell'Università di Bologna. Vi impegnate a non utilizzare la Piattaforma per attività illecite, violazioni di sicurezza o azioni che danneggino l'Associazione o terzi. Ci riserviamo il diritto di bloccare gli account e intraprendere azioni legali in caso di violazioni. Le attività vietate includono:{"\n"}
            1. Caricare o trasmettere contenuti diffamatori, fraudolenti, offensivi, violenti o lesivi della privacy altrui;{"\n"}
            2. Creare account falsi, vendere o noleggiare l'account, o utilizzare bot, script o exploit per manipolare le iscrizioni agli eventi;{"\n"}
            3. Decodificare, disassemblare o hackerare il software client, o tentare di rubare le credenziali del database Supabase;{"\n"}
            4. Inviare pubblicità commerciale non autorizzata, spam o file contenenti virus e malware;{"\n"}
            5. Impersonare amministratori, rappresentanti degli studenti o personale universitario per diffondere avvisi falsi o compiere frodi.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Esclusione di Garanzia e Risoluzione dei Servizi</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Esclusione di Garanzia sul Sistema:</Text> La Piattaforma e i suoi servizi sono forniti "così come sono". ASSCUBO esclude qualsiasi garanzia circa la stabilità, la compatibilità o l'assenza di interruzioni del Software. Non rispondiamo di perdite di dati o ritardi causati da guasti hardware, manutenzione dei provider (es. Supabase) o forza maggiore.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Limitazione dei Danni Indiretti:</Text> Nei limiti consentiti dalla legge, ASSCUBO, i suoi amministratori e gli sviluppatori volontari non saranno responsabili per danni diretti, indiretti o consequenziali (inclusi perdita di profitto, interruzione di attività, danni ai dispositivi o rimborso di biglietti di viaggio) derivanti dall'uso del Software.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>3. Modifica e Risoluzione del Servizio:</Text> Trattandosi di un progetto no-profit, ci riserviamo il diritto di modificare, sospendere o terminare i servizi in qualsiasi momento senza preavviso. In caso di violazioni di questo Contratto, possiamo bloccare l'account e rimuovere tutti i dati associati senza alcuna responsabilità.
          </Text>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Legge Applicabile e Foro Competente</Text>
          <Text style={[styles.detailParagraph, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>1. Legge Applicabile:</Text> Questo Contratto e qualsiasi controversia derivante dall'uso della Piattaforma sono regolati dalle leggi della Repubblica Italiana e dalle normative dell'Unione Europea.{"\n"}
            <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>2. Foro Competente:</Text> Qualsiasi controversia derivante da questo Contratto sarà risolta tramite consultazione amichevole. In caso di mancato accordo entro trenta (30) giorni, la controversia sarà sottoposta alla giurisdizione esclusiva del Tribunale di Bologna. La parte soccombente sosterrà le spese legali.
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
