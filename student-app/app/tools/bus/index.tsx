import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  Alert,
  Modal,
  PanResponder,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import {
  fetchBusArrivals,
  searchStopsByName,
  fetchStopsInBoundingBox,
  BusArrival,
  BusStop,
} from '../../../lib/tperService';
import { COLORS, FONTS, SIZES, SPACING, RADIUS, SHADOWS } from '../../../constants/theme';

const { width } = Dimensions.get('window');

const FAVORITES_KEY = '@ag_bus_favorites';
const RECENTS_KEY = '@ag_bus_recents';

interface FavoriteStop {
  code: string;
  name: string;
  customName?: string;
}

// Popular route destinations in Bologna (WeBus style)
const ROUTE_DESTINATIONS: Record<string, string> = {
  '11A': 'Rotonda Giardini',
  '11B': 'Ponticella / Roveri',
  '13A': 'Via Larga',
  '13B': 'Borgo Panigale',
  '14A': 'Giovanni XXIII',
  '14B': 'Barca',
  '14C': 'Pilastro',
  '18': 'Ospedale Maggiore',
  '19A': 'San Lazzaro',
  '19B': 'Casteldebole',
  '20A': 'Pilastro',
  '20B': 'Casalecchio / San Biagio',
  '21': 'Stazione Centrale / Filanda',
  '25': 'Fossolo - Due Madonne / Casalecchio',
  '25A': 'Fossolo - Due Madonne',
  '25B': 'Casalecchio - Stazione',
  '27': 'Fossolo / Croce Coperta',
  '27A': 'Fossolo - Due Madonne',
  '27B': 'Corticella / Croce Coperta',
  '29': 'Piazza Maggiore / Roncrio',
  '30': 'Sostegno / San Michele in Bosco',
  '32': 'Circolare Destra (Stazione)',
  '33': 'Circolare Sinistra (Porta Castiglione)',
  '35': 'Facoltà di Ingegneria / Rotonda Gluck',
  '36': 'Ospedale Bellaria / Barca',
  '37': 'Stazione Centrale / Bombicci',
  '38': 'Fiera / Rotonda Mileto',
  '39': 'Fiera / Ospedale Maggiore',
  '60': 'Piazza dei Martiri',
  '61': 'San Donato',
  '62': 'Corticella',
  '89': 'San Lazzaro / Villanova',
  '94': 'Castel San Pietro / Bologna',
  '97': 'Lame / San Giorgio di Piano',
  '101': 'Imola Autostazione',
  '356': 'Bologna Autostazione',
  '357': 'Bologna Autostazione',
  'N1': 'Bologna - Fiera (Notturno)',
  'N2': 'Bologna - Casalecchio (Notturno)',
  'N3': 'Bologna Centrale (Notturno)',
  'N4': 'Bologna Centrale (Notturno)',
  'N5': 'Bologna Centrale (Notturno)',
  'N6': 'Bologna Centrale (Notturno)',
  'N7': 'Bologna Centrale (Notturno)',
  'N8': 'Bologna Centrale (Notturno)',
  'A': 'Piazza Maggiore',
  'C': 'Piazza Malpighi',
  'D': 'Piazza San Francesco',
  'T2': 'Bologna Autostazione',
};

// Gets dynamic line badge color (Red for urban, Navy Blue for extraurban, etc. matching WeBus)
function getLineColor(line: string): string {
  const cleanLine = line.toUpperCase().trim();
  if (cleanLine.startsWith('N')) {
    return '#0B2545'; // Night lines: Deep midnight blue
  }
  
  // Extract number
  const num = parseInt(cleanLine.replace(/[a-zA-Z]/g, ''), 10);
  if (!isNaN(num)) {
    if (num < 100) {
      return '#E30613'; // Urban lines: Red
    } else {
      return '#134074'; // Suburban / Extraurban: Navy Blue
    }
  }
  
  // Alphabetic letters (e.g. C, D, T2)
  if (['A', 'C', 'D'].includes(cleanLine)) {
    return '#E30613'; // Center shuttles: Red
  }
  return '#F59E0B'; // Fallback: Orange-gold
}

