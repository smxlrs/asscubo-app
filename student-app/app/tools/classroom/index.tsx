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
  RefreshControl,
  Modal,
  TextInput,
  BackHandler
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, Language } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

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

const LOCALIZED_STRINGS: Record<Language, Record<string, string>> = {
  zh: {
    title: '博大空教室',
    syncing: '正在同步博洛尼亚大学排课系统...',
    errorMsg: '网络请求错误，请重试',
    retry: '重新加载',
    availableRooms: '当前选定时段可用',
    dataSource: '数据来源: University Planner (CINECA)',
    dataDisclaimer: '* 仅供参考，请以学校实际授课安排为准',
    filterTime: '时段筛选',
    timeNow: '此时此刻',
    timeMorning: '上午自习',
    timeAfternoon: '下午自习',
    timeCustom: '自定义',
    customStart: '开始时间',
    customEnd: '结束时间',
    selectCampus: '选择校区',
    allCampuses: '全部校区',
    selectBuilding: '选择教学楼',
    allBuildings: '全部大楼',
    selectCapacity: '选择容量',
    capacityAll: '容量不限',
    capacitySmall: '小型(<30人)',
    capacityMedium: '中型(30-70人)',
    capacityLarge: '大型(>70人)',
    classroomList: '教室列表',
    noClassrooms: '没有符合当前筛选条件的教室',
    buildingClosed: '大楼关闭',
    isOccupied: '已被占用',
    isFree: '空闲',
    currentBooking: '当前',
    seatsUnitSmall: '人',
    seatsUnitFull: '个座位',
    timelineTitle: '今日开放时段占用图 (时间轴)',
    oneClickGo: '一键前往',
    noBookingText: '今日暂无占用，整天可用',
    occupiedLabel: '占',
    studyFree: '空闲可自习',
    cancel: '取消',
    classroomUnit: ' 间',
    searchPlaceholder: '搜索教室名称、教学楼、地址...',
    refreshSuccess: '刷新成功',
  },
  'zh-Hant': {
    title: '博大空教室',
    syncing: '正在同步博洛尼亞大學排課系統...',
    errorMsg: '網絡請求錯誤，請重試',
    retry: '重新加載',
    availableRooms: '當前選定時段可用',
    dataSource: '數據來源: University Planner (CINECA)',
    dataDisclaimer: '* 僅供參考，請以學校實際授課安排為准',
    filterTime: '時段篩選',
    timeNow: '此時此刻',
    timeMorning: '上午自習',
    timeAfternoon: '下午自習',
    timeCustom: '自定義',
    customStart: '開始時間',
    customEnd: '結束時間',
    selectCampus: '選擇校區',
    allCampuses: '全部校區',
    selectBuilding: '選擇教學樓',
    allBuildings: '全部大樓',
    selectCapacity: '選擇容量',
    capacityAll: '容量不限',
    capacitySmall: '小型(<30人)',
    capacityMedium: '中型(30-70人)',
    capacityLarge: '大型(>70人)',
    classroomList: '教室列表',
    noClassrooms: '沒有符合當前篩選條件的教室',
    buildingClosed: '大樓關閉',
    isOccupied: '已被占用',
    isFree: '空閑',
    currentBooking: '當前',
    seatsUnitSmall: '人',
    seatsUnitFull: '個座位',
    timelineTitle: '今日開放時段占用圖 (時間軸)',
    oneClickGo: '一鍵前往',
    noBookingText: '今日暫無占用，整天可用',
    occupiedLabel: '占',
    studyFree: '空閑可自習',
    cancel: '取消',
    classroomUnit: ' 間',
    searchPlaceholder: '搜索教室名稱、教學樓、地址...',
    refreshSuccess: '刷新成功',
  },
  en: {
    title: 'Empty Classrooms',
    syncing: 'Syncing with University of Bologna planner...',
    errorMsg: 'Network error, please try again',
    retry: 'Retry',
    availableRooms: 'Available now',
    dataSource: 'Source: University Planner (CINECA)',
    dataDisclaimer: '* For reference only, subject to official schedules',
    filterTime: 'Time Filter',
    timeNow: 'Now',
    timeMorning: 'Morning',
    timeAfternoon: 'Afternoon',
    timeCustom: 'Custom',
    customStart: 'Start Time',
    customEnd: 'End Time',
    selectCampus: 'Select Campus',
    allCampuses: 'Campus',
    selectBuilding: 'Select Building',
    allBuildings: 'Building',
    selectCapacity: 'Select Capacity',
    capacityAll: 'Capacity',
    capacitySmall: 'Small (<30 seats)',
    capacityMedium: 'Medium (30-70 seats)',
    capacityLarge: 'Large (>70 seats)',
    classroomList: 'Classroom List',
    noClassrooms: 'No classrooms match current filters',
    buildingClosed: 'Closed',
    isOccupied: 'Occupied',
    isFree: 'Free',
    currentBooking: 'Current',
    seatsUnitSmall: ' seats',
    seatsUnitFull: ' seats',
    timelineTitle: 'Today\'s Availability Timeline',
    oneClickGo: 'Navigate',
    noBookingText: 'No bookings today, available all day',
    occupiedLabel: 'Occ',
    studyFree: 'Available for study',
    cancel: 'Cancel',
    classroomUnit: ' rooms',
    searchPlaceholder: 'Search classroom, building, address...',
    refreshSuccess: 'Refresh successful',
  },
  it: {
    title: 'Aule Libere',
    syncing: 'Sincronizzazione con l\'orario di Unibo...',
    errorMsg: 'Errore di rete, riprova',
    retry: 'Riprova',
    availableRooms: 'Disponibili nella fascia selezionata',
    dataSource: 'Fonte: University Planner (CINECA)',
    dataDisclaimer: '* A scopo informativo, fare riferimento agli orari ufficiali',
    filterTime: 'Filtro Orario',
    timeNow: 'Adesso',
    timeMorning: 'Mattina',
    timeAfternoon: 'Pomeriggio',
    timeCustom: 'Personalizzato',
    customStart: 'Ora Inizio',
    customEnd: 'Ora Fine',
    selectCampus: 'Seleziona Campus',
    allCampuses: 'Sede',
    selectBuilding: 'Seleziona Edificio',
    allBuildings: 'Edificio',
    selectCapacity: 'Seleziona Capienza',
    capacityAll: 'Capienza',
    capacitySmall: 'Piccola (<30 posti)',
    capacityMedium: 'Media (30-70 posti)',
    capacityLarge: 'Grande (>70 posti)',
    classroomList: 'Elenco Aule',
    noClassrooms: 'Nessuna aula corrisponde ai filtri',
    buildingClosed: 'Chiuso',
    isOccupied: 'Occupata',
    isFree: 'Libera',
    currentBooking: 'Corrente',
    seatsUnitSmall: ' posti',
    seatsUnitFull: ' posti',
    timelineTitle: 'Occupazione aula oggi (Timeline)',
    oneClickGo: 'Indicazioni',
    noBookingText: 'Nessuna prenotazione oggi, libera tutto il giorno',
    occupiedLabel: 'Occ',
    studyFree: 'Libera per studio',
    cancel: 'Annulla',
    classroomUnit: ' aule',
    searchPlaceholder: 'Cerca aula, edificio, indirizzo...',
    refreshSuccess: 'Aggiornato con successo',
  }
};

