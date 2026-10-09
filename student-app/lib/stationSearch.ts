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
