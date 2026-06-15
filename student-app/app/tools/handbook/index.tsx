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
  BackHandler,
  Image,
  Linking,
  Alert,
  Platform,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
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

const LINE_SPACINGS = [
  { label: '紧凑', val: 1.5, listValue: 1.45 },
  { label: '适中', val: 1.8, listValue: 1.75 },
  { label: '宽松', val: 2.1, listValue: 2.05 }
];

const LETTER_SPACINGS = [
  { label: '紧凑', val: 0.2 },
  { label: '适中', val: 0.6 },
  { label: '宽松', val: 1.2 }
];

const getChineseNumber = (num: number) => {
  const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六'];
  return chineseNums[num] || num.toString();
};

const hyphenateItalianWord = (word: string): string => {
  if (word.length <= 4) return word;
  
  const isVowel = (c: string) => /[aeiouyàèéìòùAEIOUYÀÈÉÌÒÙ]/.test(c);
  const isConsonant = (c: string) => /[a-zA-Z]/.test(c) && !isVowel(c);
  
  const chars = word.split('');
  const result: string[] = [];
  
  for (let i = 0; i < chars.length; i++) {
    result.push(chars[i]);
    
    if (i < chars.length - 2) {
      const curr = chars[i];
      const next1 = chars[i + 1];
      const next2 = chars[i + 2];
      
      // Rule 1: Split double consonants (e.g., t-t, l-l, c-q)
      if (isConsonant(curr) && isConsonant(next1) && curr.toLowerCase() === next1.toLowerCase()) {
        result.push('\u00AD');
        continue;
      }
      if (curr.toLowerCase() === 'c' && next1.toLowerCase() === 'q') {
        result.push('\u00AD');
        continue;
      }
      
      // Rule 2: Split consonant groups, but NOT digraphs or consonant + l/r
      if (isConsonant(curr) && isConsonant(next1)) {
        const c1 = curr.toLowerCase();
        const c2 = next1.toLowerCase();
        
        const isDigraph = (c1 === 'c' && c2 === 'h') || 
                          (c1 === 'g' && c2 === 'h') || 
                          (c1 === 'g' && c2 === 'n') || 
                          (c1 === 'g' && c2 === 'l') || 
                          (c1 === 's' && c2 === 'c');
                          
        const isConsonantLR = 'bcdfghpqrtv'.includes(c1) && 'lr'.includes(c2);
        const isSGroup = (c2 === 's' && isConsonant(next2));
        const isFirstS = (c1 === 's' && isConsonant(c2));
        
        if (!isDigraph && !isConsonantLR && !isSGroup && !isFirstS) {
          result.push('\u00AD');
          continue;
        }
      }
      
      // Rule 3: Syllable boundary before consonant + vowel (e.g. V-CV, like a-mi-co)
      if (isVowel(curr) && isConsonant(next1) && isVowel(next2)) {
        result.push('\u00AD');
        continue;
      }
      
      // Rule 3b: Syllable boundary before digraph + vowel (e.g. V-CCV, like lo-gna)
      const next1_2_isDigraph = (
        (next1.toLowerCase() === 'c' && next2.toLowerCase() === 'h') ||
        (next1.toLowerCase() === 'g' && next2.toLowerCase() === 'h') ||
        (next1.toLowerCase() === 'g' && next2.toLowerCase() === 'n') ||
        (next1.toLowerCase() === 'g' && next2.toLowerCase() === 'l') ||
        (next1.toLowerCase() === 's' && next2.toLowerCase() === 'c')
      );
      if (isVowel(curr) && next1_2_isDigraph && i < chars.length - 3 && isVowel(chars[i + 3])) {
        result.push('\u00AD');
        continue;
      }
      
      // Rule 4: Vowel-Vowel break (hiatus, e.g. e-o, a-o, but not common diphthongs)
      if (isVowel(curr) && isVowel(next1)) {
        const v1 = curr.toLowerCase();
        const v2 = next1.toLowerCase();
        const isDiphthong = ['i', 'u'].includes(v1) || ['i', 'u'].includes(v2);
        if (!isDiphthong && v1 !== v2) {
          result.push('\u00AD');
          continue;
        }
      }
    }
  }
  
  return result.join('');
};

const hyphenateItalianText = (text: string): string => {
  return text.replace(/[a-zA-ZàèéìòùÀÈÉÌÒÙ']{3,}/g, (word) => {
    if (word.includes("'")) {
      return word.split("'").map(part => hyphenateItalianWord(part)).join("'");
    }
    return hyphenateItalianWord(word);
  });
};

