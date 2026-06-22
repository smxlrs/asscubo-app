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
  tabBarStyle: 'traditional' | 'glassmorphism';
  setTabBarStyle: (style: 'traditional' | 'glassmorphism') => Promise<void>;
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
    notifications: '文章',
    forum: '论坛',
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
    tabBarSetting: '底栏样式',
    tabBarTraditional: '传统',
    tabBarGlassmorphism: '液态玻璃',
    appInfo: '平台简介',
    contactUs: '联系我们',
    officialWebsite: '官方网站',
    wechatPub: '微信公众号',
    serviceEmail: '客服邮箱',
    copyright: '博洛尼亚大学中国学联. \nAll rights reserved.',
    version: '版本: 1.0.0.4',
    aboutDescription: '本应用是由博洛尼亚大学中国学联官方出品的一站式校园和本地生活服务平台，旨在为广大博大及留意学生学者提供最及时权威的信息资讯、最实用的生活学术工具。',
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
    noNotifications: '暂无文章',
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
    appSubtitle: '一站式校园和本地生活平台',
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
    acssDescription: '博洛尼亚大学中国学联是一个独立的，非政治，非营利的协会。意大利语全称“ASSOCIAZIONE DI STUDENTI E STUDIOSI CINESI DELL’UNIVERSITA’ DI BOLOGNA”, 简称“ASSCUBO”。学联致力于促进中国留学生同当地学生之间的交流并维护在意留学生的权益；为就读于博洛尼亚大学的留学生提供必要的帮助与服务；为广大留学生营造良好的学习环境。',
    trainToolTitle: '意大利火车查询',
    trainToolDesc: '实时查看意大利各火车站出发和到达表，追踪列车时刻和站台信息。',
    usefulLinks: '实用链接',
    officialPlatforms: '公众平台',
    loginSubtitle: '博洛尼亚大学中国学联官方移动端',
    loginButton: '登录',
    registerButton: '注册',
    backToLogin: '返回登录',
    tip: '提示',
    agreeAgreementPrompt: '请先阅读并同意《用户协议》和《隐私政策》',
    fillRequiredFields: '请填写所有必填字段',
    passwordTooShort: '密码长度不能少于 6 位',
    enterEmailAndPassword: '请输入邮箱和密码',
    networkError: '网络异常，请稍后再试',
    agreementPrefix: '我已阅读并同意',
    and: '和',
    userAgreementLabel: '《用户协议》',
    privacyPolicyLabel: '《隐私政策》',
  },
  en: {
    home: 'Home',
    notifications: 'Articles',
    forum: 'Forum',
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
    tabBarSetting: 'Tab Bar Style',
    tabBarTraditional: 'Traditional',
    tabBarGlassmorphism: 'Liquid Glass',
    appInfo: 'App Info',
    contactUs: 'Contact Us',
    officialWebsite: 'Official Website',
    wechatPub: 'WeChat Public Account',
    serviceEmail: 'Service Email',
    copyright: 'ASSCUBO. \nAll rights reserved.',
    version: 'Version: 1.0.0.4',
    aboutDescription: 'This app is the official one-stop campus and local life service platform created by the Chinese Students and Scholars Association of the University of Bologna (ASSCUBO), designed to provide the latest information and practical tools.',
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
    noNotifications: 'No articles found',
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
    appSubtitle: 'One-stop Campus and Local Life Platform',
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
    acssDescription: 'The Chinese Students and Scholars Association of the University of Bologna (ASSCUBO) is an independent, non-political, and non-profit association. Its full Italian name is "ASSOCIAZIONE DI STUDENTI E STUDIOSI CINESI DELL’UNIVERSITA’ DI BOLOGNA". ASSCUBO is dedicated to promoting communication between Chinese international students and local students, protecting the rights of international students in Italy, providing necessary assistance and services to students at the University of Bologna, and creating a supportive learning environment.',
    trainToolTitle: 'Italian Train Info',
    trainToolDesc: 'Real-time departures, arrivals, platforms, and delay tracking for Italian trains.',
    usefulLinks: 'Useful Links',
    officialPlatforms: 'Official Platforms',
    loginSubtitle: 'Official mobile app of ASSCUBO',
    loginButton: 'Login',
    registerButton: 'Register',
    backToLogin: 'Back to Login',
    tip: 'Notice',
    agreeAgreementPrompt: 'Please read and agree to the User Agreement and Privacy Policy',
    fillRequiredFields: 'Please fill in all required fields',
    passwordTooShort: 'Password must be at least 6 characters',
    enterEmailAndPassword: 'Please enter email and password',
    networkError: 'Network error, please try again later',
    agreementPrefix: 'I have read and agree to ',
    and: ' and ',
    userAgreementLabel: 'User Agreement',
    privacyPolicyLabel: 'Privacy Policy',
  },
  it: {
    home: 'Home',
    notifications: 'Articoli',
    forum: 'Forum',
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
    tabBarSetting: 'Stile Barra Tab',
    tabBarTraditional: 'Tradizionale',
    tabBarGlassmorphism: 'Vetro Liquido',
    appInfo: 'Info sul Progetto',
    contactUs: 'Contattaci',
    officialWebsite: 'Sito Ufficiale',
    wechatPub: 'WeChat Pubblico',
    serviceEmail: 'Email di Servizio',
    copyright: 'ASSCUBO. \nAll rights reserved.',
    version: 'Versione: 1.0.0.4',
    aboutDescription: "Questa applicazione è la piattaforma ufficiale di servizi per la vita universitaria e locale creata dall'Associazione di Studenti e Studiosi Cinesi dell'Università di Bologna (ASSCUBO), progettata per fornire informazioni e strumenti utili.",
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
    noNotifications: 'Nessun articolo trovato',
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
    appSubtitle: 'Piattaforma all-in-one per la vita universitaria e locale',
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
    acssDescription: "L’Associazione di Studenti e Studiosi Cinesi dell’Università di Bologna (ASSCUBO) è un’associazione indipendente, apolitica e senza scopo di lucro. La denominazione ufficiale in italiano è \"ASSOCIAZIONE DI STUDENTI E STUDIOSI CINESI DELL’UNIVERSITA’ DI BOLOGNA\", abbreviato in \"ASSCUBO\". L’Associazione si impegna a promuovere lo scambio tra studenti cinesi e locali, tutelare i diritti degli studenti in Italia, fornire assistenza e servizi necessari per chi studia all’Università di Bologna e creare un ambiente di studio accogliente.",
    trainToolTitle: 'Orario e Stato Treni',
    trainToolDesc: 'Tabellone partenze/arrivi in tempo reale, binari e tracciamento ritardi dei treni.',
    usefulLinks: 'Link Utili',
    officialPlatforms: 'Canali Ufficiali',
    loginSubtitle: 'App mobile ufficiale di ASSCUBO',
    loginButton: 'Accedi',
    registerButton: 'Registrati',
    backToLogin: 'Torna al Login',
    tip: 'Avviso',
    agreeAgreementPrompt: "Si prega di leggere e accettare l'Accordo per l'Utente e l'Informativa sulla Privacy",
    fillRequiredFields: 'Si prega di compilare tutti i campi obbligatori',
    passwordTooShort: 'La password deve contenere almeno 6 caratteri',
    enterEmailAndPassword: 'Si prega di inserire email e password',
    networkError: 'Errore di rete, riprova più tardi',
    agreementPrefix: 'Ho letto e acconsento a ',
    and: ' e ',
    userAgreementLabel: "l'Accordo per l'Utente",
    privacyPolicyLabel: 'Informativa sulla Privacy',
  },
  'zh-Hant': {
    home: '首頁',
    notifications: '文章',
    forum: '論壇',
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
    tabBarSetting: '底欄樣式',
    tabBarTraditional: '傳統',
    tabBarGlassmorphism: '液態玻璃',
    appInfo: '平台簡介',
    contactUs: '聯繫我們',
    officialWebsite: '官方網站',
    wechatPub: '微信公眾號',
    serviceEmail: '客服郵箱',
    copyright: '博洛尼亞大學中國學聯. \nAll rights reserved.',
    version: '版本: 1.0.0.4',
    aboutDescription: '本應用是由博洛尼亞大學中國學聯官方出品的一站式校園和本地生活服務平台，旨在為廣大博大及留意學生學者提供最及時權威的信息資訊、最實用的生活學術工具。',
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
    noNotifications: '暫無文章',
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
    appSubtitle: '一站式校園和本地生活平台',
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
    acssDescription: '博洛尼亞大學中國學聯是一個獨立的，非政治，非營利的協會。意大利語全稱“ASSOCIAZIONE DI STUDENTI E STUDIOSI CINESI DELL’UNIVERSITA’ DI BOLOGNA”, 簡稱“ASSCUBO”。學聯致力於促進中國留學生同當地學生之間的交流並維護在意留學生的權益；為就讀於博洛尼亞大學的留學生提供必要的幫助與服務；為廣大留學生營造良好的學習環境。',
    trainToolTitle: '意大利火車查詢',
    trainToolDesc: '即時查看意大利各火車站出發和到達表，追蹤列車時刻和站台信息。',
    usefulLinks: '實用鏈接',
    officialPlatforms: '公眾平台',
    loginSubtitle: '博洛尼亞大學中國學聯官方移動端',
    loginButton: '登錄',
    registerButton: '註冊',
    backToLogin: '返回登錄',
    tip: '提示',
    agreeAgreementPrompt: '請先閱讀並同意《用戶協議》和《隱私政策》',
    fillRequiredFields: '請填寫所有必填欄位',
    passwordTooShort: '密碼長度不能少於 6 位',
    enterEmailAndPassword: '請輸入郵箱和密碼',
    networkError: '網絡異常，請稍後再試',
    agreementPrefix: '我已閱讀並同意',
    and: '和',
    userAgreementLabel: '《用戶協議》',
    privacyPolicyLabel: '《隱私政策》',
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
  const [tabBarStyle, setTabBarStyleState] = useState<'traditional' | 'glassmorphism'>('glassmorphism');
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
        const savedTabBarStyle = await safeStorage.getItem('tab_bar_style');

        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedStart) setCustomStartState(savedStart);
        if (savedEnd) setCustomEndState(savedEnd);
        if (savedTabBarStyle) setTabBarStyleState(savedTabBarStyle as 'traditional' | 'glassmorphism');

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

  const setTabBarStyle = async (style: 'traditional' | 'glassmorphism') => {
    setTabBarStyleState(style);
    await safeStorage.setItem('tab_bar_style', style);
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
      isReady,
      tabBarStyle,
      setTabBarStyle
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
