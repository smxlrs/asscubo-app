import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Language } from '../../../context/ThemeContext';
import {
  getStationBoard,
  searchTrain,
  getOperatorInfo,
  getTrainStatus,
  VtBoardEntry,
  cleanPlatform
} from '../../../lib/viaggiaTrenoService';

const { width } = Dimensions.get('window');

const LOCALIZED: Record<Language, Record<string, string>> = {
  zh: {
    title: '车站大盘',
    departures: '出发',
    arrivals: '到达',
    loading: '正在获取大盘数据...',
    error: '获取大盘数据失败，请重试。',
    noTrains: '当前时段内暂无列车信息',
    platform: '站台',
    delay: '晚点',
    onTime: '正点',
    cancelled: '已停运',
    refresh: '刷新',
    back: '返回',
    resolving: '正在解析车次...',
    noDetails: '无法获取该车次的详细运行信息。',
    disclaimer: '本服务展示的列车时刻、延误及站台等数据均来自意大利铁路公开实时运营信息，仅供出行参考。实际运行请以车站大屏幕及官方购票App（Trenitalia / Italo）实时公告为准。'
  },
  'zh-Hant': {
    title: '車站大盤',
    departures: '出發',
    arrivals: '到達',
    loading: '正在獲取大盤數據...',
    error: '獲取大盤數據失敗，請重試。',
    noTrains: '當前時段內暫無列車資訊',
    platform: '站台',
    delay: '晚點',
    onTime: '正點',
    cancelled: '已停運',
    refresh: '刷新',
    back: '返回',
    resolving: '正在解析車次...',
    noDetails: '無法獲取該車次的詳細運行資訊。',
    disclaimer: '本服務展示的列車時刻、延誤及月台等數據均來自義大利鐵路公開即時營運資訊，僅供出行參考。實際運行請以車站大屏幕及鐵路官方App（Trenitalia / Italo）即時公告為準。'
  },
  en: {
    title: 'Station Board',
    departures: 'Departures',
    arrivals: 'Arrivals',
    loading: 'Loading station board...',
    error: 'Failed to load station board, please retry.',
    noTrains: 'No trains scheduled for this period',
    platform: 'Track',
    delay: 'Delay',
    onTime: 'On Time',
    cancelled: 'Cancelled',
    refresh: 'Refresh',
    back: 'Back',
    resolving: 'Resolving train...',
    noDetails: 'No details available for this train.',
    disclaimer: 'The train schedules, delays, and platform info displayed here are retrieved from Italian rail public live data and are for reference only. Please refer to station screens and official apps for actual operations.'
  },
  it: {
    title: 'Tabellone Stazione',
    departures: 'Partenze',
    arrivals: 'Arrivi',
    loading: 'Caricamento tabellone...',
    error: 'Impossibile caricare i dati, riprova.',
    noTrains: 'Nessun treno in programmazione',
    platform: 'Binario',
    delay: 'Ritardo',
    onTime: 'In Orario',
    cancelled: 'Cancellato',
    refresh: 'Aggiorna',
    back: 'Indietro',
    resolving: 'Verifica treno...',
    noDetails: 'Dettagli non disponibili per questo treno.',
    disclaimer: 'Gli orari, ritardi e binari dei treni mostrati sono tratti dai dati pubblici in tempo reale delle ferrovie italiane e hanno valore puramente informativo. Fare riferimento ai tabelloni di stazione e alle app ufficiali per l\'operatività reale.'
  }
};

const matchPlatformFromStatus = (status: any, targetStationID: string) => {
  if (!status || !status.stops || !targetStationID) return null;
  const clean = (id: string) => String(id || '').trim().replace(/^S/i, '').replace(/^0+/, '');
  const targetClean = clean(targetStationID);
  
  const stop = status.stops.find((s: any) => clean(s.stationId) === targetClean);
  if (stop) {
    return {
      scheduledPlatform: stop.scheduledPlatform || '',
      actualPlatform: stop.actualPlatform || ''
    };
  }
  return null;
};

const normalizePlatform = (p: string) => {
  return cleanPlatform(p).toUpperCase();
};

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

