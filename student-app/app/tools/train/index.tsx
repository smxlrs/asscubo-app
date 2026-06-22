import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Dimensions,
  Linking,
  Modal,
  Animated
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Language } from '../../../context/ThemeContext';
import {
  searchTrain,
  getTrainStatus,
  getOperatorInfo,
  VtStation,
  VtTrainSearchMatch,
  VtTrainSummary,
  formatRomeTimeStr,
  formatRomeDateTimeFromTimestamp
} from '../../../lib/viaggiaTrenoService';
import { stations } from '../../../assets/stations';

const { width } = Dimensions.get('window');

const LOCALIZED: Record<Language, Record<string, string>> = {
  zh: {
    title: '意大利火车查询',
    tabTrain: '按车次查询',
    tabStation: '按车站查询',
    trainNumberPlaceholder: '请输入列车号，例如: 9604, 2235',
    stationPlaceholder: '搜索车站，例如: Bologna, Milano',
    searchButton: '搜索',
    recentSearches: '最近搜索',
    noRecent: '暂无历史记录',
    clearHistory: '清除历史',
    searching: '正在查询...',
    noTrainsFound: '未找到该车次的运行记录',
    departures: '实时出发看板',
    arrivals: '实时到达看板',
    selectStationHint: '请搜索并选择要查询的车站',
    departuresDesc: '查看该站所有始发/途经的出发列车状态与站台',
    arrivalsDesc: '查看该站所有终到/途经的到达列车状态与站台',
    selectStation: '选择车站',
    emptyList: '没有匹配的搜索结果',
    resultsTitle: '匹配的列车班次',
    selectTrainRunHint: '该车次有多个运行记录，请选择具体班次：',
    depTime: '始发时间',
    origin: '始发站',
    dest: '终到站',
    disclaimer: '本服务展示的列车时刻、延误及站台等数据均来自意大利铁路公开实时运营信息，仅供出行参考。实际运行请以车站大屏幕及官方购票App（Trenitalia / Italo）实时公告为准。'
  },
  'zh-Hant': {
    title: '意大利火車查詢',
    tabTrain: '按車次查詢',
    tabStation: '按車站查詢',
    trainNumberPlaceholder: '請輸入列車號，例如: 9604, 2235',
    stationPlaceholder: '搜索車站，例如: Bologna, Milano',
    searchButton: '搜索',
    recentSearches: '最近搜索',
    noRecent: '暫無歷史記錄',
    clearHistory: '清除歷史',
    searching: '正在查詢...',
    noTrainsFound: '未找到該車次的運行記錄',
    departures: '即時出發看板',
    arrivals: '即時到達看板',
    selectStationHint: '請搜索並選擇要查詢的車站',
    departuresDesc: '查看該站所有始發/途經的出發列車狀態與站台',
    arrivalsDesc: '查看該站所有終到/途經的到達列車狀態與站台',
    selectStation: '選擇車站',
    emptyList: '沒有匹配的搜索結果',
    resultsTitle: '匹配的列車班次',
    selectTrainRunHint: '該車次有多個運行記錄，請選擇具體班次：',
    depTime: '始發時間',
    origin: '始發站',
    dest: '終到站',
    disclaimer: '本服務展示的列車時刻、延誤及月台等數據均來自義大利鐵路公開即時營運資訊，僅供出行參考。實際運行請以車站大屏幕及鐵路官方App（Trenitalia / Italo）即時公告為準。'
  },
  en: {
    title: 'Italian Train Info',
    tabTrain: 'By Train No.',
    tabStation: 'By Station',
    trainNumberPlaceholder: 'Enter train number, e.g. 9604, 2235',
    stationPlaceholder: 'Search station, e.g. Bologna, Milano',
    searchButton: 'Search',
    recentSearches: 'Recent Searches',
    noRecent: 'No history',
    clearHistory: 'Clear History',
    searching: 'Searching...',
    noTrainsFound: 'No running schedule found for this train',
    departures: 'Live Departures',
    arrivals: 'Live Arrivals',
    selectStationHint: 'Please search and select a station',
    departuresDesc: 'View all departing and passing train statuses and tracks',
    arrivalsDesc: 'View all arriving and passing train statuses and tracks',
    selectStation: 'Select Station',
    emptyList: 'No matching stations found',
    resultsTitle: 'Matching train runs',
    selectTrainRunHint: 'This train has multiple runs today, select one:',
    depTime: 'Departure',
    origin: 'From',
    dest: 'To',
    disclaimer: 'The train schedules, delays, and platform info displayed here are retrieved from Italian rail public live data and are for reference only. Please refer to station screens and official apps for actual operations.'
  },
  it: {
    title: 'Stato e Orari Treni',
    tabTrain: 'Per Numero Treno',
    tabStation: 'Per Stazione',
    trainNumberPlaceholder: 'Inserisci numero treno, es. 9604, 2235',
    stationPlaceholder: 'Cerca stazione, es. Bologna, Milano',
    searchButton: 'Cerca',
    recentSearches: 'Ricerche Recenti',
    noRecent: 'Nessuna cronologia',
    clearHistory: 'Cancella Cronologia',
    searching: 'Ricerca in corso...',
    noTrainsFound: 'Nessun treno programmato trovato',
    departures: 'Partenze in Tempo Reale',
    arrivals: 'Arrivi in Tempo Reale',
    selectStationHint: 'Cerca e seleziona una stazione',
    departuresDesc: 'Visualizza lo stato e i binari di tutti i treni in partenza',
    arrivalsDesc: 'Visualizza lo stato e i binari di tutti i treni in arrivo',
    selectStation: 'Seleziona Stazione',
    emptyList: 'Nessuna stazione trovata',
    resultsTitle: 'Corse disponibili',
    selectTrainRunHint: 'Questo treno ha più corse oggi, selezionane una:',
    depTime: 'Partenza',
    origin: 'Da',
    dest: 'A',
    disclaimer: 'Disclaimer: Gli orari, ritardi e binari dei treni mostrati sono tratti dai dati pubblici in tempo reale delle ferrovie italiane e hanno valore puramente informativo. Fare riferimento ai tabelloni di stazione e alle app ufficiali per l\'operatività reale.'
  }
};