type ServiceCategory = 'blackboard' | 'projector' | 'audio' | 'internet' | 'accessible' | 'other';

function getServiceCategory(codice: string, descrizione: string): ServiceCategory {
  const code = (codice || '').toLowerCase();
  const desc = (descrizione || '').toLowerCase();
  
  if (code.includes('lavagna') || desc.includes('lavagna')) {
    return 'blackboard';
  }
  if (code.includes('proiett') || desc.includes('proiett') || code.includes('video') || desc.includes('video') || code.includes('schermo') || desc.includes('schermo')) {
    return 'projector';
  }
  if (code.includes('audio') || desc.includes('audio') || code.includes('microf') || desc.includes('microf') || code.includes('parl') || desc.includes('parl')) {
    return 'audio';
  }
  if (code.includes('rete') || desc.includes('rete') || code.includes('pc') || desc.includes('pc') || code.includes('internet') || desc.includes('internet') || code.includes('wifi') || desc.includes('wi-fi') || desc.includes('wifi') || desc.includes('wi-fi')) {
    return 'internet';
  }
  if (code.includes('accessib') || desc.includes('accessib') || code.includes('disabili') || desc.includes('disabili') || code.includes('3.1')) {
    return 'accessible';
  }
  return 'other';
}

interface ServiceTranslation {
  icon: keyof typeof MaterialIcons.glyphMap;
  abbrev: Record<Language, string>;
  full: Record<Language, string>;
}

const serviceTranslations: Record<ServiceCategory, ServiceTranslation> = {
  blackboard: {
    icon: 'edit',
    abbrev: {
      zh: '黑板',
      'zh-Hant': '黑板',
      en: 'Board',
      it: 'Lavagna',
    },
    full: {
      zh: '白板/黑板',
      'zh-Hant': '白板/黑板',
      en: 'Blackboard / Whiteboard',
      it: 'Lavagna / Lavagna a fogli',
    }
  },
  projector: {
    icon: 'videocam',
    abbrev: {
      zh: '投影',
      'zh-Hant': '投影',
      en: 'Proj.',
      it: 'Proiett.',
    },
    full: {
      zh: '多媒体投影仪',
      'zh-Hant': '多媒體投影儀',
      en: 'Video Projector / Screen',
      it: 'Videoproiettore / Schermo',
    }
  },
  audio: {
    icon: 'mic',
    abbrev: {
      zh: '音频',
      'zh-Hant': '音頻',
      en: 'Audio',
      it: 'Audio',
    },
    full: {
      zh: '音频麦克风系统',
      'zh-Hant': '音頻麥克風系統',
      en: 'Audio / Microphone System',
      it: 'Sistema Audio / Microfono',
    }
  },
  internet: {
    icon: 'settings-ethernet',
    abbrev: {
      zh: '网络',
      'zh-Hant': '網絡',
      en: 'Network',
      it: 'Rete',
    },
    full: {
      zh: '教师电脑/网络连接',
      'zh-Hant': '教師電腦/網絡連接',
      en: 'Teacher PC / Network Connection',
      it: 'PC Docente / Connessione Rete',
    }
  },
  accessible: {
    icon: 'accessible',
    abbrev: {
      zh: '无障碍',
      'zh-Hant': '無障礙',
      en: 'Access.',
      it: 'Access.',
    },
    full: {
      zh: '无障碍通道与设施',
      'zh-Hant': '無障礙通道與設施',
      en: 'Accessible for disabled students',
      it: 'Accessible per studenti con disabilità',
    }
  },
  other: {
    icon: 'settings',
    abbrev: {
      zh: '设备',
      'zh-Hant': '設備',
      en: 'Equip.',
      it: 'Servizio',
    },
    full: {
      zh: '其他多媒体教学设备',
      'zh-Hant': '其他多媒體教學設備',
      en: 'Other classroom services',
      it: 'Altri servizi per aula',
    }
  }
};

const getCampusLabel = (campus: string, lang: Language) => {
  const c = campus.toLowerCase();
  if (c.includes('bologna')) return lang === 'en' || lang === 'it' ? 'Bologna' : lang === 'zh-Hant' ? '博洛尼亞' : '博洛尼亚';
  if (c.includes('cesena')) return lang === 'en' || lang === 'it' ? 'Cesena' : lang === 'zh-Hant' ? '切塞納' : '切塞纳';
  if (c.includes('forl')) return lang === 'en' || lang === 'it' ? 'Forlì' : lang === 'zh-Hant' ? '弗利' : '弗利';
  if (c.includes('ravenna')) return lang === 'en' || lang === 'it' ? 'Ravenna' : lang === 'zh-Hant' ? '拉文納' : '拉文纳';
  if (c.includes('rimini')) return lang === 'en' || lang === 'it' ? 'Rimini' : lang === 'zh-Hant' ? '里米尼' : '里米尼';
  return campus;
};

const matchCampus = (comuneStr: string, selected: string) => {
  const clean = (s: string) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return clean(comuneStr) === clean(selected);
};

