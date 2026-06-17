import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, View, Platform, NativeModules } from 'react-native';
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
export type Language = 'zh' | 'zh-Hant' | 'en' | 'it';
export type LanguageMode = 'system' | 'zh' | 'zh-Hant' | 'en' | 'it';

type ThemeContextType = {
  themeMode: ThemeMode;
  customStart: string;
  customEnd: string;
  language: Language;
  languageMode: LanguageMode;
  isDark: boolean;
  colors: typeof darkColors;
  t: (key: string) => string;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setCustomStart: (time: string) => Promise<void>;
  setCustomEnd: (time: string) => Promise<void>;
  setLanguage: (lang: LanguageMode) => Promise<void>;
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
    copyright: '欧洲学生学者联合会. \nAll rights reserved.',
    version: '版本: 1.0.0.2',
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
    
    // New About Subpages & Feedback translation keys
    appName: '博学',
    aboutACSS: '关于学联',
    platformIntro: '平台简介',
    versionLabel: '版本',
    feedback: '反馈',
    checkUpdate: '检查更新',
    checkingUpdate: '正在检查更新...',
    noUpdate: '当前已是最新版本！',
    contactInfo: '联系方式 (微信/手机/邮箱)',
    feedbackContent: '反馈内容',
    submit: '提交',
    submitting: '提交中...',
    feedbackSuccess: '反馈提交成功！感谢您的宝贵意见。',
    feedbackError: '请填写完整内容',
    acssDescription: '欧洲学生学者联合会是由在欧留学的广大中国学生学者组成的自治组织，致力于服务留学人员，维护合法权益，促进中欧学术文化交流。',
    trainToolTitle: '意铁看板与车次',
    trainToolDesc: '实时查询意大利火车出发到达看板，追踪列车晚点及站台状态。'
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
    copyright: 'Association of Chinese Students and Scholars. \nAll rights reserved.',
    version: 'Version: 1.0.0.2',
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

    // New About Subpages & Feedback translation keys
    appName: 'Boxue',
    aboutACSS: 'About ACSS',
    platformIntro: 'Platform Intro',
    versionLabel: 'Version',
    feedback: 'Feedback',
    checkUpdate: 'Check for Updates',
    checkingUpdate: 'Checking for updates...',
    noUpdate: 'You are already on the latest version!',
    contactInfo: 'Contact Info (WeChat/Phone/Email)',
    feedbackContent: 'Feedback Content',
    submit: 'Submit',
    submitting: 'Submitting...',
    feedbackSuccess: 'Feedback submitted successfully! Thank you.',
    feedbackError: 'Please fill out all fields',
    acssDescription: 'The Association of Chinese Students and Scholars in Europe is an organization dedicated to serving scholars, protecting rights, and promoting cultural and academic exchanges.',
    trainToolTitle: 'Italian Train Info',
    trainToolDesc: 'Real-time departures, arrivals, platforms, and delay tracking for Italian trains.'
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
    copyright: 'Associazione degli Studenti e Studiosi Cinesi. \nAll rights reserved.',
    version: 'Versione: 1.0.0.2',
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

    // New About Subpages & Feedback translation keys
    appName: 'Boxue',
    aboutACSS: 'Info ACSS',
    platformIntro: 'Introduzione',
    versionLabel: 'Versione',
    feedback: 'Feedback',
    checkUpdate: 'Controlla Aggiornamenti',
    checkingUpdate: 'Controllo in corso...',
    noUpdate: "Sei già all'ultima versione!",
    contactInfo: 'Contatti (WeChat/Tel/Email)',
    feedbackContent: 'Contenuto del Feedback',
    submit: 'Invia',
    submitting: 'Invio in corso...',
    feedbackSuccess: 'Feedback inviato con successo! Grazie.',
    feedbackError: 'Si prega di compilare tutti i campi',
    acssDescription: "L'Associazione degli Studenti e Studiosi Cinesi in Europa è un'organizzazione dedicata a servire gli studiosi, tutelare i diritti e promuovere scambi culturali e accademici.",
    trainToolTitle: 'Orario e Stato Treni',
    trainToolDesc: 'Tabellone partenze/arrivi in tempo reale, binari e tracciamento ritardi dei treni.'
  },
  'zh-Hant': {
    home: '首頁',
    notifications: '通知',
    tools: '工具',
    profile: '我的',
    settings: '設置',
    about: '關於',
    logout: '退出登錄',
    login: '登錄帳戶',
    guestMode: '遊客模式',
    loginPrompt: '登錄即可體驗完整功能',
    hello: '你好，',
    studentRole: '普通學生學者',
    adminRole: '管理員',
    systemSettings: '系統設置',
    dataStorage: '數據與存儲',
    legalTerms: '法律與條款',
    privacyPolicy: '隱私政策',
    userAgreement: '用戶協議',
    clearCache: '清除緩存',
    cacheCleared: '緩存清除成功！',
    confirmClearCache: '確定要清除應用緩存嗎？',
    cancel: '取消',
    confirm: '確定',
    languageSetting: '語言設置',
    themeSetting: '主題模式',
    appInfo: '平台簡介',
    contactUs: '聯繫我們',
    officialWebsite: '官方網站',
    wechatPub: '微信公眾號',
    serviceEmail: '客服郵箱',
    copyright: '歐洲學生學者聯合會. \nAll rights reserved.',
    version: '版本: 1.0.0.2',
    aboutDescription: '本應用是由歐洲學生學者聯合會官方出品的一站式校園生活服務平台，旨在為廣大留歐學生學者提供最及時權威的信息資訊、最實用的生活學術工具以及充滿活力的青年社區。',
    back: '返回',
    save: '保存',
    lightMode: '淺色模式',
    darkMode: '深色模式',
    systemMode: '跟隨系統',
    customMode: '自定義時間',
    customTimeRange: '在此時間段內切換至深色模式。',
    startTime: '開始時間',
    endTime: '結束時間',
    emptyContent: '內容建設中...',
    noNotifications: '暫無新通知',
    toolsDeveloping: '工具箱正在研發中...',
    guestExplore: '暫不登錄，遊客探索',
    emailLabel: '電子郵箱',
    passwordLabel: '登錄密碼',
    emailPlaceholder: '請輸入郵箱地址',
    passwordPlaceholder: '請輸入密碼',
    registerLabel: '註冊帳戶',
    registerLink: '立即註冊',
    noAccount: '還沒有帳戶？',
    hasAccount: '已有帳戶？',
    loginLink: '立即登錄',
    nameLabel: '姓名 / 暱稱',
    namePlaceholder: '請輸入您的姓名',
    emailRegPlaceholder: '建議使用您的大學郵箱',
    passwordRegPlaceholder: '請輸入密碼 (至少6位)',
    successRegTitle: '註冊申請已提交',
    successRegText: '我們已向您的郵箱發送了一封驗證郵件，請打開郵件並點擊其中的驗證鏈接激活帳戶。',
    successRegSubtext: '驗證成功後，您可以返回此頁面進行登錄。',
    regSuccess: '註冊成功！',
    appName: '博學',
    aboutACSS: '關於學聯',
    platformIntro: '平台簡介',
    versionLabel: '版本',
    feedback: '反饋',
    checkUpdate: '檢查更新',
    checkingUpdate: '正在檢查更新...',
    noUpdate: '當前已是最新版本！',
    contactInfo: '聯繫方式 (微信/手機/郵箱)',
    feedbackContent: '反饋內容',
    submit: '提交',
    submitting: '提交中...',
    feedbackSuccess: '反饋提交成功！感謝您的寶貴意見。',
    feedbackError: '請填寫完整內容',
    acssDescription: '歐洲學生學者聯合會是由在歐留學的廣大中國學生學者組成的自治組織，致力於服務留學人員，維護合法權益，促進中歐學術文化交流。',
    trainToolTitle: '意鐵看板與車次',
    trainToolDesc: '即時查詢意大利火車出發到達看板，追蹤列車晚點及站台狀態。'
  }
};

