import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme, View, Platform, NativeModules, Animated } from 'react-native';
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
  tabOpacities: Animated.Value[];
  tabGestureActive: boolean;
  setTabGestureActive: (active: boolean) => void;
  predictiveBack: boolean;
  setPredictiveBack: (enabled: boolean) => Promise<void>;
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
  background: '#FFFFFF',
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
    nameLabel: '昵称',
    namePlaceholder: '请输入您的昵称',
    emailRegPlaceholder: '建议使用您的大学邮箱',
    passwordRegPlaceholder: '请输入密码 (至少6位)',
    confirmPasswordLabel: '确认密码',
    confirmPasswordPlaceholder: '请再次输入密码',
    passwordsDoNotMatch: '两次输入的密码不一致',
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
    loginSubtitle: '博洛尼亚大学中国学联官方APP',
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
    experimentalSetting: '实验性功能',
    backNavigationSetting: '返回方式',
    backNavigationTraditional: '传统',
    backNavigationPredictive: '预测性返回',
    enterEmailAddress: '请输入邮箱地址',
    emailNotRegistered: '该邮箱未注册，请先注册账户',
    otpSentTitle: '验证码已发送',
    otpSentMsg: '登录验证码已发送至您的邮箱，请注意查收。',
    sendOtpError: '网络错误，发送验证码失败',
    enterEmailAndOtp: '请输入邮箱和验证码',
    enter6DigitOtp: '请输入完整的 6 位验证码',
    loginVerifyFailed: '网络错误，登录验证失败',
    passwordLogin: '密码登录',
    otpLogin: '验证码登录',
    otpCodeLabel: '验证码',
    otpCodePlaceholder: '请输入 6 位验证码',
    resend: '重新发送',
    getOtpCode: '获取验证码',
    resendSuccessTitle: '邮件已重送',
    resendSuccessMsg: '验证邮件已重新发送至您的邮箱，请注意查收。',
    resendErrorTitle: '发送失败',
    networkErrorRetry: '网络发生错误，请稍后重试。',
    sensitiveWordError: '昵称包含敏感词汇 "{word}"，请更换其它昵称。',
    sentEmailPrompt: '已向以下邮箱发送了验证邮件：',
    verifyEmailInstruction: '请打开邮件并点击其中的验证链接激活账户。验证成功后，即可登录。',
    resendVerifyEmail: '重新发送验证邮件',
    verifyEmailTitle: '验证您的邮箱',
    verifyEmailDesc: '我们已向您的教育邮箱发送了一封验证邮件。\n\n请点击邮件中的链接完成验证后，再回来登录。',
    noticeTitle: '注意事项',
    noticeTip1: '• 验证邮件可能需要几分钟才能到达',
    noticeTip2: '• 请检查垃圾邮件文件夹',
    noticeTip3: '• 验证链接有效期为 24 小时',
    verifiedGoToLogin: '已验证，去登录',
    verifySuccessTitle: '邮箱验证成功',
    verifySuccessDesc: '您的账户已成功激活！\n现在可以使用注册的账号和密码登录应用。',
    welcomeTitleBoxue: '欢迎加入博学',
    welcomeBullet1: '• 开启您的学术与校园生活助手',
    welcomeBullet2: '• 随时查看最新动态、通知与微信文章',
    welcomeBullet3: '• 使用精心打磨的工具箱提升效率',
    goToLogin: '前往登录',
    exitAppPrompt: '再按一次退出博学',
    details: '详情',
    verifyingAccount: '正在验证您的账户，请稍候...',
    verificationSuccessMsg: '验证成功！',
    verificationFailed: '验证失败',
    activatingSession: '正在激活账户会话...',
    establishingSession: '正在建立安全会话...',
    linkInvalidOrIncomplete: '验证链接已失效或不完整。如果您已经激活过账户，请尝试直接登录。',
    linkConsumedOrExpired: '验证链接已失效或已被使用。如果您已激活过账户，请直接登录；否则请尝试重新发送验证邮件。',
    verificationTimeout: '验证请求响应超时，可能由于网络连接较差。请确保网络畅通后重试，或尝试直接登录。',
    authSuccess: '认证成功！',
    accountActivatedAutoLogin: '您的账户已成功激活并自动登录！\n正在为您跳转至首页...',
    enterApp: '进入应用',
    somethingWentWrong: '出了点问题',
    fallbackActivationError: '无法完成账户激活，请确认验证链接是否有效。',
    category_notice: '通知',
    category_news: '新闻',
    category_event_news: '活动',
    category_general: '综合',
    category_events: '学联活动',
    category_academic: '学术资讯',
    category_life: '生活辅助',
    category_column: '原创专栏',
    category_reprint: '转载',
    appSubtitleHeader: '博学 · 连接在意生活',
    recentEvents: '近期活动',
    seeAll: '查看全部',
    announcementsTitle: '动态与通知',
    noAnnouncements: '暂无动态与通知，敬请期待',
    featured: '置顶',
    notificationType: '通知',
    articleType: '文章',
    selectCity: '选择城市',
    searchCityPlaceholder: '搜索城市 (中文/拼音/英文)...',
    noCityFound: '没有找到匹配的城市',
    refreshSuccess: '刷新成功',
    greetingMorning: '早上好',
    greetingAfternoon: '下午好',
    greetingEvening: '晚上好',
    weatherDataSource: '数据来自: Open-Meteo',
    weatherClear: '晴朗',
    weatherCloudy: '多云',
    weatherOvercast: '阴天',
    weatherFoggy: '有雾',
    weatherDrizzle: '毛毛雨',
    weatherFreezingRain: '冻雨',
    weatherLightRain: '小雨',
    weatherHeavyRain: '大雨',
    weatherHeavyFreezingRain: '强冻雨',
    weatherSnow: '降雪',
    weatherSnowGrains: '雪粒',
    weatherShowers: '阵雨',
    weatherSnowShowers: '阵雪',
    weatherThunderstorm: '雷阵雨',
    weatherThunderstormHail: '雷雨冰雹',
    weatherApparentTemp: '体感 {temp}°C',
    weatherApparentTempFallback: '体感 --°C',
    searchAnnouncementsPlaceholder: '搜索动态与通知...',
    noRelatedContent: '暂无相关内容',
    viewDetailsArrow: '查看详情 →',
    readFullArticleArrow: '阅读全文 →',
    category_all: '全部',
    searchArticlesPlaceholder: '搜索文章...',
    collapseDetails: '收起详情',
    expandReading: '展开阅读',
    viewArticleDetail: '查看文章详情',
    latest: '最新',
    latestUpdates: '动态与通知',
    noContent: '暂无内容',
    comm_filter_all: '📢 全体',
    comm_filter_faculty: '🏛️ 按院系',
    comm_filter_year: '📅 按年级',
    comm_filter_campus: '🏫 按校区',
    comm_time_just_now: '刚刚',
    comm_time_hours_ago: '{hours}小时前',
    comm_time_days_ago: '{days}天前',
    comm_title: '💬 社群广场',
    comm_new_post: '+ 发帖',
    comm_empty_posts: '暂无帖子，来发第一帖吧！',
    comm_anon_avatar: '匿',
    comm_anon_user: '匿名用户',
    comm_replies_count: '💬 {count} 条回复',
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
    nameLabel: 'Nickname',
    namePlaceholder: 'Enter your nickname',
    emailRegPlaceholder: 'University email recommended',
    passwordRegPlaceholder: 'Enter password (at least 6 chars)',
    confirmPasswordLabel: 'Confirm Password',
    confirmPasswordPlaceholder: 'Re-enter your password',
    passwordsDoNotMatch: 'Passwords do not match',
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
    experimentalSetting: 'Experimental Features',
    backNavigationSetting: 'Back Navigation',
    backNavigationTraditional: 'Traditional',
    backNavigationPredictive: 'Predictive Back',
    enterEmailAddress: 'Please enter your email address',
    emailNotRegistered: 'This email is not registered. Please register first.',
    otpSentTitle: 'Verification Code Sent',
    otpSentMsg: 'A login verification code has been sent to your email. Please check your inbox.',
    sendOtpError: 'Network error, failed to send verification code',
    enterEmailAndOtp: 'Please enter email and verification code',
    enter6DigitOtp: 'Please enter a complete 6-digit verification code',
    loginVerifyFailed: 'Network error, login verification failed',
    passwordLogin: 'Password Login',
    otpLogin: 'Code Login',
    otpCodeLabel: 'Verification Code',
    otpCodePlaceholder: 'Enter 6-digit code',
    resend: 'Resend',
    getOtpCode: 'Get Code',
    resendSuccessTitle: 'Email Resent',
    resendSuccessMsg: 'The verification email has been resent. Please check your inbox.',
    resendErrorTitle: 'Failed to Send',
    networkErrorRetry: 'Network error, please try again later.',
    sensitiveWordError: 'Nickname contains sensitive word "{word}", please choose another.',
    sentEmailPrompt: 'A verification email has been sent to:',
    verifyEmailInstruction: 'Please open the email and click the verification link to activate your account. Once verified, you can sign in.',
    resendVerifyEmail: 'Resend Verification Email',
    verifyEmailTitle: 'Verify Your Email',
    verifyEmailDesc: 'We have sent a verification email to your university email.\n\nPlease click the link in the email to complete verification, then return to sign in.',
    noticeTitle: 'Important Notice',
    noticeTip1: '• The email may take a few minutes to arrive',
    noticeTip2: '• Please check your spam folder',
    noticeTip3: '• The verification link is valid for 24 hours',
    verifiedGoToLogin: 'Verified, Go to Login',
    verifySuccessTitle: 'Email Verified Successfully',
    verifySuccessDesc: 'Your account has been successfully activated!\nYou can now log in using your registered email and password.',
    welcomeTitleBoxue: 'Welcome to Boxue',
    welcomeBullet1: '• Start your academic and campus assistant',
    welcomeBullet2: '• Get latest updates, notices and WeChat articles',
    welcomeBullet3: '• Boost efficiency with our polished toolkit',
    goToLogin: 'Go to Login',
    exitAppPrompt: 'Press back again to exit',
    details: 'Details',
    verifyingAccount: 'Verifying your account, please wait...',
    verificationSuccessMsg: 'Verification successful!',
    verificationFailed: 'Verification failed',
    activatingSession: 'Activating account session...',
    establishingSession: 'Establishing secure session...',
    linkInvalidOrIncomplete: 'The verification link is invalid or incomplete. If you have already activated your account, please try logging in directly.',
    linkConsumedOrExpired: 'The verification link is invalid or has been used. If you have already activated your account, please log in directly; otherwise, try resending the verification email.',
    verificationTimeout: 'Verification request timed out. This could be due to a poor network connection. Please ensure a stable connection and try again, or try logging in directly.',
    authSuccess: 'Authentication successful!',
    accountActivatedAutoLogin: 'Your account has been successfully activated and logged in! \nNavigating to home page...',
    enterApp: 'Enter App',
    somethingWentWrong: 'Something went wrong',
    fallbackActivationError: 'Unable to complete account activation. Please check if the verification link is valid.',
    category_notice: 'Notice',
    category_news: 'News',
    category_event_news: 'Events',
    category_general: 'General',
    category_events: 'CSSA Events',
    category_academic: 'Academic Info',
    category_life: 'Life Guide',
    category_column: 'Original Columns',
    category_reprint: 'Reprint',
    appSubtitleHeader: 'Boxue · Connecting Life in Italy',
    recentEvents: 'Recent Events',
    seeAll: 'See All',
    announcementsTitle: 'News & Notifications',
    noAnnouncements: 'No news or notifications yet, stay tuned!',
    featured: 'Pinned',
    notificationType: 'Notice',
    articleType: 'Article',
    selectCity: 'Select City',
    searchCityPlaceholder: 'Search city (Chinese/Pinyin/English)...',
    noCityFound: 'No matching cities found',
    refreshSuccess: 'Refresh successful',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    weatherDataSource: 'Source: Open-Meteo',
    weatherClear: 'Clear',
    weatherCloudy: 'Cloudy',
    weatherOvercast: 'Overcast',
    weatherFoggy: 'Foggy',
    weatherDrizzle: 'Drizzle',
    weatherFreezingRain: 'Freezing Rain',
    weatherLightRain: 'Light Rain',
    weatherHeavyRain: 'Heavy Rain',
    weatherHeavyFreezingRain: 'Heavy Freezing Rain',
    weatherSnow: 'Snow',
    weatherSnowGrains: 'Snow Grains',
    weatherShowers: 'Rain Showers',
    weatherSnowShowers: 'Snow Showers',
    weatherThunderstorm: 'Thunderstorm',
    weatherThunderstormHail: 'Thunderstorm with Hail',
    weatherApparentTemp: 'Feels like {temp}°C',
    weatherApparentTempFallback: 'Feels like --°C',
    searchAnnouncementsPlaceholder: 'Search news & notifications...',
    noRelatedContent: 'No related content found',
    viewDetailsArrow: 'View Details →',
    readFullArticleArrow: 'Read Full Article →',
    category_all: 'All',
    searchArticlesPlaceholder: 'Search articles...',
    collapseDetails: 'Collapse Details',
    expandReading: 'Expand Reading',
    viewArticleDetail: 'View article details',
    latest: 'Latest',
    latestUpdates: 'News & Notifications',
    noContent: 'No content available',
    comm_filter_all: '📢 All',
    comm_filter_faculty: '🏛️ By Faculty',
    comm_filter_year: '📅 By Year',
    comm_filter_campus: '🏫 By Campus',
    comm_time_just_now: 'Just now',
    comm_time_hours_ago: '{hours}h ago',
    comm_time_days_ago: '{days}d ago',
    comm_title: '💬 Community',
    comm_new_post: '+ Post',
    comm_empty_posts: 'No posts yet. Be the first to post!',
    comm_anon_avatar: 'A',
    comm_anon_user: 'Anonymous User',
    comm_replies_count: '💬 {count} replies',
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
    nameLabel: 'Nickname',
    namePlaceholder: 'Inserisci il tuo nickname',
    emailRegPlaceholder: 'Email universitaria consigliata',
    passwordRegPlaceholder: 'Inserisci password (almeno 6 caratteri)',
    confirmPasswordLabel: 'Conferma Password',
    confirmPasswordPlaceholder: 'Reinserisci la password',
    passwordsDoNotMatch: 'Le password non corrispondono',
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
    experimentalSetting: 'Funzioni Sperimentali',
    backNavigationSetting: 'Navigazione Indietro',
    backNavigationTraditional: 'Tradizionale',
    backNavigationPredictive: 'Ritorno Predittivo',
    enterEmailAddress: 'Inserisci il tuo indirizzo email',
    emailNotRegistered: 'Questa email non è registrata. Si prega di registrarsi prima.',
    otpSentTitle: 'Codice di Verifica Inviato',
    otpSentMsg: 'Un codice di verifica dell\'accesso è stato inviato alla tua email. Controlla la posta.',
    sendOtpError: 'Errore di rete, invio del codice fallito',
    enterEmailAndOtp: 'Inserisci email e codice di verifica',
    enter6DigitOtp: 'Inserisci un codice di verifica a 6 cifre completo',
    loginVerifyFailed: 'Errore di rete, verifica di accesso fallita',
    passwordLogin: 'Accedi con Password',
    otpLogin: 'Accedi con Codice',
    otpCodeLabel: 'Codice di Verifica',
    otpCodePlaceholder: 'Inserisci il codice a 6 cifre',
    resend: 'Invia di nuovo',
    getOtpCode: 'Ottieni Codice',
    resendSuccessTitle: 'Email Reinviata',
    resendSuccessMsg: 'L\'email di verifica è stata reinviata. Controlla la tua posta.',
    resendErrorTitle: 'Invio Fallito',
    networkErrorRetry: 'Errore di rete, si prega di riprovare più tardi.',
    sensitiveWordError: 'Il nickname contiene una parola sensibile "{word}", scegline un altro.',
    sentEmailPrompt: 'Abbiamo inviato un\'email di verifica a:',
    verifyEmailInstruction: 'Apri l\'email e clicca sul link di verifica per attivare il tuo account. Dopo la verifica potrai accedere.',
    resendVerifyEmail: 'Reinvia Email di Verifica',
    verifyEmailTitle: 'Verifica la tua email',
    verifyEmailDesc: 'Abbiamo inviato un\'email di verifica alla tua email universitaria.\n\nClicca sul link nell\'email per completare la verifica, quindi torna per accedere.',
    noticeTitle: 'Note Importanti',
    noticeTip1: '• L\'email potrebbe richiedere alcuni minuti per arrivare',
    noticeTip2: '• Controlla la cartella spam',
    noticeTip3: '• Il link di verifica è valido per 24 ore',
    verifiedGoToLogin: 'Verificato, Vai al Login',
    verifySuccessTitle: 'Email Verificata con Successo',
    verifySuccessDesc: 'Il tuo account è stato attivato con successo!\nOra puoi accedere usando la tua email e password registrate.',
    welcomeTitleBoxue: 'Benvenuto su Boxue',
    welcomeBullet1: '• Avvia il tuo assistente accademico e universitario',
    welcomeBullet2: '• Ricevi aggiornamenti, avvisi e articoli di WeChat',
    welcomeBullet3: '• Aumenta l\'efficienza con i nostri strumenti',
    goToLogin: 'Vai al Login',
    exitAppPrompt: 'Premi di nuovo per uscire',
    details: 'Dettagli',
    verifyingAccount: 'Verifica del tuo account in corso, attendere...',
    verificationSuccessMsg: 'Verifica avvenuta con successo!',
    verificationFailed: 'Verifica fallita',
    activatingSession: 'Attivazione della sessione dell\'account...',
    establishingSession: 'Creazione della sessione sicura...',
    linkInvalidOrIncomplete: 'Il link di verifica non è valido o è incompleto. Se hai già attivato il tuo account, prova ad accedere direttamente.',
    linkConsumedOrExpired: 'Il link di verifica non è valido o è stato utilizzato. Se hai già attivato il tuo account, accedi direttamente; altrimenti, prova a reinviare l\'email di verifica.',
    verificationTimeout: 'La richiesta di verifica è andata in timeout. Potrebbe essere dovuto a una connessione di rete debole. Assicurati che la connessione sia stabile e riprova, o prova ad accedere direttamente.',
    authSuccess: 'Autenticazione riuscita!',
    accountActivatedAutoLogin: 'Il tuo account è stato attivato ed effettuato l\'accesso con successo! \nReindirizzamento alla home page...',
    enterApp: 'Entra nell\'App',
    somethingWentWrong: 'Qualcosa è andato storto',
    fallbackActivationError: 'Impossibile completare l\'attivazione dell\'account. Verifica se il link di verifica è valido.',
    category_notice: 'Avviso',
    category_news: 'Notizie',
    category_event_news: 'Eventi',
    category_general: 'Generale',
    category_events: 'Eventi ASSCUBO',
    category_academic: 'Accademia',
    category_life: 'Guida alla Vita',
    category_column: 'Rubriche',
    category_reprint: 'Ripubblicato',
    appSubtitleHeader: 'Boxue · Connettere la vita in Italia',
    recentEvents: 'Eventi Recenti',
    seeAll: 'Vedi tutti',
    announcementsTitle: 'Notizie e Avvisi',
    noAnnouncements: 'Nessuna notizia o avviso ancora, resta sintonizzato!',
    featured: 'In Evidenza',
    notificationType: 'Avviso',
    articleType: 'Articolo',
    selectCity: 'Seleziona Città',
    searchCityPlaceholder: 'Cerca città (Cinese/Pinyin/Inglese)...',
    noCityFound: 'Nessuna città corrispondente trovata',
    refreshSuccess: 'Aggiornato con successo',
    greetingMorning: 'Buongiorno',
    greetingAfternoon: 'Buon pomeriggio',
    greetingEvening: 'Buonasera',
    weatherDataSource: 'Dati da: Open-Meteo',
    weatherClear: 'Sereno',
    weatherCloudy: 'Nuvoloso',
    weatherOvercast: 'Coperto',
    weatherFoggy: 'Nebbia',
    weatherDrizzle: 'Pioviggine',
    weatherFreezingRain: 'Pioggia Gelata',
    weatherLightRain: 'Pioggia Leggera',
    weatherHeavyRain: 'Pioggia Forte',
    weatherHeavyFreezingRain: 'Forte Pioggia Gelata',
    weatherSnow: 'Neve',
    weatherSnowGrains: 'Neve a Grani',
    weatherShowers: 'Acquazzoni',
    weatherSnowShowers: 'Rovesci di Neve',
    weatherThunderstorm: 'Temporale',
    weatherThunderstormHail: 'Temporale con Grandine',
    weatherApparentTemp: 'Percepita {temp}°C',
    weatherApparentTempFallback: 'Percepita --°C',
    searchAnnouncementsPlaceholder: 'Cerca notizie e avvisi...',
    noRelatedContent: 'Nessun contenuto correlato trovato',
    viewDetailsArrow: 'Vedi dettagli →',
    readFullArticleArrow: 'Leggi articolo completo →',
    category_all: 'Tutti',
    searchArticlesPlaceholder: 'Cerca articoli...',
    collapseDetails: 'Riduci dettagli',
    expandReading: 'Espandi lettura',
    viewArticleDetail: 'Vedi dettagli dell\'articolo',
    latest: 'Novità',
    latestUpdates: 'Notizie e Avvisi',
    noContent: 'Nessun contenuto disponibile',
    comm_filter_all: '📢 Tutti',
    comm_filter_faculty: '🏛️ Per Dipartimento',
    comm_filter_year: '📅 Per Anno',
    comm_filter_campus: '🏫 Per Sede',
    comm_time_just_now: 'Proprio ora',
    comm_time_hours_ago: '{hours} ore fa',
    comm_time_days_ago: '{days} giorni fa',
    comm_title: '💬 Community',
    comm_new_post: '+ Pubblica',
    comm_empty_posts: 'Nessun post ancora. Pubblica il primo!',
    comm_anon_avatar: 'A',
    comm_anon_user: 'Utente Anonimo',
    comm_replies_count: '💬 {count} risposte',
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
    nameLabel: '暱稱',
    namePlaceholder: '請輸入您的暱稱',
    emailRegPlaceholder: '建議使用您的大學郵箱',
    passwordRegPlaceholder: '請輸入密碼 (至少6位)',
    confirmPasswordLabel: '確認密碼',
    confirmPasswordPlaceholder: '請再次輸入密碼',
    passwordsDoNotMatch: '兩次輸入的密碼不一致',
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
    loginSubtitle: '博洛尼亞大學中國學聯官方APP',
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
    experimentalSetting: '實驗性功能',
    backNavigationSetting: '返回方式',
    backNavigationTraditional: '傳統',
    backNavigationPredictive: '預測性返回',
    enterEmailAddress: '請輸入郵箱地址',
    emailNotRegistered: '該郵箱未註冊，請先註冊帳戶',
    otpSentTitle: '驗證碼已發送',
    otpSentMsg: '登錄驗證碼已發送至您的郵箱，請注意查收。',
    sendOtpError: '網絡異常，發送驗證碼失敗',
    enterEmailAndOtp: '請輸入郵箱和驗證碼',
    enter6DigitOtp: '請輸入完整的 6 位驗證碼',
    loginVerifyFailed: '網絡異常，登錄驗證失敗',
    passwordLogin: '密碼登錄',
    otpLogin: '驗證碼登錄',
    otpCodeLabel: '驗證碼',
    otpCodePlaceholder: '請輸入 6 位驗證碼',
    resend: '重新發送',
    getOtpCode: '獲取驗證碼',
    resendSuccessTitle: '郵件已重送',
    resendSuccessMsg: '驗證郵件已重新發送至您的郵箱，請注意查收。',
    resendErrorTitle: '發送失敗',
    networkErrorRetry: '網絡異常，請稍後重試。',
    sensitiveWordError: '暱稱包含敏感詞彙 "{word}"，請更換其它暱稱。',
    sentEmailPrompt: '已向以下郵箱發送了驗證郵件：',
    verifyEmailInstruction: '請打開郵件並點擊其中的驗證鏈接激活帳戶。驗證成功後，即可登錄。',
    resendVerifyEmail: '重新發送驗證郵件',
    verifyEmailTitle: '驗證您的郵箱',
    verifyEmailDesc: '我們已向您的教育郵箱發送了一封驗證郵件。\n\n請點擊郵件中的鏈接完成驗證後，再回來登錄。',
    noticeTitle: '注意事項',
    noticeTip1: '• 驗證郵件可能需要幾分鐘才能到達',
    noticeTip2: '• 請檢查垃圾郵件文件夾',
    noticeTip3: '• 驗證鏈接有效期為 24 小時',
    verifiedGoToLogin: '已驗證，去登錄',
    verifySuccessTitle: '郵箱驗證成功',
    verifySuccessDesc: '您的帳戶已成功激活！\n現在可以使用註冊的帳號和密碼登錄應用。',
    welcomeTitleBoxue: '歡迎加入博學',
    welcomeBullet1: '• 開啟您的學術與校園生活助手',
    welcomeBullet2: '• 隨時查看最新動態、通知與微信文章',
    welcomeBullet3: '• 使用精心打磨的工具箱提升效率',
    goToLogin: '前往登錄',
    exitAppPrompt: '再按一次退出博學',
    details: '詳情',
    verifyingAccount: '正在驗證您的帳戶，請稍候...',
    verificationSuccessMsg: '驗證成功！',
    verificationFailed: '驗證失敗',
    activatingSession: '正在激活帳戶會話...',
    establishingSession: '正在建立安全會話...',
    linkInvalidOrIncomplete: '驗證鏈接已失效或不完整。如果您已經激活過帳戶，請嘗試直接登錄。',
    linkConsumedOrExpired: '驗證鏈接已失效或已被使用。如果您已激活過帳戶，請直接登錄；否則請嘗試重新發送驗證郵件。',
    verificationTimeout: '驗證請求響應超時，可能由於網絡連接較差。請確保網絡暢通後重試，或嘗試直接登錄。',
    authSuccess: '認證成功！',
    accountActivatedAutoLogin: '您的帳戶已成功激活並自動登錄！\n正在為您跳轉至首頁...',
    enterApp: '進入應用',
    somethingWentWrong: '出了點問題',
    fallbackActivationError: '無法完成帳戶激活，請確認驗證鏈接是否有效。',
    category_notice: '通知',
    category_news: '新聞',
    category_event_news: '活動',
    category_general: '綜合',
    category_events: '學聯活動',
    category_academic: '學術資訊',
    category_life: '生活輔助',
    category_column: '原創專欄',
    category_reprint: '轉載',
    appSubtitleHeader: '博學 · 連接在意生活',
    recentEvents: '近期活動',
    seeAll: '查看全部',
    announcementsTitle: '動態與通知',
    noAnnouncements: '暫無動態與通知，敬請期待',
    featured: '置頂',
    notificationType: '通知',
    articleType: '文章',
    selectCity: '選擇城市',
    searchCityPlaceholder: '搜索城市 (中文/拼音/英文)...',
    noCityFound: '沒有找到匹配的城市',
    refreshSuccess: '刷新成功',
    greetingMorning: '早上好',
    greetingAfternoon: '下午好',
    greetingEvening: '晚上好',
    weatherDataSource: '數據來自: Open-Meteo',
    weatherClear: '晴朗',
    weatherCloudy: '多雲',
    weatherOvercast: '陰天',
    weatherFoggy: '有霧',
    weatherDrizzle: '毛毛雨',
    weatherFreezingRain: '凍雨',
    weatherLightRain: '小雨',
    weatherHeavyRain: '大雨',
    weatherHeavyFreezingRain: '強凍雨',
    weatherSnow: '降雪',
    weatherSnowGrains: '雪粒',
    weatherShowers: '陣雨',
    weatherSnowShowers: '陣雪',
    weatherThunderstorm: '雷陣雨',
    weatherThunderstormHail: '雷雨冰雹',
    weatherApparentTemp: '體感 {temp}°C',
    weatherApparentTempFallback: '體感 --°C',
    searchAnnouncementsPlaceholder: '搜索動態與通知...',
    noRelatedContent: '暫無相關內容',
    viewDetailsArrow: '查看詳情 →',
    readFullArticleArrow: '閱讀全文 →',
    category_all: '全部',
    searchArticlesPlaceholder: '搜索文章...',
    collapseDetails: '收起詳情',
    expandReading: '展開閱讀',
    viewArticleDetail: '查看文章詳情',
    latest: '最新',
    latestUpdates: '動態與通知',
    noContent: '暫無內容',
    comm_filter_all: '📢 全體',
    comm_filter_faculty: '🏛️ 按院系',
    comm_filter_year: '📅 按年級',
    comm_filter_campus: '🏫 按校區',
    comm_time_just_now: '剛剛',
    comm_time_hours_ago: '{hours}小時前',
    comm_time_days_ago: '{days}天前',
    comm_title: '💬 社群廣場',
    comm_new_post: '+ 發帖',
    comm_empty_posts: '暫無帖子，來發第一帖吧！',
    comm_anon_avatar: '匿',
    comm_anon_user: '匿名用戶',
    comm_replies_count: '💬 {count} 條回覆',
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
  const [tabBarStyle, setTabBarStyleState] = useState<'traditional' | 'glassmorphism'>('traditional');
  const [predictiveBack, setPredictiveBackState] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [tick, setTick] = useState(0);
  const tabOpacities = React.useRef([
    new Animated.Value(1),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]).current;
  const [tabGestureActive, setTabGestureActive] = useState(false);

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
        const savedPredictiveBack = await safeStorage.getItem('predictive_back');

        if (savedMode) setThemeModeState(savedMode as ThemeMode);
        if (savedStart) setCustomStartState(savedStart);
        if (savedEnd) setCustomEndState(savedEnd);
        if (savedTabBarStyle) setTabBarStyleState(savedTabBarStyle as 'traditional' | 'glassmorphism');
        if (savedPredictiveBack !== null) setPredictiveBackState(savedPredictiveBack === 'true');

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

  const setPredictiveBack = async (enabled: boolean) => {
    setPredictiveBackState(enabled);
    await safeStorage.setItem('predictive_back', enabled ? 'true' : 'false');
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
      setTabBarStyle,
      tabOpacities,
      tabGestureActive,
      setTabGestureActive,
      predictiveBack,
      setPredictiveBack
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
