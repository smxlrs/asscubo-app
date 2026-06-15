import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
  RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// API configurations
const CLIENT_ID = '5ad08435b6ca5357dbac609e';
const CALENDAR_ID = '5f632ffc78b5fe001d1ea638';
const AULE_API = 'https://unibo.prod.up.cineca.it/api/Aule/getAulePerCalendarioPubblico';
const IMPEGNI_API = 'https://unibo.prod.up.cineca.it/api/Impegni/getImpegniCalendarioPubblico';

// TypeScript Types
interface Building {
  id: string;
  codice: string;
  descrizione: string;
  via?: string;
  comune?: string;
  orarioApertura?: string;
  orarioChiusura?: string;
  geo?: { lat: number; lng: number };
}

interface Classroom {
  id: string;
  codice: string;
  descrizione: string;
  capienzaEffettiva: number;
  edificioId: string;
  edificio: {
    codice: string;
    comune: string;
    orarioApertura: string | null;
    orarioChiusura: string | null;
    geo?: { lat: number; lng: number };
  };
  relazioneEdificio?: Building;
  serviziAula?: {
    codice: string;
    descrizione: string;
    icona: string;
  }[];
}

interface Impegno {
  id: string;
  dataInizio: string; // ISO string UTC
  dataFine: string; // ISO string UTC
  nome?: string;
  aule: {
    id: string;
    codice: string;
    descrizione: string;
  }[];
  tipoAttivita?: {
    descrizione: string;
  };
}

// Time Slot for Timeline
interface TimelineSlot {
  startMinutes: number;
  endMinutes: number;
  isOccupied: boolean;
  eventName?: string;
}

