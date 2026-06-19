import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Language } from '../../../context/ThemeContext';
import {
  getTrainStatus,
  searchTrain,
  getTrainAlerts,
  getOperatorInfo,
  getFutureItaloTrainSchedule,
  VtTrainStatus,
  VtStop,
  VtAlert,
  cleanPlatform,
  formatRomeTimeStr,
  formatRomeDateFromTimestamp
} from '../../../lib/viaggiaTrenoService';
import { MarqueeText } from '../../../components/MarqueeText';

const { width } = Dimensions.get('window');

const getPlatformDisplayInfo = (scheduled: string, actual: string) => {
  const schedClean = cleanPlatform(scheduled);
  const actClean = cleanPlatform(actual);
  const schedNorm = schedClean.toUpperCase();
  const actNorm = actClean.toUpperCase();

  if (!actNorm) {
    return { hasChange: false, display: schedClean };
  }
  if (!schedNorm) {
    return { hasChange: false, display: actClean };
  }
  if (schedNorm === actNorm) {
    return { hasChange: false, display: actClean };
  }

  // Check if one is generic "AV" and the other is a high-speed platform (16, 17, 18, 19, or contains "AV")
  const isHighSpeedPlatform = (p: string) => {
    return /^(16|17|18|19)$/.test(p) || p.includes('AV');
  };

  const isGenericAvMatch = 
    (schedNorm === 'AV' && isHighSpeedPlatform(actNorm)) ||
    (actNorm === 'AV' && isHighSpeedPlatform(schedNorm));
  
  if (isGenericAvMatch) {
    // No real change, display the more specific one
    const moreSpecific = schedNorm === 'AV' ? actClean : schedClean;
    return { hasChange: false, display: moreSpecific };
  }

  // Check if one is just the number of the other (e.g., "19" vs "19 AV" or "19AV")
  const schedDigits = schedNorm.replace(/\D/g, '');
  const actDigits = actNorm.replace(/\D/g, '');
  
  if (schedDigits && actDigits && schedDigits === actDigits) {
    const moreSpecific = schedNorm.length >= actNorm.length ? schedClean : actClean;
    return { hasChange: false, display: moreSpecific };
  }

  return { hasChange: true, scheduled: schedClean, actual: actClean };
};