const handleOpenLink = (url: string) => {
  const isMail = url.startsWith('mailto:') || (url.includes('@') && !url.startsWith('http'));
  let targetUrl = url;
  if (isMail) {
    targetUrl = url.startsWith('mailto:') ? url : `mailto:${url}`;
  } else {
    // If it's a website and doesn't start with http/https, prepend https://
    if (!/^https?:\/\//i.test(url)) {
      targetUrl = `https://${url}`;
    }
  }
  const displayUrl = isMail ? targetUrl.replace('mailto:', '') : targetUrl;

  Alert.alert(
    isMail ? '发送电子邮件' : '打开外部链接',
    isMail 
      ? `确认要使用邮件客户端向以下邮箱发送邮件吗？\n\n${displayUrl}` 
      : `确认要在浏览器中打开以下网址吗？\n\n${displayUrl}`,
    [
      { text: '取消', style: 'cancel' },
      { 
        text: '确认', 
        onPress: () => {
          Linking.openURL(targetUrl).catch(err => {
            console.error("Couldn't open URL", err);
            Alert.alert('提示', '无法打开该链接，请确认设备已安装对应应用。');
          });
        } 
      }
    ]
  );
};

const handleOpenAddress = (address: string) => {
  const cleanAddress = address.trim();
  const query = `${cleanAddress}, Italy`;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const systemMapsUrl = Platform.OS === 'ios'
    ? `http://maps.apple.com/?q=${encodeURIComponent(query)}`
    : `geo:0,0?q=${encodeURIComponent(query)}`;

  Alert.alert(
    '地址导航',
    `您想要使用哪个地图应用导航至以下地址？\n\n${cleanAddress}`,
    [
      { text: '取消', style: 'cancel' },
      { 
        text: '系统地图', 
        onPress: () => {
          Linking.openURL(systemMapsUrl).catch(() => {
            Linking.openURL(googleMapsUrl);
          });
        } 
      },
      { 
        text: '谷歌地图', 
        onPress: () => {
          Linking.openURL(googleMapsUrl).catch(err => {
            console.error("Couldn't open Google Maps", err);
            Alert.alert('提示', '无法打开谷歌地图。');
          });
        } 
      }
    ]
  );
};

const handleMakeCall = (phone: string) => {
  const cleanPhone = phone.replace(/[\s-]/g, '');
  const targetUrl = `tel:${cleanPhone}`;

  Alert.alert(
    '拨打电话',
    `确认要拨打电话呼叫以下号码吗？\n\n${phone}`,
    [
      { text: '取消', style: 'cancel' },
      { 
        text: '呼叫', 
        onPress: () => {
          Linking.openURL(targetUrl).catch(err => {
            console.error("Couldn't make call", err);
            Alert.alert('提示', '无法拨打电话，请确认设备支持通话功能。');
          });
        } 
      }
    ]
  );
};