export default function EmptyClassroomScreen() {
  const { colors, isDark } = useTheme();

  // State Variables
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [impegni, setImpegni] = useState<Impegno[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [timeMode, setTimeMode] = useState<'now' | 'morning' | 'afternoon' | 'custom'>('now');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  
  // Custom Time Selection
  const [customStart, setCustomStart] = useState<string>('14:00');
  const [customEnd, setCustomEnd] = useState<string>('16:00');
  const [showTimeModal, setShowTimeModal] = useState<'start' | 'end' | null>(null);

  // Card expanded timeline states
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Toast State for Refresh feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    toastFade.setValue(0);
    Animated.timing(toastFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();

    setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      }).start(() => {
        setToastMsg(null);
      });
    }, 1500);
  };

  const TIME_OPTIONS = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ];

  // Helper to open map application
  const openMap = (lat?: number, lng?: number, label?: string) => {
    if (lat === undefined || lng === undefined) return;
    const scheme = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(label || '教室')}@${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label || '教室')})`
    });
    const webUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    
    if (scheme) {
      Linking.canOpenURL(scheme).then(supported => {
        if (supported) {
          Linking.openURL(scheme);
        } else {
          Linking.openURL(webUrl);
        }
      }).catch(() => {
        Linking.openURL(webUrl);
      });
    } else {
      Linking.openURL(webUrl);
    }
  };

  // Helper to parse time string "HH:MM" into minutes
  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // 1. Fetch classrooms and impegni
  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      // Fetch Classrooms
      const auleResponse = await fetch(AULE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({
          linkCalendarioId: CALENDAR_ID,
          clienteId: CLIENT_ID,
          ricercaPerTesto: '',
          limit: 100
        })
      });

      if (!auleResponse.ok) throw new Error('无法加载教室数据');
      const auleData = await auleResponse.json();

      // Determine date range for today (slightly expanded to prevent timezone missing bookings)
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const dataInizio = `${todayStr}T00:00:00.000Z`;
      const dataFine = `${todayStr}T23:59:59.000Z`;

      // Fetch Today's Impegni
      const impegniResponse = await fetch(IMPEGNI_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify({
          mostraImpegniAnnullati: true,
          mostraIndisponibilitaTotali: false,
          linkCalendarioId: CALENDAR_ID,
          clienteId: CLIENT_ID,
          pianificazioneTemplate: false,
          dataInizio,
          dataFine
        })
      });

      if (!impegniResponse.ok) throw new Error('无法加载课程占用数据');
      const impegniData = await impegniResponse.json();

      setClassrooms(auleData);
      setImpegni(impegniData);
      if (isRefresh) {
        triggerToast('✓ 教室状态已更新');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '网络请求错误，请重试');
      if (isRefresh) {
        triggerToast(`❌ 刷新失败: ${err.message || '网络错误'}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute unique buildings from classrooms list
  const buildings = useMemo(() => {
    const map = new Map<string, Building>();
    classrooms.forEach(c => {
      const b = c.relazioneEdificio;
      if (b && b.id) {
        map.set(b.id, b);
      } else if (c.edificioId) {
        map.set(c.edificioId, {
          id: c.edificioId,
          codice: c.edificio.codice || 'Unknown',
          descrizione: c.edificio.codice ? `教学楼 ${c.edificio.codice}` : '未知教学楼'
        });
      }
    });
    return Array.from(map.values());
  }, [classrooms]);

  // Compute current query time minutes
  const queryTimeRange = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    switch (timeMode) {
      case 'now':
        return { start: currentMinutes, end: currentMinutes + 10 }; // check availability for the next 10 mins
      case 'morning':
        return { start: timeToMinutes('08:30'), end: timeToMinutes('13:00') };
      case 'afternoon':
        return { start: timeToMinutes('13:00'), end: timeToMinutes('18:30') };
      case 'custom':
        return { start: timeToMinutes(customStart), end: timeToMinutes(customEnd) };
      default:
        return { start: currentMinutes, end: currentMinutes + 10 };
    }
  }, [timeMode, customStart, customEnd]);

  // Map each classroom's daily impegni
  const classroomOccupations = useMemo(() => {
    const map = new Map<string, { start: number; end: number; name: string }[]>();

    impegni.forEach(imp => {
      if (!imp.aule || imp.aule.length === 0) return;
      
      const localStart = new Date(imp.dataInizio);
      const localEnd = new Date(imp.dataFine);
      
      const startMin = localStart.getHours() * 60 + localStart.getMinutes();
      const endMin = localEnd.getHours() * 60 + localEnd.getMinutes();
      const name = imp.nome || imp.tipoAttivita?.descrizione || '课表占用';

      imp.aule.forEach(aulaRef => {
        if (!map.has(aulaRef.id)) {
          map.set(aulaRef.id, []);
        }
        map.get(aulaRef.id)!.push({ start: startMin, end: endMin, name });
      });
    });

    // Sort intervals by start time
    map.forEach((list, key) => {
      map.set(key, list.sort((a, b) => a.start - b.start));
    });

    return map;
  }, [impegni]);

  // Filter classrooms and determine availability status
  const processedClassrooms = useMemo(() => {
    const { start: qStart, end: qEnd } = queryTimeRange;

    return classrooms
      .map(aula => {
        const bookings = classroomOccupations.get(aula.id) || [];
        
        // Determine if currently occupied during selected range
        const overlappingBooking = bookings.find(b => b.start < qEnd && b.end > qStart);
        const isOccupied = !!overlappingBooking;

        // Check if building open
        const openStr = aula.relazioneEdificio?.orarioApertura || aula.edificio.orarioApertura || '08:00';
        const closeStr = aula.relazioneEdificio?.orarioChiusura || aula.edificio.orarioChiusura || '19:00';
        const openMin = timeToMinutes(openStr);
        const closeMin = timeToMinutes(closeStr);

        const isBuildingClosed = qStart >= closeMin || qEnd <= openMin;

        return {
          ...aula,
          isOccupied,
          isBuildingClosed,
          currentBookingName: overlappingBooking?.name,
          bookings
        };
      })
      .filter(aula => {
        // 1. Building filter
        if (selectedBuildingId !== 'all' && aula.edificioId !== selectedBuildingId) return false;

        // 2. Capacity filter
        if (capacityFilter === 'small' && aula.capienzaEffettiva >= 30) return false;
        if (capacityFilter === 'medium' && (aula.capienzaEffettiva < 30 || aula.capienzaEffettiva > 70)) return false;
        if (capacityFilter === 'large' && aula.capienzaEffettiva <= 70) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort: Free first, then closed, then occupied
        const scoreA = (a.isOccupied ? 2 : 0) + (a.isBuildingClosed ? 1 : 0);
        const scoreB = (b.isOccupied ? 2 : 0) + (b.isBuildingClosed ? 1 : 0);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.descrizione.localeCompare(b.descrizione);
      });
  }, [classrooms, classroomOccupations, queryTimeRange, selectedBuildingId, capacityFilter]);

  // Counting available classrooms
  const availableCount = useMemo(() => {
    return processedClassrooms.filter(a => !a.isOccupied && !a.isBuildingClosed).length;
  }, [processedClassrooms]);

  // Building Timeline for selected classroom
  const getTimelineSlots = (classroomBookings: { start: number; end: number; name: string }[], openTimeStr: string, closeTimeStr: string): TimelineSlot[] => {
    const openMin = timeToMinutes(openTimeStr);
    const closeMin = timeToMinutes(closeTimeStr);
    const slots: TimelineSlot[] = [];

    // Keep bookings only within building hours
    const filteredBookings = classroomBookings
      .filter(b => b.end > openMin && b.start < closeMin)
      .map(b => ({
        start: Math.max(openMin, b.start),
        end: Math.min(closeMin, b.end),
        name: b.name
      }));

    let pointer = openMin;
    filteredBookings.forEach(booking => {
      if (booking.start > pointer) {
        slots.push({
          startMinutes: pointer,
          endMinutes: booking.start,
          isOccupied: false
        });
      }
      slots.push({
        startMinutes: booking.start,
        endMinutes: booking.end,
        isOccupied: true,
        eventName: booking.name
      });
      pointer = booking.end;
    });

    if (pointer < closeMin) {
      slots.push({
        startMinutes: pointer,
        endMinutes: closeMin,
        isOccupied: false
      });
    }

    return slots;
  };

  const handleCardPress = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedCardId === id) {
      setExpandedCardId(null);
    } else {
      setExpandedCardId(id);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>博大空教室</Text>
        <Pressable style={styles.refreshButton} onPress={() => fetchData()} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.refreshText, { color: colors.primary }]}>↻</Text>
          )}
        </Pressable>
      </View>

      {/* Main View */}
      {loading && classrooms.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>正在同步博洛尼亚大学排课系统...</Text>
        </View>
      ) : error && classrooms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => fetchData()}>
            <Text style={styles.retryText}>重新加载</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchData(true)}
                colors={[colors.primary]}
                tintColor={colors.primary}
                progressViewOffset={22}
              />
            }
          >
            {/* Stats Dashboard */}
            <View style={[styles.dashboard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dashboardLeft}>
                <Text style={[styles.dashboardLabel, { color: colors.textSecondary }]}>当前选定时段可用</Text>
                <View style={styles.statsNumberContainer}>
                  <Text style={[styles.statsNumber, { color: colors.primary }]}>{availableCount}</Text>
                  <Text style={[styles.statsTotal, { color: colors.textMuted }]}>/ {processedClassrooms.length} 间</Text>
                </View>
                <Text style={[styles.dashboardSub, { color: colors.textMuted, fontSize: 10, marginTop: 6 }]}>
                  数据来源: University Planner (CINECA)
                </Text>
                <Text style={[styles.dashboardSub, { color: colors.textMuted, fontSize: 10, marginTop: 2 }]}>
                  * 仅供参考，请以学校实际授课安排为准
                </Text>
              </View>
              <View style={[styles.dashboardRight, { backgroundColor: colors.primary + '10' }]}>
                <Text style={styles.dashboardIcon}>🏫</Text>
              </View>
            </View>

            {/* Time Segmented Control */}
            <View style={[styles.filterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🔍 时段筛选</Text>
              <View style={styles.segmentedContainer}>
                <Pressable 
                  style={[styles.segment, timeMode === 'now' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('now')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'now' ? '#fff' : colors.textSecondary }]}>此时此刻</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segment, timeMode === 'morning' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('morning')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'morning' ? '#fff' : colors.textSecondary }]}>上午自习</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segment, timeMode === 'afternoon' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('afternoon')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'afternoon' ? '#fff' : colors.textSecondary }]}>下午自习</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segment, timeMode === 'custom' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('custom')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'custom' ? '#fff' : colors.textSecondary }]}>自定义</Text>
                </Pressable>
              </View>

              {/* Custom Time Selectors */}
              {timeMode === 'custom' && (
                <View style={styles.customTimeRow}>
                  <Pressable 
                    style={[styles.timePickerBtn, { borderColor: colors.border }]} 
                    onPress={() => setShowTimeModal('start')}
                  >
                    <Text style={[styles.timePickerLabel, { color: colors.textMuted }]}>开始时间</Text>
                    <Text style={[styles.timePickerVal, { color: colors.textPrimary }]}>{customStart}</Text>
                  </Pressable>
                  <View style={styles.timeArrow}>
                    <Text style={{ color: colors.textMuted }}>➔</Text>
                  </View>
                  <Pressable 
                    style={[styles.timePickerBtn, { borderColor: colors.border }]} 
                    onPress={() => setShowTimeModal('end')}
                  >
                    <Text style={[styles.timePickerLabel, { color: colors.textMuted }]}>结束时间</Text>
                    <Text style={[styles.timePickerVal, { color: colors.textPrimary }]}>{customEnd}</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Building horizontal chips */}
            <View style={styles.chipSection}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, paddingLeft: 4 }]}>🏢 校区教学楼</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                <Pressable
                  style={[
                    styles.chip, 
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selectedBuildingId === 'all' && [styles.chipActive, { backgroundColor: colors.primary }]
                  ]}
                  onPress={() => setSelectedBuildingId('all')}
                >
                  <Text style={[styles.chipText, { color: selectedBuildingId === 'all' ? '#fff' : colors.textSecondary }]}>
                    全部大楼
                  </Text>
                </Pressable>
                {buildings.map(b => (
                  <Pressable
                    key={b.id}
                    style={[
                      styles.chip, 
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      selectedBuildingId === b.id && [styles.chipActive, { backgroundColor: colors.primary }]
                    ]}
                    onPress={() => setSelectedBuildingId(b.id)}
                  >
                    <Text style={[styles.chipText, { color: selectedBuildingId === b.id ? '#fff' : colors.textSecondary }]} numberOfLines={1}>
                      {b.descrizione.replace('Edificio in Bo ', '').replace('via ', '')}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Capacity Filters */}
            <View style={styles.capacitySection}>
              <Pressable
                style={[
                  styles.capBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  capacityFilter === 'all' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
                ]}
                onPress={() => setCapacityFilter('all')}
              >
                <Text style={[styles.capText, { color: capacityFilter === 'all' ? colors.primary : colors.textSecondary }]}>容量不限</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.capBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  capacityFilter === 'small' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
                ]}
                onPress={() => setCapacityFilter('small')}
              >
                <Text style={[styles.capText, { color: capacityFilter === 'small' ? colors.primary : colors.textSecondary }]}>小型(&lt;30人)</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.capBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  capacityFilter === 'medium' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
                ]}
                onPress={() => setCapacityFilter('medium')}
              >
                <Text style={[styles.capText, { color: capacityFilter === 'medium' ? colors.primary : colors.textSecondary }]}>中型(30-70人)</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.capBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  capacityFilter === 'large' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
                ]}
                onPress={() => setCapacityFilter('large')}
              >
                <Text style={[styles.capText, { color: capacityFilter === 'large' ? colors.primary : colors.textSecondary }]}>大型(&gt;70人)</Text>
              </Pressable>
            </View>

            {/* Classrooms List */}
            <Text style={[styles.listHeaderTitle, { color: colors.textPrimary }]}>
              教室列表 ({processedClassrooms.length})
            </Text>

            {processedClassrooms.length === 0 ? (
              <View style={[styles.noResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.noResultIcon}>📭</Text>
                <Text style={[styles.noResultText, { color: colors.textSecondary }]}>没有符合当前筛选条件的教室</Text>
              </View>
            ) : (
              processedClassrooms.map(aula => {
                const openTime = aula.relazioneEdificio?.orarioApertura || aula.edificio.orarioApertura || '08:30';
                const closeTime = aula.relazioneEdificio?.orarioChiusura || aula.edificio.orarioChiusura || '18:30';
                const isExpanded = expandedCardId === aula.id;
                
                // Get timeline segments for today
                const slots = getTimelineSlots(aula.bookings, openTime, closeTime);

                return (
                  <View 
                    key={aula.id} 
                    style={[
                      styles.classroomCard, 
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      isExpanded && styles.expandedCardShadow
                    ]}
                  >
                    <Pressable style={styles.cardHeader} onPress={() => handleCardPress(aula.id)}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={styles.classroomTitleRow}>
                          <Text style={[styles.classroomTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {aula.descrizione}
                          </Text>
                          {/* Badges */}
                          {aula.isBuildingClosed ? (
                            <View style={[styles.statusBadge, { backgroundColor: colors.textMuted }]}>
                              <Text style={styles.statusBadgeText}>大楼关闭</Text>
                            </View>
                          ) : aula.isOccupied ? (
                            <View style={[styles.statusBadge, { backgroundColor: colors.error }]}>
                              <Text style={styles.statusBadgeText}>已被占用</Text>
                            </View>
                          ) : (
                            <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                              <Text style={styles.statusBadgeText}>空闲</Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={[styles.classroomSub, { color: colors.textSecondary }]} numberOfLines={1}>
                          {aula.relazioneEdificio?.descrizione || `楼栋 ${aula.edificio.codice}`} • {openTime}-{closeTime}
                        </Text>

                        {/* Occupation name summary */}
                        {aula.isOccupied && !aula.isBuildingClosed && (
                          <Text style={[styles.occupationSummary, { color: colors.error }]} numberOfLines={1}>
                            ⚠️ 当前: {aula.currentBookingName}
                          </Text>
                        )}

                        {/* Services / icons */}
                        <View style={styles.servicesRow}>
                          <View style={[styles.capacityTag, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[styles.capacityTagText, { color: colors.textSecondary }]}>
                              👥 {aula.capienzaEffettiva} 人
                            </Text>
                          </View>
                          
                          {aula.serviziAula?.map((s, idx) => {
                            let emoji = '⚙️';
                            if (s.codice.includes('lavagna')) emoji = '📝';
                            else if (s.codice.includes('proiett') || s.codice.includes('video')) emoji = '📹';
                            else if (s.codice.includes('audio')) emoji = '🎙️';
                            else if (s.codice.includes('accessible') || s.codice.includes('3.1')) emoji = '♿';

                            return (
                              <View key={idx} style={[styles.serviceTag, { backgroundColor: colors.surfaceElevated }]}>
                                <Text style={[styles.serviceTagText, { color: colors.textSecondary }]}>
                                  {emoji} {s.descrizione.length > 5 ? s.descrizione.substring(0, 4) + '..' : s.descrizione}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.cardHeaderRight}>
                        <Text style={[styles.expandArrow, { color: colors.textMuted }]}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Timeline view when expanded */}
                    {isExpanded && (
                      <View style={[styles.timelineContainer, { borderTopColor: colors.border }]}>
                        <View style={styles.timelineHeader}>
                          <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>今日开放时段占用图 (时间轴)</Text>
                          {(() => {
                            const lat = aula.relazioneEdificio?.geo?.lat || aula.edificio?.geo?.lat;
                            const lng = aula.relazioneEdificio?.geo?.lng || aula.edificio?.geo?.lng;
                            if (lat !== undefined && lng !== undefined) {
                              return (
                                <Pressable
                                  style={[styles.navigationBtn, { borderColor: colors.primary }]}
                                  onPress={() => openMap(lat, lng, aula.descrizione)}
                                >
                                  <Text style={[styles.navigationBtnText, { color: colors.primary }]}>📍 一键前往</Text>
                                </Pressable>
                              );
                            }
                            return null;
                          })()}
                        </View>
                        {slots.length === 0 ? (
                          <Text style={[styles.noBookingText, { color: colors.textMuted }]}>今日暂无占用，整天可用</Text>
                        ) : (
                          <View style={styles.timelineList}>
                            {slots.map((slot, index) => {
                              const sTime = minutesToTime(slot.startMinutes);
                              const eTime = minutesToTime(slot.endMinutes);
                              const durationMins = slot.endMinutes - slot.startMinutes;
                              const heightWeight = Math.max(36, Math.min(80, durationMins * 0.7)); // scale height

                              return (
                                <View key={index} style={[styles.timelineItem, { height: heightWeight }]}>
                                  <View style={styles.timeLabelContainer}>
                                    <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>{sTime}</Text>
                                    <Text style={[styles.timeLabelSub, { color: colors.textMuted }]}>{eTime}</Text>
                                  </View>
                                  
                                  <View 
                                    style={[
                                      styles.timelineBar, 
                                      { 
                                        backgroundColor: slot.isOccupied ? colors.error + '18' : colors.success + '18',
                                        borderColor: slot.isOccupied ? colors.error + '40' : colors.success + '40',
                                      }
                                    ]}
                                  >
                                    <View 
                                      style={[
                                        styles.timelineIndicator, 
                                        { backgroundColor: slot.isOccupied ? colors.error : colors.success }
                                      ]} 
                                    />
                                    <Text 
                                      style={[
                                        styles.timelineBarText, 
                                        { color: slot.isOccupied ? colors.error : colors.success, fontWeight: slot.isOccupied ? 'bold' : 'normal' }
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {slot.isOccupied ? `占 • ${slot.eventName}` : '🟢 空闲可自习'}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Time Picker Modal Overlay (Custom simple dialog) */}
      {showTimeModal !== null && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowTimeModal(null)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {showTimeModal === 'start' ? '选择开始时间' : '选择结束时间'}
            </Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {TIME_OPTIONS.map(timeStr => {
                const isSelected = showTimeModal === 'start' ? customStart === timeStr : customEnd === timeStr;
                const isPastStart = showTimeModal === 'end' && timeToMinutes(timeStr) <= timeToMinutes(customStart);
                
                if (isPastStart) return null; // End time must be after start time

                return (
                  <Pressable
                    key={timeStr}
                    style={[
                      styles.modalItem,
                      { borderBottomColor: colors.border },
                      isSelected && [styles.modalItemActive, { backgroundColor: colors.primary + '15' }]
                    ]}
                    onPress={() => {
                      if (showTimeModal === 'start') {
                        setCustomStart(timeStr);
                        // Adjust end time if it becomes invalid
                        if (timeToMinutes(customEnd) <= timeToMinutes(timeStr)) {
                          const startIdx = TIME_OPTIONS.indexOf(timeStr);
                          const newEnd = TIME_OPTIONS[Math.min(TIME_OPTIONS.length - 1, startIdx + 4)]; // +2 hours
                          setCustomEnd(newEnd);
                        }
                      } else {
                        setCustomEnd(timeStr);
                      }
                      setShowTimeModal(null);
                    }}
                  >
                    <Text 
                      style={[
                        styles.modalItemText, 
                        { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? 'bold' : 'normal' }
                      ]}
                    >
                      {timeStr}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={[styles.modalCloseBtn, { backgroundColor: colors.primary }]} onPress={() => setShowTimeModal(null)}>
              <Text style={styles.modalCloseBtnText}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Toast Feedback */}
      {toastMsg && (
        <Animated.View style={[
          styles.toastContainer, 
          { 
            opacity: toastFade,
            backgroundColor: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,30,0.9)' 
          }
        ]}>
          <Text style={[styles.toastText, { color: isDark ? '#000' : '#fff' }]}>{toastMsg}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 40,
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  dashboard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  dashboardLeft: {
    flex: 1,
  },
  dashboardLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statsNumberContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statsNumber: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  statsTotal: {
    fontSize: 15,
    marginLeft: 6,
    fontWeight: '500',
  },
  dashboardSub: {
    fontSize: 10,
    marginTop: 6,
  },
  dashboardRight: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dashboardIcon: {
    fontSize: 28,
  },
  filterSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  timePickerBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  timePickerLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  timePickerVal: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  timeArrow: {
    paddingHorizontal: 12,
  },
  chipSection: {
    marginBottom: 16,
  },
  chipsScroll: {
    paddingVertical: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  chipActive: {
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  capacitySection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  capBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  capText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  listHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingLeft: 4,
  },
  noResult: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noResultText: {
    fontSize: 13,
    fontWeight: '500',
  },
  classroomCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  expandedCardShadow: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  classroomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  classroomTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    maxWidth: '70%',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  classroomSub: {
    fontSize: 11,
    marginBottom: 8,
  },
  occupationSummary: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  servicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  capacityTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  capacityTagText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  serviceTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  serviceTagText: {
    fontSize: 9,
    fontWeight: '500',
  },
  cardHeaderRight: {
    paddingLeft: 12,
  },
  expandArrow: {
    fontSize: 12,
  },
  timelineContainer: {
    borderTopWidth: 1,
    padding: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  navigationBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  noBookingText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  timelineList: {
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 6,
  },
  timeLabelContainer: {
    width: 48,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  timeLabelSub: {
    fontSize: 9,
    lineHeight: 11,
  },
  timelineBar: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  timelineIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  timelineBarText: {
    fontSize: 10,
    flex: 1,
  },
  modalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    flex: 1,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  modalItemActive: {
    borderRadius: 8,
  },
  modalItemText: {
    fontSize: 14,
  },
  modalCloseBtn: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  toastContainer: {
    position: 'absolute',
    top: 100,
    left: 32,
    right: 32,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 99999,
  },
  toastText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