// Leaflet map HTML loading Google Maps roadmap layer and customized WeBus red bus icon pins
const getMapHtml = (isDark: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
  <style>
    body { padding: 0; margin: 0; background: #e5e5e5; }
    #map { height: 100vh; width: 100vw; }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .leaflet-popup-content {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      margin: 8px 12px;
    }
    /* Custom Marker Cluster Styles matching the theme */
    .marker-cluster-small {
      background-color: rgba(227, 6, 19, 0.2) !important;
    }
    .marker-cluster-small div {
      background-color: rgba(227, 6, 19, 0.8) !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: bold;
      font-size: 12px;
    }
    .marker-cluster-medium {
      background-color: rgba(227, 6, 19, 0.3) !important;
    }
    .marker-cluster-medium div {
      background-color: rgba(227, 6, 19, 0.85) !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: bold;
      font-size: 13px;
    }
    .marker-cluster-large {
      background-color: rgba(227, 6, 19, 0.4) !important;
    }
    .marker-cluster-large div {
      background-color: rgba(227, 6, 19, 0.9) !important;
      color: white !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: bold;
      font-size: 14px;
    }
    /* Custom Attribution Styling positioned in top-right */
    .leaflet-control-attribution {
      background: rgba(255, 255, 255, 0.8) !important;
      color: #333333 !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      margin-right: 10px !important;
      margin-top: 10px !important;
      font-size: 10px !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
      border: 1px solid rgba(0,0,0,0.05) !important;
    }
    .leaflet-control-attribution a {
      color: #0078A8 !important;
      text-decoration: none !important;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(2.8); opacity: 0; }
    }
    
    ${isDark ? `
    #map {
      filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) !important;
      background: #1a1a1a !important;
    }
    .leaflet-marker-pane, .leaflet-popup-pane, .leaflet-control-attribution {
      filter: invert(100%) hue-rotate(180deg) !important;
    }
    .leaflet-container {
      background: #1a1a1a !important;
    }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip {
      background: #2a2a2a !important;
      color: #ffffff !important;
      border: 1px solid #444;
    }
    .leaflet-popup-content {
      color: #ffffff !important;
    }
    .leaflet-control-attribution {
      background: rgba(30, 30, 30, 0.85) !important;
      color: #cccccc !important;
      border-color: rgba(255,255,255,0.1) !important;
    }
    .leaflet-control-attribution a {
      color: #3b82f6 !important;
    }
    ` : ''}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map centered in Bologna (with disabled zoom control and disabled default attribution control so we can add it custom positioned in top-right)
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([44.4949, 11.3426], 15);
    
    // Create custom attribution control, assign it to map.attributionControl so layers can register their attributions, and add to map
    map.attributionControl = L.control.attribution({ position: 'topright' });
    map.attributionControl.addTo(map);

    // Google Maps Roadmap tile layer (clean, high-definition road rendering with retina scaling)
    var tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    if (window.devicePixelRatio > 1) {
      tileUrl += '&scale=2';
    }
    L.tileLayer(tileUrl, {
      maxZoom: 20,
      tileSize: 256,
      attribution: 'Map data &copy; Google'
    }).addTo(map);

    // Initialize marker cluster group instead of layer group
    var markersGroup = L.markerClusterGroup({
      maxClusterRadius: 45,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false
    }).addTo(map);
    
    var userLocationMarker = null;

    // Custom WeBus bus marker (red circle with white bus icon inside)
    var busIcon = L.divIcon({
      html: '<div style="background-color:#E30613;width:28px;height:28px;border-radius:50%;display:flex;justify-content:center;align-items:center;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.35);"><svg viewBox="0 0 24 24" width="15" height="15" fill="white"><path d="M18 11H6V6h12m-1.5 11a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5M7.5 17a1.5 1.5 0 11-1.5-1.5 1.5 1.5 0 011.5 1.5M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V9a4 4 0 00-4-4H8a4 4 0 00-4 4v7z"/></svg></div>',
      className: 'custom-bus-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });

    // Send map movement end updates back to RN
    map.on('moveend', function() {
      var center = map.getCenter();
      var bounds = map.getBounds();
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'MAP_MOVED',
        lat: center.lat,
        lon: center.lng,
        zoom: map.getZoom(),
        minLat: bounds.getSouthWest().lat,
        maxLat: bounds.getNorthEast().lat,
        minLon: bounds.getSouthWest().lng,
        maxLon: bounds.getNorthEast().lng
      }));
    });

    // Update stops markers in batch
    window.updateStops = function(stopsJson) {
      markersGroup.clearLayers();
      var stops = JSON.parse(stopsJson);
      var markersArray = [];
      stops.forEach(function(stop) {
        if (stop.latitude && stop.longitude) {
          var marker = L.marker([stop.latitude, stop.longitude], { icon: busIcon });
          
          var escapedName = stop.stop_name.replace(/'/g, "\\\\'");
          var popupContent = "<b>" + stop.stop_name + "</b><br>" + 
                             "站牌号: <b>" + stop.stop_code + "</b><br>" +
                             "<button onclick=\\"selectStop('" + stop.stop_code + "', '" + escapedName + "')\\" style='margin-top:8px;width:100%;padding:6px;background:#E30613;color:white;border:none;border-radius:6px;font-weight:bold;font-size:12px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.2);'>在此站查询</button>";
          
          marker.bindPopup(popupContent);
          markersArray.push(marker);
        }
      });
      markersGroup.addLayers(markersArray);
    };

    window.panTo = function(lat, lon) {
      map.setView([lat, lon], 16);
    };

    window.updateUserLocation = function(lat, lon) {
      map.setView([lat, lon], 16);
      if (userLocationMarker) {
        userLocationMarker.setLatLng([lat, lon]);
      } else {
        var userIcon = L.divIcon({
          className: 'user-location-marker',
          html: '<div style="background-color:#3B82F6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.4), 0 2px 5px rgba(0,0,0,0.3);display:flex;justify-content:center;align-items:center;position:relative;"><div style="position:absolute;width:14px;height:14px;border-radius:50%;background-color:#3B82F6;animation:pulse 2s infinite ease-out;z-index:-1;"></div></div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
        userLocationMarker = L.marker([lat, lon], { icon: userIcon }).addTo(map);
      }
    };

    function selectStop(code, name) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'SELECT_STOP',
        code: code,
        name: name
      }));
    }
  </script>