const LOCALIZED: Record<Language, Record<string, string>> = {
  zh: {
    title: '车次追踪',
    loading: '正在获取运行状态...',
    error: '查询失败，该车次今日尚未开行或数据未更新。',
    trainCancelled: '该班次列车已被停运 (Cancellato)',
    scheduledDep: '计划始发',
    scheduledArr: '计划终到',
    delayMin: '晚点',
    delayOnTime: '正点运行',
    lastReport: '最后报告位置',
    stopsTitle: '行车路线与停靠站',
    stopPlatform: '站台',
    stopArr: '到达',
    stopDep: '出发',
    stopStatusSuppressed: '已取消停靠',
    stopStatusAdded: '新增停靠站',
    stopStatusUnknown: '暂无实时数据',
    minUnit: '分钟',
    earlyMin: '早到',
    origin: '始发站',
    destination: '终点站',
    refresh: '刷新',
    back: '返回',
    notStarted: '尚未开行',
    disclaimer: '本服务展示的列车时刻、延误及站台等数据均来自意大利铁路公开实时运营信息，仅供出行参考。实际运行请以车站大屏幕及官方购票App（Trenitalia / Italo）实时公告为准。'
  },
  'zh-Hant': {
    title: '車次追踪',
    loading: '正在獲取運行狀態...',
    error: '查詢失敗，該車次今日尚未開行或數據未更新。',
    trainCancelled: '該班次列車已被停運 (Cancellato)',
    scheduledDep: '計劃始發',
    scheduledArr: '計劃終到',
    delayMin: '晚點',
    delayOnTime: '正點運行',
    lastReport: '最後報告位置',
    stopsTitle: '行車路線與停靠站',
    stopPlatform: '站台',
    stopArr: '到達',
    stopDep: '出發',
    stopStatusSuppressed: '已取消停靠',
    stopStatusAdded: '新增停靠站',
    stopStatusUnknown: '暫無即時數據',
    minUnit: '分鐘',
    earlyMin: '早到',
    origin: '始發站',
    destination: '終點站',
    refresh: '刷新',
    back: '返回',
    notStarted: '尚未開行',
    disclaimer: '本服務展示的列車時刻、延誤及月台等數據均來自義大利鐵路公開即時營運資訊，僅供出行參考。實際運行請以車站大屏幕及鐵路官方App（Trenitalia / Italo）即時公告為準。'
  },
  en: {
    title: 'Train Tracking',
    loading: 'Loading train status...',
    error: 'Failed to load details. The train may not have started running yet today.',
    trainCancelled: 'This train has been CANCELLED',
    scheduledDep: 'Sch. Dep',
    scheduledArr: 'Sch. Arr',
    delayMin: 'Delay',
    delayOnTime: 'On Time',
    lastReport: 'Last Report',
    stopsTitle: 'Stations & Schedule',
    stopPlatform: 'Track',
    stopArr: 'Arr',
    stopDep: 'Dep',
    stopStatusSuppressed: 'Stop Cancelled',
    stopStatusAdded: 'Additional Stop',
    stopStatusUnknown: 'No live status',
    minUnit: 'min',
    earlyMin: 'Early',
    origin: 'Origin',
    destination: 'Destination',
    refresh: 'Refresh',
    back: 'Back',
    notStarted: 'Not started yet',
    disclaimer: 'The train schedules, delays, and platform info displayed here are retrieved from Italian rail public live data and are for reference only. Please refer to station screens and official apps for actual operations.'
  },
  it: {
    title: 'Stato Treno',
    loading: 'Caricamento stato treno...',
    error: 'Impossibile caricare lo stato del treno. Il treno potrebbe non essere ancora partito.',
    trainCancelled: 'Questo treno è stato CANCELLATO',
    scheduledDep: 'Part. Prog.',
    scheduledArr: 'Arr. Prog.',
    delayMin: 'Ritardo',
    delayOnTime: 'In Orario',
    lastReport: 'Ultimo Rilevamento',
    stopsTitle: 'Fermate e Itinerario',
    stopPlatform: 'Binario',
    stopArr: 'Arr',
    stopDep: 'Part',
    stopStatusSuppressed: 'Fermata Soppressa',
    stopStatusAdded: 'Fermata Straordinaria',
    stopStatusUnknown: 'Dato non disponibile',
    minUnit: 'min',
    earlyMin: 'Anticipo',
    origin: 'Origine',
    destination: 'Destinazione',
    refresh: 'Aggiorna',
    back: 'Indietro',
    notStarted: 'Non ancora partito',
    disclaimer: 'Gli orari, ritardi e binari dei treni mostrati sono tratti dai dati pubblici in tempo reale delle ferrovie italiane e hanno valore puramente informativo. Fare riferimento ai tabelloni di stazione e alle app ufficiali per l\'operatività reale.'
  }
};

