import { stations, Station } from '../assets/stations';

const BASE_URL = 'https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno';

export const fetchWithTimeout = async (url: string, options?: RequestInit, timeoutMs = 3000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const getCleanStationName = (apiName: string, id?: string): string => {
  let name = String(apiName || '').trim();
  if (!name) return '';

  const cleanId = String(id || '').trim();
  if (cleanId) {
    const found = stations.find(s => s.id === cleanId || s.id === 'S' + cleanId || 'S' + s.id === cleanId);
    if (found) {
      return found.n;
    }
  }

  if (name.endsWith('...')) {
    const prefix = name.slice(0, -3).toLowerCase();
    if (prefix.length >= 3) {
      const found = stations.find(s => s.n.toLowerCase().startsWith(prefix));
      if (found) {
        return found.n;
      }
    }
  }

  if (name === name.toUpperCase() && name !== name.toLowerCase()) {
    name = name
      .toLowerCase()
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  // Normalize common Italian station name abbreviations (e.g. Bologna C.le/AV, Milano C.le)
  name = name.replace(/Bologna[\s\.\/]*-*(C\.?le|C\s*le|cle)\/AV/gi, 'Bologna Centrale');
  name = name.replace(/Bologna[\s\.\/]*-*(C\.?le|C\s*le|cle)/gi, 'Bologna Centrale');
  name = name.replace(/\b(\w+)[\s\.\/]*-*(C\.?le|C\s*le|cle)(\/AV)?\b/gi, '$1 Centrale');
  name = name.replace(/\b(\w+)[\s\.]+(C\.?le|C\s*le|cle)\b/gi, '$1 Centrale');

  return name;
};

export interface VtStation {
  name: string;
  id: string;
}

export interface VtTrainSearchMatch {
  label: string;
  number: string;
  departureStationID: string;
  timestamp: string;
}

export interface VtStop {
  stationName: string;
  stationId: string;
  scheduledArrivalTime: number | null; // Unix ms
  actualArrivalTime: number | null;    // Unix ms
  scheduledDepartureTime: number | null; // Unix ms
  actualDepartureTime: number | null;   // Unix ms
  scheduledPlatform: string;
  actualPlatform: string;
  arrivalDelay: number;
  departureDelay: number;
  status: 'regular' | 'added' | 'suppressed' | 'unknown';
}

export interface VtTrainStatus {
  number: string;
  category: string;
  origin: string;
  destination: string;
  scheduledDepartureTime: number; // Unix ms
  scheduledArrivalTime: number;   // Unix ms
  delay: number; // minutes
  lastReportedStation: string;
  lastReportedTime: number | null; // Unix ms
  stops: VtStop[];
  isCancelled: boolean;
  codiceCliente?: number | string | null;
}

export interface VtBoardEntry {
  trainNumber: string;
  category: string;
  origin: string;
  destination: string;
  scheduledTime: number; // Unix ms
  delay: number; // minutes
  scheduledPlatform: string;
  actualPlatform: string;
  isCancelled: boolean;
  codiceCliente: string | number | null;
  originStationID: string;
  timestamp: number;
  originDepartureTime: number | null;
  rawEntry: any;
}

export interface VtTrainSummary {
  number: string;
  category: string;
  origin: string;
  destination: string;
  scheduledDepartureTime: number; // Unix ms
  scheduledArrivalTime: number;   // Unix ms
  departureStationID: string;
  timestamp: string;
  codiceCliente?: number | string | null;
}

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

const ROMAN_TO_ARABIC: Record<string, string> = {
  'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
  'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10',
  'XI': '11', 'XII': '12', 'XIII': '13', 'XIV': '14', 'XV': '15',
  'XVI': '16', 'XVII': '17', 'XVIII': '18', 'XIX': '19', 'XX': '20',
  'XXI': '21', 'XXII': '22', 'XXIII': '23', 'XXIV': '24', 'XXV': '25',
  'XXVI': '26', 'XXVII': '27', 'XXVIII': '28', 'XXIX': '29', 'XXX': '30'
};

export const cleanPlatform = (val: any): string => {
  if (!val) return '';
  let s = String(val).trim();
  if (s.toLowerCase() === 'none' || s.toLowerCase() === 'null') return '';

  // 1. Clean V-PO / V-PE / P.O. / P.E. / PO / PE (case-insensitive) suffixes
  s = s.replace(/[\s\-\/]+V\-?P\.?[OE]\.?$/i, '');
  s = s.replace(/[\s\-\/]+P\.?[OE]\.?$/i, '');

  // 2. Convert Roman numerals to Arabic numerals
  s = s.replace(/[A-Z]+/gi, (match) => {
    const upper = match.toUpperCase();
    return ROMAN_TO_ARABIC[upper] || match;
  });

  // 3. Remove "AV" suffix from high-speed platforms (specifically 16, 17, 18, 19)
  if (/^(16|17|18|19)[\s\.\-\/]*AV$/i.test(s)) {
    s = s.replace(/[\s\.\-\/]*AV$/i, '');
  }

  return s;
};

export const ITALO_STATION_MAP: Record<string, { code: string; slug: string }> = {
  "S11705": { code: "AGR", slug: "agropoli" }, // Agropoli Castellabate
  "S07113": { code: "FF_", slug: "ancona" }, // Ancona
  "S11119": { code: "BAC", slug: "bari" }, // Bari Centrale
  "S11108": { code: "BLT", slug: "barletta" }, // Barletta
  "S09311": { code: "BEN", slug: "benevento" }, // Benevento
  "S01529": { code: "BGM", slug: "bergamo" }, // Bergamo
  "S11113": { code: "BIG", slug: "bisceglie" }, // Bisceglie
  "S05043": { code: "BC_", slug: "bologna" }, // Bologna Centrale
  "S02026": { code: "BLZ", slug: "bolzano" }, // Bolzano/Bozen
  "S01717": { code: "BSC", slug: "brescia" }, // Brescia
  "S09211": { code: "CEA", slug: "caserta" }, // Caserta
  "S02706": { code: "CON", slug: "conegliano" }, // Conegliano
  "S02084": { code: "DSG", slug: "desenzano" }, // Desenzano del Garda-Sirmione
  "S05712": { code: "F__", slug: "ferrara" }, // Ferrara
  "S06421": { code: "SMN", slug: "firenze-santa-maria-novella" }, // Firenze Santa Maria Novella
  "S11100": { code: "FG_", slug: "foggia" }, // Foggia
  "S04700": { code: "G__", slug: "Genova Piazza Principe" }, // Genova Piazza Principe
  "S04702": { code: "GB_", slug: "Genova Brignole" }, // Genova Brignole
  "S11749": { code: "LON", slug: "lamezia-terme-centrale" }, // Lamezia Terme Centrale
  "S03202": { code: "LTL", slug: "latisana-lignano-bibione" }, // Latisana-Lignano-Bibione
  "S11723": { code: "MRT", slug: "maratea" }, // Maratea
  "S01700": { code: "MC_", slug: "milano-centrale" }, // Milano Centrale
  "S01037": { code: "RRO", slug: "milano-rho-fiera" }, // Rho Fiera
  "S01820": { code: "RG_", slug: "milano-rogoredo" }, // Milano Rogoredo
  "S11114": { code: "ML_", slug: "molfetta" }, // Molfetta
  "S03310": { code: "MNF", slug: "monfalcone" }, // Monfalcone
  "S09988": { code: "NAF", slug: "napoli-afragola" }, // Napoli Afragola
  "S09218": { code: "NAC", slug: "napoli-centrale" }, // Napoli Centrale
  "S02581": { code: "PD_", slug: "padova" }, // Padova
  "S11739": { code: "PAR", slug: "paola" }, // Paola
  "S07104": { code: "PY_", slug: "pesaro" }, // Pesaro
  "S02088": { code: "PSY", slug: "peschiera" }, // Peschiera del Garda
  "S06500": { code: "22187", slug: "pisa" }, // Pisa Centrale
  "S02701": { code: "PNE", slug: "pordenone" }, // Pordenone
  "S03200": { code: "PGR", slug: "portogruaro-caorle" }, // Portogruaro Caorle
  "S11781": { code: "RCE", slug: "reggio-calabria" }, // Reggio di Calabria Centrale
  "S05254": { code: "AAV", slug: "reggio-emilia-av" }, // Reggio Emilia AV Mediopadana
  "S07101": { code: "RO_", slug: "riccione" }, // Riccione
  "S05071": { code: "J__", slug: "rimini" }, // Rimini
  "S08409": { code: "RMT", slug: "roma-termini" }, // Roma Termini
  "S08217": { code: "RTB", slug: "roma-tiburtina" }, // Roma Tiburtina
  "S11765": { code: "RUT", slug: "rosarno" }, // Rosarno
  "S02044": { code: "RVR", slug: "rovereto" }, // Rovereto
  "S05706": { code: "R__", slug: "rovigo" }, // Rovigo
  "S09818": { code: "SAL", slug: "salerno" }, // Salerno
  "S11721": { code: "SRI", slug: "sapri" }, // Sapri
  "S11727": { code: "SDC", slug: "scalea" }, // Scalea Santa Domenica Talao
  "S00219": { code: "TOP", slug: "torino-porta-nuova" }, // Torino Porta Nuova
  "S00222": { code: "OUE", slug: "torino-porta-susa" }, // Torino Porta Susa
  "S11112": { code: "TR_", slug: "trani" }, // Trani
  "S02038": { code: "TCN", slug: "trento" }, // Trento
  "S02712": { code: "TVC", slug: "treviso-centrale" }, // Treviso Centrale
  "S03317": { code: "TSC", slug: "trieste" }, // Trieste Centrale
  "S03026": { code: "UDN", slug: "udine" }, // Udine
  "S11709": { code: "VLH", slug: "vallo-lucania" }, // Vallo della Lucania-Castelnuovo
  "S02589": { code: "VEM", slug: "venezia-mestre" }, // Venezia Mestre
  "S02593": { code: "VSL", slug: "venezia-santa-lucia" }, // Venezia Santa Lucia
  "S02430": { code: "VPN", slug: "verona-porta-nuova" }, // Verona Porta Nuova
  "S11789": { code: "VIP", slug: "vibo-pizzo" }, // Vibo Valentia Pizzo
  "S02446": { code: "VIC", slug: "vicenza" }, // Vicenza
  "S11774": { code: "VSG", slug: "villa-san-giovanni" }, // Villa San Giovanni
};

export const ITALO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Referer': 'https://italoinviaggio.italotreno.it/',
  'Origin': 'https://italoinviaggio.italotreno.it'
};

export const parseDateStr = (dateStr: any): number | null => {
  if (!dateStr) return null;
  const match = String(dateStr).match(/\/Date\((\d+)\)\//);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) return parsed;
  return null;
};

export const parseTimeStr = (timeStr: string, baseDate: Date): number | null => {
  if (!timeStr || timeStr === '01:00' || timeStr === '--:--' || timeStr === '') return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  
  const d = new Date(baseDate);
  d.setHours(hour, minute, 0, 0);

  // Adjust date if the parsed time is too far in the future or past relative to baseDate
  const diffMs = d.getTime() - baseDate.getTime();
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  if (diffMs > twelveHoursMs) {
    // e.g. query is 02:00, train is 23:00 -> diff is +21 hrs, belongs to yesterday
    d.setDate(d.getDate() - 1);
  } else if (diffMs < -twelveHoursMs) {
    // e.g. query is 23:00, train is 01:00 -> diff is -22 hrs, belongs to tomorrow
    d.setDate(d.getDate() + 1);
  }

  return d.getTime();
};

export function parseItaloTrainStatus(data: any): VtTrainStatus | null {
  if (!data || data.IsEmpty || !data.TrainSchedule) return null;
  const schedule = data.TrainSchedule;
  const num = schedule.TrainNumber || '';
  
  const baseDate = new Date();
  
  const parseItaloStop = (s: any, isReached: boolean): VtStop => {
    const code = s.LocationCode || s.StationCode || '';
    let stationName = s.LocationDescription || s.StationDescription || '';
    stationName = getCleanStationName(stationName);
    
    const platform = cleanPlatform(s.BinaryProgrammed || s.BinaryReal || s.ActualArrivalPlatform || '');
    
    // Times
    let scheduledArrivalTime: number | null = null;
    let actualArrivalTime: number | null = null;
    let scheduledDepartureTime: number | null = null;
    let actualDepartureTime: number | null = null;
    
    if (s.ArrivalHour !== undefined || s.DepartureHour !== undefined) {
      // Schema A
      scheduledArrivalTime = parseDateStr(s.ArrivalHour);
      actualArrivalTime = isReached ? parseDateStr(s.ArrivalHourReal) : null;
      scheduledDepartureTime = parseDateStr(s.DepartureHour);
      actualDepartureTime = isReached ? parseDateStr(s.DepartureHourReal) : null;
    } else {
      // Schema B
      scheduledArrivalTime = parseTimeStr(s.EstimatedArrivalTime, baseDate);
      actualArrivalTime = isReached ? parseTimeStr(s.ActualArrivalTime, baseDate) : null;
      scheduledDepartureTime = parseTimeStr(s.EstimatedDepartureTime, baseDate);
      actualDepartureTime = isReached ? parseTimeStr(s.ActualDepartureTime, baseDate) : null;
    }
    
    let arrivalDelay = 0;
    let departureDelay = 0;
    if (actualArrivalTime && scheduledArrivalTime) {
      arrivalDelay = Math.round((actualArrivalTime - scheduledArrivalTime) / 60000);
    }
    if (actualDepartureTime && scheduledDepartureTime) {
      departureDelay = Math.round((actualDepartureTime - scheduledDepartureTime) / 60000);
    }
    
    return {
      stationName,
      stationId: code,
      scheduledArrivalTime,
      actualArrivalTime,
      scheduledDepartureTime,
      actualDepartureTime,
      scheduledPlatform: platform,
      actualPlatform: isReached ? platform : '',
      arrivalDelay,
      departureDelay,
      status: 'regular'
    };
  };

  const parseStopList = (list: any[], isReached: boolean): VtStop[] => {
    return (list || []).map(s => parseItaloStop(s, isReached));
  };

  let stops: VtStop[] = [];
  if (schedule.StazionePartenza) {
    // Schema B: Prepend StazionePartenza as reached
    const parsedPartenza = parseItaloStop(schedule.StazionePartenza, true);
    const parsedFerme = parseStopList(schedule.StazioniFerme, true);
    const parsedNonFerme = parseStopList(schedule.StazioniNonFerme, false);
    stops = [parsedPartenza, ...parsedFerme, ...parsedNonFerme];
  } else {
    // Schema A
    const parsedFerme = parseStopList(schedule.StazioniFerme, true);
    const parsedNonFerme = parseStopList(schedule.StazioniNonFerme, false);
    stops = [...parsedFerme, ...parsedNonFerme];
  }
  
  stops.sort((a, b) => {
    const timeA = a.scheduledArrivalTime || a.scheduledDepartureTime || 0;
    const timeB = b.scheduledArrivalTime || b.scheduledDepartureTime || 0;
    return timeA - timeB;
  });

  const origin = getCleanStationName(schedule.DepartureStationDescription || (stops[0]?.stationName) || '');
  const destination = getCleanStationName(schedule.ArrivalStationDescription || (stops[stops.length - 1]?.stationName) || '');
  
  const delay = schedule.Distruption?.DelayAmount ?? 0;
  
  const scheduledDepartureTime = stops[0]?.scheduledDepartureTime || parseTimeStr(schedule.DepartureDate, baseDate) || 0;
  const scheduledArrivalTime = stops[stops.length - 1]?.scheduledArrivalTime || parseTimeStr(schedule.ArrivalDate, baseDate) || 0;
  
  let lastReportedStation = '';
  let lastReportedTime: number | null = null;
  
  if (data.LastReportedStation) {
    lastReportedStation = getCleanStationName(data.LastReportedStation);
  }
  if (data.LastReportedTime) {
    lastReportedTime = parseDateStr(data.LastReportedTime);
  }
  
  const reachedFerme = stops.filter(s => s.actualArrivalTime !== null || s.actualDepartureTime !== null);
  if (!lastReportedStation && reachedFerme.length > 0) {
    const lastDone = reachedFerme[reachedFerme.length - 1];
    lastReportedStation = lastDone.stationName;
    lastReportedTime = lastDone.actualDepartureTime || lastDone.actualArrivalTime;
  }

  return {
    number: num,
    category: 'NTV',
    origin,
    destination,
    scheduledDepartureTime,
    scheduledArrivalTime,
    delay,
    lastReportedStation,
    lastReportedTime,
    stops,
    isCancelled: false,
    codiceCliente: 'ITALO'
  };
}

/**
 * Resolve operator details based on customer code and train category
 */
export const getOperatorInfo = (codiceCliente: string | number | null, category: string) => {
  const code = String(codiceCliente || '').trim();
  const cat = String(category || '').trim().toUpperCase();
  
  if (cat === 'ITA' || cat === 'ITALO' || cat === 'NTV') {
    return { code: 'NTV', name: 'Italo', color: '#8A0813' }; // Italo Burgundy red
  }
  if (cat === 'MXP') {
    return { code: 'TN', name: 'Trenord', color: '#7AB800' }; // Malpensa Express is Trenord
  }
  
  switch (code) {
    case '1':
    case '2':
    case '4':
      return { code: 'TI', name: 'Trenitalia', color: '#E30613' }; // Trenitalia Red
    case '18':
      return { code: 'TTX', name: 'Trenitalia Tper', color: '#006F4F' }; // Tper Green
    case '63':
      return { code: 'TN', name: 'Trenord', color: '#7AB800' }; // Trenord Lime Green
    case '64':
      return { code: 'TILO', name: 'TILO', color: '#009EE0' }; // TILO Blue
    case '910':
      return { code: 'FSE', name: 'Ferrovie del Sud Est', color: '#D20A11' };
    default:
      if (cat.startsWith('REG') || cat === 'R') {
        return { code: 'TI', name: 'Trenitalia', color: '#E30613' };
      }
      return { code: 'TI', name: 'Trenitalia', color: '#E30613' };
  }
};

/**
 * Format Date to standard ViaggiaTreno 'partenze/arrivi' string format:
 * "Day Mon DD YYYY HH:MM:SS" (e.g. "Wed Jun 17 2026 19:15:00")
 */
/**
 * Format Date to standard ViaggiaTreno 'partenze/arrivi' string format:
 * "Day Mon DD YYYY HH:MM:SS" (e.g. "Wed Jun 17 2026 19:15:00")
 */
function formatVtDateTime(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Rome',
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    
    const pVal = (type: string) => parts.find(p => p.type === type)?.value || '';
    const weekday = pVal('weekday');
    const month = pVal('month');
    const day = pVal('day');
    const year = pVal('year');
    const hour = pVal('hour') === '24' ? '00' : pVal('hour').padStart(2, '0');
    const minute = pVal('minute').padStart(2, '0');
    const second = pVal('second').padStart(2, '0');
    
    return `${weekday} ${month} ${day} ${year} ${hour}:${minute}:${second}`;
  } catch (e) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${dayName} ${monthName} ${day} ${year} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * Get the UTC offset (in ms) of Europe/Rome timezone for a given date
 */
export function getRomeOffset(date: Date): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const partVal = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    
    const year = partVal('year');
    const month = partVal('month') - 1;
    const day = partVal('day');
    const hour = partVal('hour') === 24 ? 0 : partVal('hour');
    const minute = partVal('minute');
    const second = partVal('second');
    
    const romeUtc = Date.UTC(year, month, day, hour, minute, second);
    return romeUtc - date.getTime();
  } catch (e) {
    const month = date.getMonth();
    const isSummer = month > 2 && month < 10;
    return isSummer ? 2 * 3600 * 1000 : 1 * 3600 * 1000;
  }
}