const RECENT_TRAINS_KEY = '@ag_recent_trains';
const RECENT_STATIONS_KEY = '@ag_recent_stations';

export default function TrainToolIndex() {
  const { colors, language } = useTheme();
  
  // Localizer
  const t = (key: string) => {
    return LOCALIZED[language]?.[key] || LOCALIZED['en']?.[key] || key;
  };

  const [activeTab, setActiveTab] = useState<'train' | 'station'>('train');
  const scrollViewRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const translateX = scrollX.interpolate({
    inputRange: [0, width],
    outputRange: [0, width / 2],
    extrapolate: 'clamp'
  });

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    if (page === 0 && activeTab !== 'train') {
      setActiveTab('train');
    } else if (page === 1 && activeTab !== 'station') {
      setActiveTab('station');
    }
  };

  // Train Tab State
  const [trainNo, setTrainNo] = useState('');
  const [loadingTrain, setLoadingTrain] = useState(false);
  const [trainMatches, setTrainMatches] = useState<(VtTrainSummary | VtTrainSearchMatch)[]>([]);
  const [recentTrains, setRecentTrains] = useState<(VtTrainSearchMatch | VtTrainSummary)[]>([]);
  const [trainError, setTrainError] = useState('');

  // Station Tab State
  const [stationInput, setStationInput] = useState('');
  const [selectedStation, setSelectedStation] = useState<VtStation | null>(null);
  const [stationMatches, setStationMatches] = useState<VtStation[]>([]);
  const [recentStations, setRecentStations] = useState<VtStation[]>([]);

  // Favorites state
  const [favoriteTrains, setFavoriteTrains] = useState<(VtTrainSummary | VtTrainSearchMatch)[]>([]);
  const [favoriteStations, setFavoriteStations] = useState<VtStation[]>([]);

  const FAVORITE_TRAINS_KEY = '@ag_favorite_trains';
  const FAVORITE_STATIONS_KEY = '@ag_favorite_stations';
  const RECENT_TRAINS_KEY = '@ag_recent_trains';
  const RECENT_STATIONS_KEY = '@ag_recent_stations';

  // Load Search History and Favorites on mount & focus
  useFocusEffect(
    React.useCallback(() => {
      loadHistory();
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      const favTrainsJson = await AsyncStorage.getItem(FAVORITE_TRAINS_KEY);
      const favStationsJson = await AsyncStorage.getItem(FAVORITE_STATIONS_KEY);
      if (favTrainsJson) setFavoriteTrains(JSON.parse(favTrainsJson));
      if (favStationsJson) setFavoriteStations(JSON.parse(favStationsJson));
    } catch (e) {
      console.warn('Error loading train favorites:', e);
    }
  };

  const toggleTrainStarDirectly = async (item: VtTrainSummary | VtTrainSearchMatch) => {
    try {
      const favsJson = await AsyncStorage.getItem(FAVORITE_TRAINS_KEY);
      let favs: any[] = favsJson ? JSON.parse(favsJson) : [];
      const isAlreadyStarred = favs.some(f => String(f.number) === String(item.number));
      
      if (isAlreadyStarred) {
        favs = favs.filter(f => String(f.number) !== String(item.number));
      } else {
        const isFullSummary = 'origin' in item && item.origin;
        const summary = isFullSummary ? item : {
          number: item.number,
          category: (item as any).category || '',
          origin: '',
          destination: '',
          scheduledDepartureTime: 0,
          scheduledArrivalTime: 0,
          departureStationID: item.departureStationID,
          timestamp: item.timestamp,
          codiceCliente: (item as any).codiceCliente || null
        };
        favs = [summary, ...favs];
      }
      
      await AsyncStorage.setItem(FAVORITE_TRAINS_KEY, JSON.stringify(favs));
      setFavoriteTrains(favs);
    } catch (e) {
      console.warn(e);
    }
  };

  const toggleStationStarDirectly = async (item: VtStation) => {
    try {
      const favsJson = await AsyncStorage.getItem(FAVORITE_STATIONS_KEY);
      let favs: any[] = favsJson ? JSON.parse(favsJson) : [];
      const isAlreadyStarred = favs.some(f => String(f.id) === String(item.id));
      
      if (isAlreadyStarred) {
        favs = favs.filter(f => String(f.id) !== String(item.id));
      } else {
        favs = [item, ...favs];
      }
      
      await AsyncStorage.setItem(FAVORITE_STATIONS_KEY, JSON.stringify(favs));
      setFavoriteStations(favs);
    } catch (e) {
      console.warn(e);
    }
  };

  const formatUnixTime = (unixMs: number) => {
    return formatRomeTimeStr(unixMs);
  };

  const renderTrainCard = (item: VtTrainSummary | VtTrainSearchMatch) => {
    const isFullSummary = 'origin' in item && item.origin;
    
    // Resolve operator details
    const op = getOperatorInfo(
      (item as any).codiceCliente, 
      (item as any).category || ''
    );
    
    const starred = favoriteTrains.some(f => String(f.number) === String(item.number));
    
    // Format times if available
    const depTimeStr = isFullSummary ? formatUnixTime((item as any).scheduledDepartureTime) : '';
    const arrTimeStr = isFullSummary ? formatUnixTime((item as any).scheduledArrivalTime) : '';

    return (
      <View 
        key={item.number + '_' + item.timestamp}
        style={[styles.trainCardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={() => handleSelectTrainMatch(item)}
        >
          <View style={styles.trainCardHeader}>
            <View style={styles.operatorBadgeRow}>
              <View style={[styles.opCodeBadge, { borderColor: op.color, backgroundColor: op.color + '10' }]}>
                <Text style={[styles.opCodeText, { color: op.color }]}>{op.code}</Text>
              </View>
              <Text style={[styles.trainNumCategoryText, { color: colors.textPrimary }]}>
                {((item as any).category && (item as any).category.toUpperCase() !== op.code.toUpperCase()) ? `${(item as any).category} ` : ''}
                {item.number}
              </Text>
            </View>
          </View>

          {isFullSummary ? (
            <View style={styles.timelineContainer}>
              <View style={styles.timelineIndicatorColumn}>
                <View style={[styles.timelineDot, { backgroundColor: op.color }]} />
                <View style={[styles.timelineLinkLine, { backgroundColor: colors.border }]} />
                <View style={[styles.timelineDot, { borderColor: op.color, borderWidth: 1.5, backgroundColor: 'transparent' }]} />
              </View>
              <View style={styles.timelineDetailsColumn}>
                <View style={styles.timelineStep}>
                  <Text style={[styles.timelineTime, { color: colors.textPrimary }]}>{depTimeStr}</Text>
                  <Text style={[styles.timelineStation, { color: colors.textSecondary }]} numberOfLines={1}>
                    {(item as any).origin}
                  </Text>
                </View>
                <View style={[styles.timelineStep, { marginTop: 6 }]}>
                  <Text style={[styles.timelineTime, { color: colors.textPrimary }]}>{arrTimeStr}</Text>
                  <Text style={[styles.timelineStation, { color: colors.textSecondary }]} numberOfLines={1}>
                    {(item as any).destination}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={[styles.trainLabelText, { color: colors.textSecondary }]}>
              {(item as any).label}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => toggleTrainStarDirectly(item)}
          style={styles.starIconContainer}
        >
          <MaterialIcons
            name={starred ? "star" : "star-border"}
            size={24}
            color={starred ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
    );
  };

  const renderStationCard = (item: VtStation) => {
    const starred = favoriteStations.some(f => String(f.id) === String(item.id));
    
    return (
      <View 
        key={item.id}
        style={[styles.stationCardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Pressable
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 48 }}
          onPress={() => handleSelectStation(item)}
        >
          <MaterialIcons name="place" size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
          <Text style={[styles.stationCardNameText, { color: colors.textPrimary }]}>
            {item.name}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggleStationStarDirectly(item)}
          style={styles.starIconContainer}
        >
          <MaterialIcons
            name={starred ? "star" : "star-border"}
            size={24}
            color={starred ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
    );
  };

  const getStationMatchesForInput = (input: string) => {
    if (!input.trim()) return [];
    const query = input.trim().toLowerCase();
    
    // Resolve Chinese city aliases
    let searchKey = query;
    const CHINESE_CITY_MAPPINGS: Record<string, string> = {
      '米兰': 'milano',
      '米': 'milano',
      '罗马': 'roma',
      '博洛尼亚': 'bologna',
      '博大': 'bologna',
      '都灵': 'torino',
      '佛罗伦萨': 'firenze',
      '威尼斯': 'venezia',
      '那不勒斯': 'napoli',
      '热那亚': 'genova',
      '比萨': 'pisa',
      '巴里': 'bari',
      '拉文纳': 'ravenna',
      '里米尼': 'rimini',
      '帕多瓦': 'padova',
      '维罗纳': 'verona',
      '锡耶纳': 'siena',
      '帕尔马': 'parma',
      '摩德纳': 'modena',
    };
    for (const [zh, it] of Object.entries(CHINESE_CITY_MAPPINGS)) {
      if (searchKey === zh || searchKey.includes(zh)) {
        searchKey = it;
        break;
      }
    }

    const localMatches = stations.filter(s => s.n.toLowerCase().includes(searchKey));
    const scored = localMatches.map(s => {
      const nameLower = s.n.toLowerCase();
      let score = 0;
      if (nameLower.startsWith(searchKey)) {
        score += 1000;
      }
      score += (s.p || 0) * 100;
      score -= s.n.length;
      return { station: s, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map(item => ({
      name: item.station.n,
      id: item.station.id
    }));
  };

  const loadHistory = async () => {
    try {
      const trainsJson = await AsyncStorage.getItem(RECENT_TRAINS_KEY);
      const stationsJson = await AsyncStorage.getItem(RECENT_STATIONS_KEY);
      if (trainsJson) setRecentTrains(JSON.parse(trainsJson));
      if (stationsJson) setRecentStations(JSON.parse(stationsJson));
    } catch (e) {
      console.warn('Error loading train search history:', e);
    }
  };

  // Autocomplete local station filter
  useEffect(() => {
    setStationMatches(getStationMatchesForInput(stationInput));
  }, [stationInput]);

  // Handle train number query
  const handleTrainSearch = async () => {
    Keyboard.dismiss();
    const cleanNum = trainNo.trim();
    if (!cleanNum) return;

    setLoadingTrain(true);
    setTrainError('');
    setTrainMatches([]);

    try {
      const rawResults = await searchTrain(cleanNum);
      if (rawResults.length === 0) {
        setTrainError(t('noTrainsFound'));
      } else {
        // Resolve status for all runs in parallel
        const resolved = await Promise.all(
          rawResults.map(async (match) => {
            try {
              const status = await getTrainStatus(match.departureStationID, match.number, match.timestamp);
              if (status) {
                return {
                  ...match,
                  category: status.category || '',
                  origin: status.origin,
                  destination: status.destination,
                  scheduledDepartureTime: status.scheduledDepartureTime,
                  scheduledArrivalTime: status.scheduledArrivalTime,
                  delay: status.delay,
                  isCancelled: status.isCancelled,
                  codiceCliente: status.codiceCliente || null,
                  isRunning: !status.isCancelled && 
                    Date.now() >= status.scheduledDepartureTime && 
                    Date.now() <= (status.scheduledArrivalTime + (status.delay || 0) * 60000)
                };
              }
            } catch (e) {
              console.warn('Failed to resolve status for search match:', match, e);
            }
            return match; // Fallback to raw match
          })
        );

        // Group by number and departureStationID to deduplicate different dates
        const groups: Record<string, typeof resolved> = {};
        for (const item of resolved) {
          const key = `${item.number}_${item.departureStationID}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        }

        // Deduplicate each group: prioritize running, then resolved, then newest
        const dedupedResults = Object.values(groups).map(group => {
          if (group.length === 1) return group[0];
          const sorted = [...group].sort((a, b) => {
            const aIsRunning = 'isRunning' in a && (a as any).isRunning;
            const bIsRunning = 'isRunning' in b && (b as any).isRunning;
            if (aIsRunning && !bIsRunning) return -1;
            if (!aIsRunning && bIsRunning) return 1;

            const aIsFull = 'origin' in a && (a as any).origin;
            const bIsFull = 'origin' in b && (b as any).origin;
            if (aIsFull && !bIsFull) return -1;
            if (!aIsFull && bIsFull) return 1;

            const tA = parseInt(a.timestamp, 10) || 0;
            const tB = parseInt(b.timestamp, 10) || 0;
            return tB - tA;
          });
          return sorted[0];
        });

        if (dedupedResults.length === 1) {
          // Exactly 1 result: directly go to status details
          const match = dedupedResults[0];
          saveTrainToHistory(match);
          router.push({
            pathname: '/tools/train/train-status',
            params: {
              trainNumber: match.number,
              departureStationID: match.departureStationID,
              timestamp: match.timestamp
            }
          });
        } else {
          // Sort results: prioritize full summaries and newer runs
          const sorted = [...dedupedResults].sort((a, b) => {
            const tA = parseInt(a.timestamp, 10) || 0;
            const tB = parseInt(b.timestamp, 10) || 0;
            return tB - tA;
          });
          setTrainMatches(sorted);
        }
      }
    } catch (err) {
      setTrainError(t('noTrainsFound'));
    } finally {
      setLoadingTrain(false);
    }
  };

  const handleSelectTrainMatch = (match: VtTrainSearchMatch | VtTrainSummary) => {
    saveTrainToHistory(match);
    router.push({
      pathname: '/tools/train/train-status',
      params: {
        trainNumber: match.number,
        departureStationID: match.departureStationID,
        timestamp: match.timestamp
      }
    });
  };

  const saveTrainToHistory = async (train: VtTrainSearchMatch | VtTrainSummary) => {
    try {
      // Filter out duplicate
      const filtered = recentTrains.filter(
        t => !(t.number === train.number && t.departureStationID === train.departureStationID)
      );
      const updated = [train, ...filtered].slice(0, 5);
      setRecentTrains(updated);
      await AsyncStorage.setItem(RECENT_TRAINS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
  };

  const saveStationToHistory = async (station: VtStation) => {
    try {
      const filtered = recentStations.filter(s => s.id !== station.id);
      const updated = [station, ...filtered].slice(0, 5);
      setRecentStations(updated);
      await AsyncStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
  };

  const clearTrainHistory = async () => {
    setRecentTrains([]);
    await AsyncStorage.removeItem(RECENT_TRAINS_KEY);
  };

  const clearStationHistory = async () => {
    setRecentStations([]);
    await AsyncStorage.removeItem(RECENT_STATIONS_KEY);
  };

  const handleSelectStation = (station: VtStation) => {
    Keyboard.dismiss();
    saveStationToHistory(station);
    setStationInput('');
    setStationMatches([]);
    router.push({
      pathname: '/tools/train/station-board',
      params: {
        stationID: station.id,
        stationName: station.name,
        mode: 'departures'
      }
    });
  };

  const navigateToBoard = (mode: 'departures' | 'arrivals') => {
    if (!selectedStation) return;
    router.push({
      pathname: '/tools/train/station-board',
      params: {
        stationID: selectedStation.id,
        stationName: selectedStation.name,
        mode
      }
    });
  };

  const formatUnixDate = (timestampStr: string) => {
    if (!timestampStr) return '';
    const val = parseInt(timestampStr, 10);
    if (isNaN(val)) return '';
    return formatRomeDateTimeFromTimestamp(val);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            setActiveTab('train');
            setTrainError('');
            scrollViewRef.current?.scrollTo({ x: 0, animated: true });
          }}
          style={styles.tab}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'train' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('tabTrain')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setActiveTab('station');
            setTrainError('');
            scrollViewRef.current?.scrollTo({ x: width, animated: true });
          }}
          style={styles.tab}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'station' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('tabStation')}
          </Text>
        </Pressable>

        {/* Sliding Indicator */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: width / 2,
            height: 2,
            backgroundColor: colors.primary,
            transform: [{ translateX }]
          }}
        />
      </View>

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ width: width * 2 }}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: true,
            listener: (event: any) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const page = Math.round(offsetX / width);
              if (page === 0 && activeTab !== 'train') {
                setActiveTab('train');
              } else if (page === 1 && activeTab !== 'station') {
                setActiveTab('station');
              }
            }
          }
        )}
      >
        {/* Page 1: Train Search */}
        <View style={{ width: width, flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.searchBox}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={t('trainNumberPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={trainNo}
                  onChangeText={setTrainNo}
                  keyboardType="numeric"
                  onSubmitEditing={handleTrainSearch}
                  returnKeyType="search"
                />
                {trainNo.length > 0 && (
                  <Pressable onPress={() => setTrainNo('')} style={styles.clearInputBtn}>
                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
              <Pressable
                onPress={handleTrainSearch}
                style={({ pressed }) => [
                  styles.searchButton,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }
                ]}
              >
                <MaterialIcons name="search" size={22} color="#FFF" />
              </Pressable>
            </View>

            {loadingTrain && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('searching')}</Text>
              </View>
            )}

            {trainError.length > 0 && !loadingTrain && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={24} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{trainError}</Text>
              </View>
            )}

            {/* Multiple matches results */}
            {trainMatches.length > 0 && !loadingTrain && (
              <View style={styles.resultsWrapper}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('resultsTitle')}</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('selectTrainRunHint')}</Text>
                {trainMatches.map((item) => renderTrainCard(item))}
              </View>
            )}

            {/* Starred Trains */}
            {favoriteTrains.length > 0 && !loadingTrain && trainMatches.length === 0 && (
              <View style={styles.historyWrapper}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>已收藏车次</Text>
                </View>
                {favoriteTrains.map((item) => renderTrainCard(item))}
              </View>
            )}

            {/* Recent Trains History */}
            {recentTrains.length > 0 && !loadingTrain && trainMatches.length === 0 && (
              <View style={[styles.historyWrapper, { marginTop: favoriteTrains.length > 0 ? 16 : 10 }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('recentSearches')}</Text>
                  <Pressable onPress={clearTrainHistory}>
                    <Text style={[styles.clearBtnText, { color: colors.primary }]}>{t('clearHistory')}</Text>
                  </Pressable>
                </View>
                {recentTrains.map((item) => renderTrainCard(item))}
              </View>
            )}

            <View style={styles.disclaimerContainer}>
              <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
                {t('disclaimer')}
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* Page 2: Station Boards */}
        <View style={{ width: width, flex: 1 }}>
          <View style={[styles.searchBox, { paddingHorizontal: 16, paddingTop: 16 }]}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="train" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder={t('stationPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={stationInput}
                onChangeText={txt => {
                  setStationInput(txt);
                  if (selectedStation && txt !== selectedStation.name) {
                    setSelectedStation(null);
                  }
                }}
                returnKeyType="done"
              />
              {stationInput.length > 0 && (
                <Pressable
                  onPress={() => {
                    setStationInput('');
                    setSelectedStation(null);
                  }}
                  style={styles.clearInputBtn}
                >
                  <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Autocomplete Dropdown List */}
          {stationMatches.length > 0 && (
            <View style={[styles.autocompleteContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FlatList
                data={stationMatches}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.autocompleteItem,
                      { borderBottomColor: colors.border, backgroundColor: pressed ? colors.border + '30' : 'transparent' }
                    ]}
                    onPress={() => handleSelectStation(item)}
                  >
                    <MaterialIcons name="place" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                    <Text style={[styles.autocompleteText, { color: colors.textPrimary }]}>{item.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Action Buttons if Station Selected */}
            {selectedStation ? (
              <View style={styles.actionContainer}>
                <View style={[styles.selectedStationCard, { backgroundColor: colors.surface, borderColor: colors.primary + '30' }]}>
                  <MaterialIcons name="check-circle" size={22} color={colors.success} style={{ marginRight: 8 }} />
                  <Text style={[styles.selectedStationName, { color: colors.textPrimary }]}>
                    {selectedStation.name}
                  </Text>
                </View>

                {/* Departures */}
                <Pressable
                  onPress={() => navigateToBoard('departures')}
                  style={({ pressed }) => [
                    styles.actionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1
                    }
                  ]}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: '#E30613' + '15' }]}>
                    <MaterialIcons name="launch" size={24} color="#E30613" />
                  </View>
                  <View style={styles.actionCardText}>
                    <Text style={[styles.actionCardTitle, { color: colors.textPrimary }]}>
                      {t('departures')}
                    </Text>
                    <Text style={[styles.actionCardDesc, { color: colors.textSecondary }]}>
                      {t('departuresDesc')}
                    </Text>
                  </View>
                  <MaterialIcons name="keyboard-arrow-right" size={24} color={colors.textSecondary} />
                </Pressable>

                {/* Arrivals */}
                <Pressable
                  onPress={() => navigateToBoard('arrivals')}
                  style={({ pressed }) => [
                    styles.actionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1
                    }
                  ]}
                >
                  <View style={[styles.actionIconBg, { backgroundColor: '#10B981' + '15' }]}>
                    <MaterialIcons name="login" size={24} color="#10B981" />
                  </View>
                  <View style={styles.actionCardText}>
                    <Text style={[styles.actionCardTitle, { color: colors.textPrimary }]}>
                      {t('arrivals')}
                    </Text>
                    <Text style={[styles.actionCardDesc, { color: colors.textSecondary }]}>
                      {t('arrivalsDesc')}
                    </Text>
                  </View>
                  <MaterialIcons name="keyboard-arrow-right" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              /* Hint if no station selected */
              <View style={styles.hintContainer}>
                <MaterialIcons name="info-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>
                  {t('selectStationHint')}
                </Text>
              </View>
            )}

            {/* Starred Stations */}
            {favoriteStations.length > 0 && !selectedStation && stationMatches.length === 0 && (
              <View style={styles.historyWrapper}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>已收藏车站</Text>
                </View>
                {favoriteStations.map((item) => renderStationCard(item))}
              </View>
            )}

            {/* Recent Stations History */}
            {recentStations.length > 0 && !selectedStation && stationMatches.length === 0 && (
              <View style={[styles.historyWrapper, { marginTop: favoriteStations.length > 0 ? 16 : 10 }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('recentSearches')}</Text>
                  <Pressable onPress={clearStationHistory}>
                    <Text style={[styles.clearBtnText, { color: colors.primary }]}>{t('clearHistory')}</Text>
                  </Pressable>
                </View>
                {recentStations.map((item) => renderStationCard(item))}
              </View>
            )}

            <View style={styles.disclaimerContainer}>
              <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
                {t('disclaimer')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Animated.ScrollView>

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
    fontSize: 19,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  clearInputBtn: {
    padding: 6,
  },
  searchButton: {
    marginLeft: 12,
    height: 48,
    width: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  statusText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EF444410',
    marginBottom: 20,
  },
  errorText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  autocompleteContainer: {
    position: 'absolute',
    top: 76,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 250,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  autocompleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  autocompleteText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 10,
  },
  selectedStationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectedStationName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionCardText: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  actionCardDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  hintContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  hintText: {
    marginTop: 14,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  historyWrapper: {
    marginTop: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyItemSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  resultsWrapper: {
    marginTop: 10,
  },
  matchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  matchCardTrainNum: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  matchCardTime: {
    fontSize: 11,
  },
  matchCardEndpoints: {
    fontSize: 13,
    fontWeight: '500',
  },
  trainCardItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  trainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  operatorBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  timelineContainer: {
    flexDirection: 'row',
    marginTop: 8,
    paddingLeft: 4,
  },
  timelineIndicatorColumn: {
    alignItems: 'center',
    width: 12,
    marginRight: 8,
    paddingTop: 4,
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineLinkLine: {
    width: 1,
    height: 12,
    marginVertical: 2,
  },
  timelineDetailsColumn: {
    flex: 1,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: '600',
    width: 42,
  },
  timelineStation: {
    fontSize: 12,
    flex: 1,
  },
  trainLabelText: {
    fontSize: 13,
    marginTop: 4,
  },
  starIconContainer: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  stationCardItem: {
    borderRadius: 16,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  stationCardNameText: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  disclaimerContainer: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
  },

});