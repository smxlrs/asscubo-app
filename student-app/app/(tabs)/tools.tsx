import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  runOnJS,
  Easing,
  SharedValue
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;
const COLUMNS = 2;
const GAP = 16;
const colWidth = cardWidth + GAP;
const rowHeight = 185;

const TOOLS_ORDER_KEY = '@ag_tools_order';

type ToolItem = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route?: string;
  badge?: string;
  color: string;
};

const getPosition = (index: number) => {
  'worklet';
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return {
    x: col * colWidth,
    y: row * rowHeight,
  };
};

const getToolDefinition = (id: string, eurToCny: number, t: (key: string) => string): ToolItem | null => {
  switch (id) {
    case 'handbook':
      return {
        id: 'handbook',
        title: '新生手册',
        description: '博洛尼亚大学中国学联新生手册，让你在博洛尼亚生活得更舒适，更开心。',
        icon: 'book-open-variant',
        route: '/tools/handbook',
        badge: '推荐',
        color: '#A31621',
      };
    case 'dictionary':
      return {
        id: 'dictionary',
        title: '词典',
        description: '意汉、汉意、动词变位、动词搭配以及同义词等查询。',
        icon: 'translate',
        route: '/tools/dictionary',
        color: '#3B82F6',
      };
    case 'rate':
      return {
        id: 'rate',
        title: '汇率换算',
        description: `今日实时汇率：1 EUR = ${eurToCny.toFixed(4)} CNY`,
        icon: 'currency-eur',
        route: '/tools/rate',
        color: '#10B981',
      };
    case 'classroom':
      return {
        id: 'classroom',
        title: '空教室查询',
        description: '实时查询博洛尼亚大学空闲教室，考前自习或讨论的好去处。',
        icon: 'school-outline',
        route: '/tools/classroom',
        color: '#8B5CF6',
      };
    case 'train':
      return {
        id: 'train',
        title: t('trainToolTitle') || '意铁看板与车次',
        description: t('trainToolDesc') || '实时查询意大利火车出发到达大盘，追踪列车晚点及站台状态。',
        icon: 'train',
        route: '/tools/train',
        color: '#E30613',
      };
    case 'studyroom':
      return {
        id: 'studyroom',
        title: '自习室与图书馆',
        description: '实时查看博大自习室与图书馆空余座位、开放时间，并支持一键预约。',
        icon: 'library-outline',
        route: '/tools/studyroom',
        color: '#4F46E5',
      };
    default:
      return null;
  }
};

interface DraggableCardProps {
  id: string;
  tool: ToolItem;
  eurToCny: number;
  t: (key: string) => string;
  colors: any;
  isEditing: boolean;
  orderShared: SharedValue<string[]>;
  activeIdShared: SharedValue<string | null>;
  onDragStart: () => void;
  onDragEnd: (newOrder: string[]) => void;
  onStartEditing: () => void;
}