/**
 * Convert a local device Date object to a UTC timestamp representing the same wall-clock time in Rome.
 */
export function getRomeTimestampFromLocalDate(date: Date): number {
  const romeOffset = getRomeOffset(date);
  const localTimeAsUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
  return localTimeAsUtc - romeOffset;
}

/**
 * Format a UTC timestamp (ms) to HH:MM in Europe/Rome timezone
 */
export function formatRomeTimeStr(unixMs: number | null): string {
  if (!unixMs) return '--:--';
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(new Date(unixMs));
  } catch (e) {
    const date = new Date(unixMs);
    return `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  }
}

/**
 * Format a UTC timestamp (ms) to DD/MM in Europe/Rome timezone
 */
export function formatRomeDateFromTimestamp(unixMs: number | null): string {
  if (!unixMs) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit'
    });
    return formatter.format(new Date(unixMs));
  } catch (e) {
    const date = new Date(unixMs);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Format a UTC timestamp (ms) to DD/MM HH:MM in Europe/Rome timezone
 */
export function formatRomeDateTimeFromTimestamp(unixMs: number | null): string {
  if (!unixMs) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(new Date(unixMs));
    const pVal = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${pVal('day')}/${pVal('month')} ${pVal('hour')}:${pVal('minute')}`;
  } catch (e) {
    const date = new Date(unixMs);
    return `${String(date.getDate()).padStart(2, '0')}/${String(
      date.getMonth() + 1
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  }
}


/**
 * Fuzzy search stations from local stations list.
 * If local search yields empty, falls back to the ViaggiaTreno API.
 */
export async function searchStations(query: string): Promise<VtStation[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  // Resolve Chinese city aliases
  let searchKey = cleanQuery;
  for (const [zh, it] of Object.entries(CHINESE_CITY_MAPPINGS)) {
    if (searchKey === zh || searchKey.includes(zh)) {
      searchKey = it;
      break;
    }
  }

  // 1. Try local index first
  const localMatches = stations.filter(s => s.n.toLowerCase().includes(searchKey));

  if (localMatches.length > 0) {
    const scored = localMatches.map(s => {
      const nameLower = s.n.toLowerCase();
      let score = 0;
      
      // Prefix match gets a huge bonus
      if (nameLower.startsWith(searchKey)) {
        score += 1000;
      }
      
      // Priority score (0 to 2, scaled by 100)
      score += (s.p || 0) * 100;
      
      // Length penalty (prefer shorter names)
      score -= s.n.length;
      
      return { station: s, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 15).map(item => ({
      name: item.station.n,
      id: item.station.id
    }));
  }

  // 2. Fall back to ViaggiaTreno autocompletaStazione API
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(`${BASE_URL}/autocompletaStazione/${encoded}`);
    if (!response.ok) return [];
    
    const text = await response.text();
    if (!text.trim()) return [];
    
    // Autocomplete returns text lines like: "MILANO CENTRALE|S01700\nMILANO LAMBRATE|S01701"
    const parsed: VtStation[] = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('|'))
      .map(line => {
        const [name, id] = line.split('|');
        return { name: name.trim(), id: id.trim() };
      });
      
    return parsed;
  } catch (error) {
    console.error('Error fetching stations from ViaggiaTreno API:', error);
    return [];
  }
}

/**
 * Resolve train number into list of matching runs with origin, station id, and timestamp
 */
export async function searchTrain(trainNumber: string | number): Promise<VtTrainSearchMatch[]> {
  const cleanNumber = String(trainNumber).trim();
  if (!cleanNumber) return [];

  const vtPromise = (async (): Promise<VtTrainSearchMatch[]> => {
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/cercaNumeroTrenoTrenoAutocomplete/${cleanNumber}`, {}, 5000);
      if (!response.ok) return [];

      const text = await response.text();
      if (!text.trim()) return [];

      return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('|'))
        .map(line => {
          const [label, idValue] = line.split('|');
          const parts = idValue.split('-');
          return {
            label: label.trim(),
            number: parts[0] || cleanNumber,
            departureStationID: parts[1] || '',
            timestamp: parts[2] || ''
          };
        });
    } catch (error) {
      console.error('Error searching train number via ViaggiaTreno:', error);
      return [];
    }
  })();

  const italoPromise = (async (): Promise<VtTrainSearchMatch[]> => {
    try {
      const response = await fetchWithTimeout(`https://italoinviaggio.italotreno.it/api/RicercaTrenoService?TrainNumber=${cleanNumber}`, {
        headers: ITALO_HEADERS
      }, 2500);
      if (!response.ok) return [];
      const data = await response.json();
      if (data && !data.IsEmpty && data.TrainSchedule) {
        const schedule = data.TrainSchedule;
        const originDesc = schedule.DepartureStationDescription || '';
        
        // Use a stable timestamp (start of today) since Italo doesn't provide a TrainDate.
        // This prevents infinite loop fetches triggered by Date.now().
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const trainDateVal = d.getTime();
        
        const label = `${cleanNumber} - ${originDesc.toUpperCase()} (Italo)`;
        return [{
          label,
          number: cleanNumber,
          departureStationID: 'ITALO',
          timestamp: String(trainDateVal)
        }];
      }
    } catch (error) {
      console.error('Error searching Italo train:', error);
    }
    return [];
  })();

  try {
    const [vtMatches, italoMatches] = await Promise.all([vtPromise, italoPromise]);
    return [...italoMatches, ...vtMatches];
  } catch (error) {
    console.error('Error in parallel searchTrain:', error);
    return [];
  }
}

