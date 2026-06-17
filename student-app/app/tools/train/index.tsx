import React, { useState, useEffect, useMemo } from 'react';
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
  Modal
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Language } from '../../../context/ThemeContext';
import {
  searchStations,
  searchTrain,
  getOperatorInfo,
  getStationBoard,
  getTrainStatus,
  VtStation,
  VtTrainSearchMatch,
  VtTrainSummary
} from '../../../lib/viaggiaTrenoService';
import { stations } from '../../../assets/stations';

const { width } = Dimensions.get('window');

const LOCALIZED: Record<Language, Record<string, string>> = {
  zh: {
    title: '意铁看板与车次',
    tabTrain: '车次追踪',
    tabStation: '车站看板',
    tabRoute: '行程查询',
    trainNumberPlaceholder: '请输入列车号，例如: 9604, 2235',
    stationPlaceholder: '搜索车站，例如: Bologna, Milano',
    routeDepPlaceholder: '请输入出发站，例如: Bologna',
    routeArrPlaceholder: '请输入到达站，例如: Milano',
    routeSearchBtn: '搜索行程',
    routeDateLabel: '出发日期',
    routeOperatorLabel: '火车公司',
    routeTypeLabel: '车型',
    routeDuration: '用时',
    routeDelay: '延误',
    routeNoResults: '未找到满足条件的直达/过路车次',
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
    title: '意鐵看板與車次',
    tabTrain: '車次追踪',
    tabStation: '車站看板',
    tabRoute: '行程查詢',
    trainNumberPlaceholder: '請輸入列車號，例如: 9604, 2235',
    stationPlaceholder: '搜索車站，例如: Bologna, Milano',
    routeDepPlaceholder: '請輸入出發站，例如: Bologna',
    routeArrPlaceholder: '請輸入到達站，例如: Milano',
    routeSearchBtn: '搜索行程',
    routeDateLabel: '出發日期',
    routeOperatorLabel: '火車公司',
    routeTypeLabel: '車型',
    routeDuration: '用時',
    routeDelay: '延誤',
    routeNoResults: '未找到滿足條件的直達/過路車次',
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
    tabTrain: 'Track Train',
    tabStation: 'Station Boards',
    tabRoute: 'Route Search',
    trainNumberPlaceholder: 'Enter train number, e.g. 9604, 2235',
    stationPlaceholder: 'Search station, e.g. Bologna, Milano',
    routeDepPlaceholder: 'Departure station, e.g. Bologna',
    routeArrPlaceholder: 'Arrival station, e.g. Milano',
    routeSearchBtn: 'Search Route',
    routeDateLabel: 'Departure Date',
    routeOperatorLabel: 'Operator',
    routeTypeLabel: 'Train Type',
    routeDuration: 'Duration',
    routeDelay: 'Delay',
    routeNoResults: 'No direct/passing trains found',
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
    tabTrain: 'Stato Treno',
    tabStation: 'Tabellone Stazione',
    tabRoute: 'Cerca Viaggio',
    trainNumberPlaceholder: 'Inserisci numero treno, es. 9604, 2235',
    stationPlaceholder: 'Cerca stazione, es. Bologna, Milano',
    routeDepPlaceholder: 'Stazione di partenza, es. Bologna',
    routeArrPlaceholder: 'Stazione di arrivo, es. Milano',
    routeSearchBtn: 'Cerca Soluzioni',
    routeDateLabel: 'Data di partenza',
    routeOperatorLabel: 'Compagnia',
    routeTypeLabel: 'Tipo Treno',
    routeDuration: 'Durata',
    routeDelay: 'Ritardo',
    routeNoResults: 'Nessun treno diretto/in transito trovato',
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

interface RouteSearchResult {
  trainNumber: string;
  category: string;
  origin: string;
  destination: string;
  scheduledDepartureTime: number;
  actualDepartureTime: number | null;
  scheduledArrivalTime: number;
  actualArrivalTime: number | null;
  delay: number;
  codiceCliente: string | number | null;
  departureStationID: string;
  timestamp: string;
}

const RECENT_TRAINS_KEY = '@ag_recent_trains';
const RECENT_STATIONS_KEY = '@ag_recent_stations';

export default function TrainToolIndex() {
  const { colors, language } = useTheme();
  
  // Localizer
  const t = (key: string) => {
    return LOCALIZED[language]?.[key] || LOCALIZED['en']?.[key] || key;
  };

  const [activeTab, setActiveTab] = useState<'route' | 'train' | 'station'>('route');

  // Route Tab State
  const [routeDepInput, setRouteDepInput] = useState('');
  const [routeArrInput, setRouteArrInput] = useState('');
  const [routeDepStation, setRouteDepStation] = useState<VtStation | null>(null);
  const [routeArrStation, setRouteArrStation] = useState<VtStation | null>(null);
  const [focusedInput, setFocusedInput] = useState<'dep' | 'arr' | null>(null);
  const [routeStationMatches, setRouteStationMatches] = useState<VtStation[]>([]);
  const [routeDate, setRouteDate] = useState<string>(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  });
  const [routeOperator, setRouteOperator] = useState<'All' | 'TI' | 'Italo' | 'Trenord'>('All');

  const dateOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    const weekdayNamesZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekdayNamesEN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayNamesIT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    
    for (let i = 0; i < 2; i++) {
      const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const shortStr = `${day}/${month}`;
      const valueStr = `${year}-${month}-${day}`;
      
      let dayLabel = '';
      if (i === 0) {
        dayLabel = language === 'zh' ? '今天' : (language === 'zh-Hant' ? '今天' : (language === 'it' ? 'Oggi' : 'Today'));
      } else if (i === 1) {
        dayLabel = language === 'zh' ? '明天' : (language === 'zh-Hant' ? '明天' : (language === 'it' ? 'Domani' : 'Tomorrow'));
      } else {
        dayLabel = language === 'zh' ? weekdayNamesZH[d.getDay()] : (language === 'zh-Hant' ? weekdayNamesZH[d.getDay()] : (language === 'it' ? weekdayNamesIT[d.getDay()] : weekdayNamesEN[d.getDay()]));
      }
      
      list.push({
        value: valueStr,
        label: `${shortStr} (${dayLabel})`,
        dateObj: d,
        isFuture: i >= 2
      });
    }
    return list;
  }, [language]);

  const selectedDateOption = useMemo(() => {
    return dateOptions.find(o => o.value === routeDate) || dateOptions[0];
  }, [dateOptions, routeDate]);

  const getOfficialBookingUrl = (operator: 'All' | 'TI' | 'Italo' | 'Trenord') => {
    const isIt = language === 'it';
    if (operator === 'Italo') {
      return isIt ? 'https://www.italotreno.it' : 'https://www.italotreno.it/en';
    }
    if (operator === 'Trenord') {
      return 'https://www.trenord.it';
    }
    return isIt ? 'https://www.trenitalia.com' : 'https://www.trenitalia.com/en.html';
  };

  const handleRedirectToBook = () => {
    const url = getOfficialBookingUrl(routeOperator);
    Linking.openURL(url).catch(err => {
      console.error('Failed to open official booking url:', err);
    });
  };

  const [routeTime, setRouteTime] = useState<string>(() => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hrs}:${mins}`;
  });

  const [showPickerModal, setShowPickerModal] = useState(false);
  const [tempDate, setTempDate] = useState(routeDate);
  const [tempHour, setTempHour] = useState('08');
  const [tempMinute, setTempMinute] = useState('00');

  useEffect(() => {
    if (showPickerModal) {
      setTempDate(routeDate);
      const [h, m] = routeTime.split(':');
      setTempHour(h || '08');
      setTempMinute(m || '00');
    }
  }, [showPickerModal]);

  const datePickerOptions = useMemo(() => {
    return dateOptions.map(opt => ({
      value: opt.value,
      label: opt.label
    }));
  }, [dateOptions]);

  const hoursList = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  }, []);

  const minutesList = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  }, []);

  const [routeTrainType, setRouteTrainType] = useState<'All' | 'HighSpeed' | 'Intercity' | 'Regional'>('All');
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeResults, setRouteResults] = useState<RouteSearchResult[]>([]);
  const [routeError, setRouteError] = useState('');
  const [nextSearchTimeMs, setNextSearchTimeMs] = useState<number | null>(null);
  const [loadingMoreRoute, setLoadingMoreRoute] = useState(false);
  const [hasMoreRoute, setHasMoreRoute] = useState(true);

  // Train Tab State
  const [trainNo, setTrainNo] = useState('');
  const [loadingTrain, setLoadingTrain] = useState(false);
  const [trainMatches, setTrainMatches] = useState<VtTrainSearchMatch[]>([]);
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
    if (!unixMs) return '';
    try {
      const date = new Date(unixMs);
      return `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
      ).padStart(2, '0')}`;
    } catch (e) {
      return '';
    }
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
                {(item as any).category || ''} {item.number}
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
            color={starred ? "#EAB308" : colors.textMuted}
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
            color={starred ? "#EAB308" : colors.textMuted}
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

  // Autocomplete route station matches
  useEffect(() => {
    const activeInput = focusedInput === 'dep' ? routeDepInput : (focusedInput === 'arr' ? routeArrInput : '');
    setRouteStationMatches(getStationMatchesForInput(activeInput));
  }, [routeDepInput, routeArrInput, focusedInput]);

  const handleSwapStations = () => {
    const tempInput = routeDepInput;
    const tempStation = routeDepStation;
    setRouteDepInput(routeArrInput);
    setRouteDepStation(routeArrStation);
    setRouteArrInput(tempInput);
    setRouteArrStation(tempStation);
    setRouteResults([]);
  };

  const fetchRouteResultsBatch = async (
    depStationId: string,
    arrStationId: string,
    startTimeMs: number,
    limit: number,
    currentResults: RouteSearchResult[] = []
  ): Promise<{ results: RouteSearchResult[]; nextTimeMs: number | null; hasMore: boolean }> => {
    let accumulated = [...currentResults];
    let queryTime = new Date(startTimeMs);
    let iterations = 0;
    const maxIterations = 15; // Prevent runaway network loops
    const maxFutureTimeMs = startTimeMs + 36 * 60 * 60 * 1000; // Search up to 36 hours ahead
    let lastProcessedTimeMs = startTimeMs;

    while (accumulated.length < limit && queryTime.getTime() < maxFutureTimeMs && iterations < maxIterations) {
      iterations++;
      
      const departures = await getStationBoard(depStationId, 'departures', queryTime);
      if (departures.length === 0) {
        // No departures found. Advance queryTime by 2 hours and retry.
        queryTime = new Date(queryTime.getTime() + 2 * 60 * 60 * 1000);
        continue;
      }

      // Filter departures scheduled >= queryTime and sort by scheduledTime
      const sortedDepartures = [...departures]
        .filter(d => d.scheduledTime >= lastProcessedTimeMs)
        .sort((a, b) => a.scheduledTime - b.scheduledTime);

      if (sortedDepartures.length === 0) {
        // No subsequent departures. Advance queryTime by 2 hours.
        queryTime = new Date(queryTime.getTime() + 2 * 60 * 60 * 1000);
        continue;
      }

      // Process departures in small batches to prevent hitting rate limits
      const batchSize = 10;
      let departureIdx = 0;

      while (departureIdx < sortedDepartures.length && accumulated.length < limit) {
        const batch = sortedDepartures.slice(departureIdx, departureIdx + batchSize);
        departureIdx += batchSize;

        const batchPromises = batch.map(async (entry) => {
          try {
            if (!routeDepStation || !routeArrStation) return null;
            const depStationID = entry.originStationID || depStationId;
            const status = await getTrainStatus(depStationID, entry.trainNumber, String(entry.timestamp));
            if (!status) return null;

            const idxA = status.stops.findIndex(
              s => s.stationId === depStationId || 
                   s.stationName.trim().toLowerCase() === routeDepStation.name.trim().toLowerCase()
            );
            const idxB = status.stops.findIndex(
              s => s.stationId === arrStationId || 
                   s.stationName.trim().toLowerCase() === routeArrStation.name.trim().toLowerCase()
            );

            if (idxA !== -1 && idxB !== -1 && idxA < idxB) {
              const stopA = status.stops[idxA];
              const stopB = status.stops[idxB];

              if (stopA.status !== 'suppressed' && stopB.status !== 'suppressed') {
                return {
                  trainNumber: status.number,
                  category: status.category,
                  origin: status.origin,
                  destination: status.destination,
                  scheduledDepartureTime: stopA.scheduledDepartureTime || entry.scheduledTime,
                  actualDepartureTime: stopA.actualDepartureTime,
                  scheduledArrivalTime: stopB.scheduledArrivalTime || 0,
                  actualArrivalTime: stopB.actualArrivalTime,
                  delay: status.delay,
                  codiceCliente: status.codiceCliente || entry.codiceCliente,
                  departureStationID: depStationID,
                  timestamp: String(entry.timestamp)
                };
              }
            }
          } catch (e) {
            console.warn('Error fetching status for train', entry.trainNumber, e);
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        for (const res of batchResults) {
          if (res && !accumulated.some(existing => existing.trainNumber === res.trainNumber && existing.scheduledDepartureTime === res.scheduledDepartureTime)) {
            accumulated.push(res);
            if (accumulated.length >= limit) {
              break;
            }
          }
        }
      }

      // Advance queryTime for the next iteration
      const lastEntry = sortedDepartures[sortedDepartures.length - 1];
      if (lastEntry && lastEntry.scheduledTime > lastProcessedTimeMs) {
        lastProcessedTimeMs = lastEntry.scheduledTime + 60 * 1000;
        queryTime = new Date(lastProcessedTimeMs);
      } else {
        lastProcessedTimeMs = queryTime.getTime() + 2 * 60 * 60 * 1000;
        queryTime = new Date(lastProcessedTimeMs);
      }
    }

    const hasMore = queryTime.getTime() < maxFutureTimeMs && iterations < maxIterations;
    return {
      results: accumulated,
      nextTimeMs: lastProcessedTimeMs,
      hasMore
    };
  };

  const handleRouteSearch = async () => {
    Keyboard.dismiss();
    if (!routeDepStation || !routeArrStation) {
      setRouteError(language === 'zh' ? '请选择出发站和到达站' : 'Seleziona le stazioni di partenza e arrivo');
      return;
    }

    if (selectedDateOption?.isFuture) {
      handleRedirectToBook();
      return;
    }

    setLoadingRoute(true);
    setRouteError('');
    setRouteResults([]);
    setHasMoreRoute(true);
    setNextSearchTimeMs(null);

    try {
      const [year, month, day] = routeDate.split('-').map(Number);
      const [hour, minute] = routeTime.split(':').map(Number);
      const targetDate = new Date(year, month - 1, day, hour, minute, 0);
      // Small offset to catch trains about to depart
      targetDate.setTime(targetDate.getTime() - 10 * 60000);

      const { results, nextTimeMs, hasMore } = await fetchRouteResultsBatch(
        routeDepStation.id,
        routeArrStation.id,
        targetDate.getTime(),
        15,
        []
      );

      if (results.length === 0) {
        setRouteError(language === 'zh' ? '未找到满足条件的直达/过路车次' : 'Nessun treno diretto trovato');
      } else {
        setRouteResults(results);
        setNextSearchTimeMs(nextTimeMs);
        setHasMoreRoute(hasMore);
      }
    } catch (err) {
      console.error(err);
      setRouteError(language === 'zh' ? '查询出错，请重试' : 'Errore durante la ricerca');
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleLoadMoreRoute = async () => {
    if (loadingRoute || loadingMoreRoute || !hasMoreRoute || !nextSearchTimeMs || !routeDepStation || !routeArrStation) return;

    setLoadingMoreRoute(true);
    try {
      const { results, nextTimeMs, hasMore } = await fetchRouteResultsBatch(
        routeDepStation.id,
        routeArrStation.id,
        nextSearchTimeMs,
        routeResults.length + 8,
        routeResults
      );

      setRouteResults(results);
      setNextSearchTimeMs(nextTimeMs);
      setHasMoreRoute(hasMore);
    } catch (e) {
      console.warn('Error loading more route results:', e);
    } finally {
      setLoadingMoreRoute(false);
    }
  };

  const filteredRouteResults = useMemo(() => {
    return routeResults.filter(item => {
      // 1. Train operator filtering
      const op = getOperatorInfo(item.codiceCliente, item.category);
      if (routeOperator !== 'All') {
        if (routeOperator === 'TI' && op.code !== 'TI' && op.code !== 'TTX') return false;
        if (routeOperator === 'Italo' && op.code !== 'NTV') return false;
        if (routeOperator === 'Trenord' && op.code !== 'TN') return false;
      }

      // 2. Train type filtering
      if (routeTrainType !== 'All') {
        const cat = item.category.toUpperCase();
        const isHS = ['FR', 'FA', 'FB', 'Italo', 'EC', 'EN', 'FRECCIAROSSA', 'FRECCIARGENTO', 'FRECCIABIANCA', 'ITALO'].includes(cat) || op.name === 'Italo';
        const isIC = ['IC', 'ICN', 'INTERCITY', 'INTERCITYNOTTE'].includes(cat);
        const isReg = !isHS && !isIC;

        if (routeTrainType === 'HighSpeed' && !isHS) return false;
        if (routeTrainType === 'Intercity' && !isIC) return false;
        if (routeTrainType === 'Regional' && !isReg) return false;
      }

      return true;
    });
  }, [routeResults, routeOperator, routeTrainType]);

  // Handle train number query
  const handleTrainSearch = async () => {
    Keyboard.dismiss();
    const cleanNum = trainNo.trim();
    if (!cleanNum) return;

    setLoadingTrain(true);
    setTrainError('');
    setTrainMatches([]);

    try {
      const results = await searchTrain(cleanNum);
      if (results.length === 0) {
        setTrainError(t('noTrainsFound'));
      } else if (results.length === 1) {
        // Only 1 match, save to history and navigate directly
        saveTrainToHistory(results[0]);
        router.push({
          pathname: '/tools/train/train-status',
          params: {
            trainNumber: results[0].number,
            departureStationID: results[0].departureStationID,
            timestamp: results[0].timestamp
          }
        });
      } else {
        // Sort matches: newest first (largest timestamp first)
        const sorted = [...results].sort((a, b) => {
          const tA = parseInt(a.timestamp, 10) || 0;
          const tB = parseInt(b.timestamp, 10) || 0;
          return tB - tA;
        });
        // Multiple runs found (e.g. today's train and tomorrow's or train splitting routes)
        setTrainMatches(sorted);
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
    try {
      const date = new Date(parseInt(timestampStr, 10));
      return `${String(date.getDate()).padStart(2, '0')}/${String(
        date.getMonth() + 1
      ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
      ).padStart(2, '0')}`;
    } catch (e) {
      return '';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => {
            setActiveTab('route');
            setTrainError('');
          }}
          style={[
            styles.tab,
            activeTab === 'route' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'route' ? colors.primary : colors.textSecondary }
            ]}
          >
            {t('tabRoute')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setActiveTab('train');
            setTrainError('');
          }}
          style={[
            styles.tab,
            activeTab === 'train' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
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
          }}
          style={[
            styles.tab,
            activeTab === 'station' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
          ]}
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
      </View>

      {activeTab === 'route' ? (
        /* ==================== ROUTE SEARCH TAB ==================== */
        <View style={{ flex: 1 }}>
          {/* Fixed Search Inputs */}
          <View style={styles.routeSearchBox}>
            <View style={{ flex: 1 }}>
              {/* Departure Input */}
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}>
                <MaterialIcons name="radio-button-on" size={18} color={colors.success} style={styles.searchIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={t('routeDepPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={routeDepInput}
                  onChangeText={txt => {
                    setRouteDepInput(txt);
                    if (routeDepStation && txt !== routeDepStation.name) {
                      setRouteDepStation(null);
                    }
                  }}
                  onFocus={() => setFocusedInput('dep')}
                  returnKeyType="next"
                />
                {routeDepInput.length > 0 && (
                  <Pressable onPress={() => { setRouteDepInput(''); setRouteDepStation(null); }} style={styles.clearInputBtn}>
                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>

              {/* Arrival Input */}
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="place" size={18} color={colors.error} style={styles.searchIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={t('routeArrPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={routeArrInput}
                  onChangeText={txt => {
                    setRouteArrInput(txt);
                    if (routeArrStation && txt !== routeArrStation.name) {
                      setRouteArrStation(null);
                    }
                  }}
                  onFocus={() => setFocusedInput('arr')}
                  returnKeyType="search"
                  onSubmitEditing={handleRouteSearch}
                />
                {routeArrInput.length > 0 && (
                  <Pressable onPress={() => { setRouteArrInput(''); setRouteArrStation(null); }} style={styles.clearInputBtn}>
                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Swap Button on the right */}
            <Pressable
              onPress={handleSwapStations}
              style={[styles.swapBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MaterialIcons name="swap-vert" size={24} color={colors.primary} />
            </Pressable>
          </View>

          {/* Autocomplete Dropdown List */}
          {routeStationMatches.length > 0 && focusedInput && (
            <View style={[styles.routeAutocompleteContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <FlatList
                data={routeStationMatches}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.autocompleteItem,
                      { borderBottomColor: colors.border, backgroundColor: pressed ? colors.border + '30' : 'transparent' }
                    ]}
                    onPress={() => {
                      if (focusedInput === 'dep') {
                        setRouteDepStation(item);
                        setRouteDepInput(item.name);
                      } else {
                        setRouteArrStation(item);
                        setRouteArrInput(item.name);
                      }
                      setRouteStationMatches([]);
                      setFocusedInput(null);
                      Keyboard.dismiss();
                    }}
                  >
                    <MaterialIcons name="place" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                    <Text style={[styles.autocompleteText, { color: colors.textPrimary }]}>{item.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}

          {/* Scrollable Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onScroll={({ nativeEvent }) => {
              if (activeTab !== 'route') return;
              if (loadingRoute || loadingMoreRoute || !hasMoreRoute || routeResults.length === 0) return;

              // Check if user has scrolled near the bottom
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const paddingToBottom = 100; // Trigger slightly before reaching the absolute bottom
              const isClose = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
              
              if (isClose) {
                handleLoadMoreRoute();
              }
            }}
            scrollEventThrottle={400}
          >
            {/* Date Selector Row */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionLabel, { color: colors.textSecondary, marginBottom: 8 }]}>{t('routeDateLabel')}</Text>
              <Pressable
                onPress={() => setShowPickerModal(true)}
                style={({ pressed }) => [
                  styles.dateSelectButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.9 : 1
                  }
                ]}
              >
                <MaterialIcons name="event" size={20} color={colors.primary} style={{ marginRight: 10 }} />
                <Text style={[styles.dateSelectButtonText, { color: colors.textPrimary, flex: 1 }]}>
                  {(() => {
                    const opt = dateOptions.find(o => o.value === routeDate);
                    return opt ? `${opt.label} ${routeTime}` : `${routeDate} ${routeTime}`;
                  })()}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Search Button */}
            <Pressable
              onPress={handleRouteSearch}
              style={({ pressed }) => [
                styles.routeSearchSubmitBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }
              ]}
            >
              <Text style={styles.routeSearchSubmitBtnText}>{t('routeSearchBtn')}</Text>
            </Pressable>

            {/* Filters Bar */}
            {routeResults.length > 0 && (
              <View style={[styles.filtersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Operator Filters */}
                <View style={styles.filterRow}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('routeOperatorLabel')}:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContainer}>
                    {([
                      { value: 'All', label: language === 'zh' ? '全部' : 'Tutti' },
                      { value: 'TI', label: '意铁' },
                      { value: 'Italo', label: 'Italo' },
                      { value: 'Trenord', label: 'Trenord' }
                    ] as const).map(opt => {
                      const isSel = routeOperator === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setRouteOperator(opt.value)}
                          style={[
                            styles.filterPill,
                            {
                              backgroundColor: isSel ? colors.primarySoft : 'transparent',
                              borderColor: isSel ? colors.primary : colors.border
                            }
                          ]}
                        >
                          <Text style={[styles.filterPillText, { color: isSel ? colors.primary : colors.textSecondary }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Train Type Filters */}
                <View style={[styles.filterRow, { marginTop: 12 }]}>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t('routeTypeLabel')}:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContainer}>
                    {([
                      { value: 'All', label: language === 'zh' ? '全部' : 'Tutti' },
                      { value: 'HighSpeed', label: language === 'zh' ? '高铁' : 'Alta Vel.' },
                      { value: 'Intercity', label: language === 'zh' ? '城际' : 'Intercity' },
                      { value: 'Regional', label: language === 'zh' ? '慢车' : 'Regionale' }
                    ] as const).map(opt => {
                      const isSel = routeTrainType === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => setRouteTrainType(opt.value)}
                          style={[
                            styles.filterPill,
                            {
                              backgroundColor: isSel ? colors.primarySoft : 'transparent',
                              borderColor: isSel ? colors.primary : colors.border
                            }
                          ]}
                        >
                          <Text style={[styles.filterPillText, { color: isSel ? colors.primary : colors.textSecondary }]}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Booking Redirection Prompt for future dates */}
            {selectedDateOption?.isFuture && routeDepStation && routeArrStation && (
              <View style={[styles.bookingPromptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.bookingIconBg, { backgroundColor: colors.primary + '10' }]}>
                  <MaterialIcons name="confirmation-number" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.bookingPromptTitle, { color: colors.textPrimary }]}>
                  {language === 'zh' ? '预订未来行程' : (language === 'zh-Hant' ? '預訂未來行程' : (language === 'it' ? 'Prenota Viaggio' : 'Book Future Journeys'))}
                </Text>
                <Text style={[styles.bookingPromptDesc, { color: colors.textSecondary }]}>
                  {language === 'zh'
                    ? '意铁官方实时大盘仅支持查询今明两天的实时车次、延误和站台。查询未来日期排班及购票，请前往官方预订通道。'
                    : (language === 'zh-Hant'
                      ? '意鐵官方即時大盤僅支援查詢今明兩天的即時車次、延誤和月台。查詢未來日期排班及購票，請前往官方預訂通道。'
                      : (language === 'it'
                        ? 'Il sistema in tempo reale supporta solo la ricerca di oggi e domani. Per cercare date future e acquistare biglietti, si prega di utilizzare il canale ufficiale.'
                        : 'Italian rail live system only supports tracking trains for today and tomorrow. To check future schedules and buy tickets, please use the official booking channel.'))}
                </Text>
                <Pressable
                  onPress={handleRedirectToBook}
                  style={({ pressed }) => [
                    styles.bookingRedirectionBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <MaterialIcons name="launch" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.bookingRedirectionBtnText}>
                    {language === 'zh' ? '跳转铁路官网购票' : (language === 'zh-Hant' ? '跳轉鐵路官網購票' : (language === 'it' ? 'Prenota sul sito ufficiale' : 'Book on Official Website'))}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Loading Indicator */}
            {loadingRoute && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                  {language === 'zh' ? '正在查询大盘与实时过路车...' : 'Verifica treni in corso...'}
                </Text>
              </View>
            )}

            {/* Error Message */}
            {routeError.length > 0 && !loadingRoute && (
              <View style={styles.errorContainer}>
                <MaterialIcons name="error-outline" size={24} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>{routeError}</Text>
              </View>
            )}

            {/* Results List */}
            {!loadingRoute && !routeError && routeResults.length > 0 && !selectedDateOption?.isFuture && (
              <View style={styles.resultsWrapper}>
                <Pressable
                  onPress={handleRedirectToBook}
                  style={({ pressed }) => [
                    styles.resultsBookShortcut,
                    { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30', opacity: pressed ? 0.95 : 1 }
                  ]}
                >
                  <MaterialIcons name="confirmation-number" size={18} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.resultsBookShortcutText, { color: colors.primary, flex: 1 }]} numberOfLines={1}>
                    {language === 'zh' ? '需要预订此日期的车票？点击去购票' : (language === 'zh-Hant' ? '需要預訂此日期的車票？點擊去購票' : (language === 'it' ? 'Vuoi prenotare i biglietti? Clicca qui' : 'Need tickets for this trip? Tap to book'))}
                  </Text>
                  <MaterialIcons name="chevron-right" size={18} color={colors.primary} />
                </Pressable>

                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
                  {language === 'zh' ? `找到 ${filteredRouteResults.length} 趟车次` : `${filteredRouteResults.length} treni trovati`}
                </Text>
                {filteredRouteResults.map((item, idx) => {
                  const op = getOperatorInfo(item.codiceCliente, item.category);
                  const depTimeStr = formatUnixTime(item.scheduledDepartureTime);
                  const arrTimeStr = formatUnixTime(item.scheduledArrivalTime);
                  
                  // Duration calculation
                  const durationMs = item.scheduledArrivalTime - item.scheduledDepartureTime;
                  const durationMins = Math.round(durationMs / 60000);
                  const durationHours = Math.floor(durationMins / 60);
                  const durationMinsRem = durationMins % 60;
                  const durationStr = durationHours > 0 
                    ? `${durationHours}h ${durationMinsRem}m`
                    : `${durationMinsRem}m`;

                  const isHS = ['FR', 'FA', 'FB', 'Italo', 'EC', 'EN'].includes(item.category);

                  let delayColor = colors.textSecondary;
                  if (item.delay > 0) delayColor = colors.error;
                  else if (item.delay < 0) delayColor = colors.success;

                  return (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.routeResultCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          opacity: pressed ? 0.9 : 1
                        }
                      ]}
                      onPress={() => {
                        router.push({
                          pathname: '/tools/train/train-status',
                          params: {
                            trainNumber: item.trainNumber,
                            departureStationID: item.departureStationID,
                            timestamp: item.timestamp
                          }
                        });
                      }}
                    >
                      {/* Header */}
                      <View style={styles.resultCardHeader}>
                        <View style={styles.trainBadgeRow}>
                          <View style={[styles.catBadge, { backgroundColor: isHS ? '#E30613' + '20' : colors.primarySoft }]}>
                            <Text style={[styles.catBadgeText, { color: isHS ? '#E30613' : colors.primary }]}>
                              {item.category}
                            </Text>
                          </View>
                          <Text style={[styles.trainNumText, { color: colors.textPrimary, marginRight: 8 }]}>
                            {item.trainNumber}
                          </Text>
                          <View style={[styles.opCodeBadge, { borderColor: op.color, backgroundColor: op.color + '10', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 }]}>
                            <Text style={[styles.opCodeText, { color: op.color, fontSize: 8 }]}>{op.name}</Text>
                          </View>
                        </View>
                        
                        {/* Delay status */}
                        <Text style={[styles.delayText, { color: delayColor, fontSize: 12, fontWeight: 'bold' }]}>
                          {item.delay > 0 ? `+${item.delay} min` : (item.delay < 0 ? `-${Math.abs(item.delay)} min` : (language === 'zh' ? '正点' : 'In orario'))}
                        </Text>
                      </View>

                      {/* Timeline row */}
                      <View style={styles.routeTimelineRow}>
                        <View style={styles.timePoint}>
                          <Text style={[styles.timeText, { color: colors.textPrimary }]}>{depTimeStr}</Text>
                          <Text style={[styles.stationText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {routeDepStation?.name}
                          </Text>
                        </View>
                        
                        {/* Central connection line */}
                        <View style={styles.durationLineContainer}>
                          <Text style={[styles.durationText, { color: colors.textMuted }]}>{durationStr}</Text>
                          <View style={[styles.durationLine, { backgroundColor: colors.border }]} />
                          <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} style={{ marginTop: -8 }} />
                        </View>

                        <View style={styles.timePoint}>
                          <Text style={[styles.timeText, { color: colors.textPrimary, textAlign: 'right' }]}>{arrTimeStr}</Text>
                          <Text style={[styles.stationText, { color: colors.textSecondary, textAlign: 'right' }]} numberOfLines={1}>
                            {routeArrStation?.name}
                          </Text>
                        </View>
                      </View>

                      {/* Origin/Destination footer */}
                      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                        <Text style={[styles.footerText, { color: colors.textMuted }]}>
                          {language === 'zh' 
                            ? `始发: ${item.origin}  →  终到: ${item.destination}`
                            : `Da: ${item.origin}  →  A: ${item.destination}`}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {loadingMoreRoute && (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                      {language === 'zh' ? '正在加载更多车次...' : 'Caricamento altri treni...'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.disclaimerContainer}>
              <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
                {t('disclaimer')}
              </Text>
            </View>
          </ScrollView>
        </View>
      ) : activeTab === 'train' ? (
        /* ==================== TRACK TRAIN TAB ==================== */
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
              <Text style={styles.searchButtonText}>{t('searchButton')}</Text>
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
              {trainMatches.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.matchCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1
                    }
                  ]}
                  onPress={() => handleSelectTrainMatch(item)}
                >
                  <View style={styles.matchCardHeader}>
                    <Text style={[styles.matchCardTrainNum, { color: colors.primary }]}>{item.number}</Text>
                    <Text style={[styles.matchCardTime, { color: colors.textSecondary }]}>
                      {t('depTime')}: {formatUnixDate(item.timestamp)}
                    </Text>
                  </View>
                  <Text style={[styles.matchCardEndpoints, { color: colors.textPrimary }]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
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
      ) : (
        /* ==================== STATION BOARDS TAB ==================== */
        <View style={{ flex: 1 }}>
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
      )}

      {/* Alarm-Style Date & Time Picker Modal */}
      <Modal
        visible={showPickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {language === 'zh' ? '选择出发日期与时间' : (language === 'zh-Hant' ? '選擇出發日期與時間' : (language === 'it' ? 'Seleziona Data e Ora' : 'Select Date & Time'))}
              </Text>
            </View>
            
            <View style={styles.rollersContainer}>
              {/* Date Roller */}
              <WheelPicker
                items={datePickerOptions.map(o => o.label)}
                selectedValue={datePickerOptions.find(o => o.value === tempDate)?.label || datePickerOptions[0]?.label}
                onValueChange={(label) => {
                  const val = datePickerOptions.find(o => o.label === label)?.value;
                  if (val) setTempDate(val);
                }}
                color={colors.textSecondary}
                activeColor={colors.primary}
                widthPercent="50%"
              />
              
              <View style={{ width: 10 }} />
              
              {/* Hour Roller */}
              <WheelPicker
                items={hoursList}
                selectedValue={tempHour}
                onValueChange={setTempHour}
                color={colors.textSecondary}
                activeColor={colors.primary}
                widthPercent="20%"
              />
              
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, alignSelf: 'center', marginHorizontal: 4 }}>:</Text>
              
              {/* Minute Roller */}
              <WheelPicker
                items={minutesList}
                selectedValue={tempMinute}
                onValueChange={setTempMinute}
                color={colors.textSecondary}
                activeColor={colors.primary}
                widthPercent="20%"
              />
            </View>
            
            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setShowPickerModal(false)}
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>
                  {language === 'zh' ? '取消' : (language === 'zh-Hant' ? '取消' : (language === 'it' ? 'Annulla' : 'Cancel'))}
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => {
                  setRouteDate(tempDate);
                  setRouteTime(`${tempHour}:${tempMinute}`);
                  setRouteResults([]);
                  setRouteError('');
                  setShowPickerModal(false);
                }}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>
                  {language === 'zh' ? '确认' : (language === 'zh-Hant' ? '確認' : (language === 'it' ? 'Conferma' : 'Confirm'))}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Alarm-style Roller Wheel Picker helper component
const WheelPicker: React.FC<{
  items: string[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  height?: number;
  itemHeight?: number;
  color: string;
  activeColor: string;
  widthPercent?: string;
}> = ({
  items,
  selectedValue,
  onValueChange,
  height = 180,
  itemHeight = 40,
  color,
  activeColor,
  widthPercent = '30%'
}) => {
  const flatListRef = React.useRef<FlatList>(null);
  const selectedIndex = items.indexOf(selectedValue);
  const safeIndex = selectedIndex !== -1 ? selectedIndex : 0;
  
  const pad = height / 2 - itemHeight / 2;

  const scrollTo = (index: number, animated = true) => {
    flatListRef.current?.scrollToOffset({
      offset: index * itemHeight,
      animated
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollTo(safeIndex, false);
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedValue, items]);

  const onMomentumScrollEnd = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    if (index >= 0 && index < items.length) {
      const val = items[index];
      if (val !== selectedValue) {
        onValueChange(val);
      }
    }
  };

  return (
    <View style={{ height, width: widthPercent as any, overflow: 'hidden' }}>
      <View style={{
        position: 'absolute',
        top: pad,
        left: 0,
        right: 0,
        height: itemHeight,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: activeColor + '40',
        backgroundColor: activeColor + '08'
      }} />
      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item, index) => `${item}_${index}`}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: pad,
          paddingBottom: pad
        }}
        getItemLayout={(data, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index
        })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => {
          const isSelected = index === safeIndex;
          return (
            <View style={{
              height: itemHeight,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <Text style={{
                fontSize: isSelected ? 15 : 13,
                fontWeight: isSelected ? 'bold' : 'normal',
                color: isSelected ? activeColor : color
              }}>
                {item}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
};

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
    borderRadius: 12,
    paddingHorizontal: 20,
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
  routeSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  swapBtn: {
    width: 44,
    height: 104,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  routeAutocompleteContainer: {
    position: 'absolute',
    top: 132,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 250,
    zIndex: 99,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  filterSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dateSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateOptionCapsule: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateOptionText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  routeSearchSubmitBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeSearchSubmitBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  filtersCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    width: 60,
  },
  filterPillsContainer: {
    alignItems: 'center',
    paddingLeft: 4,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  routeResultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  resultCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeTimelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  timePoint: {
    width: '35%',
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stationText: {
    fontSize: 11,
    marginTop: 2,
  },
  durationLineContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  durationText: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  durationLine: {
    height: 2,
    width: '100%',
  },
  cardFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 10,
  },
  trainBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  delayText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateSelectorScroll: {
    paddingVertical: 4,
  },
  bookingPromptCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  bookingIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bookingPromptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  bookingPromptDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  bookingRedirectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bookingRedirectionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultsBookShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  resultsBookShortcutText: {
    fontSize: 12,
    fontWeight: '600',
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
  dateSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  dateSelectButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    width: '100%',
    maxHeight: 450,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rollersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    height: 200,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  }
});