export default function TrainStatusScreen() {
  const { colors, language, isDark } = useTheme();

  // Route query params
  const { trainNumber, departureStationID, timestamp, origin, destination, scheduledTime, category } = useLocalSearchParams<{
    trainNumber: string;
    departureStationID: string;
    timestamp: string;
    origin?: string;
    destination?: string;
    scheduledTime?: string;
    category?: string;
  }>();

  // Localizer
  const t = (key: string) => {
    return LOCALIZED[language]?.[key] || LOCALIZED['en']?.[key] || key;
  };

  const [status, setStatus] = useState<VtTrainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [alerts, setAlerts] = useState<VtAlert[]>([]);

  // Date selector local states
  const [activeTimestamp, setActiveTimestamp] = useState<string>(timestamp || '');
  const [activeStationID, setActiveStationID] = useState<string>(departureStationID || '');
  const [availableRuns, setAvailableRuns] = useState<{ timestamp: string; dateStr: string; departureStationID: string }[]>([]);

  const FAVORITE_TRAINS_KEY = '@ag_favorite_trains';
  const RECENT_TRAINS_KEY = '@ag_recent_trains';
  const isFetchingRef = useRef(false);

  useEffect(() => {
    setActiveTimestamp(timestamp || '');
    setActiveStationID(departureStationID || '');
  }, [trainNumber, departureStationID, timestamp]);

  useEffect(() => {
    fetchData();
    checkStarredStatus();
  }, [trainNumber, activeStationID, activeTimestamp]);

  const checkStarredStatus = async () => {
    if (!trainNumber) return;
    try {
      const favsJson = await AsyncStorage.getItem(FAVORITE_TRAINS_KEY);
      const favs = favsJson ? JSON.parse(favsJson) : [];
      const starred = favs.some((f: any) => String(f.number) === String(trainNumber));
      setIsStarred(starred);
    } catch (e) {
      console.warn('Failed to check star status:', e);
    }
  };

  const toggleStar = async () => {
    if (!status) return;
    try {
      const favsJson = await AsyncStorage.getItem(FAVORITE_TRAINS_KEY);
      let favs = favsJson ? JSON.parse(favsJson) : [];
      const isAlreadyStarred = favs.some((f: any) => String(f.number) === String(trainNumber));
      
      if (isAlreadyStarred) {
        favs = favs.filter((f: any) => String(f.number) !== String(trainNumber));
      } else {
        const summary = {
          number: status.number,
          category: status.category,
          origin: status.origin,
          destination: status.destination,
          scheduledDepartureTime: status.scheduledDepartureTime,
          scheduledArrivalTime: status.scheduledArrivalTime,
          departureStationID: departureStationID || status.stops[0]?.stationId || '',
          timestamp: timestamp || String(status.scheduledDepartureTime),
          codiceCliente: status.codiceCliente || null
        };
        favs = [summary, ...favs];
      }
      
      await AsyncStorage.setItem(FAVORITE_TRAINS_KEY, JSON.stringify(favs));
      setIsStarred(!isAlreadyStarred);
    } catch (e) {
      console.warn('Failed to toggle star:', e);
    }
  };

  const updateRecentTrainInHistory = async (statusData: VtTrainStatus, activeStationID: string, activeTimestamp: string) => {
    try {
      const historyJson = await AsyncStorage.getItem(RECENT_TRAINS_KEY);
      let history: any[] = historyJson ? JSON.parse(historyJson) : [];
      
      // Filter out this train to reposition it at the top
      const filtered = history.filter(h => String(h.number) !== String(statusData.number));
      
      const updatedEntry = {
        number: statusData.number,
        category: statusData.category,
        origin: statusData.origin,
        destination: statusData.destination,
        scheduledDepartureTime: statusData.scheduledDepartureTime,
        scheduledArrivalTime: statusData.scheduledArrivalTime,
        departureStationID: activeStationID,
        timestamp: activeTimestamp,
        codiceCliente: statusData.codiceCliente || null,
        label: `${statusData.category} ${statusData.number} - ${statusData.destination}`
      };
      
      const updated = [updatedEntry, ...filtered].slice(0, 5);
      await AsyncStorage.setItem(RECENT_TRAINS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update recent train in history:', e);
    }
  };

  const formatDateFromTimestamp = (ts: string) => {
    const val = parseInt(ts, 10);
    if (isNaN(val)) return '';
    return formatRomeDateFromTimestamp(val);
  };

  const fetchData = async (isRef = false) => {
    if (!trainNumber) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isRef) setLoading(true);
    setErrorMsg('');
    setAlerts([]); // Reset alerts
    try {
      let resolvedStationID = activeStationID;
      let resolvedTimestamp = activeTimestamp;
      let data = null;
      
      // Resolve the latest active run first if we have multiple runs
      const matches = await searchTrain(trainNumber);
      if (matches && matches.length > 0) {
        // Filter matches to only keep those matching resolvedStationID (if present)
        const cleanStationId = (id: string) => String(id || '').trim().toUpperCase().replace(/^S/i, '').replace(/^0+/, '');
        const targetStation = cleanStationId(resolvedStationID);
        
        let filteredMatches = matches;
        if (targetStation) {
          filteredMatches = matches.filter(m => cleanStationId(m.departureStationID) === targetStation);
        }
        
        if (filteredMatches.length === 0) {
          filteredMatches = matches;
        }

        // Sort matches: newest first (largest timestamp first)
        const sorted = [...filteredMatches].sort((a, b) => {
          const tA = parseInt(a.timestamp, 10) || 0;
          const tB = parseInt(b.timestamp, 10) || 0;
          return tB - tA;
        });

        // Date selection runs (take at most 2 runs), deduplicated by dateStr
        const runsRaw = sorted.slice(0, 2).map(m => ({
          timestamp: m.timestamp,
          dateStr: formatDateFromTimestamp(m.timestamp),
          departureStationID: m.departureStationID
        }));
        const seenDates = new Set<string>();
        const runs = runsRaw.filter(r => {
          if (seenDates.has(r.dateStr)) return false;
          seenDates.add(r.dateStr);
          return true;
        });
        runs.sort((a, b) => (parseInt(a.timestamp, 10) || 0) - (parseInt(b.timestamp, 10) || 0));
        setAvailableRuns(runs);
        
        // If current activeTimestamp is not in the list, redirect to latest
        const isCurrentValid = runs.some(r => String(r.timestamp) === String(resolvedTimestamp));
        if (!resolvedTimestamp || !isCurrentValid) {
          const latestRun = runs[runs.length - 1] || sorted[0];
          resolvedStationID = latestRun.departureStationID;
          resolvedTimestamp = latestRun.timestamp;
          
          setActiveStationID(resolvedStationID);
          setActiveTimestamp(resolvedTimestamp);
          return; // Change in state will trigger useEffect to fetch again
        }
      }
      
      if (resolvedStationID) {
        data = await getTrainStatus(resolvedStationID, trainNumber, resolvedTimestamp);
      }
      
      // Fallback
      if (!data) {
        console.log(`Query for train ${trainNumber} failed. Trying generic match fallback...`);
        const fallbackMatches = await searchTrain(trainNumber);
        if (fallbackMatches && fallbackMatches.length > 0) {
          const sorted = [...fallbackMatches].sort((a, b) => parseInt(b.timestamp, 10) - parseInt(a.timestamp, 10));
          const bestMatch = sorted[0];
          resolvedStationID = bestMatch.departureStationID;
          resolvedTimestamp = bestMatch.timestamp;
          data = await getTrainStatus(resolvedStationID, bestMatch.number, resolvedTimestamp);
          
          setActiveStationID(resolvedStationID);
          setActiveTimestamp(resolvedTimestamp);
        }
      }
      
      if (!data && (resolvedStationID === 'ITALO' || departureStationID === 'ITALO' || category === 'NTV') && origin && destination && scheduledTime) {
        data = await getFutureItaloTrainSchedule(trainNumber, origin, destination, parseInt(scheduledTime, 10));
      }
      
      if (data) {
        setStatus(data);
        await updateRecentTrainInHistory(data, resolvedStationID, resolvedTimestamp);

        try {
          const activeAlerts = await getTrainAlerts(data.number, data.origin, data.destination);
          setAlerts(activeAlerts);
        } catch (alertErr) {
          console.warn('Failed to load alerts:', alertErr);
        }
      } else {
        setErrorMsg(t('error'));
      }
    } catch (e) {
      console.error(e);
      setErrorMsg(t('error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  const getSegmentProgress = (idx: number, stops: VtStop[], delayMin: number, activeStopIndex: number) => {
    if (idx < 0 || idx >= stops.length - 1) return 0;

    // Case 1: Already passed segment
    if (idx < activeStopIndex) {
      return 1;
    }
    // Case 2: Upcoming segment
    if (idx > activeStopIndex) {
      return 0;
    }

    // Case 3: Train currently moving in this segment (idx === activeStopIndex)
    const stopCurrent = stops[idx];
    const stopNext = stops[idx + 1];

    const delayVal = delayMin || 0;
    const depTime = stopCurrent.actualDepartureTime || (stopCurrent.scheduledDepartureTime ? (stopCurrent.scheduledDepartureTime + delayVal * 60000) : null);
    const arrTime = stopNext.actualArrivalTime || (stopNext.scheduledArrivalTime ? (stopNext.scheduledArrivalTime + delayVal * 60000) : null);
    
    if (depTime && arrTime && arrTime > depTime) {
      const now = Date.now();
      if (now < depTime) return 0;
      if (now >= arrTime) return 1;
      const ratio = (now - depTime) / (arrTime - depTime);
      return Math.max(0, Math.min(1, ratio));
    }
    return 0;
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const formatTimeStr = (unixMs: number | null) => {
    return formatRomeTimeStr(unixMs);
  };

  const formatReportTimeStr = (unixMs: number | null) => {
    if (!unixMs) return '';
    return formatRomeTimeStr(unixMs);
  };

  // Find the last stop that has actual arrival/departure time (indicating it has been reached)
  const getLastReachedStopIndex = (stops: VtStop[]) => {
    let lastIndex = -1;
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].actualArrivalTime !== null || stops[i].actualDepartureTime !== null) {
        lastIndex = i;
      }
    }
    return lastIndex;
  };

  if (!status) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={handleRefresh} style={styles.backButton}>
              <MaterialIcons name="refresh" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {errorMsg ? (
          <View style={styles.centerContainer}>
            <MaterialIcons name="error-outline" size={48} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
            <Pressable
              onPress={handleRefresh}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryBtnText}>{t('refresh')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('loading')}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const timeBasedActiveIndex = status ? getLastReachedStopIndex(status.stops) : -1;
  const nameBasedActiveIndex = status
    ? status.stops.findIndex(
        s => s.stationName.trim().toLowerCase() === status.lastReportedStation.trim().toLowerCase()
      )
    : -1;

  // Timeline helper index: prefer time-based (real time departed/arrived) over name-based
  const activeStopIndex = timeBasedActiveIndex !== -1 ? timeBasedActiveIndex : nameBasedActiveIndex;

  const isNotStartedYet = status && status.stops.every(s => s.actualArrivalTime === null && s.actualDepartureTime === null);

  // Determine delay styling
  const delayMinutes = status?.delay || 0;
  const isCancelled = status?.isCancelled || false;
  
  let delayColor = colors.textSecondary;
  let delayText = t('delayOnTime');
  if (isCancelled) {
    delayColor = colors.error;
    delayText = t('trainCancelled');
  } else if (isNotStartedYet) {
    delayColor = colors.primary;
    delayText = t('notStarted');
  } else if (delayMinutes > 0) {
    delayColor = colors.error;
    delayText = `${t('delayMin')}: +${delayMinutes} ${t('minUnit')}`;
  } else if (delayMinutes < 0) {
    delayColor = colors.success;
    delayText = `${t('earlyMin')}: ${Math.abs(delayMinutes)} ${t('minUnit')}`;
  }
  // Check operator category
  const isHighSpeed = status && ['FR', 'FA', 'FB', 'Italo', 'ITALO', 'NTV', 'EC', 'EN'].includes(status.category);

  const handleStationPress = (stationName: string, stationId: string) => {
    router.push({
      pathname: '/tools/train/station-board',
      params: {
        stationID: stationId,
        stationName: stationName,
        mode: 'departures'
      }
    });
  };

  const getDisplayTimes = (scheduled: number | null, actual: number | null) => {
    if (!scheduled) return { sch: '', act: '', isDelayed: false, isEarly: false };
    const schStr = formatTimeStr(scheduled);
    
    let actStr = '--:--';
    let isDelayed = false;
    let isEarly = false;
    
    if (actual) {
      actStr = formatTimeStr(actual);
      const diffMin = Math.round((actual - scheduled) / 60000);
      isDelayed = diffMin > 0;
      isEarly = diffMin < 0;
    } else {
      const delayVal = status?.delay || 0;
      const predicted = scheduled + delayVal * 60000;
      actStr = formatTimeStr(predicted);
      isDelayed = delayVal > 0;
      isEarly = delayVal < 0;
    }
    
    return { sch: schStr, act: actStr, isDelayed, isEarly };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {status && (
            <Pressable onPress={toggleStar} style={styles.backButton}>
              <MaterialIcons
                name={isStarred ? "star" : "star-border"}
                size={24}
                color={isStarred ? "#EAB308" : colors.textPrimary}
              />
            </Pressable>
          )}
          <Pressable onPress={handleRefresh} style={styles.backButton}>
            <MaterialIcons name="refresh" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
      </View>


        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
        >
          {/* Train Summary Dashboard Card */}
          <View style={[styles.dashboardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dashboardHeader}>
              <View style={styles.trainBadgeRow}>
                <View style={[styles.catBadge, { backgroundColor: isHighSpeed ? '#E30613' + '20' : colors.primarySoft }]}>
                  <Text style={[styles.catBadgeText, { color: isHighSpeed ? '#E30613' : colors.primary }]}>
                    {status.category}
                  </Text>
                </View>
                <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.trainNumText, { color: colors.textPrimary, marginRight: 8 }]}>{status.number}</Text>
                {(() => {
                  const op = getOperatorInfo(status.codiceCliente ?? null, status.category);
                  return (
                    <View style={{
                      borderColor: op.color,
                      borderWidth: 1,
                      backgroundColor: op.color + '10',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}>
                      <Text style={{ fontSize: 9, color: op.color, fontWeight: 'bold' }}>{op.name}</Text>
                    </View>
                  );
                })()}
              </View>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.delayBadgeText, { color: delayColor, fontWeight: 'bold' }]}>
                {delayText}
              </Text>
            </View>

            {/* Path Endpoints */}
            <View style={styles.endpointsRow}>
              <View style={styles.endpointCol}>
                <Text style={[styles.endpointLabel, { color: colors.textSecondary }]}>{t('origin')}</Text>
                <MarqueeText style={[styles.endpointName, { color: colors.textPrimary }]} text={status.origin} />
                <Text style={[styles.endpointTime, { color: colors.textSecondary }]}>
                  {formatTimeStr(status.scheduledDepartureTime)}
                </Text>
              </View>
              <View style={styles.arrowCol}>
                <MaterialIcons name="trending-flat" size={24} color={colors.textMuted} />
              </View>
              <View style={styles.endpointCol}>
                <Text style={[styles.endpointLabel, { color: colors.textSecondary }]}>{t('destination')}</Text>
                <MarqueeText style={[styles.endpointName, { color: colors.textPrimary }]} text={status.destination} />
                <Text style={[styles.endpointTime, { color: colors.textSecondary }]}>
                  {formatTimeStr(status.scheduledArrivalTime)}
                </Text>
              </View>
            </View>

            {/* Last report status bar */}
            {status.lastReportedStation && (
              <View style={[styles.lastReportRow, { backgroundColor: colors.background, borderRadius: 8 }]}>
                <MaterialIcons name="my-location" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.lastReportText, { color: colors.textSecondary }]}>
                  {t('lastReport')}:{' '}
                  <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>
                    {status.lastReportedStation}
                  </Text>{' '}
                  {status.lastReportedTime ? `(${formatReportTimeStr(status.lastReportedTime)})` : ''}
                </Text>
              </View>
            )}
          </View>

          {/* Active News/Strike Alerts Card */}
          {alerts.length > 0 && (
            <View style={[styles.alertsContainer, { marginBottom: 16 }]}>
              {alerts.map((alert) => (
                <View key={alert.id} style={[styles.alertCard, { backgroundColor: colors.surface, borderColor: '#F59E0B' }]}>
                  <View style={styles.alertHeader}>
                    <MaterialIcons name="warning" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text style={[styles.alertTitle, { color: '#F59E0B' }]}>{alert.title}</Text>
                  </View>
                  <Text style={[styles.alertText, { color: colors.textPrimary }]}>{alert.text}</Text>
                  {alert.timestamp > 0 && (
                    <Text style={[styles.alertDate, { color: colors.textMuted }]}>
                      {new Date(alert.timestamp).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'it-IT', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Timeline Section Header with Date Selector */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>{t('stopsTitle')}</Text>
            {availableRuns.length > 0 && (
              <View style={styles.dateSelectorContainer}>
                {availableRuns.map((run) => {
                  const isSelected = String(run.timestamp) === String(activeTimestamp);
                  return (
                    <Pressable
                      key={run.timestamp}
                      onPress={() => {
                        setActiveTimestamp(run.timestamp);
                        setActiveStationID(run.departureStationID);
                      }}
                      style={[
                        styles.dateCapsule,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateCapsuleText,
                          {
                            color: isSelected ? '#FFF' : colors.textSecondary,
                            fontWeight: isSelected ? 'bold' : 'normal'
                          }
                         ]}
                      >
                        {run.dateStr}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.timelineWrapper}>
            {(() => {
              const isTrainNotStarted = status.stops.every(s => s.actualArrivalTime === null && s.actualDepartureTime === null);
              
              return status.stops.map((stop, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === status.stops.length - 1;
                const isSuppressed = stop.status === 'suppressed';

                let isPassed = false;
                let isCurrentStation = false;
                let isUpcoming = true;

                if (isSuppressed) {
                  isUpcoming = false;
                } else if (activeStopIndex !== -1) {
                  if (idx < activeStopIndex) {
                    isPassed = true;
                    isUpcoming = false;
                  } else if (idx === activeStopIndex) {
                    // Check if departed
                    const hasDeparted = stop.actualDepartureTime !== null;
                    if (hasDeparted && !isLast) {
                      isPassed = true;
                      isUpcoming = false;
                    } else {
                      isCurrentStation = true;
                      isUpcoming = false;
                    }
                  }
                } else {
                  if (isFirst && isTrainNotStarted) {
                    isCurrentStation = true;
                    isUpcoming = false;
                  }
                }

                // Platform change check
                const platformInfo = getPlatformDisplayInfo(stop.scheduledPlatform || '', stop.actualPlatform || '');

                // Time calculations (Scheduled and Actual side-by-side)
                const arrTimes = getDisplayTimes(stop.scheduledArrivalTime, stop.actualArrivalTime);
                const depTimes = getDisplayTimes(stop.scheduledDepartureTime, stop.actualDepartureTime);

                // Stop Delay calculations
                const stopDelay = isLast ? stop.arrivalDelay : stop.departureDelay;
                let stopDelayText = '';
                if (stopDelay > 0) stopDelayText = `+${stopDelay}'`;
                else if (stopDelay < 0) stopDelayText = `${stopDelay}'`;

                return (
                  <View key={stop.stationId + '_' + idx} style={styles.timelineNodeRow}>
                    {/* Left Column: Timeline Lines and Nodes */}
                    <View style={styles.timelineLeftCol}>
                      {/* Background vertical line (connecting center of current circle to center of next circle) */}
                      {!isLast && (
                        <ProgressBarLine
                          progress={getSegmentProgress(idx, status.stops, status.delay, activeStopIndex)}
                          colors={colors}
                        />
                      )}

                      {/* Spacer above circle to align with card header */}
                      <View style={{ height: 25 }} />

                      {/* Node Circle */}
                      {isSuppressed ? (
                        <View style={[styles.circleNode, { borderColor: colors.error, backgroundColor: colors.surface }]}>
                          <MaterialIcons name="close" size={10} color={colors.error} />
                        </View>
                      ) : isCurrentStation ? (
                        <View style={[styles.circleNode, { borderColor: colors.success, backgroundColor: colors.success, width: 16, height: 16, borderRadius: 8, borderWidth: 0, marginVertical: 2, justifyContent: 'center', alignItems: 'center' }]}>
                          <View style={{ backgroundColor: '#FFF', width: 6, height: 6, borderRadius: 3 }} />
                        </View>
                      ) : isPassed ? (
                        <View style={[styles.circleNode, { borderColor: colors.success, backgroundColor: colors.success, width: 12, height: 12, borderRadius: 6, borderWidth: 0 }]} />
                      ) : (
                        <View style={[styles.circleNode, { borderColor: colors.textMuted, backgroundColor: colors.surface, width: 12, height: 12, borderRadius: 6 }]} />
                      )}
                    </View>

                  {/* Right Column: Station Details Card */}
                  <View 
                    style={[
                      styles.timelineCard, 
                      { 
                        backgroundColor: isPassed ? (isDark ? '#0C0C0C' : '#F1F3F5') : colors.surface, 
                        borderColor: colors.border,
                        opacity: isPassed ? 0.6 : 1 
                      }
                    ]}
                  >
                    <View style={styles.cardHeaderRow}>
                      <Pressable 
                        onPress={() => !isSuppressed && handleStationPress(stop.stationName, stop.stationId)}
                        disabled={isSuppressed}
                        style={({ pressed }) => [
                          styles.stationPressable,
                          { opacity: pressed ? 0.7 : 1 }
                        ]}
                      >
                        <Text
                          style={[
                            styles.stationNameText,
                            { color: isSuppressed ? colors.textMuted : colors.primary, textDecorationLine: isSuppressed ? 'none' : 'underline' },
                            isSuppressed && { textDecorationLine: 'line-through' }
                          ]}
                          numberOfLines={1}
                        >
                          {stop.stationName}
                        </Text>
                      </Pressable>
                      {stopDelayText.length > 0 && !isSuppressed && (
                        <Text style={[styles.stopDelayText, { color: stopDelay > 0 ? colors.error : colors.success }]}>
                          {stopDelayText}
                        </Text>
                      )}
                    </View>

                    {isSuppressed && (
                      <View style={[styles.suppressedBadge, { backgroundColor: colors.error + '15' }]}>
                        <Text style={[styles.suppressedBadgeText, { color: colors.error }]}>
                          {t('stopStatusSuppressed')}
                        </Text>
                      </View>
                    )}

                    {!isSuppressed && (
                      <View style={styles.cardInfoGrid}>
                        {/* Time Slots */}
                        <View style={styles.infoCol}>
                          {!isFirst && (
                            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                              {t('stopArr')}: <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{arrTimes.sch}</Text>
                              {'  →  '}
                              <Text style={{ 
                                color: arrTimes.isDelayed ? colors.error : (arrTimes.isEarly ? colors.success : colors.textPrimary), 
                                fontWeight: '700' 
                              }}>
                                {arrTimes.act}
                              </Text>
                            </Text>
                          )}
                          {!isLast && (
                            <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                              {t('stopDep')}: <Text style={{ color: colors.textPrimary, fontWeight: '500' }}>{depTimes.sch}</Text>
                              {'  →  '}
                              <Text style={{ 
                                color: depTimes.isDelayed ? colors.error : (depTimes.isEarly ? colors.success : colors.textPrimary), 
                                fontWeight: '700' 
                              }}>
                                {depTimes.act}
                              </Text>
                            </Text>
                          )}
                        </View>

                        {/* Track/Platform */}
                        <View style={styles.trackCol}>
                          <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
                            {t('stopPlatform')}:{' '}
                            {platformInfo.hasChange ? (
                              <Text>
                                <Text style={{ textDecorationLine: 'line-through' }}>{platformInfo.scheduled}</Text>{' '}
                                <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>{platformInfo.actual}</Text>
                              </Text>
                            ) : (
                              <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                                {platformInfo.display || '--'}
                              </Text>
                            )}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            });
          })()}
          </View>
          <View style={styles.disclaimerContainer}>
            <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {t('disclaimer')}
            </Text>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 100,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  dashboardCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trainBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  trainNumText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  delayBadgeText: {
    fontSize: 13,
    flexShrink: 0,
  },
  endpointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  endpointCol: {
    flex: 2,
    overflow: 'hidden',
  },
  arrowCol: {
    flex: 1,
    alignItems: 'center',
  },
  endpointLabel: {
    fontSize: 10,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  endpointName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  endpointTime: {
    fontSize: 12,
  },
  newEndpointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  endpointIndicatorCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    width: 12,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  indicatorLine: {
    width: 1,
    height: 12,
    marginVertical: 2,
  },
  newEndpointsLeft: {
    flex: 1,
    marginRight: 16,
  },
  newEndpointsRight: {
    alignItems: 'flex-end',
    width: 100,
  },
  newEndpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newEndpointRoleLabel: {
    fontSize: 10,
    fontWeight: '600',
    width: 42,
  },
  newEndpointName: {
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  newTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  newTimeLabel: {
    fontSize: 10,
    marginRight: 8,
  },
  newTimeText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  lastReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  lastReportText: {
    fontSize: 11,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  timelineWrapper: {
    paddingLeft: 4,
  },
  timelineNodeRow: {
    flexDirection: 'row',
    minHeight: 80,
  },
  timelineLeftCol: {
    alignItems: 'center',
    width: 24,
  },
  verticalLine: {
    width: 3,
  },
  circleNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  pulseInner: {
    // used inside active node
  },
  timelineCard: {
    flex: 1,
    marginLeft: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stationNameText: {
    fontSize: 14,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  stationPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  stopDelayText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  suppressedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  suppressedBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  cardInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoCol: {
    flex: 3,
  },
  trackCol: {
    flex: 2,
    alignItems: 'flex-end',
  },
  timeLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  theoreticalTimeText: {
    fontSize: 10,
  },
  alertsContainer: {
    width: '100%',
  },
  alertCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 5,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  alertText: {
    fontSize: 12,
    lineHeight: 18,
  },
  alertDate: {
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
  verticalLineContainer: {
    width: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  verticalLineProgress: {
    width: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCapsule: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 6,
  },
  dateCapsuleText: {
    fontSize: 10,
  },
  disclaimerContainer: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },
});

const ProgressBarLine = ({ progress, colors }: { progress: number; colors: any }) => {
  return (
    <View
      style={{
        position: 'absolute',
        top: 35,
        bottom: -35,
        left: 10.5,
        width: 3,
        backgroundColor: colors.border,
        overflow: 'hidden'
      }}
    >
      {progress > 0 && (
        <View
          style={{
            backgroundColor: colors.success,
            height: `${progress * 100}%`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        />
      )}
    </View>
  );
};