export default function StationBoardScreen() {
  const { colors, language } = useTheme();
  
  // Local params
  const { stationID, stationName, mode } = useLocalSearchParams<{
    stationID: string;
    stationName: string;
    mode: 'departures' | 'arrivals';
  }>();

  // Localizer
  const t = (key: string) => {
    return LOCALIZED[language]?.[key] || LOCALIZED['en']?.[key] || key;
  };

  const [boardMode, setBoardMode] = useState<'departures' | 'arrivals'>(mode || 'departures');
  const [trains, setTrains] = useState<VtBoardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resolvingTrain, setResolvingTrain] = useState(false);
  const [isStarred, setIsStarred] = useState(false);

  // States for background back-filling of missing endpoint times
  const [extraTrainTimes, setExtraTrainTimes] = useState<Record<string, { departureTime: number; arrivalTime: number; scheduledPlatform: string; actualPlatform: string }>>({});
  const extraTimesCache = useRef<Record<string, { departureTime: number; arrivalTime: number; scheduledPlatform: string; actualPlatform: string }>>({});

  const FAVORITE_STATIONS_KEY = '@ag_favorite_stations';

  useEffect(() => {
    fetchData();
    checkStarredStatus();
  }, [boardMode, stationID]);

  const checkStarredStatus = async () => {
    if (!stationID) return;
    try {
      const favsJson = await AsyncStorage.getItem(FAVORITE_STATIONS_KEY);
      const favs = favsJson ? JSON.parse(favsJson) : [];
      const starred = favs.some((f: any) => String(f.id) === String(stationID));
      setIsStarred(starred);
    } catch (e) {
      console.warn('Failed to check station star status:', e);
    }
  };

  const toggleStar = async () => {
    if (!stationID || !stationName) return;
    try {
      const favsJson = await AsyncStorage.getItem(FAVORITE_STATIONS_KEY);
      let favs = favsJson ? JSON.parse(favsJson) : [];
      const isAlreadyStarred = favs.some((f: any) => String(f.id) === String(stationID));
      
      if (isAlreadyStarred) {
        favs = favs.filter((f: any) => String(f.id) !== String(stationID));
      } else {
        const stationItem = {
          id: stationID,
          name: stationName
        };
        favs = [stationItem, ...favs];
      }
      
      await AsyncStorage.setItem(FAVORITE_STATIONS_KEY, JSON.stringify(favs));
      setIsStarred(!isAlreadyStarred);
    } catch (e) {
      console.warn('Failed to toggle station star:', e);
    }
  };

  const fetchData = async (isRef = false) => {
    if (!stationID) return;
    if (!isRef) setLoading(true);
    setErrorMsg('');
    try {
      const data = await getStationBoard(stationID, boardMode);
      setTrains(data);
      triggerBackgroundTimeLoading(data);
    } catch (e) {
      setErrorMsg(t('error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const triggerBackgroundTimeLoading = (boardEntries: VtBoardEntry[]) => {
    const loadTimes = async () => {
      for (const entry of boardEntries) {
        if (!entry.trainNumber || !entry.originStationID || !entry.timestamp) continue;
        const cacheKey = `${entry.trainNumber}_${entry.originStationID}_${entry.timestamp}`;
        if (extraTimesCache.current[cacheKey]) continue;

        try {
          const status = await getTrainStatus(entry.originStationID, entry.trainNumber, String(entry.timestamp));
          if (status) {
            const platforms = matchPlatformFromStatus(status, stationID || '');
            const timeObj = {
              departureTime: status.scheduledDepartureTime,
              arrivalTime: status.scheduledArrivalTime,
              scheduledPlatform: platforms?.scheduledPlatform || '',
              actualPlatform: platforms?.actualPlatform || ''
            };
            extraTimesCache.current[cacheKey] = timeObj;
            setExtraTrainTimes(prev => ({
              ...prev,
              [cacheKey]: timeObj
            }));
          }
        } catch (err) {
          console.warn(`Failed to fetch extra times for train ${entry.trainNumber}:`, err);
        }
      }
    };
    loadTimes();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(true);
  };

  const handleTrainPress = async (entry: VtBoardEntry) => {
    if (resolvingTrain) return;
    setResolvingTrain(true);
    try {
      const matches = await searchTrain(entry.trainNumber);
      if (matches.length === 0) {
        Alert.alert(t('title'), t('noDetails'));
      } else if (matches.length === 1) {
        router.push({
          pathname: '/tools/train/train-status',
          params: {
            trainNumber: matches[0].number,
            departureStationID: matches[0].departureStationID,
            timestamp: matches[0].timestamp
          }
        });
      } else {
        // Find match where label matches either origin or destination endpoints
        const endpoint = boardMode === 'departures' ? entry.destination : entry.origin;
        const matched = matches.find(
          m => m.label.toLowerCase().includes(endpoint.toLowerCase())
        ) || matches[0];
        
        router.push({
          pathname: '/tools/train/train-status',
          params: {
            trainNumber: matched.number,
            departureStationID: matched.departureStationID,
            timestamp: matched.timestamp
          }
        });
      }
    } catch (err) {
      Alert.alert(t('title'), t('noDetails'));
    } finally {
      setResolvingTrain(false);
    }
  };

  const formatTimeStr = (timestamp: number) => {
    if (!timestamp) return '--:--';
    try {
      const date = new Date(timestamp);
      return `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
      ).padStart(2, '0')}`;
    } catch (e) {
      return '--:--';
    }
  };

  const renderTrainItem = ({ item }: { item: VtBoardEntry }) => {
    const timeStr = formatTimeStr(item.scheduledTime);
    
    // Delay text color & content
    let delayColor = colors.textSecondary;
    let delayText = t('onTime');
    if (item.isCancelled) {
      delayColor = colors.error;
      delayText = t('cancelled');
    } else if (item.delay > 0) {
      delayColor = colors.error;
      delayText = `+${item.delay}'`;
    } else if (item.delay < 0) {
      delayColor = colors.success;
      delayText = `${item.delay}'`;
    }

    const cacheKey = `${item.trainNumber}_${item.originStationID}_${item.timestamp}`;
    const extraTime = extraTrainTimes[cacheKey];

    const scheduledPlatform = item.scheduledPlatform || extraTime?.scheduledPlatform || '';
    const actualPlatform = item.actualPlatform || extraTime?.actualPlatform || '';

    // Platform track changes
    const platformInfo = getPlatformDisplayInfo(scheduledPlatform, actualPlatform);

    // Operator branding details
    const op = getOperatorInfo(item.codiceCliente, item.category);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.trainCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1
          }
        ]}
        onPress={() => handleTrainPress(item)}
      >
        <View style={[styles.cardMain, { marginBottom: 0 }]}>
          <View style={styles.trainInfo}>
            {/* Operator and Train number row */}
            <View style={styles.trainBadgeRow}>
              <View style={[styles.opCodeBadge, { borderColor: op.color, backgroundColor: op.color + '10' }]}>
                <Text style={[styles.opCodeText, { color: op.color }]}>{op.code}</Text>
              </View>
              <Text style={[styles.trainNumCategoryText, { color: colors.textPrimary }]}>
                {item.category} {item.trainNumber}
              </Text>
            </View>

            {/* Structured timeline routes origin/destination */}
            <View style={styles.boardTimeline}>
              {(() => {
                return boardMode === 'departures' ? (
                  <>
                    <View style={styles.boardTimelineStep}>
                      <View style={[styles.timelineMiniDot, { backgroundColor: op.color }]} />
                      <Text style={[styles.timelineMiniTime, { color: colors.textPrimary }]}>{timeStr}</Text>
                      <Text style={[styles.timelineMiniStation, { color: colors.textSecondary }]} numberOfLines={1}>
                        {stationName || '此站'} (出发)
                      </Text>
                    </View>
                    <View style={[styles.timelineMiniLine, { backgroundColor: colors.border }]} />
                    <View style={styles.boardTimelineStep}>
                      <View style={[styles.timelineMiniDot, { borderColor: op.color, borderWidth: 1.5, backgroundColor: 'transparent' }]} />
                      <Text style={[styles.timelineMiniTime, { color: colors.textMuted }]}>
                        {extraTime ? formatTimeStr(extraTime.arrivalTime) : '--:--'}
                      </Text>
                      <Text style={[styles.timelineMiniStation, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.destination}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.boardTimelineStep}>
                      <View style={[styles.timelineMiniDot, { backgroundColor: op.color }]} />
                      <Text style={[styles.timelineMiniTime, { color: colors.textMuted }]}>
                        {item.originDepartureTime ? formatTimeStr(item.originDepartureTime) : (extraTime ? formatTimeStr(extraTime.departureTime) : '--:--')}
                      </Text>
                      <Text style={[styles.timelineMiniStation, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.origin || '始发站'}
                      </Text>
                    </View>
                    <View style={[styles.timelineMiniLine, { backgroundColor: colors.border }]} />
                    <View style={styles.boardTimelineStep}>
                      <View style={[styles.timelineMiniDot, { borderColor: op.color, borderWidth: 1.5, backgroundColor: 'transparent' }]} />
                      <Text style={[styles.timelineMiniTime, { color: colors.textPrimary }]}>{timeStr}</Text>
                      <Text style={[styles.timelineMiniStation, { color: colors.textSecondary }]} numberOfLines={1}>
                        {stationName || '此站'} (到达)
                      </Text>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>

          {/* Delay Badge & Platform */}
          <View style={styles.cardRight}>
            {(actualPlatform !== '' || scheduledPlatform !== '') ? (
              <View style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="train" size={13} color={colors.textSecondary} style={{ marginRight: 2 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {t('platform')}:{' '}
                  {platformInfo.hasChange ? (
                    <Text>
                      <Text style={{ textDecorationLine: 'line-through' }}>{platformInfo.scheduled}</Text>{' '}
                      <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>{platformInfo.actual}</Text>
                    </Text>
                  ) : (
                    <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>
                      {platformInfo.display}
                    </Text>
                  )}
                </Text>
              </View>
            ) : (
              <View style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="train" size={13} color={colors.textSecondary} style={{ marginRight: 2 }} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {t('platform')}: <Text style={{ color: colors.textMuted }}>--</Text>
                </Text>
              </View>
            )}

            <View style={[styles.delayPill, { backgroundColor: delayColor + '15' }]}>
              <Text style={[styles.delayText, { color: delayColor, fontWeight: 'bold' }]}>
                {delayText}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (trains.length === 0) return null;
    return (
      <View style={styles.disclaimerContainer}>
        <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
          {t('disclaimer')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {stationName || t('title')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {stationID && (
            <Pressable onPress={toggleStar} style={styles.backButton}>
              <MaterialIcons
                name={isStarred ? "star" : "star-border"}
                size={24}
                color={isStarred ? "#EAB308" : colors.textPrimary}
              />
            </Pressable>
          )}
          <Pressable onPress={handleRefresh} style={styles.backButton} disabled={refreshing || loading}>
            {refreshing || loading ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <MaterialIcons name="refresh" size={24} color={colors.textPrimary} />
            )}
          </Pressable>
        </View>
      </View>

      {/* Mode Selector */}
      <View style={[styles.modeSelector, { borderBottomColor: colors.border }]}>
        <Pressable
          style={[
            styles.modeTab,
            boardMode === 'departures' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setBoardMode('departures')}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: boardMode === 'departures' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('departures')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.modeTab,
            boardMode === 'arrivals' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
          onPress={() => setBoardMode('arrivals')}
        >
          <Text
            style={[
              styles.modeTabText,
              { color: boardMode === 'arrivals' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('arrivals')}
          </Text>
        </Pressable>
      </View>

      {/* Main List / Loader */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('loading')}</Text>
        </View>
      ) : errorMsg ? (
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
        <FlatList
          data={trains}
          keyExtractor={(item, index) => `${item.trainNumber}_${index}`}
          renderItem={renderTrainItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inbox" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('noTrains')}</Text>
            </View>
          }
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Resolving Train Loader Overlay */}
      {resolvingTrain && (
        <View style={styles.overlay}>
          <View style={[styles.overlayContent, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.overlayText, { color: colors.textPrimary }]}>{t('resolving')}</Text>
          </View>
        </View>
      )}
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
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modeSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  trainCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  trainInfo: {
    flex: 1,
  },
  trainBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  opCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
  },
  opCodeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  trainNumCategoryText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  boardTimeline: {
    marginTop: 6,
    paddingLeft: 4,
  },
  boardTimelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
  },
  timelineMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  timelineMiniTime: {
    fontSize: 11,
    fontWeight: '600',
    width: 42,
  },
  timelineMiniStation: {
    fontSize: 12,
    flex: 1,
  },
  timelineMiniLine: {
    width: 1,
    height: 6,
    marginLeft: 2.5,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
    justifyContent: 'center',
    paddingTop: 3,
  },
  delayPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delayText: {
    fontSize: 11,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    paddingTop: 80,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlayContent: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    elevation: 10,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  disclaimerContainer: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  }
});
