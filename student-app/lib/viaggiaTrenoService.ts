import { stations, Station } from '../assets/stations';

const BASE_URL = 'http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno';

export const getCleanStationName = (apiName: string, id?: string): string => {
  const name = String(apiName || '').trim();
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
    return name
      .toLowerCase()
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

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

const cleanPlatform = (val: any) => {
  if (!val) return '';
  const s = String(val).trim();
  if (s.toLowerCase() === 'none' || s.toLowerCase() === 'null') return '';
  return s;
};

/**
 * Resolve operator details based on customer code and train category
 */
export const getOperatorInfo = (codiceCliente: string | number | null, category: string) => {
  const code = String(codiceCliente || '').trim();
  const cat = String(category || '').trim().toUpperCase();
  
  if (cat === 'ITA' || cat === 'ITALO') {
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
function formatVtDateTime(date: Date): string {
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

  try {
    const response = await fetch(`${BASE_URL}/cercaNumeroTrenoTrenoAutocomplete/${cleanNumber}`);
    if (!response.ok) return [];

    const text = await response.text();
    if (!text.trim()) return [];

    // Returns text lines like: "9604 - MILANO CENTRALE|9604-S01700-1618700400000"
    const matches: VtTrainSearchMatch[] = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('|'))
      .map(line => {
        const [label, idValue] = line.split('|');
        const parts = idValue.split('-');
        // parts format: [trainNumber, departureStationID, timestamp]
        return {
          label: label.trim(),
          number: parts[0] || cleanNumber,
          departureStationID: parts[1] || '',
          timestamp: parts[2] || ''
        };
      });

    return matches;
  } catch (error) {
    console.error('Error searching train number via ViaggiaTreno:', error);
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

    return {
      number: data.numeroTreno || cleanNum,
      category: data.categoria || '',
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

  try {
    const formattedTime = formatVtDateTime(dateTime);
    const path = mode === 'departures' ? 'partenze' : 'arrivi';
    
    // Encode the formatted date because it has spaces and colons
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
        
      const scheduledPlatform = mode === 'departures'
        ? entry.binarioProgrammatoPartenzaDescrizione || entry.binarioProgrammatoPartenza || ''
        : entry.binarioProgrammatoArrivoDescrizione || entry.binarioProgrammatoArrivo || '';
        
      const actualPlatform = mode === 'departures'
        ? entry.binarioEffettivoPartenzaDescrizione || entry.binarioEffettivoPartenza || ''
        : entry.binarioEffettivoArrivoDescrizione || entry.binarioEffettivoArrivo || '';

      return {
        trainNumber: entry.numeroTreno ? String(entry.numeroTreno) : '',
        category: (entry.categoriaDescrizione || entry.categoria || '').trim(),
        origin: getCleanStationName(entry.origine || '', entry.codOrigine || ''),
        destination: getCleanStationName(entry.destinazione || ''),
        scheduledTime: scheduledTime || 0,
        delay: typeof entry.ritardo === 'number' ? entry.ritardo : 0,
        scheduledPlatform: scheduledPlatform.trim(),
        actualPlatform: actualPlatform.trim(),
        isCancelled,
        codiceCliente: entry.codiceCliente,
        originStationID: entry.codOrigine || '',
        timestamp: entry.dataPartenzaTreno || 0,
        originDepartureTime: entry.partenzaTreno || null,
        rawEntry: entry
      };
    });
  } catch (error) {
    console.error(`Error fetching station ${mode} board:`, error);
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