/**
 * Query real-time train status details by departure station, number, and optional timestamp
 */
export async function getTrainStatus(
  departureStationID: string,
  trainNumber: string | number,
  timestamp?: string
): Promise<VtTrainStatus | null> {
  const cleanNum = String(trainNumber).trim();
  const cleanStation = departureStationID.trim();
  if (!cleanNum || !cleanStation) return null;

  if (cleanStation === 'ITALO') {
    try {
      const response = await fetchWithTimeout(`https://italoinviaggio.italotreno.it/api/RicercaTrenoService?TrainNumber=${cleanNum}`, {
        headers: ITALO_HEADERS
      }, 4000);
      if (!response.ok) return null;
      const data = await response.json();
      return parseItaloTrainStatus(data);
    } catch (error) {
      console.error('Error fetching Italo train status:', error);
      return null;
    }
  }

  try {
    const url = timestamp 
      ? `${BASE_URL}/andamentoTreno/${cleanStation}/${cleanNum}/${timestamp}`
      : `${BASE_URL}/andamentoTreno/${cleanStation}/${cleanNum}`;
      
    const response = await fetch(url);
    if (response.status === 204) {
      // Train not started or cancelled, no details
      return null;
    }
    if (!response.ok) return null;

    const data = await response.json();
    if (!data) return null;

    // Map stops
    const stops: VtStop[] = (data.fermate || []).map((f: any) => {
      let stopStatus: VtStop['status'] = 'regular';
      if (f.actualFermataType === 2) stopStatus = 'added';
      else if (f.actualFermataType === 3) stopStatus = 'suppressed';
      else if (f.actualFermataType === 0) stopStatus = 'unknown';

      // Parse platforms properly based on whether it is origin, destination or intermediate
      const scheduledPlatform = cleanPlatform(f.binarioProgrammatoPartenzaDescrizione || f.binarioProgrammatoArrivoDescrizione);
      const actualPlatform = cleanPlatform(f.binarioEffettivoPartenzaDescrizione || f.binarioEffettivoArrivoDescrizione);

      return {
        stationName: getCleanStationName(f.stazione || '', f.id || ''),
        stationId: f.id || '',
        scheduledArrivalTime: f.arrivo_teorico || null,
        actualArrivalTime: f.arrivoReale || null,
        scheduledDepartureTime: f.partenza_teorica || null,
        actualDepartureTime: f.partenzaReale || null,
        scheduledPlatform,
        actualPlatform,
        arrivalDelay: typeof f.ritardoArrivo === 'number' ? f.ritardoArrivo : 0,
        departureDelay: typeof f.ritardoPartenza === 'number' ? f.ritardoPartenza : 0,
        status: stopStatus
      };
    });

    const isCancelled = data.provvedimento === 1 || data.compProvvedimento === 1;

    const firstStopName = stops[0]?.stationName || getCleanStationName(data.origine || '');
    const lastStopName = stops[stops.length - 1]?.stationName || getCleanStationName(data.destinazione || '');

    let parsedCategory = (data.categoria || '').trim();
    if (!parsedCategory && data.compNumeroTreno) {
      const match = String(data.compNumeroTreno).trim().match(/^([A-Z\s]+)\d+$/i);
      if (match && match[1]) {
        parsedCategory = match[1].trim();
      }
    }

    return {
      number: data.numeroTreno || cleanNum,
      category: inferTrainCategory(data.numeroTreno || cleanNum, parsedCategory || data.categoria),
      origin: firstStopName,
      destination: lastStopName,
      scheduledDepartureTime: data.orarioPartenza || 0,
      scheduledArrivalTime: data.orarioArrivo || 0,
      delay: typeof data.ritardo === 'number' ? data.ritardo : 0,
      lastReportedStation: getCleanStationName(data.stazioneUltimoRilevamento || ''),
      lastReportedTime: data.oraUltimoRilevamento || null,
      stops,
      isCancelled,
      codiceCliente: data.codiceCliente
    };
  } catch (error) {
    console.error('Error fetching train status details:', error);
    return null;
  }
}

