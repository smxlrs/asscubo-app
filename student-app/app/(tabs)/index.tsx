import React, { useEffect, useState, useRef } from 'react';
import { BlurView } from 'expo-blur';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Image, ActivityIndicator, Animated, Easing, Modal, TextInput, Platform,
  Dimensions, Pressable
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';

type Article = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  cover_image: string | null;
  created_at: string;
  view_count: number;
  link?: string | null;
  type?: 'article' | 'notification';
  is_pinned?: boolean;
};

type Notification = {
  id: string;
  title: string;
  content: string;
  category: string;
  cover_image: string | null;
  created_at: string;
  link?: string | null;
  is_pinned?: boolean;
};

type Event = {
  id: string;
  title: string;
  location: string | null;
  start_time: string;
  cover_image: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  notice: '通知',
  news: '新闻',
  event_news: '活动',
  general: '综合',
  events: '学联活动',
  academic: '学术资讯',
  life: '生活辅助',
  column: '原创专栏',
  reprint: '转载',
};

const CATEGORY_COLORS: Record<string, string> = {
  notice: '#FF6B6B',
  news: '#4ECDC4',
  event_news: '#C9A84C',
  general: '#8B5CF6',
  events: '#EF4444',
  academic: '#3B82F6',
  life: '#10B981',
  column: '#F59E0B',
  reprint: '#6B7280',
};

function getWeatherInfo(code: number, isDay: number) {
  switch (code) {
    case 0:
      return {
        label: '晴朗',
        icon: isDay ? 'sunny-outline' : 'moon-outline',
        color: isDay ? '#FFA726' : '#9575CD'
      };
    case 1:
    case 2:
      return {
        label: '多云',
        icon: isDay ? 'partly-sunny-outline' : 'cloudy-night-outline',
        color: isDay ? '#FFB74D' : '#90A4AE'
      };
    case 3:
      return {
        label: '阴天',
        icon: 'cloudy-outline',
        color: '#90A4AE'
      };
    case 45:
    case 48:
      return {
        label: '有雾',
        icon: 'cloud-outline',
        color: '#B0BEC5'
      };
    case 51:
    case 53:
    case 55:
      return {
        label: '毛毛雨',
        icon: 'rainy-outline',
        color: '#4FC3F7'
      };
    case 56:
    case 57:
      return {
        label: '冻雨',
        icon: 'snow-outline',
        color: '#81D4FA'
      };
    case 61:
    case 63:
      return {
        label: '小雨',
        icon: 'rainy-outline',
        color: '#64B5F6'
      };
    case 65:
      return {
        label: '大雨',
        icon: 'rainy-outline',
        color: '#2196F3'
      };
    case 66:
    case 67:
      return {
        label: '强冻雨',
        icon: 'snow-outline',
        color: '#81D4FA'
      };
    case 71:
    case 73:
    case 75:
      return {
        label: '降雪',
        icon: 'snow-outline',
        color: '#E0E0E0'
      };
    case 77:
      return {
        label: '雪粒',
        icon: 'snow-outline',
        color: '#E0E0E0'
      };
    case 80:
    case 81:
    case 82:
      return {
        label: '阵雨',
        icon: 'rainy-outline',
        color: '#64B5F6'
      };
    case 85:
    case 86:
      return {
        label: '阵雪',
        icon: 'snow-outline',
        color: '#E0E0E0'
      };
    case 95:
      return {
        label: '雷阵雨',
        icon: 'thunderstorm-outline',
        color: '#FFD54F'
      };
    case 96:
    case 99:
      return {
        label: '雷雨冰雹',
        icon: 'thunderstorm-outline',
        color: '#FFD54F'
      };
    default:
      return {
        label: '多云',
        icon: 'cloudy-outline',
        color: '#90A4AE'
      };
  }
}