// Parser to support bold text, markdown links, emails, URLs, Italian addresses, and phone numbers
const parseInlineStyles = (text: string, fontSize: number) => {
  const elements: React.ReactNode[] = [];
  let currentIndex = 0;
  
  // Regex pattern:
  // Group 1: **bold**
  // Group 2/3: [linkText](url)
  // Group 4: raw URL (http/https)
  // Group 5: raw email address
  // Group 6: raw website (without protocol, e.g. unibo.it)
  // Group 7: Italian address (Via/Piazza/Viale/Corso/Largo followed by street info)
  // Group 8: Phone number (051 landline format)
  const regex = /\*\*(.*?)\*\*|\[(.*?)\]\((.*?)\)|(https?:\/\/[^\s\)\],，。；;]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|\b((?:[a-zA-Z0-9-]+\.)+(?:com|org|net|it|edu|cn)(?:\/[^\s\)\],，。；;]*)?)\b|\b((?:Via|Piazza|Viale|Corso|Largo)\s+[A-Z][a-zA-Z0-9\s'’,.-]{2,30}(?:,\s*\d+|\s+\d+)?(?:,\s*\d{5})?(?:\s+[A-Za-z\s]+)?)\b|\b((?:\+39\s*)?051[\s-]?\d{7})\b/g;
  let match;
  let keyCount = 0;
  
  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    
    // Add plain text before match
    if (matchIndex > currentIndex) {
      elements.push(
        <Text key={`plain-${keyCount++}`}>
          {hyphenateItalianText(text.substring(currentIndex, matchIndex))}
        </Text>
      );
    }
    
    if (match[1] !== undefined) {
      // Bold match
      elements.push(
        <Text key={`bold-${keyCount++}`} style={{ fontWeight: 'bold' }}>
          {hyphenateItalianText(match[1])}
        </Text>
      );
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // Markdown Link match
      const url = match[3];
      elements.push(
        <Text 
          key={`link-${keyCount++}`} 
          style={{ color: '#3B82F6', textDecorationLine: 'underline', fontWeight: '500' }}
          onPress={() => handleOpenLink(url)}
        >
          {hyphenateItalianText(match[2])}
        </Text>
      );
    } else if (match[4] !== undefined) {
      // Raw URL match
      const url = match[4];
      elements.push(
        <Text 
          key={`rawlink-${keyCount++}`} 
          style={{ color: '#3B82F6', textDecorationLine: 'underline', fontWeight: '500' }}
          onPress={() => handleOpenLink(url)}
        >
          {url}
        </Text>
      );
    } else if (match[5] !== undefined) {
      // Raw email match
      const email = match[5];
      elements.push(
        <Text 
          key={`email-${keyCount++}`} 
          style={{ color: '#3B82F6', textDecorationLine: 'underline', fontWeight: '500' }}
          onPress={() => handleOpenLink(email)}
        >
          {email}
        </Text>
      );
    } else if (match[6] !== undefined) {
      // Raw Website match (e.g. asscubo.it)
      const url = match[6];
      elements.push(
        <Text 
          key={`website-${keyCount++}`} 
          style={{ color: '#3B82F6', textDecorationLine: 'underline', fontWeight: '500' }}
          onPress={() => handleOpenLink(url)}
        >
          {url}
        </Text>
      );
    } else if (match[7] !== undefined) {
      // Italian address match
      const address = match[7];
      elements.push(
        <Text 
          key={`address-${keyCount++}`} 
          style={{ color: '#059669', textDecorationLine: 'underline', fontWeight: '500' }}
          onPress={() => handleOpenAddress(address)}
        >
          {address}
        </Text>
      );
    } else if (match[8] !== undefined) {
      // Phone number match
      const phone = match[8];
      elements.push(
        <Text 
          key={`phone-${keyCount++}`} 
          style={{ color: '#D97706', textDecorationLine: 'underline', fontWeight: '500' }}
          onPress={() => handleMakeCall(phone)}
        >
          {phone}
        </Text>
      );
    }
    
    currentIndex = regex.lastIndex;
  }
  
  // Add remaining plain text
  if (currentIndex < text.length) {
    elements.push(
      <Text key={`plain-${keyCount++}`}>
        {hyphenateItalianText(text.substring(currentIndex))}
      </Text>
    );
  }
  
  return elements.length > 0 ? elements : hyphenateItalianText(text);
};

const LOCAL_IMAGES: { [key: string]: any } = {
  'figures/asscubo.png': require('../../../assets/figures/asscubo.png'),
  'figures/logo.png': require('../../../assets/figures/logo.png'),
  'figures/asscubo.png.png': require('../../../assets/figures/asscubo.png'),
  'figures/logo.png.png': require('../../../assets/figures/logo.png'),
  'figures/marzabotto.png': require('../../../assets/figures/marzabotto.png'),
  'marzabotto.png': require('../../../assets/figures/marzabotto.png'),
  'biglietto': require('../../../assets/images/biglietto.png'),
  'carta': require('../../../assets/images/carta.png'),
  'biglietto.png': require('../../../assets/images/biglietto.png'),
  'carta.png': require('../../../assets/images/carta.png')
};

const resolveImageSource = (alt: string, url: string) => {
  const cleanAlt = alt.trim().toLowerCase();
  const cleanUrl = url.trim().toLowerCase();
  
  for (const key of Object.keys(LOCAL_IMAGES)) {
    const lowerKey = key.toLowerCase();
    if (
      cleanAlt === lowerKey || 
      cleanAlt.endsWith('/' + lowerKey) ||
      cleanUrl === lowerKey ||
      cleanUrl.endsWith('/' + lowerKey) ||
      cleanUrl.includes('/' + lowerKey + '.') ||
      (lowerKey.includes('.') && cleanUrl.includes(lowerKey.split('.')[0] + '.'))
    ) {
      return LOCAL_IMAGES[key];
    }
  }
  
  return { uri: url };
};