/**
 * Get Arrivals or Departures Board for a station ID
 */
export async function getStationBoard(
  stationID: string,
  mode: 'departures' | 'arrivals',
  dateTime: Date = new Date()
): Promise<VtBoardEntry[]> {
  const cleanId = stationID.trim();
  if (!cleanId) return [];

  const vtPromise = (async (): Promise<VtBoardEntry[]> => {
    try {
      const formattedTime = formatVtDateTime(dateTime);
      const path = mode === 'departures' ? 'partenze' : 'arrivi';
      const url = `${BASE_URL}/${path}/${cleanId}/${encodeURIComponent(formattedTime)}`;
      
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data.map((entry: any) => {
        const isCancelled = entry.provvedimento === 1 || entry.compProvvedimento === 1;
        
        const scheduledTime = mode === 'departures' 
          ? entry.orarioPartenza 
          : entry.orarioArrivo;
          
        const scheduledPlatform = cleanPlatform(mode === 'departures'
          ? entry.binarioProgrammatoPartenzaDescrizione || entry.binarioProgrammatoPartenza || ''
          : entry.binarioProgrammatoArrivoDescrizione || entry.binarioProgrammatoArrivo || '');
          
        const actualPlatform = cleanPlatform(mode === 'departures'
          ? entry.binarioEffettivoPartenzaDescrizione || entry.binarioEffettivoPartenza || ''
          : entry.binarioEffettivoArrivoDescrizione || entry.binarioEffettivoArrivo || '');

        return {
          trainNumber: entry.numeroTreno ? String(entry.numeroTreno) : '',
          category: inferTrainCategory(entry.numeroTreno || '', entry.categoriaDescrizione || entry.categoria),
          origin: getCleanStationName(entry.origine || '', entry.codOrigine || ''),
          destination: getCleanStationName(entry.destinazione || ''),
          scheduledTime: scheduledTime || 0,
          delay: typeof entry.ritardo === 'number' ? entry.ritardo : 0,
          scheduledPlatform,
          actualPlatform,
          isCancelled,
          codiceCliente: entry.codiceCliente,
          originStationID: entry.codOrigine || '',
          timestamp: entry.dataPartenzaTreno || 0,
          originDepartureTime: entry.partenzaTreno || null,
          rawEntry: entry
        };
      });
    } catch (error) {
      console.error(`Error fetching station ${mode} board from ViaggiaTreno:`, error);
      return [];
    }
  })();

  const italoPromise = (async (): Promise<VtBoardEntry[]> => {
    const italoInfo = ITALO_STATION_MAP[cleanId];
    if (!italoInfo) return [];

    try {
      const url = `https://italoinviaggio.italotreno.it/api/RicercaStazioneService?CodiceStazione=${italoInfo.code}&NomeStazione=${italoInfo.slug}`;
      const response = await fetch(url, { headers: ITALO_HEADERS });
      if (!response.ok) return [];

      const data = await response.json();
      if (!data || data.IsEmpty) return [];

      const list = mode === 'departures' ? data.ListaTreniPartenza : data.ListaTreniArrivo;
      if (!Array.isArray(list)) return [];

      return list.map((entry: any) => {
        const scheduledTime = parseTimeStr(entry.OraPassaggio, dateTime) || dateTime.getTime();
        const delay = entry.Ritardo ?? 0;
        const platform = cleanPlatform(entry.Binario || '');

        let origin = '';
        let destination = '';
        if (mode === 'departures') {
          origin = getCleanStationName(data.DescrizioneLocalita || '');
          destination = getCleanStationName(entry.DescrizioneLocalita || '');
        } else {
          origin = getCleanStationName(entry.DescrizioneLocalita || '');
          destination = getCleanStationName(data.DescrizioneLocalita || '');
        }

        return {
          trainNumber: entry.Numero ? String(entry.Numero) : '',
          category: 'NTV',
          origin,
          destination,
          scheduledTime,
          delay,
          scheduledPlatform: platform,
          actualPlatform: platform,
          isCancelled: false,
          codiceCliente: 'ITALO',
          originStationID: 'ITALO',
          timestamp: scheduledTime,
          originDepartureTime: scheduledTime,
          rawEntry: entry
        };
      });
    } catch (error) {
      console.error(`Error fetching Italo station board for ${cleanId}:`, error);
      return [];
    }
  })();

  try {
    const [vtEntries, italoEntries] = await Promise.all([vtPromise, italoPromise]);
    const merged = [...italoEntries, ...vtEntries];
    merged.sort((a, b) => a.scheduledTime - b.scheduledTime);
    return merged;
  } catch (error) {
    console.error('Error in parallel getStationBoard:', error);
    return [];
  }
}

