// 主题颜色 - 博洛尼亚大学深红色系
export const COLORS = {
  // 主色调：博洛尼亚深红
  primary: '#A31621',
  primaryDark: '#7A1018',
  primaryLight: '#C41E2A',
  primarySoft: '#F5E6E8',

  // 辅助色
  gold: '#C9A84C',
  goldLight: '#F0D080',

  // 背景
  background: '#0F0F0F',
  surface: '#1A1A1A',
  surfaceElevated: '#242424',
  card: '#1E1E1E',

  // 文字
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',
  textInverse: '#FFFFFF',

  // 功能色
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // 边框
  border: '#2A2A2A',
  borderLight: '#333333',

  // 渐变
  gradientPrimary: ['#A31621', '#7A1018'],
  gradientDark: ['#1A1A1A', '#0F0F0F'],
  gradientCard: ['#242424', '#1A1A1A'],
};

export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  primary: {
    shadowColor: '#A31621',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
};