const CITIES = [
  // 博洛尼亚大学各校区 (University of Bologna Campuses) - 放在最前
  { name: '博洛尼亚', englishName: 'Bologna (主校区)', lat: 44.4949, lon: 11.3426, country: '意大利' },
  { name: '切塞纳', englishName: 'Cesena (博大校区)', lat: 44.1394, lon: 12.2431, country: '意大利' },
  { name: '弗利', englishName: 'Forlì (博大校区)', lat: 44.2227, lon: 12.0409, country: '意大利' },
  { name: '拉文纳', englishName: 'Ravenna (博大校区)', lat: 44.4184, lon: 12.2035, country: '意大利' },
  { name: '里米尼', englishName: 'Rimini (博大校区)', lat: 44.0575, lon: 12.5653, country: '意大利' },

  // 其他意大利主要城市 (Other Italian Cities)
  { name: '米兰', englishName: 'Milano / Milan', lat: 45.4642, lon: 9.1900, country: '意大利' },
  { name: '罗马', englishName: 'Roma / Rome', lat: 41.9028, lon: 12.4964, country: '意大利' },
  { name: '佛罗伦萨', englishName: 'Firenze / Florence', lat: 43.7696, lon: 11.2558, country: '意大利' },
  { name: '都灵', englishName: 'Torino / Turin', lat: 45.0703, lon: 7.6869, country: '意大利' },
  { name: '威尼斯', englishName: 'Venezia / Venice', lat: 45.4408, lon: 12.3155, country: '意大利' },
  { name: '帕多瓦', englishName: 'Padova / Padua', lat: 45.4064, lon: 11.8768, country: '意大利' },
  { name: '热那亚', englishName: 'Genova / Genoa', lat: 44.4056, lon: 8.9463, country: '意大利' },
  { name: '比萨', englishName: 'Pisa', lat: 43.7085, lon: 10.4036, country: '意大利' },
  { name: '那不勒斯', englishName: 'Napoli / Naples', lat: 40.8518, lon: 14.2681, country: '意大利' },
  { name: '佩鲁贾', englishName: 'Perugia', lat: 43.1107, lon: 12.3908, country: '意大利' },
  { name: '帕维亚', englishName: 'Pavia', lat: 45.1850, lon: 9.1559, country: '意大利' },
  { name: '锡耶纳', englishName: 'Siena', lat: 43.3188, lon: 11.3308, country: '意大利' },
  { name: '的里雅斯特', englishName: 'Trieste', lat: 45.6495, lon: 13.7768, country: '意大利' },
  { name: '特伦托', englishName: 'Trento', lat: 46.0679, lon: 11.1211, country: '意大利' },
  { name: '乌迪内', englishName: 'Udine', lat: 46.0710, lon: 13.2345, country: '意大利' },
  { name: '莱切', englishName: 'Lecce', lat: 40.3515, lon: 18.1750, country: '意大利' },
  { name: '巴里', englishName: 'Bari', lat: 41.1171, lon: 16.8719, country: '意大利' },
  { name: '巴勒莫', englishName: 'Palermo', lat: 38.1157, lon: 13.3614, country: '意大利' },
  { name: '维罗纳', englishName: 'Verona', lat: 45.4384, lon: 10.9916, country: '意大利' },
  { name: '摩德纳', englishName: 'Modena', lat: 44.6471, lon: 10.9252, country: '意大利' },
  { name: '帕尔马', englishName: 'Parma', lat: 44.8015, lon: 10.3279, country: '意大利' },
  { name: '布雷西亚', englishName: 'Brescia', lat: 45.5416, lon: 10.2118, country: '意大利' },

  // 中国主要城市 (Chinese Cities)
  { name: '北京', englishName: 'Beijing', lat: 39.9075, lon: 116.3972, country: '中国' },
  { name: '上海', englishName: 'Shanghai', lat: 31.2304, lon: 121.4737, country: '中国' },
  { name: '广州', englishName: 'Guangzhou', lat: 23.1291, lon: 113.2644, country: '中国' },
  { name: '深圳', englishName: 'Shenzhen', lat: 22.5431, lon: 114.0579, country: '中国' },
  { name: '成都', englishName: 'Chengdu', lat: 30.5728, lon: 104.0668, country: '中国' },
  { name: '杭州', englishName: 'Hangzhou', lat: 30.2741, lon: 120.1551, country: '中国' },
  { name: '武汉', englishName: 'Wuhan', lat: 30.5928, lon: 114.3055, country: '中国' },
  { name: '西安', englishName: 'Xi\'an', lat: 34.3416, lon: 108.9398, country: '中国' },
  { name: '南京', englishName: 'Nanjing', lat: 32.0603, lon: 118.7969, country: '中国' },
  { name: '重庆', englishName: 'Chongqing', lat: 29.5630, lon: 106.5516, country: '中国' },
  { name: '天津', englishName: 'Tianjin', lat: 39.0842, lon: 117.2010, country: '中国' },
  { name: '苏州', englishName: 'Suzhou', lat: 31.2990, lon: 120.5853, country: '中国' },
  { name: '长沙', englishName: 'Changsha', lat: 28.2282, lon: 112.9823, country: '中国' },
  { name: '青岛', englishName: 'Qingdao', lat: 36.0671, lon: 120.3826, country: '中国' },
  { name: '大连', englishName: 'Dalian', lat: 38.9140, lon: 121.6147, country: '中国' },
  { name: '厦门', englishName: 'Xiamen', lat: 24.4798, lon: 118.0894, country: '中国' },
  { name: '福州', englishName: 'Fuzhou', lat: 26.0745, lon: 119.2965, country: '中国' },
  { name: '沈阳', englishName: 'Shenyang', lat: 41.8057, lon: 123.4315, country: '中国' },
  { name: '哈尔滨', englishName: 'Harbin', lat: 45.8038, lon: 126.5350, country: '中国' },
  { name: '合肥', englishName: 'Hefei', lat: 31.8206, lon: 117.2272, country: '中国' },
  { name: '昆明', englishName: 'Kunming', lat: 25.0406, lon: 102.7122, country: '中国' },
  { name: '济南', englishName: 'Jinan', lat: 36.6512, lon: 117.1201, country: '中国' },
  { name: '郑州', englishName: 'Zhengzhou', lat: 34.7578, lon: 113.6654, country: '中国' },
  { name: '无锡', englishName: 'Wuxi', lat: 31.4912, lon: 120.3119, country: '中国' },
  { name: '南宁', englishName: 'Nanning', lat: 22.8170, lon: 108.3665, country: '中国' },
  { name: '乌鲁木齐', englishName: 'Urumqi', lat: 43.8256, lon: 87.6168, country: '中国' },
  { name: '兰州', englishName: 'Lanzhou', lat: 36.0611, lon: 103.8343, country: '中国' },
];

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { colors, isDark, tabBarStyle } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Theme-adapted banner styles
  const bannerColors: readonly [string, string, ...string[]] = isDark 
    ? ['#A31621', '#7A1018', '#1A0508'] 
    : ['#F5E6E8', '#E8C5C8', '#D89E9F']; // Soft pastel pink/rose gradient
  
  const bannerTextColor = isDark ? '#FFFFFF' : '#7A1018';
  const bannerSubtitleColor = isDark ? 'rgba(255,255,255,0.7)' : '#5A6376';
  
  const statsRowBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)';
  const statsDividerColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(122,16,24,0.15)';
  const statsNumberColor = isDark ? '#FFFFFF' : '#7A1018';
  const statsLabelColor = isDark ? 'rgba(255,255,255,0.7)' : '#5A6376';
  
  const avatarBg = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(122,16,24,0.08)';
  const avatarBorderColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(122,16,24,0.2)';
  const avatarIconColor = isDark ? '#FFFFFF' : '#A31621';

  const [articles, setArticles] = useState<Article[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Toast State for Refresh feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<any>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    toastFade.setValue(0);
    
    const isSuccess = msg === '刷新成功';
    const fadeInDuration = isSuccess ? 150 : 250;
    const keepDuration = isSuccess ? 1000 : 2000;
    const fadeOutDuration = 250;

    Animated.timing(toastFade, {
      toValue: 1,
      duration: fadeInDuration,
      useNativeDriver: true,
    }).start();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: fadeOutDuration,
        useNativeDriver: true,
      }).start(() => {
        setToastMsg(null);
      });
    }, keepDuration);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const [weather, setWeather] = useState<{
    temp: number;
    apparentTemp: number;
    humidity: number;
    windSpeed: number;
    code: number;
    isDay: number;
    label: string;
    icon: string;
    color: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [spinValue] = useState(new Animated.Value(0));

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  async function fetchWeather(isRefresh = false, cityToFetch = selectedCity) {
    const startTime = Date.now();
    if (isRefresh) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      setWeatherLoading(true);
    }

    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${cityToFetch.lat}&longitude=${cityToFetch.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=Europe%2FRome`
      );
      const data = await response.json();
      if (data && data.current) {
        const current = data.current;
        const info = getWeatherInfo(current.weather_code, current.is_day);
        setWeather({
          temp: current.temperature_2m,
          apparentTemp: current.apparent_temperature,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
          code: current.weather_code,
          isDay: current.is_day,
          label: info.label,
          icon: info.icon,
          color: info.color
        });
      }
    } catch (e) {
      console.warn('Failed to fetch weather:', e);
      // Fallback data
      setWeather({
        temp: 22,
        apparentTemp: 21.5,
        humidity: 60,
        windSpeed: 8.5,
        code: 0,
        isDay: 1,
        label: '晴朗',
        icon: 'sunny-outline',
        color: '#FFB300'
      });
    } finally {
      if (isRefresh) {
        const elapsedTime = Date.now() - startTime;
        const minDuration = 1000; // Let the icon spin at least one full turn
        if (elapsedTime < minDuration) {
          await new Promise(resolve => setTimeout(resolve, minDuration - elapsedTime));
        }
      }
      setWeatherLoading(false);
      if (isRefresh) {
        spinValue.stopAnimation((currentValue) => {
          const remaining = 1 - currentValue;
          Animated.timing(spinValue, {
            toValue: 1,
            duration: remaining * 500,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }).start(() => {
            spinValue.setValue(0);
          });
        });

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    }
  }

  async function fetchData(isRefresh = false) {
    const [notificationsRes, articlesRes, eventsRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id, title, content, category, cover_image, created_at, link, is_pinned')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('articles')
        .select('id, title, summary, category, cover_image, created_at, link, is_pinned, view_count')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('events')
        .select('id, title, location, start_time, cover_image')
        .eq('is_published', true)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(3),
    ]);

    const combined: Article[] = [];

    if (notificationsRes.data) {
      notificationsRes.data.forEach((item: any) => {
        combined.push({
          id: item.id,
          title: item.title,
          summary: item.content || null,
          category: item.category || 'general',
          cover_image: item.cover_image || null,
          created_at: item.created_at,
          view_count: 0,
          link: item.link || null,
          type: 'notification',
          is_pinned: item.is_pinned
        });
      });
    }

    if (articlesRes.data) {
      articlesRes.data.forEach((item: any) => {
        combined.push({
          id: item.id,
          title: item.title,
          summary: item.summary || null,
          category: item.category || 'general',
          cover_image: item.cover_image || null,
          created_at: item.created_at,
          view_count: item.view_count || 0,
          link: item.link || null,
          type: 'article',
          is_pinned: item.is_pinned
        });
      });
    }

    // Sort by is_pinned DESC, then created_at DESC
    combined.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setArticles(combined);
    setNotifications([]); // Clear independent notifications state

    if (eventsRes.data) setUpcomingEvents(eventsRes.data);
    setLoading(false);
    setRefreshing(false);
    if (isRefresh) {
      setTimeout(() => {
        triggerToast('刷新成功');
      }, 150);
    }
  }

  async function changeCity(city: typeof CITIES[0]) {
    setSelectedCity(city);
    try {
      await AsyncStorage.setItem('user_weather_city', JSON.stringify(city));
    } catch (e) {
      console.warn('Failed to save weather city:', e);
    }
    fetchWeather(true, city);
  }

  useEffect(() => {
    async function initWeather() {
      try {
        const savedCityJson = await AsyncStorage.getItem('user_weather_city');
        if (savedCityJson) {
          const savedCity = JSON.parse(savedCityJson);
          setSelectedCity(savedCity);
          fetchWeather(false, savedCity);
        } else {
          fetchWeather(false, CITIES[0]);
        }
      } catch (e) {
        console.warn('Failed to load saved weather city:', e);
        fetchWeather(false, CITIES[0]);
      }
    }
    fetchData();
    initWeather();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    fetchData(true);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? '早上好' : greetingHour < 18 ? '下午好' : '晚上好';

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={isDark ? ['#141414', '#0A0A0A'] : ['#FFFFFF', '#EFF2F6']}
      style={styles.container}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarStyle === 'glassmorphism' ? 110 : 24 }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={colors.primary} 
            progressViewOffset={Platform.OS === 'android' ? insets.top + 80 : undefined}
          />
        }
      >
        {/* Header Banner */}
        <LinearGradient
          colors={bannerColors}
          style={[styles.headerBanner, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greeting, { color: bannerTextColor }]}>
                {user ? `${greeting}！${profile?.name || ''}` : greeting}
              </Text>
              <Text style={[styles.headerSubtitle, { color: bannerSubtitleColor }]}>博学 · 连接在意生活</Text>
            </View>
            
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={() => {
                  if (user) {
                    router.push('/(tabs)/profile');
                  } else {
                    router.push('/(auth)/login');
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.avatar, { backgroundColor: avatarBg, borderColor: avatarBorderColor }]}>
                  {user && profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <MaterialCommunityIcons 
                      name={user ? "account" : "account-outline"} 
                      size={24} 
                      color={avatarIconColor} 
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Immersive Weather Card */}
          <View style={[styles.weatherCard, { backgroundColor: statsRowBg, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(122,16,24,0.08)' }]}>
            <View style={styles.weatherHeader}>
              <TouchableOpacity 
                style={styles.weatherLocation} 
                onPress={() => setCityModalVisible(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="map-marker-outline" size={14} color={isDark ? 'rgba(255,255,255,0.6)' : '#7A1018'} style={{ marginRight: 2 }} />
                <Text style={[styles.weatherLocationText, { color: isDark ? 'rgba(255,255,255,0.8)' : '#7A1018' }]}>
                  {selectedCity.name}
                </Text>
                <Text style={[styles.weatherSourceText, { color: isDark ? 'rgba(255,255,255,0.4)' : '#98A2B3', marginLeft: 4 }]}>
                  数据来自: Open-Meteo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.weatherRefreshBtn} 
                onPress={() => fetchWeather(true)}
                disabled={weatherLoading}
              >
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <MaterialCommunityIcons 
                    name="refresh" 
                    size={16} 
                    color={isDark ? 'rgba(255,255,255,0.6)' : '#7A1018'} 
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>

            {weatherLoading && !weather ? (
              <View style={styles.weatherCenter}>
                <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#A31621'} />
              </View>
            ) : (
              <Animated.View style={{ opacity: fadeAnim, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <View style={styles.weatherCol}>
                  <View style={styles.weatherRowTop}>
                    <Ionicons 
                      name={weather?.icon as any || 'sunny-outline'} 
                      size={28} 
                      color={weather?.color || '#FFB300'} 
                    />
                  </View>
                  <View style={styles.weatherRowBottom}>
                    <Text style={[styles.weatherLabelText, { color: isDark ? '#FFFFFF' : '#7A1018' }]}>
                      {weather?.label || '晴朗'}
                    </Text>
                  </View>
                </View>

                <View style={styles.weatherDivider} />

                <View style={styles.weatherCol}>
                  <View style={styles.weatherRowTop}>
                    <Text style={[styles.weatherTempText, { color: isDark ? '#FFFFFF' : '#7A1018' }]}>
                      {weather ? `${Math.round(weather.temp)}°C` : '--°C'}
                    </Text>
                  </View>
                  <View style={styles.weatherRowBottom}>
                    <Text style={[styles.weatherApparentText, { color: isDark ? 'rgba(255,255,255,0.6)' : '#5A6376' }]}>
                      {weather ? `体感 ${Math.round(weather.apparentTemp)}°C` : '体感 --°C'}
                    </Text>
                  </View>
                </View>

                <View style={styles.weatherDivider} />

                <View style={styles.weatherCol}>
                  <View style={styles.weatherRowTop}>
                    <View style={styles.weatherDetailRow}>
                      <MaterialCommunityIcons name="water-outline" size={14} color={isDark ? 'rgba(255,255,255,0.6)' : '#5A6376'} style={{ marginRight: 2 }} />
                      <Text style={[styles.weatherDetailText, { color: isDark ? 'rgba(255,255,255,0.8)' : '#7A1018', fontWeight: '600' }]}>
                        {weather ? `${weather.humidity}%` : '--%'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.weatherRowBottom}>
                    <View style={styles.weatherDetailRow}>
                      <MaterialCommunityIcons name="weather-windy" size={12} color={isDark ? 'rgba(255,255,255,0.6)' : '#5A6376'} style={{ marginRight: 2 }} />
                      <Text style={[styles.weatherDetailText, { color: isDark ? 'rgba(255,255,255,0.6)' : '#5A6376', fontSize: 11 }]}>
                        {weather ? `${Math.round(weather.windSpeed)} km/h` : '-- km/h'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        </LinearGradient>

        {/* Add padding spacer below header banner */}
        <View style={{ height: 20 }} />

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>近期活动</Text>
              </View>
              <TouchableOpacity 
                onPress={() => router.push('/(tabs)/events')}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={[styles.seeAll, { color: colors.primary, marginRight: 2 }]}>查看全部</Text>
                <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {upcomingEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: colors.surface, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(163,22,33,0.06)' }]}
                  onPress={() => router.push(`/event/${event.id}` as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[colors.surface, colors.surfaceElevated]}
                    style={styles.eventCardGradient}
                  >
                    <View style={[styles.eventDateBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.eventDateText}>{formatDate(event.start_time)}</Text>
                    </View>
                    <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={2}>{event.title}</Text>
                    {event.location && (
                      <Text style={[styles.eventLocation, { color: colors.textSecondary }]} numberOfLines={1}>📍 {event.location}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Combined Latest Feed: News & Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bullhorn-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>动态与通知</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/(tabs)/announcements')}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={[styles.seeAll, { color: colors.primary, marginRight: 2 }]}>查看全部</Text>
              <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {articles.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>暂无动态与通知，敬请期待</Text>
            </View>
          ) : (
            articles.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.articleCard, { backgroundColor: colors.surface, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(163,22,33,0.06)' }]}
                onPress={() => {
                  if (item.type === 'notification') {
                    if (item.link) {
                      router.push(`/article/web?url=${encodeURIComponent(item.link)}&title=${encodeURIComponent(item.title)}` as any);
                    } else {
                      router.push(`/article/${item.id}` as any);
                    }
                  } else {
                    router.push(`/article/${item.id}` as any);
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.articleLeft}>
                  <View style={styles.articleHeaderRow}>
                    {/* Pinned Badge */}
                    {item.is_pinned && (
                      <View style={[
                        styles.featuredBadge, 
                        { 
                          backgroundColor: '#F59E0B20', 
                          marginLeft: 0,
                          marginRight: 6,
                          flexDirection: 'row',
                          alignItems: 'center'
                        }
                      ]}>
                        <MaterialCommunityIcons name="pin" size={10} color="#F59E0B" style={{ marginRight: 2 }} />
                        <Text style={[styles.featuredText, { color: '#F59E0B' }]}>置顶</Text>
                      </View>
                    )}

                    {/* Type Badge */}
                    <View style={[
                      styles.categoryBadge, 
                      { 
                        backgroundColor: item.type === 'notification' ? '#3B82F6' : '#10B981',
                        marginRight: 6
                      }
                    ]}>
                      <Text style={[
                        styles.categoryText, 
                        { color: '#FFFFFF', fontWeight: 'bold' }
                      ]}>
                        {item.type === 'notification' ? '通知' : '文章'}
                      </Text>
                    </View>

                    {/* Category Badge */}
                    {item.category !== 'general' && (
                      <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[item.category] + '20' }]}>
                        <Text style={[styles.categoryText, { color: CATEGORY_COLORS[item.category] }]}>
                          {CATEGORY_LABELS[item.category] || '综合'}
                        </Text>
                      </View>
                    )}

                    {/* Latest Badge */}
                    {index === 0 && (
                      <View style={[styles.featuredBadge, { backgroundColor: COLORS.gold + '20', marginLeft: 6 }]}>
                        <Text style={[styles.featuredText, { color: COLORS.gold }]}>最新</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.articleTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
                  {item.summary ? (
                    <Text style={[styles.articleSummary, { color: colors.textSecondary }]} numberOfLines={2}>{item.summary}</Text>
                  ) : null}
                  <View style={styles.articleMeta}>
                    <Text style={[styles.articleDate, { color: colors.textMuted }]}>{formatDate(item.created_at)}</Text>
                    {item.type === 'article' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="eye-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                        <Text style={[styles.articleViews, { color: colors.textMuted }]}>{item.view_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {item.cover_image ? (
                  <Image
                    source={{
                      uri: item.cover_image,
                      headers: {
                        Referer: 'https://mp.weixin.qq.com',
                      },
                    }}
                    style={[styles.articleImage, { backgroundColor: colors.border }]}
                    resizeMode="cover"
                  />
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal
        visible={cityModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setCityModalVisible(false);
          setSearchQuery('');
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            setCityModalVisible(false);
            setSearchQuery('');
          }}
        >
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', borderColor: isDark ? '#333333' : '#E4E7EC' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#101828' }]}>选择城市</Text>
            
            <TextInput
              style={[
                styles.searchInput,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7', 
                  color: isDark ? '#FFFFFF' : '#101828', 
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#D0D5DD' 
                }
              ]}
              placeholder="搜索城市 (中文/拼音/英文)..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#98A2B3'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />

            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {CITIES.filter(city => 
                city.name.includes(searchQuery) || 
                city.englishName.toLowerCase().includes(searchQuery.toLowerCase())
              ).map((city) => (
                <TouchableOpacity
                  key={city.name}
                  style={[
                    styles.cityItem,
                    selectedCity.name === city.name && { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(163,22,33,0.06)' }
                  ]}
                  onPress={() => {
                    changeCity(city);
                    setCityModalVisible(false);
                    setSearchQuery('');
                  }}
                >
                  <View>
                    <Text style={[
                      styles.cityItemText,
                      { color: isDark ? '#FFFFFF' : '#344054' },
                      selectedCity.name === city.name && { color: colors.primary, fontWeight: '600' }
                    ]}>
                      {city.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#667085', marginTop: 2 }}>
                      {city.englishName} ({city.country})
                    </Text>
                  </View>
                  {selectedCity.name === city.name && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              {CITIES.filter(city => 
                city.name.includes(searchQuery) || 
                city.englishName.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <Text style={{ textAlign: 'center', color: '#98A2B3', paddingVertical: 20, fontSize: 13 }}>
                  没有找到匹配的城市
                </Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      {toastMsg && (
        <Animated.View style={[
          toastMsg === '刷新成功' ? [styles.checkmarkBubble, { top: Platform.OS === 'ios' ? insets.top + 15 : insets.top + 84 }] : styles.toastContainer, 
          { 
            opacity: toastFade,
            backgroundColor: toastMsg === '刷新成功' ? '#FFFFFF' : colors.surface,
            borderColor: toastMsg === '刷新成功' ? 'transparent' : colors.primary,
            borderWidth: toastMsg === '刷新成功' ? 0 : 1,
          }
        ]}>
          {toastMsg === '刷新成功' ? (
            <MaterialCommunityIcons name="check" size={24} color={colors.primary} />
          ) : (
            <Text style={[styles.toastText, { color: colors.primary }]}>{toastMsg}</Text>
          )}
        </Animated.View>
      )}

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  headerBanner: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButton: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  weatherCard: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  weatherRefreshBtn: {
    padding: 2,
  },
  weatherLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherLocationText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.medium,
  },
  weatherSourceText: {
    fontSize: 10,
    fontFamily: FONTS.regular,
  },
  weatherCenter: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherRowTop: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherRowBottom: {
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  weatherLabelText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.semiBold,
  },
  weatherTempText: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
    lineHeight: 28,
  },
  weatherApparentText: {
    fontSize: SIZES.xs - 1,
    fontFamily: FONTS.regular,
  },
  weatherDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(120,120,120,0.15)',
    alignSelf: 'center',
  },
  weatherDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherDetailText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  quickActionItem: { flex: 1, alignItems: 'center' },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  quickActionLabel: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.base,
  },
  sectionTitle: {
    fontSize: SIZES.base,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  horizontalScroll: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  eventCard: {
    width: 200,
    marginRight: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#0A101D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  eventCardGradient: { padding: SPACING.base },
  eventDateBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: SPACING.sm,
  },
  eventDateText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
  },
  eventTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  eventLocation: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
  },
  articleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.base,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#0A101D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  articleLeft: { flex: 1 },
  articleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  categoryText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.semiBold,
  },
  articleTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: SPACING.xs,
  },
  articleSummary: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.xs,
  },
  articleMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 2,
  },
  articleDate: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  articleViews: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  featuredBadge: {
    backgroundColor: COLORS.gold + '20',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    marginLeft: SPACING.sm,
  },
  featuredText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
    color: COLORS.gold,
  },
  articleImage: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    marginLeft: SPACING.md,
    backgroundColor: COLORS.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyEmoji: { fontSize: 48, marginBottom: SPACING.base },
  emptyText: {
    fontSize: SIZES.base,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalTitle: {
    fontSize: SIZES.md + 2,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    fontSize: SIZES.sm,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    marginVertical: 2,
  },
  cityItemText: {
    fontSize: SIZES.md,
    fontFamily: FONTS.medium,
  },
  toastContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 99999,
    borderWidth: 1,
  },
  toastText: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  checkmarkBubble: {
    position: 'absolute',
    left: '50%',
    marginLeft: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 99999,
  },
});
