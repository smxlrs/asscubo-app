import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  Pressable, 
  ScrollView, 
  View, 
  Animated, 
  Dimensions, 
  ActivityIndicator, 
  StatusBar,
  BackHandler
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.75;

type Chapter = {
  id: string;
  title: string;
  order_index: number;
  content_type: 'pdf' | 'richtext';
  content_body?: string;
  parent_id: string | null;
  children?: Chapter[];
};

type ReaderTheme = {
  id: string;
  name: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  surfaceColor: string;
};

const THEMES: ReaderTheme[] = [
  { id: 'light', name: '大方白', backgroundColor: '#FFFFFF', textColor: '#2C3E50', borderColor: '#EAEAEA', surfaceColor: '#F7F9FA' },
  { id: 'green', name: '护眼绿', backgroundColor: '#E8F5E9', textColor: '#1B5E20', borderColor: '#C8E6C9', surfaceColor: '#F1F8F2' },
  { id: 'sepia', name: '羊皮纸', backgroundColor: '#F5ECDB', textColor: '#5D4037', borderColor: '#EFE3CE', surfaceColor: '#FAF5EC' },
  { id: 'dark', name: '极夜黑', backgroundColor: '#121212', textColor: '#B0BEC5', borderColor: '#263238', surfaceColor: '#1E1E1E' }
];

const FONT_SIZES = [14, 16, 18, 20, 22, 26, 30]; // Available font sizes