export interface VtAlert {
  id: string;
  title: string;
  text: string;
  timestamp: number;
}

/**
 * Fetch and filter active network news for alerts matching the train number or route
 */
export async function getTrainAlerts(
  trainNumber: string,
  origin: string,
  destination: string
): Promise<VtAlert[]> {
  try {
    const response = await fetch(`${BASE_URL}/news/0/it`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    const num = String(trainNumber).trim();
    const orig = String(origin || '').trim().toUpperCase();
    const dest = String(destination || '').trim().toUpperCase();

    const cleanCityName = (stationName: string) => {
      return stationName
        .split(' ')[0]
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
    };

    const origCity = cleanCityName(orig);
    const destCity = cleanCityName(dest);

    return data
      .filter((item: any) => {
        const text = String(item.testo || '').toUpperCase();
        const title = String(item.titolo || '').toUpperCase();
        
        // Match train number
        const matchesTrainNum = text.includes(num) || title.includes(num);
        
        // Match city pairs
        const matchesCities = 
          (origCity.length > 2 && text.includes(origCity) && destCity.length > 2 && text.includes(destCity)) ||
          (origCity.length > 2 && title.includes(origCity) && destCity.length > 2 && title.includes(destCity));

        return matchesTrainNum || matchesCities;
      })
      .map((item: any) => ({
        id: item.id || String(Math.random()),
        title: item.titolo || 'Trenitalia Informa',
        text: item.testo || '',
        timestamp: item.data || 0
      }));
  } catch (error) {
    console.error('Error fetching train alerts:', error);
    return [];
  }
}

/**
 * Infer train category based on train number if category is missing or expand long category names.
 */
export function inferTrainCategory(trainNumber: string | number, currentCategory: string = ''): string {
  const cat = String(currentCategory || '').trim();
  const numStr = String(trainNumber || '').trim();

  // Normalize existing categories
  if (cat) {
    const upper = cat.toUpperCase();
    if (upper === 'FRECCIAROSSA') return 'FR';
    if (upper === 'FRECCIARGENTO') return 'FA';
    if (upper === 'FRECCIABIANCA') return 'FB';
    if (upper === 'INTERCITY') return 'IC';
    if (upper === 'INTERCITY NOTTE') return 'ICN';
    if (upper === 'REGIO' || upper === 'REGIONALE') return 'REG';
    return cat;
  }

  const num = parseInt(numStr, 10);
  if (isNaN(num)) return '';

  // 1. High Speed trains (FR / FA / FB)
  if (num >= 9000 && num <= 9999) return 'FR';
  if (num >= 9300 && num <= 9699) return 'FR';
  if (num >= 8400 && num <= 8599) return 'FR';
  if (num >= 8300 && num <= 8399) return 'FA';
  if (num >= 8800 && num <= 8899) return 'FR';

  // 2. Intercity (IC / ICN)
  if (num >= 500 && num <= 749) return 'IC';
  if (num >= 1500 && num <= 1599) return 'IC';
  if (num >= 750 && num <= 799) return 'ICN';
  if (num >= 1900 && num <= 1999) return 'ICN';

  // 3. Regional trains (REG / RV)
  if (num >= 2000 && num <= 3999) return 'RV';
  if (num >= 4000 && num <= 4999) return 'REG';

  return '';
}


