import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

type ToolItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route?: string;
  badge?: string;
  color: string;
};

export default function ToolsScreen() {
  const { colors, t } = useTheme();
  const [eurToCny, setEurToCny] = useState<number>(7.8256);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/EUR');
        const data = await response.json();
        if (data && data.result === 'success' && data.rates && data.rates.CNY) {
          setEurToCny(data.rates.CNY);
        }
      } catch (error) {
        console.log('Error fetching EUR to CNY rate for Tools tab:', error);
      }
    };
    fetchRate();
  }, []);

  const tools: ToolItem[] = [
    {
      id: 'handbook',
      title: '新生手册',
      description: '博洛尼亚大学中国学联新生手册，让你在博洛尼亚生活得更舒适，更开心。',
      icon: 'book-open-variant',
      route: '/tools/handbook',
      badge: '推荐',
      color: '#A31621',
    },
    {
      id: 'dictionary',
      title: '词典',
      description: '意汉、汉意、动词变位、动词搭配以及同义词等查询。',
      icon: 'translate',
      route: '/tools/dictionary',
      color: '#3B82F6',
    },
    {
      id: 'rate',
      title: '汇率换算',
      description: `今日实时汇率：1 EUR = ${eurToCny.toFixed(4)} CNY`,
      icon: 'currency-eur',
      route: '/tools/rate',
      color: '#10B981',
    },
    {
      id: 'classroom',
      title: '空教室查询',
      description: '实时查询博洛尼亚大学空闲教室，考前自习或讨论的好去处。',
      icon: 'school-outline',
      route: '/tools/classroom',
      color: '#8B5CF6',
    },
    {
      id: 'train',
      title: t('trainToolTitle') || '意铁看板与车次',
      description: t('trainToolDesc') || '实时查询意大利火车出发到达大盘，追踪列车晚点及站台状态。',
      icon: 'train',
      route: '/tools/train',
      color: '#E30613',
    },
    {
      id: 'faq',
      title: '常见问答',
      description: '居留、签证、租房等常见疑难一网打尽',
      icon: 'help-circle-outline',
      color: '#F59E0B',
    }
  ];

  const handleToolPress = (tool: ToolItem) => {
    if (tool.route) {
      router.push(tool.route as any);
    } else {
      Alert.alert('提示', '该工具正在全力研发中，敬请期待！');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tools')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>实用学术与生活辅助小工具箱</Text>
        </View>

        <View style={styles.grid}>
          {tools.map((tool) => (
            <Pressable
              key={tool.id}
              style={({ pressed }) => [
                styles.card,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }]
                }
              ]}
              onPress={() => handleToolPress(tool)}
            >
              {tool.badge && (
                <View style={[styles.badge, { backgroundColor: tool.color }]}>
                  <Text style={styles.badgeText}>{tool.badge}</Text>
                </View>
              )}
              
              <View style={[styles.iconContainer, { backgroundColor: tool.color + '15' }]}>
                <MaterialCommunityIcons name={tool.icon as any} size={24} color={tool.color} />
              </View>

              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{tool.title}</Text>
              {tool.id === 'rate' ? (
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  今日实时汇率：{"\n"}1 EUR = <Text style={{ color: colors.success, fontWeight: 'bold' }}>{eurToCny.toFixed(4)}</Text> CNY
                </Text>
              ) : (
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{tool.description}</Text>
              )}
              
              {!tool.route && (
                <View style={[styles.comingSoonBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>建设中</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Simple wrapper to resolve Alert inside React Native on click
import { Alert } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: cardWidth,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    minHeight: 165,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  comingSoonBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
});