const LOCAL_FALLBACK_CHAPTERS: Chapter[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    title: '第一章：学联简介与章程',
    order_index: 1,
    content_type: 'richtext',
    parent_id: null,
    children: [
      {
        id: 'child-1-1',
        title: '学联组织架构与职责',
        order_index: 1,
        content_type: 'richtext',
        content_body: `### 一、学联简介
本校学生联合会（简称学联）是在学校党委领导、团委指导下的全体在校学生的自治组织。学联以“全心全意为同学服务”为根本宗旨，代表和维护广大同学的根本利益。

### 二、核心架构与部门职责
1. **主席团**
   主持学联全面工作，协调各部门运作，直接对接学校校方行政管理和外事办。

2. **秘书处**
   负责日常会务统筹、文字秘书、档案留存管理及财务监督，维护学联信息公开透明。

3. **宣传部**
   管理微信公众号、本 App 等媒体矩阵，设计校园大型活动的视觉物料并策划重大报道。

4. **文体部**
   精心策划并举办一年一度的迎新文艺晚会、中秋游园会、毕业晚会以及各校区体育对抗赛。

5. **学术部**
   定期举办跨学科青年学术沙龙、学术论坛、考研保研分享会以及新生辩论赛。

6. **外联部**
   负责拓展外部赞助与商务合作，对接兄弟高校学联，提供更多社会实践和实习推介机会。

### 三、联系我们
- **办公地点**：学生活动中心 302 室
- **官方邮箱**：su@stu.university.edu.cn
- **答疑微信**：ACSS_Service`,
        parent_id: 'a0000000-0000-0000-0000-000000000001'
      }
    ]
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    title: '第二章：校园生活指南',
    order_index: 2,
    content_type: 'richtext',
    parent_id: null,
    children: [
      {
        id: 'child-2-1',
        title: '图书馆使用规范与借阅指引',
        order_index: 1,
        content_type: 'richtext',
        content_body: `### 📖 图书馆概况
我校图书馆共有校本部主馆和北校区分馆，总藏书量超150万册。全馆覆盖高速免费Wi-Fi，并设有自主静音学习区、多媒体视听体验室及小组学术讨论室。

### 🕒 开放时间
- **普通开放日 (周一至周日)**：08:00 - 22:30
- **法定节假日及寒暑假**：另行通知（请随时留意本 App 首页公告推送）

### 📇 借阅规则与电子学生证
- **入馆凭证**：持电子学生证（本 App 首页展示）或实体校园卡刷卡入馆。
- **借阅限额**：本科生限借 15 册，硕士及博士研究生限借 30 册。
- **借阅期限**：普通图书借期为 30 天，可在到期前 3 天内通过本 App 或学校网页系统续借一次（延长30天）。
- **逾期处理**：逾期归还将暂停借阅权限，且每册每日产生 0.2 元的违约金，还清并归还图书后权限即刻恢复。

### 🤫 入馆须知与礼仪
1. 请保持馆内绝对安静，入馆前请将手机调至静音或振动状态。接听电话请至安全通道。
2. 馆内严禁吸烟、携带易燃易爆品。非封闭式饮料与气味浓烈的食物谢绝带入自习室。
3. 小组讨论请提前在 App 中预约专用讨论室，切勿在普通自习区大声喧哗。`,
        parent_id: 'a0000000-0000-0000-0000-000000000002'
      },
      {
        id: 'child-2-2',
        title: '学生公寓管理条例',
        order_index: 2,
        content_type: 'richtext',
        content_body: `### 🏠 公寓服务与规定
学生公寓是同学们日常学习和生活的重要场所。营造安全、整洁、文明的公寓环境需要大家的共同维护。

### ⚡ 用电安全与作息纪律
- **限时断电**：宿舍区每日 06:00 开启电源，23:30 关闭（周末及节假日延迟至 24:00 关灯，空调插座 24小时不间断供电）。
- **违章电器**：严禁在宿舍内使用热得快、电磁炉、电饭煲、大功率电吹风、小太阳等违章电器（寝室限额 800W）。一经查实，违规电器将予扣押并取消学年评优资格。
- **大门封闭时间**：公寓楼大门于每日 23:30 锁门，晚归学生需出示电子学生证，并在宿管室如实登记晚归原因。

### 🧹 卫生与公共秩序
- 宿舍卫生实行寝室长负责制与轮流值日制，宿管科每周三下午将进行全校例行卫生与安全大检查。
- 严禁擅自留宿外来人员；为了公共卫生与舍友身心健康，公寓内严禁饲养猫、狗等任何宠物。`,
        parent_id: 'a0000000-0000-0000-0000-000000000002'
      }
    ]
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    title: '第三章：办事流程指引',
    order_index: 3,
    content_type: 'richtext',
    parent_id: null,
    children: [
      {
        id: 'child-3-1',
        title: '学生活动场地申请流程',
        order_index: 1,
        content_type: 'richtext',
        content_body: `### 🏛️ 场地申请指引
各班级、学生社团因举办活动、讲座、沙龙等需要使用学校公共场地（如多功能厅、报告厅、操场等）的，应按以下流程提前申请。

### 📝 申请条件
- 申请主体必须为学校正式注册并备案的学生社团、行政班级或官方学生组织。
- 活动方案须提前经社团指导老师（或辅导员）签字同意，且活动内容需符合国家法律法规和校纪校规，严禁任何形式的商业盈利性宣传。

### 🔄 场地预约四步走
1. **下载表格**：在学校教务网或学联官方平台下载并填写《校内公共场地使用申请表》。
2. **指导老师审批**：填写活动预算、安全预案，由社团指导老师或班主任签署同意意见并盖章。
3. **主管部门归口盖章**：
   - 青年活动中心/大学生活动中心场地：至校团委办公室审批。
   - 普通教学教室/多媒体多功能教室：至教务处综合管理科审批。
   - 体育场馆/塑胶操场：至体育教学部综合办公室审批。
4. **系统归档**：审批流程结束后，在活动开始前至少 3 个工作日将盖章表格原件拍照，上传提交至本 App 的场地申报专区，进行系统归档与空闲排程通知。`,
        parent_id: 'a0000000-0000-0000-0000-000000000003'
      }
    ]
  }
];

