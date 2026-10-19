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

/** Exact aliases first; contained city names prefer the longest match.
 * One-character abbreviations must stand alone.
 */
export function stationSearchKey(input: string): string {
  const query = input.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(CHINESE_CITY_MAPPINGS, query)) {
    return CHINESE_CITY_MAPPINGS[query];
  }
  const match = Object.entries(CHINESE_CITY_MAPPINGS)
    .filter(([name]) => name.length > 1 && query.includes(name))
    .sort(([a], [b]) => b.length - a.length)[0];
  return match ? match[1] : query;
}

interface SearchableStation {
  n: string;
  id: string;
  p?: number;
}

// Curated travel-hub priority, not measured passenger counts. IDs keep similarly
// named stops (e.g. Garibaldi Passante / Mestre Ospedale) independent.
// Existing catalog priorities remain the fallback for other Italian cities.
const TRAVEL_HUB_PRIORITY: Readonly<Record<string, number>> = {
  S00219: 300, // Torino Porta Nuova
  S00222: 290, // Torino Porta Susa
  S00452: 150, // Torino Lingotto
  S08409: 300, // Roma Termini
  S08217: 290, // Roma Tiburtina
  S08406: 180, // Roma Ostiense
  S08405: 170, // Roma Trastevere
  S01700: 300, // Milano Centrale
  S01645: 290, // Milano Porta Garibaldi
  S01820: 280, // Milano Rogoredo
  S25001: 180, // Milano Cadorna
  S01701: 170, // Milano Lambrate
  S05043: 300, // Bologna Centrale
  S06421: 300, // Firenze Santa Maria Novella
  S06900: 290, // Firenze Campo di Marte
  S06420: 180, // Firenze Rifredi
  S02593: 300, // Venezia Santa Lucia
  S02589: 290, // Venezia Mestre
  S09218: 300, // Napoli Centrale
  S09988: 290, // Napoli Afragola
  S04700: 300, // Genova Piazza Principe
  S04702: 290, // Genova Brignole
  S04220: 180, // Genova Sampierdarena
  S02430: 300, // Verona Porta Nuova
  S02433: 150, // Verona Porta Vescovo
  S06500: 300, // Pisa Centrale
  S06501: 150, // Pisa San Rossore
  S05254: 200, // Reggio Emilia AV Mediopadana
};

function normalizedStationText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim();
}

/** Exact station > city/name prefix > word match > substring; within each
 * match group, prefer major travel hubs, then regional hubs, then other stops.
 * Returns a new array, preserving the source catalog and every matching ID.
 */
export function rankStationMatches<T extends SearchableStation>(items: readonly T[], input: string): T[] {
  const key = normalizedStationText(stationSearchKey(input));
  if (!key) return [];
  return items.map(station => {
    const name = normalizedStationText(station.n);
    const match = name === key ? 4 : name.startsWith(key) ? 3
      : name.includes(' ' + key) ? 2 : name.includes(key) ? 1 : 0;
    const priority = Object.prototype.hasOwnProperty.call(TRAVEL_HUB_PRIORITY, station.id)
      ? TRAVEL_HUB_PRIORITY[station.id] : (station.p || 0) * 100;
    return { station, name, match, priority };
  }).filter(item => item.match > 0)
    .sort((a, b) => b.match - a.match || b.priority - a.priority
      || a.name.localeCompare(b.name, 'it') || a.station.id.localeCompare(b.station.id))
    .map(item => item.station);
}