function getSystemLanguage(): Language {
  let locale = 'zh';
  try {
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale || settings?.AppleLanguages?.[0] || 'zh';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || 'zh';
    }
  } catch (e) {
    console.warn('Failed to get system language, falling back to zh:', e);
  }

  const cleanLocale = locale.replace('_', '-').toLowerCase();

  if (
    cleanLocale.includes('zh-hant') || 
    cleanLocale.includes('-tw') || 
    cleanLocale.includes('-hk') || 
    cleanLocale.includes('-mo')
  ) {
    return 'zh-Hant';
  }

  if (cleanLocale.startsWith('zh')) {
    return 'zh';
  }

  if (cleanLocale.startsWith('en')) {
    return 'en';
  }

  if (cleanLocale.startsWith('it')) {
    return 'it';
  }

  return 'zh';
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [customStart, setCustomStartState] = useState('20:00');
  const [customEnd, setCustomEndState] = useState('07:00');
  const [languageMode, setLanguageModeState] = useState<LanguageMode>('system');
  const [isReady, setIsReady] = useState(false);
  const [tick, setTick] = useState(0);

  const systemScheme = useColorScheme();

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedMode = await safeStorage.getItem('theme_mode');
        const savedStart = await safeStorage.getItem('custom_start');
        const savedEnd = await safeStorage.getItem('custom_end');
        const savedLang = await safeStorage.getItem('language'); // Legacy
        const savedLangMode = await safeStorage.getItem('language_mode');

        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedStart) setCustomStartState(savedStart);
        if (savedEnd) setCustomEndState(savedEnd);

        let initialMode: LanguageMode = 'system';
        if (savedLangMode) {
          initialMode = savedLangMode as LanguageMode;
        } else if (savedLang) {
          initialMode = savedLang as LanguageMode;
        }
        setLanguageModeState(initialMode);
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

  const getActiveLanguage = (mode: LanguageMode): Language => {
    if (mode === 'system') {
      return getSystemLanguage();
    }
    return mode;
  };

  const language = getActiveLanguage(languageMode);

  const t = (key: string) => {
    return translations[language]?.[key] || translations['zh'][key] || key;
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

  const setLanguage = async (mode: LanguageMode) => {
    setLanguageModeState(mode);
    await safeStorage.setItem('language_mode', mode);
  };

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: systemScheme === 'dark' ? '#0A0A0A' : '#F5F7FA' }} />;
  }

  return (
    <ThemeContext.Provider value={{
      themeMode,
      customStart,
      customEnd,
      language,
      languageMode,
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