export default function HandbookReaderScreen() {
  const { colors } = useTheme();

  // Settings states
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // Default is 18px (index 2)
  const [selectedTheme, setSelectedTheme] = useState<ReaderTheme>(THEMES[2]); // Default is Sepia
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Chapters & Loading states
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer Animation state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerAnimation = useRef(new Animated.Value(0)).current;

  // Settings Animation state
  const settingsAnimation = useRef(new Animated.Value(0)).current;

  // Ref to ScrollView to scroll to top when changing chapters
  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Fetch handbook chapters
  useEffect(() => {
    async function fetchHandbook() {
      try {
        const { data, error } = await supabase
          .from('handbook_chapters')
          .select('*')
          .eq('is_published', true)
          .order('order_index', { ascending: true });

        if (error || !data || data.length === 0) {
          throw new Error('Supabase fetch failed or returned empty');
        }

        // Process data into hierarchical tree structure
        const roots = data.filter(c => !c.parent_id);
        const processed = roots.map(root => ({
          ...root,
          children: data.filter(c => c.parent_id === root.id)
        }));

        setChapters(processed as Chapter[]);
        
        // Load first child chapter as default
        if (processed[0] && processed[0].children && processed[0].children[0]) {
          setCurrentChapter(processed[0].children[0]);
        } else {
          setCurrentChapter(processed[0]);
        }
      } catch (err) {
        console.warn('Using local fallback handbook data:', err);
        setChapters(LOCAL_FALLBACK_CHAPTERS);
        setCurrentChapter(LOCAL_FALLBACK_CHAPTERS[0].children![0]);
      } finally {
        setLoading(false);
      }
    }
    fetchHandbook();
  }, []);

  // Handle hardware back press on Android (close drawer or settings first)
  useEffect(() => {
    const handleBackButton = () => {
      if (isDrawerOpen) {
        closeDrawer();
        return true;
      }
      if (isSettingsOpen) {
        closeSettings();
        return true;
      }
      return false; // Exit screen
    };

    BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => BackHandler.removeEventListener('hardwareBackPress', handleBackButton);
  }, [isDrawerOpen, isSettingsOpen]);

  // Drawer actions
  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(drawerAnimation, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsDrawerOpen(false));
  };

  // Settings Panel actions
  const openSettings = () => {
    setIsSettingsOpen(true);
    Animated.timing(settingsAnimation, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const closeSettings = () => {
    Animated.timing(settingsAnimation, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setIsSettingsOpen(false));
  };

  // Select a chapter to read
  const handleSelectChapter = (chap: Chapter) => {
    setCurrentChapter(chap);
    closeDrawer();
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  };

  // Helper to render customized typography elements from markdown content body
  const renderContentBody = () => {
    if (!currentChapter || !currentChapter.content_body) {
      return <Text style={[styles.noContent, { color: selectedTheme.textColor }]}>暂无小节正文内容。</Text>;
    }

    const fontSize = FONT_SIZES[fontSizeIndex];
    const lines = currentChapter.content_body.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <View key={idx} style={{ height: fontSize * 0.75 }} />;
      }

      // Headers
      if (trimmed.startsWith('### ')) {
        const text = trimmed.substring(4);
        return (
          <Text key={idx} style={[styles.h3, { fontSize: fontSize * 1.25, color: selectedTheme.textColor, marginTop: fontSize, marginBottom: fontSize * 0.4 }]}>
            {text}
          </Text>
        );
      }
      if (trimmed.startsWith('## ')) {
        const text = trimmed.substring(3);
        return (
          <Text key={idx} style={[styles.h2, { fontSize: fontSize * 1.4, color: selectedTheme.textColor, marginTop: fontSize * 1.2, marginBottom: fontSize * 0.5 }]}>
            {text}
          </Text>
        );
      }
      if (trimmed.startsWith('# ')) {
        const text = trimmed.substring(2);
        return (
          <Text key={idx} style={[styles.h1, { fontSize: fontSize * 1.6, color: selectedTheme.textColor, marginTop: fontSize * 1.5, marginBottom: fontSize * 0.6 }]}>
            {text}
          </Text>
        );
      }

      // Unordered list items
      if (trimmed.startsWith('- ')) {
        const text = trimmed.substring(2);
        return (
          <View key={idx} style={[styles.listItem, { marginBottom: fontSize * 0.35 }]}>
            <Text style={[styles.bullet, { fontSize: fontSize, color: selectedTheme.textColor }]}>•</Text>
            <Text style={[styles.listText, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * 1.6 }]}>{text}</Text>
          </View>
        );
      }

      // Ordered list items
      if (/^\d+\.\s/.test(trimmed)) {
        const dotIdx = trimmed.indexOf('.');
        const num = trimmed.substring(0, dotIdx + 1);
        const text = trimmed.substring(dotIdx + 1).trim();
        return (
          <View key={idx} style={[styles.listItem, { marginBottom: fontSize * 0.35 }]}>
            <Text style={[styles.bullet, { fontSize: fontSize, color: selectedTheme.textColor, fontWeight: 'bold' }]}>{num}</Text>
            <Text style={[styles.listText, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * 1.6 }]}>{text}</Text>
          </View>
        );
      }

      // Regular Paragraphs
      return (
        <Text key={idx} style={[styles.paragraph, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * 1.65, marginBottom: fontSize * 0.6 }]}>
          {trimmed}
        </Text>
      );
    });
  };

  const getParentChapterTitle = () => {
    if (!currentChapter || !currentChapter.parent_id) return '';
    const parent = chapters.find(c => c.id === currentChapter.parent_id);
    return parent ? parent.title : '';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#A31621" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>正在调阅新生手册电子排版...</Text>
      </View>
    );
  }

  const drawerTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const overlayOpacity = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const settingsTranslateY = settingsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: selectedTheme.backgroundColor }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={selectedTheme.id === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Reader Header */}
      <View style={[styles.header, { backgroundColor: selectedTheme.surfaceColor, borderBottomColor: selectedTheme.borderColor }]}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconButton} onPress={openDrawer}>
            <Text style={[styles.headerIcon, { color: selectedTheme.textColor }]}>☰</Text>
          </Pressable>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backText, { color: '#A31621' }]}>返回</Text>
          </Pressable>
        </View>

        <Text style={[styles.headerTitle, { color: selectedTheme.textColor }]} numberOfLines={1}>
          {currentChapter ? currentChapter.title : '新生手册'}
        </Text>

        <Pressable style={styles.iconButton} onPress={openSettings}>
          <Text style={[styles.fontSettingIcon, { color: selectedTheme.textColor }]}>Aa</Text>
        </Pressable>
      </View>

      {/* Reader Content Body */}
      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {currentChapter && currentChapter.parent_id && (
          <Text style={[styles.parentChapterLabel, { color: selectedTheme.textColor + '80' }]}>
            {getParentChapterTitle()}
          </Text>
        )}
        <Text style={[styles.mainChapterTitle, { fontSize: FONT_SIZES[fontSizeIndex] * 1.5, color: selectedTheme.textColor }]}>
          {currentChapter ? currentChapter.title : ''}
        </Text>
        <View style={[styles.titleDivider, { backgroundColor: selectedTheme.borderColor }]} />
        
        {renderContentBody()}
      </ScrollView>

      {/* Left TOC Sidebar Drawer (Overlay + Drawer container) */}
      {isDrawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.drawerOverlay} onPress={closeDrawer}>
            <Animated.View style={[styles.overlayBg, { opacity: overlayOpacity }]} />
          </Pressable>
          <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerTranslateX }], backgroundColor: selectedTheme.surfaceColor, borderRightColor: selectedTheme.borderColor }]}>
            <View style={[styles.drawerHeader, { borderBottomColor: selectedTheme.borderColor }]}>
              <Text style={[styles.drawerHeaderTitle, { color: selectedTheme.textColor }]}>新生手册目录</Text>
              <Pressable style={styles.closeDrawerButton} onPress={closeDrawer}>
                <Text style={[styles.closeDrawerText, { color: selectedTheme.textColor }]}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
              {chapters.map((parent, pIdx) => (
                <View key={parent.id} style={styles.drawerGroup}>
                  <Text style={[styles.drawerParentTitle, { color: selectedTheme.textColor + '90' }]}>
                    {parent.title}
                  </Text>
                  
                  {parent.children && parent.children.map((child, cIdx) => {
                    const isSelected = currentChapter?.id === child.id;
                    return (
                      <Pressable 
                        key={child.id}
                        style={[
                          styles.drawerChildRow, 
                          isSelected && { backgroundColor: selectedTheme.id === 'dark' ? '#2A2A2D' : '#0000000A' }
                        ]}
                        onPress={() => handleSelectChapter(child)}
                      >
                        <Text style={[
                          styles.drawerChildText, 
                          { color: isSelected ? '#A31621' : selectedTheme.textColor }
                        ]}>
                          {parent.order_index}.{child.order_index} {child.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Bottom Font/Theme Settings Sheet */}
      {isSettingsOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.settingsOverlay} onPress={closeSettings} />
          <Animated.View style={[styles.settingsPanel, { transform: [{ translateY: settingsTranslateY }], backgroundColor: selectedTheme.surfaceColor, borderTopColor: selectedTheme.borderColor }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsPanelTitle, { color: selectedTheme.textColor }]}>阅读选项</Text>
              <Pressable style={styles.closeSettingsBtn} onPress={closeSettings}>
                <Text style={{ fontSize: 24, color: selectedTheme.textColor }}>×</Text>
              </Pressable>
            </View>

            {/* Font Size controls */}
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: selectedTheme.textColor }]}>字号大小</Text>
              <View style={styles.fontSizeControls}>
                <Pressable 
                  style={[styles.sizeBtn, { borderColor: selectedTheme.borderColor }, fontSizeIndex === 0 && { opacity: 0.5 }]}
                  disabled={fontSizeIndex === 0}
                  onPress={() => setFontSizeIndex(prev => Math.max(0, prev - 1))}
                >
                  <Text style={[styles.sizeBtnText, { color: selectedTheme.textColor }]}>A-</Text>
                </Pressable>
                
                <Text style={[styles.fontSizeIndicator, { color: selectedTheme.textColor }]}>
                  {FONT_SIZES[fontSizeIndex]}px
                </Text>

                <Pressable 
                  style={[styles.sizeBtn, { borderColor: selectedTheme.borderColor }, fontSizeIndex === FONT_SIZES.length - 1 && { opacity: 0.5 }]}
                  disabled={fontSizeIndex === FONT_SIZES.length - 1}
                  onPress={() => setFontSizeIndex(prev => Math.min(FONT_SIZES.length - 1, prev + 1))}
                >
                  <Text style={[styles.sizeBtnText, { color: selectedTheme.textColor }]}>A+</Text>
                </Pressable>
              </View>
            </View>

            {/* Themes Selection */}
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: selectedTheme.textColor }]}>底色主题</Text>
              <View style={styles.themesRow}>
                {THEMES.map((theme) => {
                  const isSelected = selectedTheme.id === theme.id;
                  return (
                    <Pressable
                      key={theme.id}
                      style={[
                        styles.themeCircle,
                        { backgroundColor: theme.backgroundColor, borderColor: isSelected ? '#A31621' : theme.borderColor },
                        isSelected && { borderWidth: 2 }
                      ]}
                      onPress={() => setSelectedTheme(theme)}
                    >
                      <Text style={[
                        styles.themeName, 
                        { color: theme.textColor, fontSize: 10, fontWeight: isSelected ? 'bold' : 'normal' }
                      ]}>
                        {theme.name[2]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 22,
    lineHeight: 22,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  fontSettingIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'serif',
    paddingHorizontal: 10,
  },
  headerPlaceholder: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 50,
  },
  parentChapterLabel: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  mainChapterTitle: {
    fontWeight: 'bold',
    lineHeight: 38,
    marginBottom: 16,
  },
  titleDivider: {
    height: 1,
    width: '100%',
    marginBottom: 24,
  },
  noContent: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 50,
    fontStyle: 'italic',
  },
  h1: {
    fontWeight: 'bold',
  },
  h2: {
    fontWeight: 'bold',
  },
  h3: {
    fontWeight: 'bold',
  },
  paragraph: {
    textAlign: 'justify',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  bullet: {
    width: 24,
    textAlign: 'center',
  },
  listText: {
    flex: 1,
  },
  // TOC Drawer Styles
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  drawerContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  drawerHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    borderBottomWidth: 1,
  },
  drawerHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeDrawerButton: {
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeDrawerText: {
    fontSize: 28,
    lineHeight: 28,
  },
  drawerList: {
    flex: 1,
    paddingVertical: 12,
  },
  drawerGroup: {
    marginBottom: 20,
  },
  drawerParentTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  drawerChildRow: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  drawerChildText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Settings Panel Styles
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  settingsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  settingsPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeSettingsBtn: {
    padding: 6,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sizeBtn: {
    width: 44,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  sizeBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  fontSizeIndicator: {
    width: 60,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  themesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  themeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  themeName: {
    fontSize: 10,
  },
});
