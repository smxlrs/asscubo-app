import { supabase } from './supabase';

export interface BusArrival {
  line: string;
  type: 'satellite' | 'scheduled';
  time: string;
  hasRamp: boolean;
  busNumber?: string;
  raw: string;
}

export interface BusStop {
  id: number;
  stop_code: string;
  stop_name: string;
  latitude: number | null;
  longitude: number | null;
  city: string;
  lines: string | null;
}

/**
 * Queries TPER HelloBus SOAP web service for bus arrivals at a specific stop code.
 * Optionally filters by line.
 */
export async function fetchBusArrivals(stopCode: string, lineCode = ''): Promise<BusArrival[]> {
  const cleanStop = stopCode.trim();
  const cleanLine = lineCode.trim().toUpperCase();

  if (!cleanStop) {
    throw new Error('请输入站牌号');
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <QueryHellobus xmlns="https://hellobuswsweb.tper.it/web-services/hellobus.asmx">
      <fermata>${cleanStop}</fermata>
      <linea>${cleanLine}</linea>
      <oraHHMM></oraHHMM>
    </QueryHellobus>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch('https://hellobuswsweb.tper.it/web-services/hellobus.asmx', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'https://hellobuswsweb.tper.it/web-services/hellobus.asmx/QueryHellobus',
      },
      body: soapEnvelope,
    });

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`);
    }

    const xmlResponse = await response.text();
    
    // Extract QueryHellobusResult node using regex
    const match = xmlResponse.match(/<QueryHellobusResult>([\s\S]*?)<\/QueryHellobusResult>/);
    if (!match) {
      throw new Error('解析响应数据失败');
    }

    const resultText = match[1].trim();

    // Check for standard errors returned in the SOAP response
    if (resultText.includes('NON GESTITA')) {
      if (resultText.toLowerCase().includes('fermata')) {
        throw new Error(`站牌号 ${cleanStop} 不存在或不受管理`);
      } else if (resultText.toLowerCase().includes('linea')) {
        throw new Error(`公交线路 ${cleanLine} 不存在或不在该站点停靠`);
      }
      throw new Error('输入的查询条件暂无可用数据');
    }

    if (resultText.includes('NON PREVISTI Transiti') || resultText.includes('nessun transito')) {
      return [];
    }

    return parseHelloBusString(resultText);
  } catch (error: any) {
    console.error('HelloBus Query Error:', error);
    throw error;
  }
}

/**
 * Parses the HelloBus result string into structured objects.
 * Format: "TperHellobus: (x15:30) 97 DaSatellite 15:00 (Bus1848 CON PEDANA), 27A Previsto 15:42"
 */
function parseHelloBusString(text: string): BusArrival[] {
  // Strip prefix like "TperHellobus: " or "TperHellobus: (x15:30) "
  let cleaned = text.replace(/^TperHellobus:\s*(?:\(x\d{2}:\d{2}\))?\s*/i, '');
  cleaned = cleaned.replace(/^HellobusHelp:\s*/i, '');
  cleaned = cleaned.trim();

  if (!cleaned) return [];

  // Split by comma
  const segments = cleaned.split(',').map(s => s.trim());
  const arrivals: BusArrival[] = [];

  for (const segment of segments) {
    if (!segment) continue;

    // Ignore TPER status notices (e.g. "OGGI NESSUNA ALTRA CORSA DI N4 PER FERMATA 702")
    if (
      /nessun/i.test(segment) ||
      /nessuna/i.test(segment) ||
      /non\s+previsti/i.test(segment)
    ) {
      continue;
    }

    // Regex to match: LINE_NAME TYPE TIME (extra_details)
    // Example: "97 DaSatellite 15:00 (Bus1848 CON PEDANA)"
    // Example: "27A Previsto 15:42"
    // Example: "C DaSatellite 16:11"
    const regex = /^([a-zA-Z0-9]+)\s+(DaSatellite|Previsto)\s+(\d{2}:\d{2})(?:\s+\((.*?)\))?$/i;
    const match = segment.match(regex);

    if (match) {
      const line = match[1];
      const typeStr = match[2].toLowerCase();
      const time = match[3];
      const details = match[4] || '';

      const hasRamp = details.toUpperCase().includes('CON PEDANA');
      
      // Try to extract bus number, e.g., "Bus1848"
      const busMatch = details.match(/Bus\s*(\d+)/i);
      const busNumber = busMatch ? busMatch[1] : undefined;

      arrivals.push({
        line,
        type: typeStr === 'dasatellite' ? 'satellite' : 'scheduled',
        time,
        hasRamp,
        busNumber,
        raw: segment,
      });
    } else {
      // Fallback if regex doesn't match perfectly but looks like an arrival
      // E.g., just line and time "27A 15:30"
      const simpleRegex = /^([a-zA-Z0-9]+)\s+(\d{2}:\d{2})/i;
      const simpleMatch = segment.match(simpleRegex);
      if (simpleMatch) {
        arrivals.push({
          line: simpleMatch[1],
          type: 'scheduled',
          time: simpleMatch[2],
          hasRamp: false,
          raw: segment,
        });
      } else {
        console.warn('Could not parse segment:', segment);
      }
    }
  }

  return arrivals;
}

/**
 * Searches for bus stops by name using Supabase online lookup.
 * Uses ilike for case-insensitive partial match.
 */
export async function searchStopsByName(query: string): Promise<BusStop[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  try {
    let dbQuery = supabase
      .from('bus_stops')
      .select('id, stop_code, stop_name, latitude, longitude, city, lines');

    // If query is numeric, search for exact stop_code OR partial stop_name
    if (/^\d+$/.test(cleanQuery)) {
      dbQuery = dbQuery.or(`stop_code.eq.${cleanQuery},stop_name.ilike.%${cleanQuery}%`);
    } else {
      dbQuery = dbQuery.ilike('stop_name', `%${cleanQuery}%`);
    }

    // Fetch more results so we can sort them properly in memory
    const { data, error } = await dbQuery.limit(100);

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    if (!data) return [];

    const q = cleanQuery.toLowerCase();

    // Map each item to a relevance score (lower score = higher priority)
    const scoredItems = data.map(item => {
      const name = item.stop_name.toLowerCase();
      const code = item.stop_code.toLowerCase();
      
      let score = 5; // Default score
      
      if (code === q) {
        score = 0; // Exact match of stop code has highest priority
      } else if (name === q) {
        score = 1; // Exact match of stop name
      } else if (name.startsWith(q)) {
        score = 2; // Starts with query
      } else {
        const index = name.indexOf(q);
        if (index > 0) {
          const charBefore = name.charAt(index - 1);
          // Word boundary match: character before index is non-alphanumeric (including space/accents check)
          if (!/[a-zA-Z0-9\u00C0-\u017F]/.test(charBefore)) {
            score = 3;
          } else {
            score = 4; // Substring match
          }
        }
      }

      return {
        item,
        score,
      };
    });

    // Sort by:
    // 1. Score (ascending)
    // 2. Stop name (alphabetically)
    scoredItems.sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      return a.item.stop_name.localeCompare(b.item.stop_name);
    });

    // Slice to top 30 and map back to BusStop type
    return scoredItems.slice(0, 30).map(si => ({
      id: Number(si.item.id),
      stop_code: si.item.stop_code,
      stop_name: si.item.stop_name,
      latitude: si.item.latitude,
      longitude: si.item.longitude,
      city: si.item.city,
      lines: si.item.lines,
    }));
  } catch (err) {
    console.error('Failed to search stops in database:', err);
    return [];
  }
}

/**
 * Queries bus stops located inside a bounding box.
 * Used for displaying stops on the map.
 */
export async function fetchStopsInBoundingBox(
  minLat: number,
  maxLat: number,
  minLon: number,
  maxLon: number,
  limit: number = 1000
): Promise<BusStop[]> {
  try {
    const { data, error } = await supabase
      .from('bus_stops')
      .select('id, stop_code, stop_name, latitude, longitude, city, lines')
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLon)
      .lte('longitude', maxLon)
      .limit(limit);

    if (error) throw error;

    return (data || []).map(item => ({
      id: Number(item.id),
      stop_code: item.stop_code,
      stop_name: item.stop_name,
      latitude: item.latitude,
      longitude: item.longitude,
      city: item.city,
      lines: item.lines,
    }));
  } catch (err) {
    console.error('Failed to fetch stops in box:', err);
    return [];
  }
}
