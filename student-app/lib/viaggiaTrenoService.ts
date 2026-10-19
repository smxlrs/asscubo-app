import { rankStationMatches, stationSearchKey } from './stationSearch';
import { fetchWithDeadline, NetworkError, NETWORK_TIMEOUT_MS, requireSuccessfulResponse } from './network';
import { romeToIso } from './eventTime';
import { romeDay, romeParts } from './romeTime';
import { stations, Station } from '../assets/stations';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const BASE_URL = `${SUPABASE_URL}/functions/v1/viaggia-treno-proxy`;

const DIRECT_VIAGGIA_URL = 'https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno';
const isViaggiaProxyUrl = (url: string) => !!SUPABASE_URL && url.startsWith(`${BASE_URL}/`);

export const fetchWithTimeout = async (url: string, options?: RequestInit, timeoutMs = NETWORK_TIMEOUT_MS): Promise<Response> => {
  if (!isViaggiaProxyUrl(url)) return fetchWithDeadline(url, options, timeoutMs);
  const started = Date.now();
  // Credentials belong only to Supabase, never to the public operator endpoint.
  const proxyHeaders = new Headers(options?.headers);
  proxyHeaders.set('apikey', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '');
  let proxyResponse: Response | undefined;
  let proxyError: unknown;
  try {
    proxyResponse = await fetchWithDeadline(url, { ...options, headers: proxyHeaders }, timeoutMs);
    if (![401, 403, 408, 429].includes(proxyResponse.status) && proxyResponse.status < 500) return proxyResponse;
  } catch (error) {
    if (options?.signal?.aborted || (error instanceof NetworkError && error.reason === 'requestErrorCancelled')) throw error;
    proxyError = error;
  }
  const remaining = timeoutMs - (Date.now() - started);
  if (remaining <= 0) {
    if (proxyError) throw proxyError;
    throw new NetworkError('timeout', 'Train request deadline exceeded');
  }
  console.log('[Train][ViaggiaTreno] Proxy unavailable; retrying operator HTTPS', proxyResponse?.status || 'connection error');
  const directHeaders = new Headers(options?.headers);
  for (const name of ['apikey', 'authorization', 'cookie']) directHeaders.delete(name);
  directHeaders.set('Accept', 'application/json, text/plain, */*');
  // The operator CDN rejects some native HTTP client defaults (including OkHttp).
  // Match its public web client, as already done for the separate Italo API.
  directHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  directHeaders.set('Referer', 'https://www.viaggiatreno.it/');
  // Keep the whole operation within one deadline, including reading both bodies.
  const response = await fetchWithDeadline(`${DIRECT_VIAGGIA_URL}${url.slice(BASE_URL.length)}`, {
    ...options, headers: directHeaders, credentials: 'omit',
  }, remaining);
  console.log('[Train][ViaggiaTreno] Operator HTTPS response', response.status,
    url.slice(BASE_URL.length).split('/')[1], response.headers.get('content-type'));
  return response;
};