export default function HandbookReaderScreen() {
  const { colors } = useTheme();

  // Settings states
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // Default is 18px (index 2)
  const [selectedTheme, setSelectedTheme] = useState<ReaderTheme>(THEMES[2]); // Default is Sepia
  const [lineSpacingIndex, setLineSpacingIndex] = useState(1); // Default is '适中' (index 1)
  const [letterSpacingIndex, setLetterSpacingIndex] = useState(1); // Default is '适中' (index 1)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Chapters & Loading states
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  const getRootChapterIndex = (chap: Chapter) => {
    const idx = chapters.findIndex(c => c.id === chap.id);
    if (idx === -1) {
      return chap.order_index >= 3 ? chap.order_index - 2 : null;
    }
    return idx >= 2 ? idx - 1 : null;
  };

  const getFormattedChapterTitle = (chap: Chapter | null) => {
    if (!chap) return '';
    if (chap.parent_id) {
      const parent = chapters.find(c => c.id === chap.parent_id);
      if (parent) {
        const parentIdx = getRootChapterIndex(parent);
        if (parentIdx !== null) {
          return `${parentIdx}.${chap.order_index} ${chap.title}`;
        } else {
          return chap.title;
        }
      }
    } else {
      const idx = getRootChapterIndex(chap);
      if (idx !== null) {
        return `第${getChineseNumber(idx)}章 ${chap.title}`;
      } else {
        return chap.title;
      }
    }
    return chap.title;
  };

  // Drawer Animation state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerAnimation = useRef(new Animated.Value(0)).current;

  // Settings Animation state
  const settingsAnimation = useRef(new Animated.Value(0)).current;

  // Ref to ScrollView to scroll to top when changing chapters
  const scrollViewRef = useRef<ScrollView>(null);
  const drawerScrollViewRef = useRef<ScrollView>(null);
  const groupYPositions = useRef<{ [key: string]: number }>({});
  const childYPositions = useRef<{ [key: string]: number }>({});
  const drawerScrollY = useRef<number>(-1);
  const lastChapterId = useRef<string>('');

  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});

  const toggleGroup = (parentId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => ({
      ...prev,
      [parentId]: prev[parentId] === false ? true : false
    }));
  };

  useEffect(() => {
    if (isDrawerOpen && currentChapter) {
      const chapterChanged = lastChapterId.current !== currentChapter.id;
      lastChapterId.current = currentChapter.id;

      const timer = setTimeout(() => {
        let targetY = 0;
        if (chapterChanged || drawerScrollY.current < 0) {
          let scrollY = 0;
          if (currentChapter.parent_id) {
            const groupY = groupYPositions.current[currentChapter.parent_id] || 0;
            const childY = childYPositions.current[currentChapter.id] || 0;
            scrollY = groupY + childY;
          } else {
            scrollY = groupYPositions.current[currentChapter.id] || 0;
          }
          targetY = Math.max(0, scrollY - 60);
          drawerScrollY.current = targetY;
        } else {
          targetY = drawerScrollY.current;
        }

        drawerScrollViewRef.current?.scrollTo({
          y: targetY,
          animated: false
        });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isDrawerOpen, currentChapter]);

  // Calculate readable chapters (leaf nodes) in flat structure
  const readableChapters = React.useMemo(() => {
    const list: Chapter[] = [];
    chapters.forEach(parent => {
      if (parent.children && parent.children.length > 0) {
        parent.children.forEach(child => {
          list.push(child);
        });
      } else {
        list.push(parent);
      }
    });
    return list;
  }, [chapters]);

  const currentChapterIdx = readableChapters.findIndex(c => c.id === currentChapter?.id);
  const prevChapter = currentChapterIdx > 0 ? readableChapters[currentChapterIdx - 1] : null;
  const nextChapter = currentChapterIdx >= 0 && currentChapterIdx < readableChapters.length - 1 
    ? readableChapters[currentChapterIdx + 1] 
    : null;

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
        setChapters([]);
        setCurrentChapter(null);
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

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      } else {
        (BackHandler as any).removeEventListener('hardwareBackPress', handleBackButton);
      }
    };
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

  // Helper to extract clean plain text preview from chapter content body
  const getChapterPreview = (body?: string) => {
    if (!body) return '查看本章节的详细指引。';
    // Strip markdown images: ![alt](url)
    let clean = body.replace(/!\[.*?\]\(.*?\)/g, '');
    // Strip markdown links: [text](url) -> text
    clean = clean.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    // Strip headers: #, ##, ###
    clean = clean.replace(/#+\s+/g, '');
    // Strip list marks: -, *, digits
    clean = clean.replace(/^[-*]\s+/gm, '');
    clean = clean.replace(/^\d+\.\s+/gm, '');
    // Strip bold markers: **
    clean = clean.replace(/\*\*/g, '');
    // Strip single newlines, replace multiple spaces with single space
    clean = clean.replace(/\s+/g, ' ').trim();
    
    if (clean.length > 90) {
      return clean.substring(0, 90) + '...';
    }
    return clean || '查看本章节的详细指引。';
  };

  // Helper to render the sub-chapter directory cards for parent navigation hub
  const renderNavigationHub = () => {
    if (!currentChapter || !currentChapter.children) return null;
    
    return (
      <View style={styles.hubContainer}>
        <Text style={[styles.hubIntro, { color: selectedTheme.textColor + 'CC' }]}>
          本章节包含以下子小节，点击可直接跳转阅读：
        </Text>
        {currentChapter.children.map((child, idx) => {
          const preview = getChapterPreview(child.content_body);
          return (
            <Pressable
              key={child.id}
              style={({ pressed }) => [
                styles.hubCard,
                {
                  backgroundColor: selectedTheme.surfaceColor,
                  borderColor: selectedTheme.borderColor,
                },
                pressed && { opacity: 0.8 }
              ]}
              onPress={() => handleSelectChapter(child)}
            >
              <View style={styles.hubCardHeader}>
                <Text style={[styles.hubCardTitle, { color: '#A31621' }]}>
                  {getFormattedChapterTitle(child)}
                </Text>
                <Text style={[styles.hubCardArrow, { color: '#A31621' }]}>➔</Text>
              </View>
              <Text style={[styles.hubCardPreview, { color: selectedTheme.textColor + '90' }]}>
                {preview}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  // Helper to split a block by markdown images and render them as actual components
  const renderBlock = (blockText: string, blockIdx: number, fontSize: number) => {
    const isWestern = !/[\u4e00-\u9fa5]/.test(blockText);
    const textLetterSpacing = isWestern ? 0 : LETTER_SPACINGS[letterSpacingIndex].val;
    const textAlignStyle = isWestern ? 'left' : 'justify';

    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let subIdx = 0;
    
    while ((match = imageRegex.exec(blockText)) !== null) {
      const matchIndex = match.index;
      
      // 1. Add text before the image
      if (matchIndex > lastIndex) {
        const textBefore = blockText.substring(lastIndex, matchIndex).trim();
        if (textBefore) {
          parts.push(
            <Text key={`text-${blockIdx}-${subIdx++}`} selectable={true} style={[styles.paragraph, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * LINE_SPACINGS[lineSpacingIndex].val, letterSpacing: textLetterSpacing, textAlign: textAlignStyle, marginBottom: fontSize * 0.6 }]}>
              {parseInlineStyles(textBefore, fontSize)}
            </Text>
          );
        }
      }
      
      // 2. Add the Image component
      const alt = match[1];
      const url = match[2];
      const imageSource = resolveImageSource(alt, url);
      const showAlt = alt && 
        !alt.includes('/') && 
        !/\.(png|jpg|jpeg|gif)$/i.test(alt.trim()) &&
        !['biglietto', 'carta', 'logo', 'asscubo'].includes(alt.trim().toLowerCase());

      parts.push(
        <View key={`img-${blockIdx}-${subIdx++}`} style={styles.imageContainer}>
          <Image 
            source={imageSource} 
            style={[styles.inlineImage, { backgroundColor: 'transparent' }]} 
            resizeMode="contain" 
          />
          {showAlt ? <Text selectable={true} style={[styles.imageAlt, { color: selectedTheme.textColor + '80' }]}>{alt}</Text> : null}
        </View>
      );
      
      lastIndex = imageRegex.lastIndex;
    }
    
    // 3. Add remaining text after the last image
    if (lastIndex < blockText.length) {
      const textAfter = blockText.substring(lastIndex).trim();
      if (textAfter) {
        parts.push(
          <Text key={`text-${blockIdx}-${subIdx++}`} selectable={true} style={[styles.paragraph, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * LINE_SPACINGS[lineSpacingIndex].val, letterSpacing: textLetterSpacing, textAlign: textAlignStyle, marginBottom: fontSize * 0.6 }]}>
            {parseInlineStyles(textAfter, fontSize)}
          </Text>
        );
      }
    }
    
    return parts;
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
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.noContent, { color: selectedTheme.textColor }]}>
            暂无正文内容。
          </Text>
          <Text style={[styles.emptyHint, { color: selectedTheme.textColor + '80' }]}>
            请确保您已在 Supabase 导入新生手册数据并配置读取权限。
          </Text>
        </View>
      );
    }

    const fontSize = FONT_SIZES[fontSizeIndex];
    // Normalize carriage returns and split using regex to handle Windows newlines and spacing variations
    const normalizedBody = currentChapter.content_body.replace(/\r\n/g, '\n');
    const blocks = normalizedBody.split(/\n\s*\n/);

    return blocks.map((block, idx) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) {
        return null;
      }

      // Headers (might be followed immediately by text on subsequent lines)
      if (trimmedBlock.startsWith('### ')) {
        const lines = trimmedBlock.split('\n');
        const headerText = lines[0].substring(4);
        const restText = lines.slice(1).join('\n').trim();
        return (
          <React.Fragment key={idx}>
            <Text selectable={true} style={[styles.h3, { fontSize: fontSize * 1.25, color: selectedTheme.textColor, marginTop: fontSize, marginBottom: fontSize * 0.4 }]}>
              {parseInlineStyles(headerText, fontSize * 1.25)}
            </Text>
            {restText ? renderBlock(restText, idx, fontSize) : null}
          </React.Fragment>
        );
      }
      if (trimmedBlock.startsWith('## ')) {
        const lines = trimmedBlock.split('\n');
        const headerText = lines[0].substring(3);
        const restText = lines.slice(1).join('\n').trim();
        return (
          <React.Fragment key={idx}>
            <Text selectable={true} style={[styles.h2, { fontSize: fontSize * 1.4, color: selectedTheme.textColor, marginTop: fontSize * 1.2, marginBottom: fontSize * 0.5 }]}>
              {parseInlineStyles(headerText, fontSize * 1.4)}
            </Text>
            {restText ? renderBlock(restText, idx, fontSize) : null}
          </React.Fragment>
        );
      }
      if (trimmedBlock.startsWith('# ')) {
        const lines = trimmedBlock.split('\n');
        const headerText = lines[0].substring(2);
        const restText = lines.slice(1).join('\n').trim();
        return (
          <React.Fragment key={idx}>
            <Text selectable={true} style={[styles.h1, { fontSize: fontSize * 1.6, color: selectedTheme.textColor, marginTop: fontSize * 1.5, marginBottom: fontSize * 0.6 }]}>
              {parseInlineStyles(headerText, fontSize * 1.6)}
            </Text>
            {restText ? renderBlock(restText, idx, fontSize) : null}
          </React.Fragment>
        );
      }

      // List detection and rendering (lines starting with '- ' or digits)
      const lines = trimmedBlock.split('\n');
      const isList = lines.every(line => {
        const t = line.trim();
        return t.startsWith('- ') || /^\d+\.\s/.test(t) || t === '';
      });

      if (isList) {
        return (
          <View key={idx} style={{ marginBottom: fontSize * 0.6 }}>
            {lines.map((line, lIdx) => {
              const t = line.trim();
              if (!t) return null;
              if (t.startsWith('- ')) {
                const text = t.substring(2);
                const isWesternList = !/[\u4e00-\u9fa5]/.test(text);
                const listLetterSpacing = isWesternList ? 0 : LETTER_SPACINGS[letterSpacingIndex].val;
                const listAlign = isWesternList ? 'left' : 'justify';
                return (
                  <View key={lIdx} style={[styles.listItem, { marginBottom: fontSize * 0.25 }]}>
                    <Text style={[styles.bullet, { fontSize: fontSize, color: selectedTheme.textColor }]}>•</Text>
                    <Text selectable={true} style={[styles.listText, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * LINE_SPACINGS[lineSpacingIndex].listValue, letterSpacing: listLetterSpacing, textAlign: listAlign }]}>
                      {parseInlineStyles(text, fontSize)}
                    </Text>
                  </View>
                );
              }
              const dotIdx = t.indexOf('.');
              const num = t.substring(0, dotIdx + 1);
              const text = t.substring(dotIdx + 1).trim();
              const isWesternList = !/[\u4e00-\u9fa5]/.test(text);
              const listLetterSpacing = isWesternList ? 0 : LETTER_SPACINGS[letterSpacingIndex].val;
              const listAlign = isWesternList ? 'left' : 'justify';
              return (
                <View key={lIdx} style={[styles.listItem, { marginBottom: fontSize * 0.25 }]}>
                  <Text style={[styles.bullet, { fontSize: fontSize, color: selectedTheme.textColor, fontWeight: 'bold' }]}>{num}</Text>
                  <Text selectable={true} style={[styles.listText, { fontSize: fontSize, color: selectedTheme.textColor, lineHeight: fontSize * LINE_SPACINGS[lineSpacingIndex].listValue, letterSpacing: listLetterSpacing, textAlign: listAlign }]}>
                    {parseInlineStyles(text, fontSize)}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      }

      // Regular Paragraphs (might contain single newlines \n for close line breaks, and image tags)
      return (
        <View key={idx}>
          {renderBlock(trimmedBlock, idx, fontSize)}
        </View>
      );
    });
  };

  const getParentChapterTitle = () => {
    if (!currentChapter || !currentChapter.parent_id) return '';
    const parent = chapters.find(c => c.id === currentChapter.parent_id);
    return parent ? getFormattedChapterTitle(parent) : '';
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
    outputRange: [400, 0],
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
            <View style={{
              width: 10,
              height: 10,
              borderLeftWidth: 2,
              borderBottomWidth: 2,
              borderColor: '#A31621',
              transform: [{ rotate: '45deg' }],
              marginHorizontal: 8,
              marginVertical: 4,
            }} />
          </Pressable>
        </View>

        <Text style={[styles.headerTitle, { color: selectedTheme.textColor }]} numberOfLines={1}>
          {currentChapter ? getFormattedChapterTitle(currentChapter) : '新生手册'}
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
          {currentChapter ? getFormattedChapterTitle(currentChapter) : ''}
        </Text>
        <View style={[styles.titleDivider, { backgroundColor: selectedTheme.borderColor }]} />
        
        {currentChapter && currentChapter.children && currentChapter.children.length > 0 ? (
          renderNavigationHub()
        ) : (
          renderContentBody()
        )}

        {/* Previous / Next Navigation Buttons */}
        {readableChapters.length > 1 && (
          <View style={styles.navigationRow}>
            {prevChapter ? (
              <Pressable 
                style={({ pressed }) => [
                  styles.navButton, 
                  { 
                    backgroundColor: selectedTheme.surfaceColor, 
                    borderColor: selectedTheme.borderColor,
                    opacity: pressed ? 0.8 : 1,
                  }
                ]} 
                onPress={() => handleSelectChapter(prevChapter)}
              >
                <Text style={[styles.navLabel, { color: '#A31621' }]}>← 上一章</Text>
                <Text style={[styles.navTitle, { color: selectedTheme.textColor }]} numberOfLines={1}>
                  {getFormattedChapterTitle(prevChapter)}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.navButtonPlaceholder} />
            )}
            
            {nextChapter ? (
              <Pressable 
                style={({ pressed }) => [
                  styles.navButton, 
                  { 
                    backgroundColor: selectedTheme.surfaceColor, 
                    borderColor: selectedTheme.borderColor,
                    alignItems: 'flex-end',
                    opacity: pressed ? 0.8 : 1,
                  }
                ]} 
                onPress={() => handleSelectChapter(nextChapter)}
              >
                <Text style={[styles.navLabel, { color: '#A31621' }]}>下一章 →</Text>
                <Text style={[styles.navTitle, { color: selectedTheme.textColor }]} numberOfLines={1}>
                  {getFormattedChapterTitle(nextChapter)}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.navButtonPlaceholder} />
            )}
          </View>
        )}
      </ScrollView>

      {/* Left TOC Sidebar Drawer (Overlay + Drawer container) */}
      {isDrawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.drawerOverlay} onPress={closeDrawer}>
            <Animated.View style={[styles.overlayBg, { opacity: overlayOpacity }]} />
          </Pressable>
          <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerTranslateX }], backgroundColor: selectedTheme.surfaceColor, borderRightColor: selectedTheme.borderColor }]}>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
              <View style={[styles.drawerHeader, { borderBottomColor: selectedTheme.borderColor }]}>
                <Text style={[styles.drawerHeaderTitle, { color: selectedTheme.textColor }]}>新生手册目录</Text>
                <Pressable style={styles.closeDrawerButton} onPress={closeDrawer}>
                  <Text style={[styles.closeDrawerText, { color: selectedTheme.textColor }]}>×</Text>
                </Pressable>
              </View>
              <ScrollView 
                ref={drawerScrollViewRef} 
                style={styles.drawerList} 
                showsVerticalScrollIndicator={false}
                onScroll={(event) => {
                  drawerScrollY.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                {chapters.map((parent, pIdx) => {
                  const isParentSelected = currentChapter?.id === parent.id;
                  return (
                    <View 
                      key={parent.id} 
                      style={styles.drawerGroup}
                      onLayout={(event) => {
                        const { y } = event.nativeEvent.layout;
                        groupYPositions.current[parent.id] = y;
                      }}
                    >
                      <View style={[
                        styles.drawerParentRow,
                        isParentSelected && { backgroundColor: selectedTheme.id === 'dark' ? '#2A2A2D' : '#0000000A' }
                      ]}>
                        <Pressable 
                          style={styles.drawerParentTitlePressable} 
                          onPress={() => handleSelectChapter(parent)}
                        >
                          <Text style={[
                            styles.drawerParentTitle, 
                            { 
                              color: isParentSelected ? '#A31621' : selectedTheme.textColor,
                            }
                          ]}>
                            {getFormattedChapterTitle(parent)}
                          </Text>
                        </Pressable>
                        {parent.children && parent.children.length > 0 && (
                          <Pressable 
                            style={styles.drawerCollapseBtn} 
                            onPress={() => toggleGroup(parent.id)}
                          >
                            <Text style={[styles.drawerCollapseIcon, { color: selectedTheme.textColor + '80' }]}>
                              {expandedGroups[parent.id] === false ? '▶' : '▼'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      
                      {expandedGroups[parent.id] !== false && parent.children && parent.children.map((child, cIdx) => {
                        const isSelected = currentChapter?.id === child.id;
                        return (
                          <Pressable 
                            key={child.id}
                            style={[
                              styles.drawerChildRow, 
                              isSelected && { backgroundColor: selectedTheme.id === 'dark' ? '#2A2A2D' : '#0000000A' }
                            ]}
                            onLayout={(event) => {
                              const { y } = event.nativeEvent.layout;
                              childYPositions.current[child.id] = y;
                            }}
                            onPress={() => handleSelectChapter(child)}
                          >
                            <Text 
                              style={[
                                styles.drawerChildText, 
                                { color: isSelected ? '#A31621' : selectedTheme.textColor }
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {getFormattedChapterTitle(child)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
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
                <MaterialIcons name="close" size={20} color={selectedTheme.textColor} />
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

            {/* Line Spacing Selection */}
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: selectedTheme.textColor }]}>行间距</Text>
              <View style={styles.spacingRow}>
                {LINE_SPACINGS.map((spacing, idx) => {
                  const isSelected = lineSpacingIndex === idx;
                  return (
                    <Pressable
                      key={idx}
                      style={[
                        styles.spacingOptionBtn,
                        { borderColor: selectedTheme.borderColor },
                        isSelected && { borderColor: '#A31621', backgroundColor: selectedTheme.surfaceColor }
                      ]}
                      onPress={() => setLineSpacingIndex(idx)}
                    >
                      <Text style={[
                        styles.spacingOptionText,
                        { color: selectedTheme.textColor, fontWeight: isSelected ? 'bold' : 'normal' }
                      ]}>
                        {spacing.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Letter Spacing Selection */}
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: selectedTheme.textColor }]}>字间距</Text>
              <View style={styles.spacingRow}>
                {LETTER_SPACINGS.map((spacing, idx) => {
                  const isSelected = letterSpacingIndex === idx;
                  return (
                    <Pressable
                      key={idx}
                      style={[
                        styles.spacingOptionBtn,
                        { borderColor: selectedTheme.borderColor },
                        isSelected && { borderColor: '#A31621', backgroundColor: selectedTheme.surfaceColor }
                      ]}
                      onPress={() => setLetterSpacingIndex(idx)}
                    >
                      <Text style={[
                        styles.spacingOptionText,
                        { color: selectedTheme.textColor, fontWeight: isSelected ? 'bold' : 'normal' }
                      ]}>
                        {spacing.label}
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyHint: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  overlayBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
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
  drawerParentPressable: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  drawerParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 2,
  },
  drawerParentTitlePressable: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  drawerCollapseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerCollapseIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  drawerParentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  drawerChildRow: {
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
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
  spacingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  spacingOptionBtn: {
    width: 52,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  spacingOptionText: {
    fontSize: 12,
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
  imageContainer: {
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  inlineImage: {
    width: width - 48,
    height: (width - 48) * 0.6,
    borderRadius: 12,
  },
  imageAlt: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 20,
    gap: 12,
  },
  navButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  navButtonPlaceholder: {
    flex: 1,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  navTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  hubContainer: {
    marginTop: 10,
  },
  hubIntro: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  hubCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  hubCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hubCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  hubCardArrow: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  hubCardPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
});