const getBuildingHint = (desc: string, lang: string): string => {
  const lowercase = desc.toLowerCase();
  if (lowercase.includes('ingegneria') || lowercase.includes('risorgimento')) {
    if (lang === 'it') return 'Dip. di Ingegneria';
    if (lang === 'en') return 'Engineering Campus';
    if (lang === 'zh-Hant') return '工程系 / 工程校區 (Ingegneria)';
    return '工程系 / 工程校区 (Ingegneria)';
  }
  if (lowercase.includes('porta s. donato, 2') || lowercase.includes('porta san donato 2')) {
    if (lang === 'it') return 'Dip. di Matematica';
    if (lang === 'en') return 'Math Department';
    if (lang === 'zh-Hant') return '數學系 (Matematica)';
    return '数学系 (Matematica)';
  }
  if (lowercase.includes('porta s. donato, 1') || lowercase.includes('porta san donato 1')) {
    if (lang === 'it') return 'Informatica / Fisica';
    if (lang === 'en') return 'Computer Science / Physics';
    if (lang === 'zh-Hant') return '計算機系 / 物理系 (Informatica / Fisica)';
    return '计算机系 / 物理系 (Informatica / Fisica)';
  }
  if (lowercase.includes('selmi 2') || lowercase.includes('selmi 3')) {
    if (lang === 'it') return 'Chimica / Matematica';
    if (lang === 'en') return 'Chemistry / Math';
    if (lang === 'zh-Hant') return '化學系 / 數學系 (Chimica / Matematica)';
    return '化学系 / 数学系 (Chimica / Matematica)';
  }
  if (lowercase.includes('irnerio 46')) {
    if (lang === 'it') return 'Geologia / Fisica';
    if (lang === 'en') return 'Geology / Physics';
    if (lang === 'zh-Hant') return '地質學 / 物理學 (Geologia / Fisica)';
    return '地质学 / 物理学 (Geologia / Fisica)';
  }
  if (lowercase.includes('irnerio 42') || lowercase.includes('irnerio 40')) {
    if (lang === 'it') return 'Biologia / Scienze';
    if (lang === 'en') return 'Biology / Science';
    if (lang === 'zh-Hant') return '生物系 / 科學大樓 (Biologia / Scienze)';
    return '生物系 / 科学大楼 (Biologia / Scienze)';
  }
  if (lowercase.includes('ranzani') || lowercase.includes('filippo re') || lowercase.includes('filippo-re')) {
    if (lowercase.includes('ranzani')) {
      if (lang === 'it') return 'Agraria';
      if (lang === 'en') return 'Agriculture';
      if (lang === 'zh-Hant') return '農學 / 林學 (Agraria)';
      return '农学 / 林学 (Agraria)';
    }
    if (lowercase.includes('filippo re')) {
      if (lang === 'it') return 'Psicologia / Educazione';
      if (lang === 'en') return 'Psychology / Education';
      if (lang === 'zh-Hant') return '心理學 / 教育學 (Psicologia / Educazione)';
      return '心理学 / 教育学 (Psicologia / Educazione)';
    }
    if (lang === 'it') return 'Agraria';
    if (lang === 'en') return 'Agriculture';
    if (lang === 'zh-Hant') return '農業與自然科學 (Agraria)';
    return '农业与自然科学 (Agraria)';
  }
  if (lowercase.includes('san giacomo')) {
    if (lang === 'it') return 'Farmacia / Anatomia';
    if (lang === 'en') return 'Pharmacy / Anatomy';
    if (lang === 'zh-Hant') return '藥學 / 解剖學 (Farmacia / Anatomia)';
    return '药学 / 解剖学 (Farmacia / Anatomia)';
  }
  if (lowercase.includes('berti pichat')) {
    if (lang === 'it') return 'Fisica / Astronomia';
    if (lang === 'en') return 'Physics / Astronomy';
    if (lang === 'zh-Hant') return '物理系 / 天文系 (Fisica / Astronomia)';
    return '物理系 / 天文系 (Fisica / Astronomia)';
  }
  if (lowercase.includes('hercolani')) {
    if (lang === 'it') return 'Scienze Politiche';
    if (lang === 'en') return 'Political Sciences';
    if (lang === 'zh-Hant') return '政治學 / 社會學 (Scienze Politiche)';
    return '政治学 / 社会学 (Scienze Politiche)';
  }
  if (lowercase.includes('zamboni')) {
    if (lang === 'it') return 'Lettere / Filosofia';
    if (lang === 'en') return 'Literature / Philosophy';
    if (lang === 'zh-Hant') return '文學系 / 哲學院 (Lettere / Filosofia)';
    return '文学系 / 哲学院 (Lettere / Filosofia)';
  }
  if (lowercase.includes('belmeloro') || lowercase.includes('andreatta')) {
    if (lang === 'it') return 'Giurisprudenza / Belmeloro';
    if (lang === 'en') return 'Law / Belmeloro';
    if (lang === 'zh-Hant') return '法律系 / 政經大樓 (Giurisprudenza / Belmeloro)';
    return '法律系 / 政经大楼 (Giurisprudenza / Belmeloro)';
  }
  if (lowercase.includes('bodoniana') || lowercase.includes('san donato, 19/2')) {
    if (lang === 'it') return 'Economia / CLA';
    if (lang === 'en') return 'Economics / Language Center (CLA)';
    if (lang === 'zh-Hant') return '經濟學 / 語言中心 (Economia / CLA)';
    return '经济学 / 语言中心 (Economia / CLA)';
  }
  if (lowercase.includes('beverara') || lowercase.includes('navile')) {
    if (lang === 'it') return 'Plesso Navile (Chimica/Fisica)';
    if (lang === 'en') return 'Navile Campus (Chemistry/Physics)';
    if (lang === 'zh-Hant') return '納維萊新校區 - 化學與物理 (Plesso Navile)';
    return '纳维莱新校区 - 化学与物理 (Plesso Navile)';
  }
  return '';
};

interface DeptSearchRule {
  keywords: string[];
  patterns: string[];
}