</body>
</html>
`;

export default function BusBoardScreen() {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<WebView>(null);

  // Input states
  const [stopCodeInput, setStopCodeInput] = useState('');
  const [lineFilterInput, setLineFilterInput] = useState('');
  const [stopNameInput, setStopNameInput] = useState('');

  // Suggestions state
  const [suggestions, setSuggestions] = useState<BusStop[]>([]);
  const [searchingStops, setSearchingStops] = useState(false);

  // Active stop query states
  const [activeStopCode, setActiveStopCode] = useState<string | null>(null);
  const [activeStopName, setActiveStopName] = useState<string | null>(null);
  const [activeStopLines, setActiveStopLines] = useState<string[]>([]);
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');

  // Arrivals data states
  const [arrivals, setArrivals] = useState<BusArrival[]>([]);
  const [allArrivals, setAllArrivals] = useState<BusArrival[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Favorites & Recents states
  const [favorites, setFavorites] = useState<FavoriteStop[]>([]);
  const [recents, setRecents] = useState<FavoriteStop[]>([]);

  // Map & Tab states
  const [activeTab, setActiveTab] = useState<'search' | 'map'>('search');
  const tabAnim = useRef(new Animated.Value(0)).current;
  const mapScrollViewRef = useRef<ScrollView>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 44.4949, lon: 11.3426 });
  // Add Favorite Modal state
  const [favModalVisible, setFavModalVisible] = useState(false);
  const [newFavCustomName, setNewFavCustomName] = useState('');

  // Bus Arrival Detail Modal state
  const [selectedArrival, setSelectedArrival] = useState<BusArrival | null>(null);

  // Bottom Sheet Dimensions & Calculations
  const SHEET_HEIGHT = Dimensions.get('window').height * 0.75;
  const COLLAPSED_HEIGHT = 280;
  const MIN_HEIGHT = 100;
  
  const snapPoints = {
    expanded: 0,
    collapsed: SHEET_HEIGHT - COLLAPSED_HEIGHT,
    minimized: SHEET_HEIGHT - MIN_HEIGHT
  };

  const translateY = useRef(new Animated.Value(snapPoints.collapsed)).current;
  const lastTranslatedY = useRef(snapPoints.collapsed);

  // PanResponder to handle Bottom Sheet dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        translateY.setOffset(lastTranslatedY.current);
        translateY.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        const nextValue = gestureState.dy;
        const absolutePos = lastTranslatedY.current + nextValue;
        if (absolutePos >= 0 && absolutePos <= SHEET_HEIGHT) {
          translateY.setValue(nextValue);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateY.flattenOffset();
        const finalY = lastTranslatedY.current + gestureState.dy;
        
        let nearestSnap = snapPoints.collapsed;
        let minDiff = Infinity;
        
        Object.values(snapPoints).forEach(val => {
          const diff = Math.abs(finalY - val);
          if (diff < minDiff) {
            minDiff = diff;
            nearestSnap = val;
          }
        });
        
        lastTranslatedY.current = nearestSnap;
        
        Animated.spring(translateY, {
          toValue: nearestSnap,
          useNativeDriver: true,
          damping: 24,
          stiffness: 140,
        }).start();
      }
    })
  ).current;

  // Toggle Bottom Sheet collapsed/expanded
  const toggleSheetState = () => {
    const isCollapsed = Math.abs(lastTranslatedY.current - snapPoints.collapsed) < 10;
    const targetSnap = isCollapsed ? snapPoints.expanded : snapPoints.collapsed;
    
    lastTranslatedY.current = targetSnap;
    Animated.spring(translateY, {
      toValue: targetSnap,
      useNativeDriver: true,
      damping: 24,
      stiffness: 140,
    }).start();
  };

  // Close Bottom Sheet smooth animation
  const closeBottomSheet = () => {
    Animated.spring(translateY, {
      toValue: SHEET_HEIGHT,
      damping: 26,
      stiffness: 150,
      useNativeDriver: true,
    }).start(() => {
      setActiveStopCode(null);
    });
  };

  // Automatically reset to collapsed state when a new stop code is selected
  useEffect(() => {
    if (activeStopCode) {
      Animated.spring(translateY, {
        toValue: snapPoints.collapsed,
        useNativeDriver: true,
        damping: 24,
        stiffness: 130,
      }).start(() => {
        lastTranslatedY.current = snapPoints.collapsed;
      });
    }
  }, [activeStopCode]);

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: activeTab === 'search' ? 0 : 1,
      damping: 22,
      stiffness: 150,
      useNativeDriver: true,
    }).start();
  }, [activeTab]);

  const translateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width / 2],
  });

  // When activeStopCode changes and we are on 'map' tab, scroll to bottom to show results
  useEffect(() => {
    if (activeTab === 'map' && activeStopCode) {
      setTimeout(() => {
        mapScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 500);
    }
  }, [activeStopCode, activeTab]);

  // Load favorites & recents on mount
  useEffect(() => {
    loadFavorites();
    loadRecents();
  }, []);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(FAVORITES_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to load favorites:', e);
    }
  };

  const loadRecents = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENTS_KEY);
      if (stored) setRecents(JSON.parse(stored));
    } catch (e) {
      console.warn('Failed to load recents:', e);
    }
  };

  const saveFavorites = async (newFavs: FavoriteStop[]) => {
    try {
      setFavorites(newFavs);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavs));
    } catch (e) {
      console.warn('Failed to save favorites:', e);
    }
  };

  const saveRecents = async (newRecents: FavoriteStop[]) => {
    try {
      setRecents(newRecents);
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(newRecents));
    } catch (e) {
      console.warn('Failed to save recents:', e);
    }
  };

  // Add stop to recent searches list
  const addToRecents = (code: string, name: string) => {
    const filtered = recents.filter(item => item.code !== code);
    const updated = [{ code, name }, ...filtered].slice(0, 10);
    saveRecents(updated);
  };

  // Fuzzy stop name search debouncer
  useEffect(() => {
    if (stopNameInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setSearchingStops(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchStopsByName(stopNameInput);
        setSuggestions(results);
      } catch (err) {
        console.warn('Stop name search error:', err);
      } finally {
        setSearchingStops(false);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [stopNameInput]);

  // Execute HelloBus arrival query (Parallel fetch for each line to maximize data density)
  const executeQuery = async (code: string, name?: string, lineFilter = lineFilterInput) => {
    if (!code.trim()) return;

    setQueryLoading(true);
    setQueryError(null);
    setActiveStopCode(code);
    
    let displayName = name || '公交站';
    let stopLinesStr = '';

    // Fetch stop name and passing lines from Supabase database
    try {
      const results = await searchStopsByName(code);
      const match = results.find(r => r.stop_code === code);
      if (match) {
        displayName = match.stop_name;
        stopLinesStr = match.lines || '';
      }
    } catch (e) {
      console.warn('Could not retrieve stop details:', e);
    }
    setActiveStopName(displayName);

    // Parse list of lines, e.g. ["25", "356", "N2"]
    const linesList = stopLinesStr ? stopLinesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    setActiveStopLines(linesList);
    setSelectedRouteFilter('ALL');

    try {
      let finalArrivals: BusArrival[] = [];

      if (lineFilter.trim()) {
        // Query specific user-filtered line
        finalArrivals = await fetchBusArrivals(code, lineFilter);
      } else if (linesList.length === 0) {
        // Fallback: Query all at once if no route data is populated
        finalArrivals = await fetchBusArrivals(code, '');
      } else {
        // Parallel queries to HelloBus API for all passing lines (improves density, like WeBus)
        const promises = linesList.map(line =>
          fetchBusArrivals(code, line)
            .catch(err => {
              console.warn(`Query failed for line ${line}:`, err);
              return [] as BusArrival[];
            })
        );
        const results = await Promise.all(promises);
        const combined = results.flat();

        // Sort all arrivals by remaining minutes (handling midnight crossing)
        combined.sort((a, b) => {
          const [ah, am] = a.time.split(':').map(Number);
          const [bh, bm] = b.time.split(':').map(Number);
          const now = new Date();
          const nowMin = now.getHours() * 60 + now.getMinutes();
          
          let aMin = ah * 60 + am;
          let bMin = bh * 60 + bm;
          
          if (aMin - nowMin < -120) aMin += 24 * 60;
          if (bMin - nowMin < -120) bMin += 24 * 60;
          
          return aMin - bMin;
        });

        // Filter duplicates
        finalArrivals = combined.filter((item, index, self) =>
          self.findIndex(t => t.line === item.line && t.time === item.time) === index
        );
      }

      setAllArrivals(finalArrivals);
      setArrivals(finalArrivals);
      addToRecents(code, displayName);
    } catch (err: any) {
      setQueryError(err.message || '查询失败，请稍后重试');
      setArrivals([]);
      setAllArrivals([]);
    } finally {
      setQueryLoading(false);
    }
  };

  // Filter display list by selected route tab
  const getFilteredArrivals = () => {
    if (selectedRouteFilter === 'ALL') {
      return arrivals;
    }
    // E.g., Filter "25" matches both "25", "25A" and "25B"
    return arrivals.filter(bus => 
      bus.line.toUpperCase() === selectedRouteFilter.toUpperCase() ||
      bus.line.toUpperCase().startsWith(selectedRouteFilter.toUpperCase())
    );
  };

  const displayedArrivals = getFilteredArrivals();

  const handleLocateUser = async () => {
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const requestResult = await Location.requestForegroundPermissionsAsync();
        status = requestResult.status;
      }

      if (status !== 'granted') {
        Alert.alert('提示', '未获得定位权限，无法在地图上定位您的位置。');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      webViewRef.current?.injectJavaScript(`
        if (window.updateUserLocation) {
          window.updateUserLocation(${latitude}, ${longitude});
        }
      `);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('提示', '获取位置失败，请检查手机GPS定位是否已开启。');
    }
  };

  // Handle map center changes and stop selecting
  const handleMapMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'MAP_MOVED') {
        const { lat, lon, zoom, minLat, maxLat, minLon, maxLon } = message;
        setMapCenter({ lat, lon });
        
        // Fetch stops within bounding box, if zoomed in enough (zoom >= 13)
        let stops: BusStop[] = [];
        if (zoom === undefined || zoom >= 13) {
          const qMinLat = minLat !== undefined ? minLat : lat - 0.004;
          const qMaxLat = maxLat !== undefined ? maxLat : lat + 0.004;
          const qMinLon = minLon !== undefined ? minLon : lon - 0.005;
          const qMaxLon = maxLon !== undefined ? maxLon : lon + 0.005;
          
          stops = await fetchStopsInBoundingBox(
            qMinLat,
            qMaxLat,
            qMinLon,
            qMaxLon,
            1000 // Query more stops to support clustering over visible bounds
          );
        }
        webViewRef.current?.injectJavaScript(`window.updateStops('${JSON.stringify(stops)}')`);
      } else if (message.type === 'SELECT_STOP') {
        const { code, name } = message;
        setStopCodeInput(code);
        setStopNameInput('');
        setSuggestions([]);
        executeQuery(code, name);
      }
    } catch (err) {
      console.warn('Map message error:', err);
    }
  };

  // Favorites management
  const handleAddFavorite = () => {
    if (!activeStopCode || !activeStopName) return;
    setNewFavCustomName(activeStopName);
    setFavModalVisible(true);
  };

  const confirmAddFavorite = () => {
    if (!activeStopCode || !activeStopName) return;

    const filtered = favorites.filter(item => item.code !== activeStopCode);
    const newFav: FavoriteStop = {
      code: activeStopCode,
      name: activeStopName,
      customName: newFavCustomName.trim() || activeStopName
    };
    saveFavorites([...filtered, newFav]);
    setFavModalVisible(false);
  };

  const handleRemoveFavorite = (code: string) => {
    const updated = favorites.filter(item => item.code !== code);
    saveFavorites(updated);
  };

  // Convert arrival time to human countdown string
  const getCountdownString = (timeStr: string) => {
    const [arrH, arrM] = timeStr.split(':').map(Number);
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();

    let diff = (arrH * 60 + arrM) - (nowH * 60 + nowM);
    if (diff < -120) {
      diff += 24 * 60;
    }

    if (diff < 0) {
      return '已离站';
    } else if (diff === 0) {
      return '即将到站';
    } else {
      return `${diff} 分钟`;
    }
  };

    // Pan Leaflet WebView map to selected stop location
  const handleLocateOnMap = async (code: string, name: string) => {
    setActiveTab('map');
    try {
      const results = await searchStopsByName(code);
      const stop = results.find(r => r.stop_code === code);
      if (stop && stop.latitude && stop.longitude) {
        setMapCenter({ lat: stop.latitude, lon: stop.longitude });
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(`window.panTo(${stop.latitude}, ${stop.longitude})`);
        }, 500); // 500ms delay to give the map WebView time to mount and layout
      } else {
        Alert.alert('提示', '未找到该站点的坐标信息，请在地图上拖动查找。');
      }
    } catch (e) {
      console.warn('Failed to pan map to stop:', e);
    }
  };

  const isFavorite = activeStopCode ? favorites.some(f => f.code === activeStopCode) : false;

  // Extract arrivals board rendering to prevent duplication
  const renderArrivalsBoard = (hideHeader = false) => {
    return (
      <View style={hideHeader ? { paddingHorizontal: 4 } : [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 4 }]}>
        {!hideHeader && (
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activeStopName, { color: colors.textPrimary }]} numberOfLines={1}>
                {activeStopName}
              </Text>
              <Text style={[styles.activeStopCode, { color: colors.textSecondary }]}>
                站牌号: {activeStopCode}
              </Text>
            </View>

            <Pressable
              style={[
                styles.favIconBtn,
                { 
                  borderColor: isFavorite ? colors.primary : colors.border,
                  backgroundColor: isFavorite ? colors.primary + '15' : 'transparent' 
                }
              ]}
              onPress={isFavorite ? () => handleRemoveFavorite(activeStopCode!) : handleAddFavorite}
            >
              <Ionicons 
                name={isFavorite ? "star" : "star-outline"} 
                size={22} 
                color={isFavorite ? colors.primary : colors.textSecondary} 
              />
            </Pressable>
          </View>
        )}

        {queryError ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>{queryError}</Text>
          </View>
        ) : displayedArrivals.length === 0 && !queryLoading ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bus-alert" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              当前筛选条件下此站点无到站公交
            </Text>
          </View>
        ) : (
          <View style={styles.arrivalsList}>
            <Text style={[styles.listHeaderTitle, { color: colors.textSecondary }]}>实时到站 (Live Arrivals)</Text>
            {displayedArrivals.map((bus, idx) => {
              const dest = ROUTE_DESTINATIONS[bus.line] || 
                           ROUTE_DESTINATIONS[bus.line.replace(/[a-zA-Z]/g, '')] || 
                           'Bologna Rete Bus';
              return (
                <Pressable 
                  key={idx} 
                  style={({ pressed }) => [
                    styles.arrivalItem, 
                    { 
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent'
                    }
                  ]}
                  onPress={() => setSelectedArrival(bus)}
                >
                  {/* WeBus dynamic colored line badge */}
                  <View style={[styles.lineBadge, { backgroundColor: getLineColor(bus.line) }]}>
                    <Text style={styles.lineText}>{bus.line}</Text>
                  </View>

                  {/* Line destination, time, status */}
                  <View style={styles.arrivalMiddle}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.arrivalTime, { color: colors.textPrimary }]}>
                        {bus.time}
                      </Text>
                      
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: bus.type === 'satellite' ? '#10B98115' : '#6B728015' }
                      ]}>
                        <View style={[
                          styles.statusDot, 
                          { backgroundColor: bus.type === 'satellite' ? '#10B981' : '#6B7280' }
                        ]} />
                        <Text style={[
                          styles.statusText, 
                          { color: bus.type === 'satellite' ? '#10B981' : '#6B7280' }
                        ]}>
                          {bus.type === 'satellite' ? 'real time' : 'scheduled'}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.destinationText, { color: colors.textSecondary }]} numberOfLines={1}>
                      ➔ {dest}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      {bus.hasRamp && (
                        <View style={styles.rampBadge}>
                          <FontIcon name="wheelchair" size={11} color={colors.primary} style={{ marginRight: 2 }} />
                          <Text style={[styles.rampText, { color: colors.primary }]}>无障碍踏板</Text>
                        </View>
                      )}
                      {bus.busNumber && (
                        <Text style={{ fontSize: 10, color: colors.textMuted, marginLeft: bus.hasRamp ? 8 : 0 }}>
                          车号: #{bus.busNumber}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Countdown */}
                  <View style={styles.arrivalRight}>
                    <Text style={[styles.countdownText, { color: colors.primary }]}>
                      {getCountdownString(bus.time)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* WeBus style Route filter tabs */}
        {activeStopLines.length > 0 && !queryError && (
          <View style={[styles.routesFilterContainer, { borderTopColor: colors.border }]}>
            <Text style={[styles.routesFilterTitle, { color: colors.textSecondary }]}>线路过滤 (Routes)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.routesFilterList}>
              <Pressable
                style={[
                  styles.routeFilterBtn,
                  { 
                    backgroundColor: selectedRouteFilter === 'ALL' ? '#E30613' : (isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7'),
                    borderColor: selectedRouteFilter === 'ALL' ? '#E30613' : colors.border
                  }
                ]}
                onPress={() => setSelectedRouteFilter('ALL')}
              >
                <Text style={[styles.routeFilterBtnText, { color: selectedRouteFilter === 'ALL' ? '#FFF' : colors.textPrimary }]}>
                  全部
                </Text>
              </Pressable>
              {activeStopLines.map(line => (
                <Pressable
                  key={line}
                  style={[
                    styles.routeFilterBtn,
                    { 
                      backgroundColor: selectedRouteFilter === line ? getLineColor(line) : (isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7'),
                      borderColor: selectedRouteFilter === line ? getLineColor(line) : colors.border
                    }
                  ]}
                  onPress={() => setSelectedRouteFilter(line)}
                >
                  <Text style={[styles.routeFilterBtnText, { color: selectedRouteFilter === line ? '#FFF' : colors.textPrimary }]}>
                    {line}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>博洛尼亚公交查询</Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => activeStopCode && executeQuery(activeStopCode, activeStopName || undefined)}
          disabled={queryLoading || !activeStopCode}
        >
          {queryLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="refresh" size={24} color={activeStopCode ? colors.primary : colors.textMuted} />
          )}
        </Pressable>
      </View>

      {/* Tabs Selector */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => setActiveTab('search')}
          style={styles.tab}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'search' ? colors.primary : colors.textSecondary }
            ]}
          >
            搜索查询
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('map')}
          style={styles.tab}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'map' ? colors.primary : colors.textSecondary }
            ]}
          >
            地图选点
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

      {activeTab === 'search' ? (
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search Panel */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: SPACING.md }]}>查询车辆到站</Text>
            
            <View style={styles.rowInputs}>
              <View style={{ flex: 2, marginRight: 8 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>数字站牌号 (Fermata)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.textInput,
                      { 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7', 
                        color: colors.textPrimary,
                        borderColor: colors.border 
                      }
                    ]}
                    placeholder="如: 4306"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={stopCodeInput}
                    onChangeText={(val) => {
                      setStopCodeInput(val);
                      if (val.trim()) {
                        setStopNameInput('');
                      }
                    }}
                  />
                </View>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>过滤线路 (可选)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.textInput,
                      { 
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7', 
                        color: colors.textPrimary,
                        borderColor: colors.border 
                      }
                    ]}
                    placeholder="如: 25"
                    placeholderTextColor={colors.textMuted}
                    value={lineFilterInput}
                    onChangeText={setLineFilterInput}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            <View style={{ marginTop: 12 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>通过名字模糊搜索 (Nome Fermata)</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.textInput,
                    { 
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7', 
                      color: colors.textPrimary,
                      borderColor: colors.border 
                    }
                  ]}
                  placeholder="输入站名关键词，如: Casaralta"
                  placeholderTextColor={colors.textMuted}
                  value={stopNameInput}
                  onChangeText={setStopNameInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Autocomplete Dropdown */}
            {searchingStops && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 12 }} />
            )}

            {suggestions.length > 0 && (
              <View style={[styles.suggestionsBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                {suggestions.map((item) => (
                  <Pressable
                    key={item.stop_code}
                    style={({ pressed }) => [
                      styles.suggestionItem,
                      { 
                        borderBottomColor: colors.border,
                        backgroundColor: pressed ? (isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7') : 'transparent'
                      }
                    ]}
                    onPress={() => {
                      setStopCodeInput(item.stop_code);
                      setStopNameInput('');
                      setSuggestions([]);
                      executeQuery(item.stop_code, item.stop_name);
                    }}
                  >
                    <Ionicons name="bus-outline" size={16} color={colors.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.stop_name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>站牌号: {item.stop_code} {item.lines ? `(${item.lines})` : ''}</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}

            <View style={{ marginTop: 16 }}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  { 
                    backgroundColor: stopCodeInput.trim() ? colors.primary : colors.textMuted,
                    opacity: pressed ? 0.9 : 1
                  }
                ]}
                disabled={!stopCodeInput.trim()}
                onPress={() => executeQuery(stopCodeInput)}
              >
                <Text style={styles.actionButtonText}>查询到站信息</Text>
              </Pressable>
            </View>
          </View>

          {/* Live Arrivals Board */}
          {activeStopCode && renderArrivalsBoard()}

          {/* Favorite Stops */}
          {favorites.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>常用收藏</Text>
              <View style={styles.favoritesGrid}>
                {favorites.map((fav) => (
                  <Pressable
                    key={fav.code}
                    style={({ pressed }) => [
                      styles.favChip,
                      { 
                        backgroundColor: colors.surface, 
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1
                      }
                    ]}
                    onPress={() => executeQuery(fav.code, fav.name)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.favChipTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {fav.customName || fav.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>站牌号: {fav.code}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        style={styles.favMapLocBtn}
                        onPress={() => handleLocateOnMap(fav.code, fav.name)}
                      >
                        <Ionicons name="map-outline" size={15} color={colors.primary} />
                      </Pressable>
                      <Pressable
                        style={styles.favRemoveBtn}
                        onPress={() => handleRemoveFavorite(fav.code)}
                      >
                        <Ionicons name="close" size={16} color={colors.error} />
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.dataSourceFooter}>
            <Text style={[styles.dataSourceText, { color: colors.textMuted }]}>
              数据来源: 博洛尼亚 TPER (Trasporto Passeggeri Emilia-Romagna) 官方实时数据接口
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Map Container - fills the whole screen under tabs */}
          <View style={{ flex: 1 }}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: getMapHtml(isDark) }}
              style={{ flex: 1 }}
              onMessage={handleMapMessage}
              domStorageEnabled={true}
              javaScriptEnabled={true}
            />
          </View>

          {/* Floating Guide Banner (only when no stop is selected) */}
          {!activeStopCode && (
            <View style={[styles.floatingMapGuide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.floatingMapGuideText, { color: colors.textSecondary }]}>
                请在地图中拖动并点击红色标记选择站点
              </Text>
            </View>
          )}

          {/* Floating GPS Locate Button */}
          <Pressable
            style={({ pressed }) => [
              styles.locateButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                bottom: activeStopCode ? 296 : 24,
                opacity: pressed ? 0.8 : 1,
              }
            ]}
            onPress={handleLocateUser}
          >
            <MaterialIcons name="my-location" size={22} color={colors.primary} />
          </Pressable>

          {/* Draggable/Animated Bottom Sheet for Arrivals Board */}
          {activeStopCode && (
            <Animated.View 
              style={[
                styles.bottomSheet, 
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  transform: [{ translateY }]
                }
              ]}
            >
              {/* Draggable Handle and Header */}
              <View 
                {...panResponder.panHandlers}
                style={[styles.sheetHeader, { borderBottomColor: colors.border }]}
              >
                <Pressable style={styles.sheetHandleContainer} onPress={toggleSheetState}>
                  <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }]} />
                </Pressable>
                
                <View style={styles.sheetHeaderContent}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.activeStopName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {activeStopName}
                    </Text>
                    <Text style={[styles.activeStopCode, { color: colors.textSecondary }]}>
                      站牌号: {activeStopCode}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Pressable
                      style={[
                        styles.favIconBtn,
                        { 
                          borderColor: isFavorite ? colors.primary : colors.border,
                          backgroundColor: isFavorite ? colors.primary + '15' : 'transparent',
                          width: 38,
                          height: 38,
                        }
                      ]}
                      onPress={isFavorite ? () => handleRemoveFavorite(activeStopCode!) : handleAddFavorite}
                    >
                      <Ionicons 
                        name={isFavorite ? "star" : "star-outline"} 
                        size={20} 
                        color={isFavorite ? colors.primary : colors.textSecondary} 
                      />
                    </Pressable>
                    
                    <Pressable
                      style={[styles.sheetCloseBtn, { borderColor: colors.border }]}
                      onPress={closeBottomSheet}
                    >
                      <Ionicons name="close" size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Scrollable live board content inside sheet */}
              <ScrollView 
                style={styles.sheetScrollView} 
                contentContainerStyle={styles.sheetScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {renderArrivalsBoard(true)}
                
                <View style={styles.dataSourceFooter}>
                  <Text style={[styles.dataSourceText, { color: colors.textMuted }]}>
                    数据来源: 博洛尼亚 TPER (Trasporto Passeggeri Emilia-Romagna) 官方实时数据接口
                  </Text>
                </View>
                
                <View style={{ height: 40 }} />
              </ScrollView>
            </Animated.View>
          )}
        </View>
      )}

      {/* Save Favorite Modal */}
      <Modal
        visible={favModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFavModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>收藏该站点</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8, fontWeight: '500' }}>
              添加备注
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7', 
                  color: colors.textPrimary,
                  borderColor: colors.border
                }
              ]}
              placeholder="留空则默认站名"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
              value={newFavCustomName}
              onChangeText={setNewFavCustomName}
              clearButtonMode="while-editing"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setFavModalVisible(false)}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={confirmAddFavorite}
              >
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>收藏</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bus Arrival Detail Modal */}
      {selectedArrival && (
        <Modal
          visible={!!selectedArrival}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedArrival(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', borderColor: colors.border }]}>
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 0 }]}>车辆到站详情</Text>
                <Pressable onPress={() => setSelectedArrival(null)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Arrival details layout */}
              <View style={{ alignItems: 'center', gap: 12, marginBottom: 20 }}>
                {/* Large Line Badge */}
                <View style={[styles.lineBadgeLarge, { backgroundColor: getLineColor(selectedArrival.line) }]}>
                  <Text style={styles.lineTextLarge}>{selectedArrival.line}</Text>
                </View>
                
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.textPrimary }}>
                  ➔ {ROUTE_DESTINATIONS[selectedArrival.line] || ROUTE_DESTINATIONS[selectedArrival.line.replace(/[a-zA-Z]/g, '')] || 'Bologna Rete Bus'}
                </Text>

                {/* Countdown & Time */}
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.primary }}>
                    {getCountdownString(selectedArrival.time)}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                    预计到站时间: {selectedArrival.time}
                  </Text>
                </View>
              </View>

              {/* Detail List */}
              <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginBottom: 16 }}>
                {/* Stop info */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>当前查询站点</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '500', fontSize: 13, maxWidth: '60%' }} numberOfLines={1}>
                    {activeStopName} ({activeStopCode})
                  </Text>
                </View>

                {/* Tracking type */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>定位追踪方式</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[
                      styles.statusDot, 
                      { backgroundColor: selectedArrival.type === 'satellite' ? '#10B981' : '#6B7280', marginRight: 6 }
                    ]} />
                    <Text style={{ color: selectedArrival.type === 'satellite' ? '#10B981' : colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                      {selectedArrival.type === 'satellite' ? '卫星实时追踪 (Live)' : '计划排班时刻 (Scheduled)'}
                    </Text>
                  </View>
                </View>

                {/* Vehicle number */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>公交车牌号</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '500', fontSize: 13 }}>
                    {selectedArrival.busNumber ? `#${selectedArrival.busNumber}` : '暂无车号信息'}
                  </Text>
                </View>

                {/* Wheelchair ramp */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>无障碍设施</Text>
                  <Text style={{ color: selectedArrival.hasRamp ? colors.primary : colors.textSecondary, fontWeight: '500', fontSize: 13 }}>
                    {selectedArrival.hasRamp ? '配备无障碍踏板' : '未配备或暂无信息'}
                  </Text>
                </View>
              </View>

              {/* Information Tip */}
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', padding: 12, borderRadius: 10 }}>
                <Text style={{ fontSize: 11, color: colors.textMuted, lineHeight: 15 }}>
                  提示: 卫星实时追踪（实时）的时间会根据公交车当前的 GPS 坐标及道路拥堵状况进行动态计算与调整。请提前前往站点候车。
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function FontIcon({ name, size, color, style }: { name: string; size: number; color: string; style?: any }) {
  return (
    <MaterialCommunityIcons 
      name={name as any} 
      size={size} 
      color={color} 
      style={style} 
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingLeft: 12,
    minWidth: 44,
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputContainer: {
    height: 40,
  },
  textInput: {
    flex: 1,
    height: '100%',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  rowInputs: {
    flexDirection: 'row',
  },
  rowButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  mapToggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapToggleText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  suggestionsBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  mapTip: {
    fontSize: 11,
    lineHeight: 15,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120,120,120,0.1)',
  },
  activeStopName: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  activeStopCode: {
    fontSize: 12,
    marginTop: 2,
  },
  favIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.2)',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  arrivalsList: {
    gap: 4,
  },
  listHeaderTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  arrivalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  lineBadge: {
    width: 44,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  arrivalMiddle: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  arrivalTime: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  destinationText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  rampBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F615',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rampText: {
    fontSize: 9,
    fontWeight: '600',
  },
  arrivalRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 70,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  routesFilterContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  routesFilterTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routesFilterList: {
    gap: 8,
  },
  routeFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  routeFilterBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    gap: 8,
  },
  favoritesGrid: {
    gap: 8,
  },
  favChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  favChipTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  favMapLocBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentsRow: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  recentChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
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
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: Dimensions.get('window').height * 0.75,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  sheetHandleContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  sheetHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetScrollView: {
    flex: 1,
  },
  sheetScrollContent: {
    padding: 16,
  },
  floatingMapGuide: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingMapGuideText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dataSourceFooter: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dataSourceText: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  lineBadgeLarge: {
    width: 60,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  lineTextLarge: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  locateButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