export const getCleanStationName = (apiName: string, id?: string): string => {
  let name = String(apiName || '').trim();
  const cleanId = String(id || '').trim();
  // Keep complete operator names authoritative; the local catalog may be outdated.
  if (cleanId && (!name || name.endsWith('...'))) {
    const found = stations.find(s => s.id === cleanId || s.id === 'S' + cleanId || 'S' + s.id === cleanId);
    if (found) {
      return found.n;
    }
  }

  if (!name) return '';

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
  detailLevel?: 'station-board';
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

export const normalizeTrainNumber = (
  value: string | number | null | undefined,
  fallback: string | number = ''
): string => {
  const normalized = String(value ?? '').trim();
  return normalized || String(fallback).trim();
};

export const normalizeTrainCategory = (value: string | null | undefined): string => {
  const category = String(value ?? '').trim();
  const upper = category.toUpperCase();

  if (upper === 'FRECCIAROSSA') return 'FR';
  if (upper === 'FRECCIARGENTO') return 'FA';
  if (upper === 'FRECCIABIANCA') return 'FB';
  if (upper === 'INTERCITY') return 'IC';
  if (upper === 'INTERCITY NOTTE') return 'ICN';
  if (upper === 'REGIONALE VELOCE') return 'RV';
  if (upper === 'REGIO' || upper === 'REGIONALE') return 'REG';

  return category;
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

function romeWallTime(base: Date, hour: number, minute: number, dayOffset = 0): number {
  const p = romeParts(base);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset)).toISOString().slice(0, 10);
  const iso = romeToIso(day + ' ' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'));
  return iso ? Date.parse(iso) : NaN;
}

export const parseTimeStr = (timeStr: string, baseDate: Date): number | null => {
  if (!timeStr || timeStr === '--:--' || timeStr === '') return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const candidates = [-1, 0, 1].map(offset => romeWallTime(baseDate, hour, minute, offset)).filter(Number.isFinite);
  candidates.sort((a, b) => Math.abs(a - baseDate.getTime()) - Math.abs(b - baseDate.getTime()));
  return candidates[0] ?? null;
};

export function parseItaloTrainStatus(data: any): VtTrainStatus | null {
  if (!data || data.IsEmpty || !data.TrainSchedule) return null;
  const schedule = data.TrainSchedule;
  const num = normalizeTrainNumber(schedule.TrainNumber);
  
  const baseDate = new Date();
  
  const parseItaloStop = (s: any, isReached: boolean): VtStop => {
    const code = String(s.LocationCode || s.StationCode || '').toUpperCase();
    let stationName = s.LocationDescription || s.StationDescription || '';
    stationName = getCleanStationName(stationName);
    
    const scheduledPlatform = cleanPlatform(s.BinaryProgrammed || '');
    const actualPlatform = cleanPlatform(s.BinaryReal || s.ActualArrivalPlatform || '');
    
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
      stationId: Object.entries(ITALO_STATION_MAP).find(([, info]) => info.code === code)?.[0] || code,
      scheduledArrivalTime,
      actualArrivalTime,
      scheduledDepartureTime,
      actualDepartureTime,
      scheduledPlatform,
      actualPlatform: isReached ? actualPlatform : '',
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
  if (cat === 'EN' || cat === 'EURONIGHT' || cat === 'NJ' || cat === 'NIGHTJET') {
    return { code: 'TI/ÖBB', name: 'Trenitalia / ÖBB', color: '#E20026' }; // ÖBB red
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
  // API expects Rome wall-clock components, regardless of the device timezone.
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = romeParts(date);
  const dayName = days[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
  const monthName = months[p.month - 1];
  const day = String(p.day).padStart(2, '0');
  const year = p.year;
  const hours = String(p.hour).padStart(2, '0');
  const minutes = String(p.minute).padStart(2, '0');
  const seconds = String(p.second).padStart(2, '0');
  return `${dayName} ${monthName} ${day} ${year} ${hours}:${minutes}:${seconds}`;
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
    const year = date.getUTCFullYear();
    const transition = (month: number) => {
      const last = new Date(Date.UTC(year, month + 1, 0, 1));
      last.setUTCDate(last.getUTCDate() - last.getUTCDay()); return last.getTime();
    };
    return date.getTime() >= transition(2) && date.getTime() < transition(9) ? 7200000 : 3600000;
  }
}

/**
 * Convert a local device Date object to a UTC timestamp representing the same wall-clock time in Rome.
 */
export function getRomeTimestampFromLocalDate(date: Date): number {
  // Date already represents an instant, independent of the device timezone.
  return date.getTime();
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
    const date = new Date(unixMs + getRomeOffset(new Date(unixMs)));
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(
      date.getUTCMinutes()
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
    const date = new Date(unixMs + getRomeOffset(new Date(unixMs)));
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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
    const date = new Date(unixMs + getRomeOffset(new Date(unixMs)));
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(
      date.getUTCMonth() + 1
    ).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(
      date.getUTCMinutes()
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

  const searchKey = stationSearchKey(cleanQuery);

  // 1. Try local index first
  const localMatches = rankStationMatches(stations, searchKey);
  if (localMatches.length > 0) {
    return localMatches.slice(0, 15).map(station => ({ name: station.n, id: station.id }));
  }

  // 2. Fall back to ViaggiaTreno autocompletaStazione API
  try {
    const encoded = encodeURIComponent(searchKey);
    const response = await fetchWithTimeout(`${BASE_URL}/autocompletaStazione/${encoded}`, undefined, NETWORK_TIMEOUT_MS);
    if (response.status === 404) return [];
    requireSuccessfulResponse(response);
    
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
      
    return rankStationMatches(parsed.map(station => ({ n: station.name, id: station.id })), searchKey)
      .slice(0, 15).map(station => ({ name: station.n, id: station.id }));
  } catch (error) {
    console.log('Error fetching stations from ViaggiaTreno API:', error);
    return [];
  }
}

/**
 * Resolve train number into list of matching runs with origin, station id, and timestamp
 */
export async function searchTrain(trainNumber: string | number, operator?: 'italo' | 'trenitalia'): Promise<VtTrainSearchMatch[]> {
  const cleanNumber = normalizeTrainNumber(trainNumber);
  if (!cleanNumber) return [];
  let networkFailure: NetworkError | null = null;

  const vtPromise = (async (): Promise<VtTrainSearchMatch[]> => {
    if (operator === 'italo') return [];
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/cercaNumeroTrenoTrenoAutocomplete/${cleanNumber}`, {}, NETWORK_TIMEOUT_MS);
      if (response.status === 404) return [];
      requireSuccessfulResponse(response);

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
            number: normalizeTrainNumber(parts[0], cleanNumber),
            departureStationID: parts[1] || '',
            timestamp: parts[2] || ''
          };
        });
    } catch (error) {
      console.log('Error searching train number via ViaggiaTreno:', error);
      if (error instanceof NetworkError) networkFailure = error;
      return [];
    }
  })();

  const italoPromise = (async (): Promise<VtTrainSearchMatch[]> => {
    if (operator === 'trenitalia') return [];
    try {
      const response = await fetchWithTimeout(`https://italoinviaggio.italotreno.it/api/RicercaTrenoService?TrainNumber=${cleanNumber}`, {
        headers: ITALO_HEADERS
      }, NETWORK_TIMEOUT_MS);
      if (response.status === 404) return [];
      requireSuccessfulResponse(response);
      const data = await response.json();
      if (data && !data.IsEmpty && data.TrainSchedule) {
        const schedule = data.TrainSchedule;
        const originDesc = schedule.DepartureStationDescription || '';
        
        // Use a stable timestamp (start of today) since Italo doesn't provide a TrainDate.
        // This prevents infinite loop fetches triggered by Date.now().
        const trainDateVal = Date.parse(romeToIso(romeDay() + ' 00:00')!);
        
        const label = `${cleanNumber} - ${originDesc.toUpperCase()} (Italo)`;
        return [{
          label,
          number: cleanNumber,
          departureStationID: 'ITALO',
          timestamp: String(trainDateVal)
        }];
      }
    } catch (error) {
      console.log('Error searching Italo train:', error);
      if (error instanceof NetworkError) networkFailure = error;
    }
    return [];
  })();

  try {
    const [vtMatches, italoMatches] = await Promise.all([vtPromise, italoPromise]);
    if (!vtMatches.length && !italoMatches.length && networkFailure) throw networkFailure;
    return [...italoMatches, ...vtMatches];
  } catch (error) {
    console.log('Error in parallel searchTrain:', error);
    if (error instanceof NetworkError) throw error;
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
  const cleanNum = normalizeTrainNumber(trainNumber);
  const cleanStation = departureStationID.trim();
  if (!cleanNum || !cleanStation) return null;

  if (cleanStation === 'ITALO') {
    try {
      const response = await fetchWithTimeout(`https://italoinviaggio.italotreno.it/api/RicercaTrenoService?TrainNumber=${cleanNum}`, {
        headers: ITALO_HEADERS
      }, NETWORK_TIMEOUT_MS);
      if (response.status === 404) return null;
      requireSuccessfulResponse(response);
      const data = await response.json();
      return parseItaloTrainStatus(data);
    } catch (error) {
      console.log('Error fetching Italo train status:', error);
      if (error instanceof NetworkError) throw error;
      return null;
    }
  }

  try {
    const url = timestamp 
      ? `${BASE_URL}/andamentoTreno/${cleanStation}/${cleanNum}/${timestamp}`
      : `${BASE_URL}/andamentoTreno/${cleanStation}/${cleanNum}`;
      
    const response = await fetchWithTimeout(url, undefined, NETWORK_TIMEOUT_MS);
    if (response.status === 204) {
      // Train not started or cancelled, no details
      return null;
    }
    if (response.status === 404) return null;
    requireSuccessfulResponse(response);

    const data = await response.json();
    if (!data) return null;

    // Map stops
    const stops: VtStop[] = (data.fermate || []).map((f: any) => {
      let stopStatus: VtStop['status'] = 'regular';
      if (f.actualFermataType === 2) stopStatus = 'added';
      else if (f.actualFermataType === 3) stopStatus = 'suppressed';
      else if (f.actualFermataType === 0) stopStatus = 'unknown';

      // Parse platforms properly based on whether it is origin, destination or intermediate
      const scheduledPlatform = cleanPlatform(f.binarioProgrammatoPartenzaDescrizione || f.binarioProgrammatoPartenza || f.binarioProgrammatoArrivoDescrizione || f.binarioProgrammatoArrivo);
      const actualPlatform = cleanPlatform(f.binarioEffettivoPartenzaDescrizione || f.binarioEffettivoPartenza || f.binarioEffettivoArrivoDescrizione || f.binarioEffettivoArrivo);

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

    return adjustInternationalTrainStatus({
      number: normalizeTrainNumber(data.numeroTreno, cleanNum),
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
    });
  } catch (error) {
    console.log('Error fetching train status details:', error);
    if (error instanceof NetworkError) throw error;
    return null;
  }
}

/**
 * Get Arrivals or Departures Board for a station ID
 */
export async function getStationBoard(
  stationID: string,
  mode: 'departures' | 'arrivals',
  dateTime: Date = new Date(),
  operator?: 'italo' | 'trenitalia'
): Promise<VtBoardEntry[]> {
  const cleanId = stationID.trim();
  if (!cleanId) return [];

  let fetchError: any = null;

  const vtPromise = (async (): Promise<VtBoardEntry[]> => {
    if (operator === 'italo') return [];
    try {
      const formattedTime = formatVtDateTime(dateTime);
      const path = mode === 'departures' ? 'partenze' : 'arrivi';
      const url = `${BASE_URL}/${path}/${cleanId}/${encodeURIComponent(formattedTime)}`;
      
      const response = await fetchWithTimeout(url, undefined, NETWORK_TIMEOUT_MS);
      if (__DEV__) {
        console.log(`[Train][ViaggiaTreno] ${mode} date=${dateTime.toString()} iso=${dateTime.toISOString()} status=${response.status} url=${url}`);
      }
      if (response.status === 404) return [];
      requireSuccessfulResponse(response);

      const body = await response.text();
      let data: any;
      try {
        data = JSON.parse(body.replace(/^\uFEFF/, '').trim());
      } catch (parseError) {
        if (__DEV__) {
          console.warn(`[Train][ViaggiaTreno] JSON parse failed length=${body.length}`, parseError);
        }
        throw new NetworkError('data', 'Invalid station board response', undefined, parseError);
      }
      if (!Array.isArray(data)) return [];
      if (__DEV__) {
        console.log(`[Train][ViaggiaTreno] ${mode} entries=${data.length}`);
      }

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

        return adjustInternationalBoardEntry({
          trainNumber: normalizeTrainNumber(entry.numeroTreno),
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
        });
      });
    } catch (error) {
      console.log(`Error fetching station ${mode} board from ViaggiaTreno:`, error);
      fetchError = error;
      return [];
    }
  })();

  const italoPromise = (async (): Promise<VtBoardEntry[]> => {
    if (operator === 'trenitalia') return [];
    const italoInfo = ITALO_STATION_MAP[cleanId];
    if (!italoInfo) return [];

    try {
      const url = `https://italoinviaggio.italotreno.it/api/RicercaStazioneService?CodiceStazione=${italoInfo.code}&NomeStazione=${italoInfo.slug}`;
      const response = await fetchWithDeadline(url, { headers: ITALO_HEADERS });
      if (response.status === 404) return [];
      requireSuccessfulResponse(response);

      const data = await response.json();
      if (!data || data.IsEmpty) return [];

      const list = mode === 'departures' ? data.ListaTreniPartenza : data.ListaTreniArrivo;
      if (!Array.isArray(list)) return [];

      return list.map((entry: any) => {
        const scheduledTime = parseTimeStr(entry.OraPassaggio, dateTime) || 0;
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

        return adjustInternationalBoardEntry({
          trainNumber: normalizeTrainNumber(entry.Numero),
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
        });
      });
    } catch (error) {
      console.log(`Error fetching Italo station board for ${cleanId}:`, error);
      fetchError = error;
      return [];
    }
  })();

  const [vtEntries, italoEntries] = await Promise.all([vtPromise, italoPromise]);

  if (vtEntries.length === 0 && italoEntries.length === 0 && fetchError) {
    throw fetchError;
  }

  const merged = [...italoEntries, ...vtEntries];
  merged.sort((a, b) => a.scheduledTime - b.scheduledTime);
  return merged;
}

export interface VtAlert {
  id: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface VtAlertResult {
  alerts: VtAlert[];
  available: boolean;
}

export interface VtTransportStrike {
  id: string;
  startDate: string;
  endDate: string;
  sector: string;
  relevance: string;
  region: string;
  province: string;
  modalities: string;
  unions: string;
  category: string;
  declarationDate: string;
  receivedDate: string;
}

export interface VtTransportStrikeResult {
  strikes: VtTransportStrike[];
  available: boolean;
}

const MIT_STRIKES_RSS_URL = 'https://scioperi.mit.gov.it/mit2/public/scioperi/rss';

const decodeXmlText = (value: string): string => {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r/g, '')
    .trim();
};

const getXmlTagValue = (xml: string, tag: string): string => {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlText(match[1]) : '';
};

const getStrikeField = (description: string, label: string): string => {
  const match = description.match(new RegExp(`(?:^|\\n)${label}:\\s*([^\\n]+)`, 'i'));
  return match ? match[1].trim() : '';
};

const getTitleField = (title: string, label: string): string => {
  const match = title.match(new RegExp(`${label}:\\s*([^\\-]+?)(?=\\s*-\\s*[^-]+:|$)`, 'i'));
  return match ? match[1].trim() : '';
};

const parseItalianDate = (date: string): number => {
  const match = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 0;
  const iso = romeToIso(`${match[3]}-${match[2]}-${match[1]} 00:00`);
  return iso ? Date.parse(iso) : 0;
};

/** Fetch the official Italian Ministry of Transport feed of upcoming transport strikes. */
export async function getTransportStrikes(): Promise<VtTransportStrikeResult> {
  try {
    const response = await fetchWithTimeout(
      MIT_STRIKES_RSS_URL,
      { headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' } },
      NETWORK_TIMEOUT_MS
    );
    if (!response.ok) return { strikes: [], available: false };

    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const today = new Date(romeToIso(romeDay() + ' 00:00')!);

    const strikes = items
      .map((item): VtTransportStrike | null => {
        const title = getXmlTagValue(item, 'title');
        const description = getXmlTagValue(item, 'description');
        const startDate = getTitleField(title, 'Data inizio');
        const endDate = getStrikeField(description, 'Data fine') || startDate;
        const endTimestamp = parseItalianDate(endDate);
        if (!startDate || !endTimestamp || endTimestamp < today.getTime()) return null;

        return {
          id: getXmlTagValue(item, 'guid') || `${startDate}-${title}`,
          startDate,
          endDate,
          sector: getStrikeField(description, 'Settore') || getTitleField(title, 'Settore'),
          relevance: getStrikeField(description, 'Rilevanza') || getTitleField(title, 'Rilevanza'),
          region: getStrikeField(description, 'Regione') || getTitleField(title, 'Regione'),
          province: getStrikeField(description, 'Provincia') || getTitleField(title, 'Provincia'),
          modalities: getStrikeField(description, 'modalit(?:à|a)'),
          unions: getStrikeField(description, 'Sindacati'),
          category: getStrikeField(description, 'Categoria interessata'),
          declarationDate: getStrikeField(description, 'Data proclamazione'),
          receivedDate: getStrikeField(description, 'Data ricezione')
        };
      })
      .filter((strike): strike is VtTransportStrike => strike !== null)
      .sort((a, b) => parseItalianDate(a.startDate) - parseItalianDate(b.startDate));

    return { strikes, available: true };
  } catch (error) {
    console.warn('Error fetching official transport strike feed:', error);
    return { strikes: [], available: false };
  }
}

const TRAIN_ALERT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeAlertTimestamp(value: unknown): number {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 0;
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

/**
 * Fetch and filter active network news for alerts matching the train number or route
 */
export async function getTrainAlerts(
  trainNumber: string,
  origin: string,
  destination: string
): Promise<VtAlertResult> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/news/0/it`, undefined, NETWORK_TIMEOUT_MS);
    if (!response.ok) return { alerts: [], available: false };
    const data = await response.json();
    if (!Array.isArray(data)) return { alerts: [], available: false };

    const num = String(trainNumber).trim();
    const orig = String(origin || '').trim().toUpperCase();
    const dest = String(destination || '').trim().toUpperCase();
    const earliestAlertTimestamp = Date.now() - TRAIN_ALERT_MAX_AGE_MS;

    const cleanCityName = (stationName: string) => {
      return stationName
        .split(' ')[0]
        .replace(/[^A-Za-z]/g, '')
        .toUpperCase();
    };

    const origCity = cleanCityName(orig);
    const destCity = cleanCityName(dest);

    const alerts = data
      .filter((item: any) => {
        const timestamp = normalizeAlertTimestamp(item.data);
        if (timestamp < earliestAlertTimestamp) return false;

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
        timestamp: normalizeAlertTimestamp(item.data)
      }));

    return { alerts, available: true };
  } catch (error) {
    console.log('Error fetching train alerts:', error);
    return { alerts: [], available: false };
  }
}

/**
 * Infer train category based on train number if category is missing or expand long category names.
 */
export function inferTrainCategory(trainNumber: string | number, currentCategory: string = ''): string {
  const cat = normalizeTrainCategory(currentCategory);
  const numStr = String(trainNumber || '').trim();

  // Normalize existing categories
  if (cat) {
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

// Compare complete station identities; a city substring must never pick an arbitrary stop.
function stationIdentityKey(name: string): string {
  return getCleanStationName(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
const STATION_ALIASES: Record<string, string> = {
  'venezia s lucia': 'S02593', 'venezia s l': 'S02593',
  'firenze smn': 'S06421', 'firenze s m novella': 'S06421', 'firenze s m n': 'S06421',
  'torino p nuova': 'S00219', 'torino p n': 'S00219',
  'torino p susa': 'S00222', 'torino porta di susa': 'S00222',
  'reggio emilia av': 'S05254', 'mediopadana r emilia': 'S05254',
  'reggio emilia av mediopadana': 'S05254', 'bazzano fer': 'S05975',
};
export const findStationIdByName = (name: string): string | null => {
  const key = stationIdentityKey(name);
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(STATION_ALIASES, key)) return STATION_ALIASES[key];
  // The operator's own station slugs safely resolve short names such as Bologna.
  const operator = Object.entries(ITALO_STATION_MAP).filter(([, s]) => stationIdentityKey(s.slug) === key);
  if (operator.length === 1) return operator[0][0];
  const exact = stations.filter(s => stationIdentityKey(s.n) === key);
  if (exact.length === 1) return exact[0].id;
  const partial = stations.filter(s => {
    const candidate = stationIdentityKey(s.n);
    return candidate.startsWith(key + ' ') || key.startsWith(candidate + ' ');
  });
  return partial.length === 1 ? partial[0].id : null;
};

export async function getFutureItaloTrainSchedule(
  trainNumber: string,
  originName: string,
  destinationName: string,
  scheduledDepartureTime: number,
  boardMode: 'departures' | 'arrivals' = 'departures',
  boardPlatforms: { scheduledPlatform?: string; actualPlatform?: string } = {}
): Promise<VtTrainStatus | null> {
  // Italo station boards are live: never attach today's board to a saved past/future run.
  if (!Number.isFinite(scheduledDepartureTime) || scheduledDepartureTime <= 0
    || romeDay(new Date(scheduledDepartureTime)) !== romeDay()) return null;
  const originId = findStationIdByName(originName);
  const destId = findStationIdByName(destinationName);
  if (!originId && !destId) return null;
  
  let arrivalTime = boardMode === 'arrivals' ? scheduledDepartureTime : 0;
  const departureTime = boardMode === 'departures' ? scheduledDepartureTime : 0;
  let scheduledPlatform = boardMode === 'arrivals' ? cleanPlatform(boardPlatforms.scheduledPlatform) : '';
  let actualPlatform = boardMode === 'arrivals' ? cleanPlatform(boardPlatforms.actualPlatform) : '';
  
  if (destId) {
    try {
      const board = await getStationBoard(destId, 'arrivals', new Date(scheduledDepartureTime), 'italo');
      const entry = board.find(b => String(b.trainNumber) === String(trainNumber)
        && (!departureTime || b.scheduledTime >= departureTime));
      if (entry) {
        arrivalTime = entry.scheduledTime;
        scheduledPlatform = entry.scheduledPlatform;
        actualPlatform = entry.actualPlatform;
      }
    } catch (e) {
      // The selected board still confirms a station/time even if the endpoint board fails.
      console.warn('Failed to fetch destination board for future Italo train:', e);
    }
  }
  
  const stops: VtStop[] = [
    {
      stationName: originName,
      stationId: originId || '',
      scheduledArrivalTime: null,
      actualArrivalTime: null,
      scheduledDepartureTime: departureTime || null,
      actualDepartureTime: null,
      scheduledPlatform: boardMode === 'departures' ? cleanPlatform(boardPlatforms.scheduledPlatform) : '',
      actualPlatform: boardMode === 'departures' ? cleanPlatform(boardPlatforms.actualPlatform) : '',
      arrivalDelay: 0,
      departureDelay: 0,
      status: 'regular'
    },
    {
      stationName: destinationName,
      stationId: destId || '',
      scheduledArrivalTime: arrivalTime || null,
      actualArrivalTime: null,
      scheduledDepartureTime: null,
      actualDepartureTime: null,
      scheduledPlatform,
      actualPlatform,
      arrivalDelay: 0,
      departureDelay: 0,
      status: 'regular'
    }
  ];
  
  return {
    detailLevel: 'station-board',
    number: normalizeTrainNumber(trainNumber),
    category: 'NTV',
    origin: originName,
    destination: destinationName,
    scheduledDepartureTime: departureTime,
    scheduledArrivalTime: arrivalTime,
    delay: 0,
    lastReportedStation: '',
    lastReportedTime: null,
    stops,
    isCancelled: false,
    codiceCliente: 'ITALO'
  };
}

export function adjustInternationalTrainStatus(status: VtTrainStatus): VtTrainStatus {
  // Missing foreign stops must remain unknown; never inject a hardcoded timetable.
  return status;
}

export function adjustInternationalBoardEntry(entry: VtBoardEntry): VtBoardEntry {
  const num = String(entry.trainNumber).trim();
  const cat = String(entry.category).trim().toUpperCase();
  if (cat === 'EN' || cat === 'EURONIGHT' || cat === 'NJ' || cat === 'NIGHTJET') {
    if (num === '294' || num === '40294') {
      entry.destination = 'München Hbf';
    } else if (num === '295' || num === '40295') {
      entry.origin = 'München Hbf';
    } else if (num === '235' || num === '40235') {
      entry.destination = 'Wien Hbf';
    } else if (num === '233' || num === '40233') {
      entry.origin = 'Wien Hbf';
    }
  }
  return entry;
}