const DEPT_RULES: DeptSearchRule[] = [
  {
    keywords: ['工程', '工程系', '工程学院', '工学院', '工程校区', 'ingegneria', 'risorgimento', 'engineering'],
    patterns: ['ingegneria', 'risorgimento']
  },
  {
    keywords: ['化学', '化学系', '化学学院', '化学楼', '化学系大楼', 'chimica', 'selmi', 'navile', 'chemistry'],
    patterns: ['selmi', 'navile', 'beverara', 'chimica']
  },
  {
    keywords: ['数学', '数学系', '数学学院', '数学楼', 'matematica', 'math'],
    patterns: ['porta s. donato, 2', 'porta san donato 2', 'selmi', 'matematica']
  },
  {
    keywords: ['计算机', '计算机系', '计算机学院', '电脑', 'informatica', 'cs', 'computer science'],
    patterns: ['porta s. donato, 1', 'porta san donato 1', 'informatica']
  },
  {
    keywords: ['物理', '物理系', '物理学院', '物理楼', 'fisica', 'berti pichat', 'physics'],
    patterns: ['fisica', 'berti pichat', 'irnerio 46', 'porta s. donato, 1', 'porta san donato 1']
  },
  {
    keywords: ['生物', '生物系', '生物学院', '生物楼', 'biologia', 'biology'],
    patterns: ['biologia', 'irnerio 42', 'irnerio 40', 'san giacomo', 'scienze']
  },
  {
    keywords: ['经济', '经济系', '经济学院', '商科', '商学院', 'economia', 'economics'],
    patterns: ['economia', 'scaravilli', 'bodoniana', 'san donato, 19/2']
  },
  {
    keywords: ['法律', '法学', '法学院', '法律系', 'giurisprudenza', 'law'],
    patterns: ['giurisprudenza', 'belmeloro', 'andreatta', 'legge']
  },
  {
    keywords: ['政治', '政治系', '政治学院', 'scienze politiche', 'political'],
    patterns: ['politiche', 'hercolani']
  },
  {
    keywords: ['文学', '哲学', '文学院', '哲学系', 'zamboni', 'lettere', 'filosofia'],
    patterns: ['lettere', 'filosofia', 'zamboni']
  },
  {
    keywords: ['农学', '林学', '农学院', '农业', 'agraria', 'agriculture'],
    patterns: ['agraria', 'ranzani']
  },
  {
    keywords: ['心理', '教育', '心理学', '教育学', 'psicologia', 'education'],
    patterns: ['psicologia', 'educazione', 'filippo re']
  },
  {
    keywords: ['药学', '解剖', '药学院', 'farmacia', 'pharmacy'],
    patterns: ['farmacia', 'anatomia', 'san giacomo 3']
  }
];

const matchDepartmentSearch = (desc: string, codice: string, query: string): boolean => {
  const lowercaseDesc = (desc || '').toLowerCase();
  const lowercaseCodice = (codice || '').toLowerCase();
  const lowercaseQuery = (query || '').toLowerCase().trim();

  for (const rule of DEPT_RULES) {
    const isKeywordMatch = rule.keywords.some(kw => 
      lowercaseQuery.includes(kw) || kw.includes(lowercaseQuery)
    );

    if (isKeywordMatch) {
      const isPatternMatch = rule.patterns.some(pattern => 
        lowercaseDesc.includes(pattern) || lowercaseCodice.includes(pattern)
      );
      if (isPatternMatch) {
        return true;
      }
    }
  }
  return false;
};


const getShortBuildingName = (building: Building, lang: string): string => {
  const cleanName = building.descrizione
    .replace('Edificio in Bo - ', '')
    .replace('Edificio in BO - ', '')
    .replace('Edificio in Bo ', '')
    .replace('Edificio in BO ', '')
    .replace('via ', '')
    .replace('Via ', '');
  
  const desc = building.descrizione.toLowerCase();
  if (desc.includes('ingegneria') || desc.includes('risorgimento')) {
    return lang === 'en' || lang === 'it' ? 'Engineering' : '工程系';
  }
  if (desc.includes('porta s. donato, 2') || desc.includes('porta san donato 2')) {
    return lang === 'en' || lang === 'it' ? 'Math' : '数学系';
  }
  if (desc.includes('porta s. donato, 1') || desc.includes('porta san donato 1')) {
    return lang === 'en' || lang === 'it' ? 'CS / Physics' : '计算机/物理';
  }
  if (desc.includes('selmi 2') || desc.includes('selmi 3')) {
    return lang === 'en' || lang === 'it' ? 'Chemistry' : '化学系';
  }
  if (desc.includes('irnerio 46')) {
    return 'Irnerio 46';
  }
  if (desc.includes('irnerio 42') || desc.includes('irnerio 40')) {
    return lang === 'en' || lang === 'it' ? 'Biology' : '生物系';
  }
  if (desc.includes('ranzani')) {
    return lang === 'en' || lang === 'it' ? 'Agriculture' : '农学林学';
  }
  if (desc.includes('filippo re') || desc.includes('filippo-re')) {
    return lang === 'en' || lang === 'it' ? 'Psychology' : '心理教育';
  }
  if (desc.includes('san giacomo')) {
    return lang === 'en' || lang === 'it' ? 'Pharmacy' : '药学生物';
  }
  if (desc.includes('berti pichat')) {
    return 'Berti Pichat';
  }
  if (desc.includes('hercolani')) {
    return lang === 'en' || lang === 'it' ? 'Pol. Science' : '政治系';
  }
  if (desc.includes('zamboni')) {
    return lang === 'en' || lang === 'it' ? 'Literature' : '文学系';
  }
  if (desc.includes('belmeloro') || desc.includes('andreatta')) {
    return lang === 'en' || lang === 'it' ? 'Law' : '法律政经';
  }
  if (desc.includes('bodoniana') || desc.includes('san donato, 19/2')) {
    return lang === 'en' || lang === 'it' ? 'Economics' : '经济/语言';
  }
  if (desc.includes('beverara') || desc.includes('navile')) {
    return lang === 'en' || lang === 'it' ? 'Navile' : '纳维莱';
  }

  return cleanName.length > 8 ? cleanName.substring(0, 8) + '...' : cleanName;
};

interface AnimatedModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  colors: any;
  children: React.ReactNode;
  closeBtnText: string;
}

