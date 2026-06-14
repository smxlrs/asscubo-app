const fs = require('fs');
const path = require('path');

const studentAppDir = path.join(__dirname, 'student-app');
const appDir = path.join(studentAppDir, 'app');

const filesToWrite = {
  // 1. context/ThemeContext.tsx
  [path.join(studentAppDir, 'context', 'ThemeContext.tsx')]: `import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('AsyncStorage.getItem failed:', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn('AsyncStorage.setItem failed:', e);
    }
  }
};

export type ThemeMode = 'light' | 'dark' | 'system' | 'custom';
export type Language = 'zh' | 'en' | 'it';

type ThemeContextType = {
  themeMode: ThemeMode;
  customStart: string;
  customEnd: string;
  language: Language;
  isDark: boolean;
  colors: typeof darkColors;
  t: (key: string) => string;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setCustomStart: (time: string) => Promise<void>;
  setCustomEnd: (time: string) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  isReady: boolean;
};

const darkColors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#555555',
  primary: '#A31621',
  primaryLight: '#C41E2A',
  primarySoft: '#A3162115',
  success: '#22C55E',
  error: '#EF4444',
};

const lightColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceElevated: '#E4E7EC',
  border: '#D0D5DD',
  textPrimary: '#1D2939',
  textSecondary: '#475467',
  textMuted: '#98A2B3',
  primary: '#A31621',
  primaryLight: '#C41E2A',
  primarySoft: '#A3162115',
  success: '#22C55E',
  error: '#EF4444',
};

const translations: Record<Language, Record<string, string>> = {
  zh: {
    home: '首页',
    notifications: '通知',
    tools: '工具',
    profile: '我的',
    settings: '设置',
    about: '关于',
    logout: '退出登录',
    login: '登录账户',
    guestMode: '游客模式',
    loginPrompt: '登录即可体验完整功能',
    hello: '你好，',
    studentRole: '普通学生学者',
    adminRole: '管理员',
    systemSettings: '系统设置',
    dataStorage: '数据与存储',
    legalTerms: '法律与条款',
    privacyPolicy: '隐私政策',
    userAgreement: '用户协议',
    clearCache: '清除缓存',
    cacheCleared: '缓存清除成功！',
    confirmClearCache: '确定要清除应用缓存吗？',
    cancel: '取消',
    confirm: '确定',
    languageSetting: '语言设置',
    themeSetting: '主题模式',
    appInfo: '平台简介',
    contactUs: '联系我们',
    officialWebsite: '官方网站',
    wechatPub: '微信公众号',
    serviceEmail: '客服邮箱',
    copyright: '欧洲学生学者联合会. \\nAll rights reserved.',
    version: '版本: 1.0.0 (Beta)',
    aboutDescription: '本应用是由欧洲学生学者联合会官方出品的一站式校园生活服务平台，旨在为广大留欧学生学者提供最及时权威的信息资讯、最实用的生活学术工具以及充满活力的青年社区。',
    back: '返回',
    save: '保存',
    lightMode: '浅色模式',
    darkMode: '深色模式',
    systemMode: '跟随系统',
    customMode: '自定义时间',
    customTimeRange: '在此时间段内切换至深色模式。',
    startTime: '开始时间',
    endTime: '结束时间',
    emptyContent: '内容建设中...',
    noNotifications: '暂无新通知',
    toolsDeveloping: '工具箱正在研发中...',
    guestExplore: '暂不登录，游客探索',
    emailLabel: '电子邮箱',
    wechatLabel: '微信 (选填)',
    passwordLabel: '登录密码',
    emailPlaceholder: '请输入邮箱地址',
    passwordPlaceholder: '请输入密码',
    registerLabel: '注册账户',
    registerLink: '立即注册',
    noAccount: '还没有账户？',
    hasAccount: '已有账户？',
    loginLink: '立即登录',
    nameLabel: '姓名 / 昵称',
    namePlaceholder: '请输入您的姓名',
    emailRegPlaceholder: '建议使用您的大学邮箱',
    passwordRegPlaceholder: '请输入密码 (至少6位)',
    successRegTitle: '注册申请已提交',
    successRegText: '我们已向您的邮箱发送了一封验证邮件，请打开邮件并点击其中的验证链接激活账户。',
    successRegSubtext: '验证成功后，您可以返回此页面进行登录。',
    regSuccess: '注册成功！',
    
    appName: '学联官方平台',
    aboutACSS: '关于学联',
    platformIntro: '平台简介',
    versionLabel: '版本',
    feedback: '反馈',
    checkUpdate: '检查更新',
    checkingUpdate: '正在检查更新...',
    noUpdate: '当前已是最新版本！',
    contactInfo: '邮箱 (必填)',
    feedbackContent: '反馈内容',
    submit: '提交',
    submitting: '提交中...',
    feedbackSuccess: '反馈提交成功！感谢您的宝贵意见。',
    feedbackError: '请填写邮箱和反馈内容',
    acssDescription: '欧洲学生学者联合会是由在欧留学的广大中国学生学者组成的自治组织，致力于服务留学人员，维护合法权益，促进中欧学术文化交流。'
  },
  en: {
    home: 'Home',
    notifications: 'Notifications',
    tools: 'Tools',
    profile: 'Profile',
    settings: 'Settings',
    about: 'About',
    logout: 'Logout',
    login: 'Login',
    guestMode: 'Guest Mode',
    loginPrompt: 'Login to unlock all features',
    hello: 'Hello, ',
    studentRole: 'Student / Scholar',
    adminRole: 'Administrator',
    systemSettings: 'System Settings',
    dataStorage: 'Data & Storage',
    legalTerms: 'Legal & Terms',
    privacyPolicy: 'Privacy Policy',
    userAgreement: 'User Agreement',
    clearCache: 'Clear Cache',
    cacheCleared: 'Cache cleared successfully!',
    confirmClearCache: 'Are you sure you want to clear cache?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    languageSetting: 'Language',
    themeSetting: 'Theme Mode',
    appInfo: 'App Info',
    contactUs: 'Contact Us',
    officialWebsite: 'Official Website',
    wechatPub: 'WeChat Public Account',
    serviceEmail: 'Service Email',
    copyright: 'Association of Chinese Students and Scholars. \\nAll rights reserved.',
    version: 'Version: 1.0.0 (Beta)',
    aboutDescription: 'This app is the official one-stop campus life service platform created by the Association of Chinese Students and Scholars in Europe, designed to provide the latest information, practical tools, and vibrant community services.',
    back: 'Back',
    save: 'Save',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    systemMode: 'Follow System',
    customMode: 'Custom Schedule',
    customTimeRange: 'Switch to dark mode within this time range.',
    startTime: 'Start Time',
    endTime: 'End Time',
    emptyContent: 'Content under construction...',
    noNotifications: 'No new notifications',
    toolsDeveloping: 'Tools are under development...',
    guestExplore: 'Continue as Guest',
    emailLabel: 'Email Address',
    wechatLabel: 'WeChat (Optional)',
    passwordLabel: 'Password',
    emailPlaceholder: 'Enter your email address',
    passwordPlaceholder: 'Enter your password',
    registerLabel: 'Create Account',
    registerLink: 'Register Now',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    loginLink: 'Login Now',
    nameLabel: 'Name / Nickname',
    namePlaceholder: 'Enter your name',
    emailRegPlaceholder: 'University email recommended',
    passwordRegPlaceholder: 'Enter password (at least 6 chars)',
    successRegTitle: 'Registration Submitted',
    successRegText: 'We have sent a verification email. Please click the link inside to activate your account.',
    successRegSubtext: 'Once verified, you can return here to sign in.',
    regSuccess: 'Registered Successfully!',

    appName: 'ACSS Platform',
    aboutACSS: 'About ACSS',
    platformIntro: 'Platform Intro',
    versionLabel: 'Version',
    feedback: 'Feedback',
    checkUpdate: 'Check for Updates',
    checkingUpdate: 'Checking for updates...',
    noUpdate: 'You are already on the latest version!',
    contactInfo: 'Email (Required)',
    feedbackContent: 'Feedback Content',
    submit: 'Submit',
    submitting: 'Submitting...',
    feedbackSuccess: 'Feedback submitted successfully! Thank you.',
    feedbackError: 'Please fill out email and feedback content',
    acssDescription: 'The Association of Chinese Students and Scholars in Europe is an organization dedicated to serving scholars, protecting rights, and promoting cultural and academic exchanges.'
  },
  it: {
    home: 'Home',
    notifications: 'Notifiche',
    tools: 'Strumenti',
    profile: 'Profilo',
    settings: 'Impostazioni',
    about: 'Info',
    logout: 'Disconnetti',
    login: 'Accedi',
    guestMode: 'Modalità Ospite',
    loginPrompt: 'Accedi per sbloccare tutte le funzionalità',
    hello: 'Ciao, ',
    studentRole: 'Studente / Ricercatore',
    adminRole: 'Amministratore',
    systemSettings: 'Impostazioni di Sistema',
    dataStorage: 'Dati e Archiviazione',
    legalTerms: 'Termini Legali',
    privacyPolicy: 'Informativa sulla Privacy',
    userAgreement: "Accordo per l'Utente",
    clearCache: 'Cancella Cache',
    cacheCleared: 'Cache cancellata con successo!',
    confirmClearCache: 'Sei sicuro di voler cancellare la cache?',
    cancel: 'Annulla',
    confirm: 'Conferma',
    languageSetting: 'Lingua',
    themeSetting: 'Tema',
    appInfo: 'Info sul Progetto',
    contactUs: 'Contattaci',
    officialWebsite: 'Sito Ufficiale',
    wechatPub: 'WeChat Pubblico',
    serviceEmail: 'Email di Servizio',
    copyright: 'Associazione degli Studenti e Studiosi Cinesi. \\nAll rights reserved.',
    version: 'Versione: 1.0.0 (Beta)',
    aboutDescription: "Questa applicazione è la piattaforma ufficiale di servizi per la vita universitaria creata dall'Associazione degli Studenti e Studiosi Cinesi in Europa, progettata per fornire informazioni, strumenti utili e servizi di community.",
    back: 'Indietro',
    save: 'Salva',
    lightMode: 'Tema Chiaro',
    darkMode: 'Tema Scuro',
    systemMode: 'Segui Sistema',
    customMode: 'Orario Personalizzato',
    customTimeRange: 'Passa al tema scuro in questo intervallo di tempo.',
    startTime: 'Ora Inizio',
    endTime: 'Ora Fine',
    emptyContent: 'Contenuto in costruzione...',
    noNotifications: 'Nessuna nuova notifica',
    toolsDeveloping: 'Strumenti in fase di sviluppo...',
    guestExplore: 'Continua come Ospite',
    emailLabel: 'Indirizzo Email',
    wechatLabel: 'WeChat (Opzionale)',
    passwordLabel: 'Password',
    emailPlaceholder: 'Inserisci il tuo indirizzo email',
    passwordPlaceholder: 'Inserisci la tua password',
    registerLabel: 'Crea Account',
    registerLink: 'Registrati Ora',
    noAccount: 'Non hai un account?',
    hasAccount: 'Hai già un account?',
    loginLink: 'Accedi Ora',
    nameLabel: 'Nome / Nickname',
    namePlaceholder: 'Inserisci il tuo nome',
    emailRegPlaceholder: 'Email universitaria consigliata',
    passwordRegPlaceholder: 'Inserisci password (almeno 6 caratteri)',
    successRegTitle: 'Registrazione Inviata',
    successRegText: "Abbiamo inviato un'email di verifica. Clicca sul link all'interno per attivare il tuo account.",
    successRegSubtext: 'Una volta verificato, puoi tornare qui per accedere.',
    regSuccess: 'Registrato con Successo!',

    appName: 'Piattaforma ACSS',
    aboutACSS: 'Info ACSS',
    platformIntro: 'Introduzione',
    versionLabel: 'Versione',
    feedback: 'Feedback',
    checkUpdate: 'Controlla Aggiornamenti',
    checkingUpdate: 'Controllo in corso...',
    noUpdate: "Sei già all'ultima versione!",
    contactInfo: 'Email (Obbligatorio)',
    feedbackContent: 'Contenuto del Feedback',
    submit: 'Invia',
    submitting: 'Invio in corso...',
    feedbackSuccess: 'Feedback inviato con successo! Grazie.',
    feedbackError: 'Si prega di compilare email e contenuto del feedback',
    acssDescription: "L'Associazione degli Studenti e Studiosi Cinesi in Europa è un'organizzazione dedicata a servire gli studiosi, tutelare i diritti e promuovere scambi culturali e accademici."
  }
};

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [customStart, setCustomStartState] = useState('20:00');
  const [customEnd, setCustomEndState] = useState('07:00');
  const [language, setLanguageState] = useState<Language>('zh');
  const [isReady, setIsReady] = useState(false);
  const [tick, setTick] = useState(0);

  const systemScheme = useColorScheme();

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedMode = await safeStorage.getItem('theme_mode');
        const savedStart = await safeStorage.getItem('custom_start');
        const savedEnd = await safeStorage.getItem('custom_end');
        const savedLang = await safeStorage.getItem('language');

        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedStart) setCustomStartState(savedStart);
        if (savedEnd) setCustomEndState(savedEnd);
        if (savedLang) setLanguageState(savedLang as Language);
      } catch (e) {
        console.error('Failed to load theme settings', e);
      } finally {
        setIsReady(true);
      }
    }
    loadSettings();
  }, []);

  useEffect(() => {
    if (themeMode !== 'custom') return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [themeMode]);

  const getIsDark = () => {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    if (themeMode === 'system') return systemScheme === 'dark';
    if (themeMode === 'custom') {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();

      const [startHour, startMin] = customStart.split(':').map(Number);
      const [endHour, endMin] = customEnd.split(':').map(Number);
      const startMinTotal = startHour * 60 + startMin;
      const endMinTotal = endHour * 60 + endMin;

      if (startMinTotal < endMinTotal) {
        return currentMin >= startMinTotal && currentMin < endMinTotal;
      } else {
        return currentMin >= startMinTotal || currentMin < endMinTotal;
      }
    }
    return true;
  };

  const isDark = getIsDark();
  const colors = isDark ? darkColors : lightColors;

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await safeStorage.setItem('theme_mode', mode);
  };

  const setCustomStart = async (time: string) => {
    setCustomStartState(time);
    await safeStorage.setItem('custom_start', time);
  };

  const setCustomEnd = async (time: string) => {
    setCustomEndState(time);
    await safeStorage.setItem('custom_end', time);
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await safeStorage.setItem('language', lang);
  };

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />;
  }

  return (
    <ThemeContext.Provider value={{
      themeMode,
      customStart,
      customEnd,
      language,
      isDark,
      colors,
      t,
      setThemeMode,
      setCustomStart,
      setCustomEnd,
      setLanguage,
      isReady
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
`,

  // 2. app/about.tsx
  [path.join(appDir, 'about.tsx')]: `import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  Platform, 
  BackHandler, 
  Image 
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

type ActiveView = 'main' | 'association' | 'intro' | 'feedback';

export default function AboutScreen() {
  const { colors, t } = useTheme();

  const [activeView, setActiveView] = useState<ActiveView>('main');
  const [email, setEmail] = useState('');
  const [wechat, setWechat] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  
  // Media picker states
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  // Intercept native Android back button to navigate internally
  useEffect(() => {
    const onBackPress = () => {
      if (activeView !== 'main') {
        setActiveView('main');
        return true; // prevent default behavior (exiting screen)
      }
      return false; // exit screen
    };

    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
  }, [activeView]);

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      Alert.alert(
        t('checkUpdate'), 
        t('noUpdate') + '\\n\\n(💡 提示：正式版本发布后，App可通过集成 expo-updates 服务进行无线热更新；或在更新时点击版本号调用浏览器直接下载最新的 APK/IPA 安装包进行升级。)'
      );
    }, 1200);
  };

  const handleSelectMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('feedback'), '我们需要相册访问权限来上传图片或视频。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'image');
    }
  };

  const handleRemoveMedia = () => {
    setMediaUri(null);
    setMediaType(null);
  };

  const handleFeedbackSubmit = () => {
    if (!email.trim() || !feedbackText.trim()) {
      Alert.alert(t('feedback'), t('feedbackError'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert(t('feedback'), '请输入有效的邮箱地址');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      Alert.alert(t('feedback'), t('feedbackSuccess'));
      setEmail('');
      setWechat('');
      setFeedbackText('');
      setMediaUri(null);
      setMediaType(null);
      setActiveView('main');
    }, 1500);
  };

  const handleBack = () => {
    if (activeView !== 'main') {
      setActiveView('main');
    } else {
      router.back();
    }
  };

  const getHeaderTitle = () => {
    if (activeView === 'association') return t('aboutACSS');
    if (activeView === 'intro') return t('platformIntro');
    if (activeView === 'feedback') return t('feedback');
    return t('about');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Text style={[styles.backText, { color: colors.primaryLight }]}>← {t('back')}</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{getHeaderTitle()}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {activeView === 'main' && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>🏠</Text>
            <Text style={[styles.appName, { color: colors.textPrimary }]}>{t('appName')}</Text>
            <Text style={[styles.version, { color: colors.textSecondary }]}>Version 1.0.0 (Beta)</Text>
          </View>

          <View style={[styles.menuSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* 1. About ACSS */}
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => setActiveView('association')}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('aboutACSS')}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>

            {/* 2. Platform Intro */}
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => setActiveView('intro')}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('platformIntro')}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>

            {/* 3. Version Update Check */}
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={handleCheckUpdate} disabled={checkingUpdate}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('versionLabel')}</Text>
              <View style={styles.rowRight}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color={colors.primaryLight} style={{ marginRight: 8 }} />
                ) : (
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>1.0.0 (Beta)</Text>
                )}
                <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
              </View>
            </Pressable>

            {/* 4. Feedback Form */}
            <Pressable style={[styles.menuRow, { borderBottomColor: colors.border }]} onPress={() => setActiveView('feedback')}>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{t('feedback')}</Text>
              <Text style={[styles.arrow, { color: colors.textMuted }]}>›</Text>
            </Pressable>
          </View>

          <Text style={[styles.copyright, { color: colors.textMuted }]}>
            © 2026 {t('copyright')}
          </Text>
        </ScrollView>
      )}

      {activeView === 'association' && (
        <ScrollView contentContainerStyle={styles.textDetailsContent}>
          <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{t('aboutACSS')}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            {t('acssDescription')}
          </Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            学联致力于全心全意为学子服务，搭建立足本地、面向欧洲的学术桥梁，定期举办学术沙龙、求职交流会、文艺晚会以及体育赛事，丰富留学人员的精神生活，是学子在海外温暖的港湾。
          </Text>
        </ScrollView>
      )}

      {activeView === 'intro' && (
        <ScrollView contentContainerStyle={styles.textDetailsContent}>
          <Text style={[styles.detailTitle, { color: colors.primaryLight }]}>{t('platformIntro')}</Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            {t('aboutDescription')}
          </Text>
          <Text style={[styles.detailParagraph, { color: colors.textPrimary }]}>
            本App不仅是信息发布的权威出口，还内置了留学生在学术、生活、求职等方面的多样化实用小工具（如汇率换算、常见问题手册等）。我们期望将平台打造成全场景覆盖的高效率一站式载体。
          </Text>
        </ScrollView>
      )}

      {activeView === 'feedback' && (
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.formHeaderTitle, { color: colors.textPrimary }]}>{t('feedback')}</Text>
          
          {/* Email input (Required) */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {t('emailLabel')} <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('emailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* WeChat input (Optional) */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {t('wechatLabel')}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="请输入微信号"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={wechat}
              onChangeText={setWechat}
            />
          </View>

          {/* Feedback Content (Required) */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              {t('feedbackContent')} <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="请填写您的宝贵意见..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
          </View>

          {/* Image/Video Upload preview card */}
          {mediaUri && (
            <View style={[styles.mediaPreviewContainer, { borderColor: colors.border }]}>
              {mediaType === 'image' ? (
                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
              ) : (
                <View style={[styles.videoPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.videoPlaceholderText, { color: colors.textPrimary }]}>📹 Video Selected</Text>
                </View>
              )}
              <Pressable style={[styles.removeMediaBtn, { backgroundColor: colors.error }]} onPress={handleRemoveMedia}>
                <Text style={styles.removeMediaBtnText}>×</Text>
              </Pressable>
            </View>
          )}

          {/* Media upload button */}
          {!mediaUri && (
            <Pressable 
              style={[styles.uploadButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} 
              onPress={handleSelectMedia}
            >
              <Text style={styles.uploadButtonIcon}>➕</Text>
              <Text style={[styles.uploadButtonText, { color: colors.textSecondary }]}>
                上传图片或视频 (Upload Image/Video)
              </Text>
            </Pressable>
          )}

          <Pressable 
            style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]} 
            onPress={handleFeedbackSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitButtonText}>{t('submit')}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
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
  backText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  content: {
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  version: {
    fontSize: 14,
  },
  menuSection: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  menuRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  menuLabel: {
    fontSize: 15,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowValue: {
    fontSize: 14,
    marginRight: 8,
  },
  arrow: {
    fontSize: 18,
  },
  copyright: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 40,
    marginBottom: 20,
  },
  textDetailsContent: {
    padding: 24,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  detailParagraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 14,
  },
  formContent: {
    padding: 24,
  },
  formHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  textArea: {
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    paddingTop: 16,
  },
  mediaPreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 18,
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  uploadButton: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  uploadButtonIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 10,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
`
};

Object.entries(filesToWrite).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully wrote file: ${filePath}`);
});

console.log('About submenus, back navigations, and media pickers written successfully!');