function DraggableCard({
  id,
  tool,
  eurToCny,
  t,
  colors,
  isEditing,
  orderShared,
  activeIdShared,
  onDragStart,
  onDragEnd,
  onStartEditing,
}: DraggableCardProps) {
  const cardIndex = useDerivedValue(() => {
    return orderShared.value.indexOf(id);
  });

  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const wiggleVal = useSharedValue(0);

  useEffect(() => {
    if (isEditing) {
      wiggleVal.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 110, easing: Easing.linear }),
          withTiming(-1, { duration: 110, easing: Easing.linear })
        ),
        -1,
        true
      );
    } else {
      wiggleVal.value = 0;
    }
  }, [isEditing]);

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = wiggleVal.value !== 0 ? `${wiggleVal.value * 1.2}deg` : '0deg';
    const isDragging = activeIdShared.value === id;

    const scale = withSpring(isDragging ? 1.06 : 1.0, { damping: 15, stiffness: 150 });
    const zIndex = isDragging ? 999 : 1;

    const pos = getPosition(cardIndex.value);
    const tx = isDragging ? dragX.value : withSpring(pos.x, { damping: 15, stiffness: 120 });
    const ty = isDragging ? dragY.value : withSpring(pos.y, { damping: 15, stiffness: 120 });

    return {
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale },
        { rotate: isDragging ? '0deg' : rotate }
      ],
      zIndex,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: withSpring(isDragging ? 10 : 2, { damping: 15, stiffness: 150 })
      },
      shadowOpacity: withSpring(isDragging ? 0.3 : 0.05, { damping: 15, stiffness: 150 }),
      shadowRadius: withSpring(isDragging ? 12 : 8, { damping: 15, stiffness: 150 }),
      elevation: withSpring(isDragging ? 8 : 2, { damping: 15, stiffness: 150 }),
    };
  });

  const gesture = Gesture.Pan()
    .activateAfterLongPress(isEditing ? 100 : 600)
    .onStart(() => {
      if (!isEditing) {
        runOnJS(onStartEditing)();
      }
      runOnJS(onDragStart)();
      activeIdShared.value = id;
      const pos = getPosition(cardIndex.value);
      startX.value = pos.x;
      startY.value = pos.y;
      dragX.value = pos.x;
      dragY.value = pos.y;
    })
    .onUpdate((event) => {
      const curX = startX.value + event.translationX;
      const curY = startY.value + event.translationY;
      dragX.value = curX;
      dragY.value = curY;

      // Calculate the closest target column and row
      const targetCol = Math.max(0, Math.min(COLUMNS - 1, Math.round(curX / colWidth)));
      const targetRow = Math.max(0, Math.min(Math.floor((orderShared.value.length - 1) / COLUMNS), Math.round(curY / rowHeight)));
      const targetIndex = targetRow * COLUMNS + targetCol;

      if (targetIndex !== cardIndex.value && targetIndex < orderShared.value.length) {
        const newOrder = [...orderShared.value];
        const oldIndex = cardIndex.value;
        newOrder.splice(oldIndex, 1);
        newOrder.splice(targetIndex, 0, id);
        orderShared.value = newOrder;
      }
    })
    .onEnd(() => {
      activeIdShared.value = null;
      runOnJS(onDragEnd)(orderShared.value);
    });

  const handlePress = () => {
    if (tool.route) {
      router.push(tool.route as any);
    } else {
      Alert.alert('提示', '该工具正在全力研发中，敬请期待！');
    }
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardContainer, animatedStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed && !isEditing ? 0.9 : 1,
              transform: [{ scale: pressed && !isEditing ? 0.98 : 1 }]
            }
          ]}
          onPress={() => {
            if (isEditing) return;
            handlePress();
          }}
        >
          <View style={{ flex: 1 }}>
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
          </View>

          {!tool.route && (
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>建设中</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

export default function ToolsScreen() {
  const { colors, t } = useTheme();
  const [eurToCny, setEurToCny] = useState<number>(7.8256);
  const [toolOrder, setToolOrder] = useState<string[]>(['handbook', 'dictionary', 'rate', 'classroom', 'train', 'studyroom']);
  const [isEditing, setIsEditing] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const orderShared = useSharedValue(toolOrder);
  const activeIdShared = useSharedValue<string | null>(null);

  useEffect(() => {
    orderShared.value = toolOrder;
  }, [toolOrder]);

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

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const saved = await AsyncStorage.getItem(TOOLS_ORDER_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validIds = ['handbook', 'dictionary', 'rate', 'classroom', 'train', 'studyroom'];
            const filtered = parsed.filter((id: any) => validIds.includes(id));
            const missing = validIds.filter(id => !filtered.includes(id));
            setToolOrder([...filtered, ...missing]);
          }
        }
      } catch (e) {
        console.warn('Failed to load tools order:', e);
      }
    };
    loadOrder();
  }, []);

  const saveOrder = async (newOrder: string[]) => {
    try {
      await AsyncStorage.setItem(TOOLS_ORDER_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.warn('Failed to save tools order:', e);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
        >
          <Pressable 
            style={{ flex: 1, minHeight: '100%' }}
            onPress={() => {
              if (isEditing) {
                setIsEditing(false);
              }
            }}
          >
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{t('tools')}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {isEditing ? '按住并拖动卡片以排序，点击空白处完成' : '实用学术与生活辅助小工具箱'}
                </Text>
              </View>
            </View>

            <View style={[styles.grid, { height: Math.ceil(toolOrder.length / COLUMNS) * rowHeight }]}>
            {toolOrder.map((id) => {
              const tool = getToolDefinition(id, eurToCny, t);
              if (!tool) return null;
              return (
                <DraggableCard
                  key={tool.id}
                  id={tool.id}
                  tool={tool}
                  eurToCny={eurToCny}
                  t={t}
                  colors={colors}
                  isEditing={isEditing}
                  orderShared={orderShared}
                  activeIdShared={activeIdShared}
                  onDragStart={() => {
                    setScrollEnabled(false);
                  }}
                  onDragEnd={(newOrder) => {
                    setScrollEnabled(true);
                    setToolOrder(newOrder);
                    saveOrder(newOrder);
                  }}
                  onStartEditing={() => {
                    setIsEditing(true);
                  }}
                />
              );
            })}
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  grid: {
    position: 'relative',
    width: '100%',
  },
  cardContainer: {
    width: cardWidth,
    height: 165,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
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
    zIndex: 2,
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