const AnimatedModal: React.FC<AnimatedModalProps> = ({
  visible,
  onClose,
  title,
  colors,
  children
}) => {
  const [shouldRender, setShouldRender] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  return (
    <Modal
      transparent={true}
      visible={shouldRender}
      onRequestClose={onClose}
      animationType="none"
    >
      <View style={styles.modalOverlayContainer}>
        <Animated.View
          style={[
            styles.modalOverlayBackdrop,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function EmptyClassroomScreen() {
  const { colors, isDark, language } = useTheme();
  
  const activeLang = (language === 'zh' || language === 'zh-Hant' || language === 'en' || language === 'it') ? language : 'zh';
  
  const getTxt = (key: string) => {
    return LOCALIZED_STRINGS[activeLang]?.[key] || LOCALIZED_STRINGS['zh'][key] || key;
  };

  const scrollViewRef = useRef<ScrollView>(null);
  const [listHeaderY, setListHeaderY] = useState(0);
  const hasAutoScrolled = useRef(false);

  // State Variables
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [impegni, setImpegni] = useState<Impegno[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter States
  const [timeMode, setTimeMode] = useState<'now' | 'morning' | 'afternoon' | 'custom'>('now');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('all');
  const [capacityFilter, setCapacityFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  
  // Custom Time Selection
  const [customStart, setCustomStart] = useState<string>('14:00');
  const [customEnd, setCustomEnd] = useState<string>('16:00');
  const [showTimeModal, setShowTimeModal] = useState<'start' | 'end' | null>(null);

  // Dropdown selector modal states
  const [showBuildingModal, setShowBuildingModal] = useState<boolean>(false);
  const [showCapacityModal, setShowCapacityModal] = useState<boolean>(false);

  // Campus filter states
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [showCampusModal, setShowCampusModal] = useState<boolean>(false);

  // Card expanded timeline states
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Toast State for Refresh feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastFade = useRef(new Animated.Value(0)).current;
  const toastTimeoutRef = useRef<any>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    toastFade.setValue(0);

    const isSuccess = msg === getTxt('refreshSuccess');
    const fadeInDuration = isSuccess ? 150 : 300;
    const keepDuration = isSuccess ? 1000 : 1500;
    const fadeOutDuration = 300;

    Animated.timing(toastFade, {
      toValue: 1,
      duration: fadeInDuration,
      useNativeDriver: true
    }).start();

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastFade, {
        toValue: 0,
        duration: fadeOutDuration,
        useNativeDriver: true
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
        triggerToast(getTxt('refreshSuccess'));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || getTxt('errorMsg'));
      if (isRefresh) {
        triggerToast(activeLang === 'en' ? `❌ Refresh failed: ${err.message || 'Network error'}` : activeLang === 'it' ? `❌ Aggiornamento fallito: ${err.message || 'Errore di rete'}` : activeLang === 'zh-Hant' ? `❌ 刷新失敗: ${err.message || '網絡錯誤'}` : `❌ 刷新失败: ${err.message || '网络错误'}`);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (isSearching) {
        setIsSearching(false);
        setSearchQuery('');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [isSearching]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      if (!hasAutoScrolled.current && listHeaderY > 0) {
        scrollViewRef.current?.scrollTo({ y: listHeaderY - 10, animated: true });
        hasAutoScrolled.current = true;
      }
    } else {
      if (hasAutoScrolled.current) {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        hasAutoScrolled.current = false;
      }
    }
  }, [searchQuery, listHeaderY]);

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
          descrizione: c.edificio.codice ? `教学楼 ${c.edificio.codice}` : '未知教学楼',
          comune: c.edificio.comune
        });
      }
    });
    return Array.from(map.values());
  }, [classrooms]);

  // Pre-defined static campus list to ensure all major Unibo campuses are always visible
  const campuses = useMemo(() => {
    return ['Bologna', 'Cesena', 'Forlì', 'Ravenna', 'Rimini'];
  }, []);

  // When selected campus changes, reset building filter
  useEffect(() => {
    setSelectedBuildingId('all');
  }, [selectedCampus]);

  const filteredBuildings = useMemo(() => {
    if (selectedCampus === 'all') return buildings;
    return buildings.filter(b => b.comune ? matchCampus(b.comune, selectedCampus) : false);
  }, [buildings, selectedCampus]);

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
        // 0. Campus filter
        if (selectedCampus !== 'all') {
          const comune = aula.relazioneEdificio?.comune || aula.edificio?.comune;
          if (!comune || !matchCampus(comune, selectedCampus)) return false;
        }

        // 1. Building filter
        if (selectedBuildingId !== 'all' && aula.edificioId !== selectedBuildingId) return false;

        // 2. Capacity filter
        if (capacityFilter === 'small' && aula.capienzaEffettiva >= 30) return false;
        if (capacityFilter === 'medium' && (aula.capienzaEffettiva < 30 || aula.capienzaEffettiva > 70)) return false;
        if (capacityFilter === 'large' && aula.capienzaEffettiva <= 70) return false;

        // 3. Search query filter (classroom name, address, or Chinese department name)
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const nameMatch = aula.descrizione?.toLowerCase().includes(query) || aula.codice?.toLowerCase().includes(query);
          const addressMatch = 
            aula.relazioneEdificio?.via?.toLowerCase().includes(query) || 
            aula.relazioneEdificio?.descrizione?.toLowerCase().includes(query) ||
            aula.edificio?.codice?.toLowerCase().includes(query);
          
          // Match Chinese translations / department hints (e.g. '化学系', '工程系')
          const hint = getBuildingHint(aula.relazioneEdificio?.descrizione || aula.edificio?.codice || '', activeLang);
          const shortName = aula.relazioneEdificio ? getShortBuildingName(aula.relazioneEdificio, activeLang) : '';
          const deptMatch = matchDepartmentSearch(
            aula.relazioneEdificio?.descrizione || aula.edificio?.codice || '',
            aula.edificio?.codice || '',
            query
          );
          const chineseMatch = hint.toLowerCase().includes(query) || shortName.toLowerCase().includes(query) || deptMatch;
          
          if (!nameMatch && !addressMatch && !chineseMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort: Free first, then closed, then occupied
        const scoreA = (a.isOccupied ? 2 : 0) + (a.isBuildingClosed ? 1 : 0);
        const scoreB = (b.isOccupied ? 2 : 0) + (b.isBuildingClosed ? 1 : 0);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.descrizione.localeCompare(b.descrizione);
      });
  }, [classrooms, classroomOccupations, queryTimeRange, selectedBuildingId, capacityFilter, selectedCampus, searchQuery]);

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

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const buildingLabel = selectedBuilding 
    ? getShortBuildingName(selectedBuilding, activeLang) 
    : getTxt('allBuildings');

  const capacityLabel = capacityFilter === 'all' ? getTxt('capacityAll') :
                         capacityFilter === 'small' ? getTxt('capacitySmall') :
                         capacityFilter === 'medium' ? getTxt('capacityMedium') :
                         getTxt('capacityLarge');

  const capacityButtonLabel = useMemo(() => {
    if (capacityFilter === 'all') return getTxt('capacityAll');
    if (capacityFilter === 'small') return activeLang === 'it' || activeLang === 'en' ? '<30 seats' : '<30人';
    if (capacityFilter === 'medium') return '30-70';
    return activeLang === 'it' || activeLang === 'en' ? '>70 seats' : '>70人';
  }, [capacityFilter, activeLang]);

  const handleBack = () => {
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{getTxt('title')}</Text>
        <Pressable 
          style={styles.refreshButton} 
          onPress={() => {
            setIsSearching(!isSearching);
            if (isSearching) setSearchQuery('');
          }}
        >
          <MaterialIcons name={isSearching ? "close" : "search"} size={24} color={colors.primary} />
        </Pressable>
      </View>

      {isSearching && (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={[
              styles.searchInputField,
              { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F4F7', 
                color: colors.textPrimary, 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#D0D5DD'
              }
            ]}
            placeholder={getTxt('searchPlaceholder')}
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#98A2B3'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {/* Main View */}
      {loading && classrooms.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{getTxt('syncing')}</Text>
        </View>
      ) : error && classrooms.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={40} color={colors.error} style={{ marginBottom: 8 }} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
          <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => fetchData()}>
            <Text style={styles.retryText}>{getTxt('retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView 
            ref={scrollViewRef}
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
                <Text style={[styles.dashboardLabel, { color: colors.textSecondary }]}>{getTxt('availableRooms')}</Text>
                <View style={styles.statsNumberContainer}>
                  <Text style={[styles.statsNumber, { color: colors.primary }]}>{availableCount}</Text>
                  <Text style={[styles.statsTotal, { color: colors.textMuted }]}>/ {processedClassrooms.length}{getTxt('classroomUnit')}</Text>
                </View>
                <Text style={[styles.dashboardSub, { color: colors.textMuted, fontSize: 10, marginTop: 6 }]}>
                  {getTxt('dataSource')}
                </Text>
                <Text style={[styles.dashboardSub, { color: colors.textMuted, fontSize: 10, marginTop: 2 }]}>
                  {getTxt('dataDisclaimer')}
                </Text>
              </View>
              <View style={[styles.dashboardRight, { backgroundColor: colors.primary + '10' }]}>
                <MaterialIcons name="school" size={28} color={colors.primary} />
              </View>
            </View>

            {/* Time Segmented Control */}
            <View style={[styles.filterSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="search" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>{getTxt('filterTime')}</Text>
              </View>
              <View style={[styles.segmentedContainer, { backgroundColor: isDark ? colors.border : '#F3F4F6' }]}>
                <Pressable 
                  style={[styles.segment, timeMode === 'now' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('now')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'now' ? '#fff' : colors.textSecondary }]}>{getTxt('timeNow')}</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segment, timeMode === 'morning' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('morning')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'morning' ? '#fff' : colors.textSecondary }]}>{getTxt('timeMorning')}</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segment, timeMode === 'afternoon' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('afternoon')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'afternoon' ? '#fff' : colors.textSecondary }]}>{getTxt('timeAfternoon')}</Text>
                </Pressable>
                <Pressable 
                  style={[styles.segment, timeMode === 'custom' && [styles.segmentActive, { backgroundColor: colors.primary }]]}
                  onPress={() => setTimeMode('custom')}
                >
                  <Text style={[styles.segmentText, { color: timeMode === 'custom' ? '#fff' : colors.textSecondary }]}>{getTxt('timeCustom')}</Text>
                </Pressable>
              </View>

              {/* Custom Time Selectors */}
              {timeMode === 'custom' && (
                <View style={styles.customTimeRow}>
                  <Pressable 
                    style={[styles.timePickerBtn, { borderColor: colors.border }]} 
                    onPress={() => setShowTimeModal('start')}
                  >
                    <Text style={[styles.timePickerLabel, { color: colors.textMuted }]}>{getTxt('customStart')}</Text>
                    <Text style={[styles.timePickerVal, { color: colors.textPrimary }]}>{customStart}</Text>
                  </Pressable>
                  <View style={styles.timeArrow}>
                    <MaterialIcons name="arrow-forward" size={16} color={colors.textMuted} />
                  </View>
                  <Pressable 
                    style={[styles.timePickerBtn, { borderColor: colors.border }]} 
                    onPress={() => setShowTimeModal('end')}
                  >
                    <Text style={[styles.timePickerLabel, { color: colors.textMuted }]}>{getTxt('customEnd')}</Text>
                    <Text style={[styles.timePickerVal, { color: colors.textPrimary }]}>{customEnd}</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Dropdown Filters Row */}
            <View style={styles.dropdownFiltersRow}>
              {/* Campus Dropdown Button */}
              <Pressable 
                style={[
                  styles.dropdownButton, 
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: selectedCampus === 'all' ? colors.border : colors.primary 
                  }
                ]} 
                onPress={() => setShowCampusModal(true)}
              >
                <Text 
                  style={[
                    styles.dropdownButtonText, 
                    { color: selectedCampus === 'all' ? colors.textPrimary : colors.primary }
                  ]} 
                  numberOfLines={1}
                >
                  {selectedCampus === 'all' ? getTxt('allCampuses') : getCampusLabel(selectedCampus, activeLang)}
                </Text>
                <MaterialCommunityIcons 
                  name="chevron-down" 
                  size={14} 
                  color={selectedCampus === 'all' ? colors.textSecondary : colors.primary} 
                />
              </Pressable>

              {/* Building Dropdown Button */}
              <Pressable 
                style={[
                  styles.dropdownButton, 
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: selectedBuildingId === 'all' ? colors.border : colors.primary 
                  }
                ]} 
                onPress={() => setShowBuildingModal(true)}
              >
                <Text 
                  style={[
                    styles.dropdownButtonText, 
                    { color: selectedBuildingId === 'all' ? colors.textPrimary : colors.primary }
                  ]} 
                  numberOfLines={1}
                >
                  {buildingLabel}
                </Text>
                <MaterialCommunityIcons 
                  name="chevron-down" 
                  size={14} 
                  color={selectedBuildingId === 'all' ? colors.textSecondary : colors.primary} 
                />
              </Pressable>

              {/* Capacity Dropdown Button */}
              <Pressable 
                style={[
                  styles.dropdownButton, 
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: capacityFilter === 'all' ? colors.border : colors.primary 
                  }
                ]} 
                onPress={() => setShowCapacityModal(true)}
              >
                <Text 
                  style={[
                    styles.dropdownButtonText, 
                    { color: capacityFilter === 'all' ? colors.textPrimary : colors.primary }
                  ]} 
                  numberOfLines={1}
                >
                  {capacityButtonLabel}
                </Text>
                <MaterialCommunityIcons 
                  name="chevron-down" 
                  size={14} 
                  color={capacityFilter === 'all' ? colors.textSecondary : colors.primary} 
                />
              </Pressable>
            </View>

            {/* Classrooms List */}
            <View 
              onLayout={(e) => {
                setListHeaderY(e.nativeEvent.layout.y);
              }}
            >
              <Text style={[styles.listHeaderTitle, { color: colors.textPrimary }]}>
                {getTxt('classroomList')} ({processedClassrooms.length})
              </Text>
            </View>

            {processedClassrooms.length === 0 ? (
              <View style={[styles.noResult, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialIcons name="inbox" size={48} color={colors.textMuted} style={{ marginBottom: 12 }} />
                <Text style={[styles.noResultText, { color: colors.textSecondary }]}>{getTxt('noClassrooms')}</Text>
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
                              <Text style={styles.statusBadgeText}>{getTxt('buildingClosed')}</Text>
                            </View>
                          ) : aula.isOccupied ? (
                            <View style={[styles.statusBadge, { backgroundColor: colors.error }]}>
                              <Text style={styles.statusBadgeText}>{getTxt('isOccupied')}</Text>
                            </View>
                          ) : (
                            <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
                              <Text style={styles.statusBadgeText}>{getTxt('isFree')}</Text>
                            </View>
                          )}
                        </View>
                        
                        <Text style={[styles.classroomSub, { color: colors.textSecondary }]} numberOfLines={1}>
                          {aula.relazioneEdificio?.descrizione || `${activeLang === 'en' ? 'Building' : activeLang === 'it' ? 'Edificio' : '楼栋'} ${aula.edificio.codice}`} • {openTime}-{closeTime}
                        </Text>

                        {/* Occupation name summary */}
                        {aula.isOccupied && !aula.isBuildingClosed && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <MaterialIcons name="warning" size={12} color={colors.error} style={{ marginRight: 4 }} />
                            <Text style={[styles.occupationSummary, { color: colors.error, marginTop: 0 }]} numberOfLines={1}>
                              {getTxt('currentBooking')}: {aula.currentBookingName}
                            </Text>
                          </View>
                        )}

                        {/* Services / icons */}
                        <View style={styles.servicesRow}>
                          <View style={[styles.capacityTag, { backgroundColor: colors.surfaceElevated, flexDirection: 'row', alignItems: 'center' }]}>
                            <MaterialIcons name="people" size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
                            <Text style={[styles.capacityTagText, { color: colors.textSecondary }]}>
                              {aula.capienzaEffettiva}{getTxt('seatsUnitSmall')}
                            </Text>
                          </View>
                          
                          {aula.serviziAula?.map((s, idx) => {
                            const cat = getServiceCategory(s.codice, s.descrizione);
                            const trans = serviceTranslations[cat];
                            const label = isExpanded ? trans.full[activeLang] : trans.abbrev[activeLang];
                            const iconName = trans.icon;

                            return (
                              <View key={idx} style={[styles.serviceTag, { backgroundColor: colors.surfaceElevated, flexDirection: 'row', alignItems: 'center' }]}>
                                <MaterialIcons name={iconName} size={11} color={colors.textSecondary} style={{ marginRight: 4 }} />
                                <Text style={[styles.serviceTagText, { color: colors.textSecondary }]}>
                                  {label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={styles.cardHeaderRight}>
                        <MaterialIcons 
                          name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                          size={20} 
                          color={colors.textMuted} 
                        />
                      </View>
                    </Pressable>

                    {/* Timeline view when expanded */}
                    {isExpanded && (
                      <View style={[styles.timelineContainer, { borderTopColor: colors.border }]}>
                        <View style={styles.timelineHeader}>
                          <Text style={[styles.timelineTitle, { color: colors.textPrimary }]}>{getTxt('timelineTitle')}</Text>
                          {(() => {
                            const lat = aula.relazioneEdificio?.geo?.lat || aula.edificio?.geo?.lat;
                            const lng = aula.relazioneEdificio?.geo?.lng || aula.edificio?.geo?.lng;
                            if (lat !== undefined && lng !== undefined) {
                              return (
                                <Pressable
                                  style={[styles.navigationBtn, { borderColor: colors.primary, flexDirection: 'row', alignItems: 'center' }]}
                                  onPress={() => openMap(lat, lng, aula.descrizione)}
                                >
                                  <MaterialIcons name="near-me" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                                  <Text style={[styles.navigationBtnText, { color: colors.primary }]}>{getTxt('oneClickGo')}</Text>
                                </Pressable>
                              );
                            }
                            return null;
                          })()}
                        </View>
                        {slots.length === 0 ? (
                          <Text style={[styles.noBookingText, { color: colors.textMuted }]}>{getTxt('noBookingText')}</Text>
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
                                        {slot.isOccupied ? `${getTxt('occupiedLabel')} • ${slot.eventName}` : getTxt('studyFree')}
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
      <AnimatedModal
        visible={showTimeModal !== null}
        onClose={() => setShowTimeModal(null)}
        title={showTimeModal === 'start' 
          ? (language === 'en' ? 'Select Start Time' : language === 'it' ? 'Seleziona Ora Inizio' : '选择开始时间') 
          : (language === 'en' ? 'Select End Time' : language === 'it' ? 'Seleziona Ora Fine' : '选择结束时间')}
        colors={colors}
        closeBtnText={getTxt('cancel')}
      >
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
                  isSelected && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
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
      </AnimatedModal>

      {/* Campus Selector Modal Overlay */}
      <AnimatedModal
        visible={showCampusModal}
        onClose={() => setShowCampusModal(false)}
        title={getTxt('selectCampus')}
        colors={colors}
        closeBtnText={getTxt('cancel')}
      >
        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
          <Pressable
            style={[
              styles.modalItem,
              selectedCampus === 'all' && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
            ]}
            onPress={() => {
              setSelectedCampus('all');
              setShowCampusModal(false);
            }}
          >
            <Text 
              style={[
                styles.modalItemText, 
                { color: selectedCampus === 'all' ? colors.primary : colors.textPrimary, fontWeight: selectedCampus === 'all' ? 'bold' : 'normal' }
              ]}
            >
              {getTxt('allCampuses')}
            </Text>
          </Pressable>
          {campuses.map(camp => {
            const isSelected = selectedCampus === camp;
            return (
              <Pressable
                key={camp}
                style={[
                  styles.modalItem,
                  isSelected && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
                ]}
                onPress={() => {
                  setSelectedCampus(camp);
                  setShowCampusModal(false);
                }}
              >
                <Text 
                  style={[
                    styles.modalItemText, 
                    { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? 'bold' : 'normal' }
                  ]}
                >
                  {getCampusLabel(camp, activeLang)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </AnimatedModal>

      {/* Building Selector Modal Overlay */}
      <AnimatedModal
        visible={showBuildingModal}
        onClose={() => setShowBuildingModal(false)}
        title={getTxt('selectBuilding')}
        colors={colors}
        closeBtnText={getTxt('cancel')}
      >
        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
          <Pressable
            style={[
              styles.modalItem,
              selectedBuildingId === 'all' && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
            ]}
            onPress={() => {
              setSelectedBuildingId('all');
              setShowBuildingModal(false);
            }}
          >
            <Text 
              style={[
                styles.modalItemText, 
                { color: selectedBuildingId === 'all' ? colors.primary : colors.textPrimary, fontWeight: selectedBuildingId === 'all' ? 'bold' : 'normal' }
              ]}
            >
              {getTxt('allBuildings')}
            </Text>
          </Pressable>
          {filteredBuildings.map(b => {
            const isSelected = selectedBuildingId === b.id;
            const cleanName = b.descrizione
              .replace('Edificio in Bo - ', '')
              .replace('Edificio in BO - ', '')
              .replace('Edificio in Bo ', '')
              .replace('Edificio in BO ', '')
              .replace('via ', '')
              .replace('Via ', '');
            const deptHint = getBuildingHint(b.descrizione, activeLang);
            return (
              <Pressable
                key={b.id}
                style={[
                  styles.modalItem,
                  isSelected && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
                ]}
                onPress={() => {
                  setSelectedBuildingId(b.id);
                  setShowBuildingModal(false);
                }}
              >
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text 
                    style={[
                      styles.modalItemText, 
                      { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? 'bold' : 'normal', textAlign: 'center' }
                    ]}
                    numberOfLines={1}
                  >
                    {cleanName}
                  </Text>
                  {deptHint ? (
                    <Text style={{ fontSize: 10.5, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>
                      {deptHint}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </AnimatedModal>

      {/* Capacity Selector Modal Overlay */}
      <AnimatedModal
        visible={showCapacityModal}
        onClose={() => setShowCapacityModal(false)}
        title={getTxt('selectCapacity')}
        colors={colors}
        closeBtnText={getTxt('cancel')}
      >
        <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
          {(['all', 'small', 'medium', 'large'] as const).map(cap => {
            const isSelected = capacityFilter === cap;
            const labelKey = cap === 'all' ? 'capacityAll' :
                             cap === 'small' ? 'capacitySmall' :
                             cap === 'medium' ? 'capacityMedium' :
                             'capacityLarge';
            return (
              <Pressable
                key={cap}
                style={[
                  styles.modalItem,
                  isSelected && [styles.modalItemActive, { backgroundColor: colors.primarySoft }]
                ]}
                onPress={() => {
                  setCapacityFilter(cap);
                  setShowCapacityModal(false);
                }}
              >
                <Text 
                  style={[
                    styles.modalItemText, 
                    { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? 'bold' : 'normal' }
                  ]}
                >
                  {getTxt(labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </AnimatedModal>

      {/* Toast Feedback */}
      {toastMsg && (
        <Animated.View style={[
          toastMsg === getTxt('refreshSuccess') ? styles.checkmarkBubble : styles.toastContainer, 
          { 
            opacity: toastFade,
            backgroundColor: toastMsg === getTxt('refreshSuccess') ? '#FFFFFF' : colors.surface,
            borderColor: toastMsg === getTxt('refreshSuccess') ? 'transparent' : colors.primary,
            borderWidth: toastMsg === getTxt('refreshSuccess') ? 0 : 1,
          }
        ]}>
          {toastMsg === getTxt('refreshSuccess') ? (
            <MaterialIcons name="check" size={24} color={colors.primary} />
          ) : (
            <Text style={[styles.toastText, { color: colors.primary }]}>{toastMsg}</Text>
          )}
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
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInputField: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
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
  dropdownFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    marginBottom: 16,
    gap: 8,
  },
  dropdownButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 30,
  },
  dropdownButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 2,
    gap: 4,
  },
  dropdownButtonText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
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
  modalOverlayBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalOverlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    width: '100%',
    maxHeight: 280,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: 'center',
  },
  modalItemActive: {
    borderRadius: 8,
  },
  modalItemText: {
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
  checkmarkBubble: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 150,
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
  toastText: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
