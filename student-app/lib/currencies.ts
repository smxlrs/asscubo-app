export type CurrencyOption = {
  code: string;
  flag: string;
  continent: '欧洲' | '亚洲' | '中东' | '美洲' | '非洲' | '大洋洲';
  countryName: string;
  currencyName: string;
  searchTerms: string;
};

export const DISPLAYED_CURRENCIES_STORAGE_KEY = '@ag_displayed_currencies';
export const HOME_RATE_VISIBLE_STORAGE_KEY = '@ag_show_home_rate';
export const DEFAULT_DISPLAYED_CURRENCY_CODES = ['EUR', 'CNY', 'USD', 'GBP'];

// Keep each continent in travel-frequency order rather than alphabetic order.
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'EUR', flag: '🇪🇺', continent: '欧洲', countryName: '欧元区 / Eurozone', currencyName: '欧元 / Euro', searchTerms: 'eur 欧元 euro 意大利 italy 法国 france 德国 germany 西班牙 spain 葡萄牙 portugal 荷兰 netherlands 比利时 belgium 奥地利 austria 希腊 greece' },
  { code: 'GBP', flag: '🇬🇧', continent: '欧洲', countryName: '英国 / United Kingdom', currencyName: '英镑 / Pound Sterling', searchTerms: 'gbp 英国 united kingdom 英格兰 england 英镑 pound sterling' },
  { code: 'CHF', flag: '🇨🇭', continent: '欧洲', countryName: '瑞士 / Switzerland', currencyName: '瑞士法郎 / Swiss Franc', searchTerms: 'chf 瑞士 switzerland 法郎 franc' },
  { code: 'TRY', flag: '🇹🇷', continent: '欧洲', countryName: '土耳其 / Turkey', currencyName: '土耳其里拉 / Turkish Lira', searchTerms: 'try 土耳其 turkey 里拉 lira' },
  { code: 'SEK', flag: '🇸🇪', continent: '欧洲', countryName: '瑞典 / Sweden', currencyName: '瑞典克朗 / Swedish Krona', searchTerms: 'sek 瑞典 sweden 克朗 krona' },
  { code: 'NOK', flag: '🇳🇴', continent: '欧洲', countryName: '挪威 / Norway', currencyName: '挪威克朗 / Norwegian Krone', searchTerms: 'nok 挪威 norway 克朗 krone' },
  { code: 'DKK', flag: '🇩🇰', continent: '欧洲', countryName: '丹麦 / Denmark', currencyName: '丹麦克朗 / Danish Krone', searchTerms: 'dkk 丹麦 denmark 克朗 krone' },
  { code: 'PLN', flag: '🇵🇱', continent: '欧洲', countryName: '波兰 / Poland', currencyName: '波兰兹罗提 / Polish Zloty', searchTerms: 'pln 波兰 poland 兹罗提 zloty' },
  { code: 'CZK', flag: '🇨🇿', continent: '欧洲', countryName: '捷克 / Czechia', currencyName: '捷克克朗 / Czech Koruna', searchTerms: 'czk 捷克 czech czechia 克朗 koruna' },
  { code: 'HUF', flag: '🇭🇺', continent: '欧洲', countryName: '匈牙利 / Hungary', currencyName: '匈牙利福林 / Hungarian Forint', searchTerms: 'huf 匈牙利 hungary 福林 forint' },
  { code: 'RON', flag: '🇷🇴', continent: '欧洲', countryName: '罗马尼亚 / Romania', currencyName: '罗马尼亚列伊 / Romanian Leu', searchTerms: 'ron 罗马尼亚 romania 列伊 leu' },
  { code: 'ISK', flag: '🇮🇸', continent: '欧洲', countryName: '冰岛 / Iceland', currencyName: '冰岛克朗 / Icelandic Krona', searchTerms: 'isk 冰岛 iceland 克朗 krona' },
  { code: 'BGN', flag: '🇧🇬', continent: '欧洲', countryName: '保加利亚 / Bulgaria', currencyName: '保加利亚列弗 / Bulgarian Lev', searchTerms: 'bgn 保加利亚 bulgaria 列弗 lev' },
  { code: 'RSD', flag: '🇷🇸', continent: '欧洲', countryName: '塞尔维亚 / Serbia', currencyName: '塞尔维亚第纳尔 / Serbian Dinar', searchTerms: 'rsd 塞尔维亚 serbia 第纳尔 dinar' },
  { code: 'UAH', flag: '🇺🇦', continent: '欧洲', countryName: '乌克兰 / Ukraine', currencyName: '乌克兰格里夫纳 / Hryvnia', searchTerms: 'uah 乌克兰 ukraine 格里夫纳 hryvnia' },

  { code: 'CNY', flag: '🇨🇳', continent: '亚洲', countryName: '中国 / China', currencyName: '人民币 / Yuan', searchTerms: 'cny 中国 china 人民币 yuan rmb' },
  { code: 'JPY', flag: '🇯🇵', continent: '亚洲', countryName: '日本 / Japan', currencyName: '日元 / Japanese Yen', searchTerms: 'jpy 日本 japan 日元 yen' },
  { code: 'KRW', flag: '🇰🇷', continent: '亚洲', countryName: '韩国 / South Korea', currencyName: '韩元 / Korean Won', searchTerms: 'krw 韩国 south korea 韩元 won' },
  { code: 'HKD', flag: '🇭🇰', continent: '亚洲', countryName: '中国香港 / Hong Kong', currencyName: '港币 / Hong Kong Dollar', searchTerms: 'hkd 香港 hong kong 港币 dollar' },
  { code: 'TWD', flag: '🇹🇼', continent: '亚洲', countryName: '中国台湾 / Taiwan', currencyName: '新台币 / New Taiwan Dollar', searchTerms: 'twd 台湾 taiwan 新台币 dollar' },
  { code: 'SGD', flag: '🇸🇬', continent: '亚洲', countryName: '新加坡 / Singapore', currencyName: '新加坡元 / Singapore Dollar', searchTerms: 'sgd 新加坡 singapore dollar 新元' },
  { code: 'THB', flag: '🇹🇭', continent: '亚洲', countryName: '泰国 / Thailand', currencyName: '泰铢 / Thai Baht', searchTerms: 'thb 泰国 thailand 泰铢 baht' },
  { code: 'MYR', flag: '🇲🇾', continent: '亚洲', countryName: '马来西亚 / Malaysia', currencyName: '马来西亚林吉特 / Ringgit', searchTerms: 'myr 马来西亚 malaysia 林吉特 ringgit' },
  { code: 'IDR', flag: '🇮🇩', continent: '亚洲', countryName: '印度尼西亚 / Indonesia', currencyName: '印尼盾 / Rupiah', searchTerms: 'idr 印尼 indonesia rupiah 盾' },
  { code: 'VND', flag: '🇻🇳', continent: '亚洲', countryName: '越南 / Vietnam', currencyName: '越南盾 / Vietnamese Dong', searchTerms: 'vnd 越南 vietnam 越南盾 dong' },
  { code: 'PHP', flag: '🇵🇭', continent: '亚洲', countryName: '菲律宾 / Philippines', currencyName: '菲律宾比索 / Philippine Peso', searchTerms: 'php 菲律宾 philippines 比索 peso' },
  { code: 'INR', flag: '🇮🇳', continent: '亚洲', countryName: '印度 / India', currencyName: '印度卢比 / Indian Rupee', searchTerms: 'inr 印度 india 卢比 rupee' },
  { code: 'PKR', flag: '🇵🇰', continent: '亚洲', countryName: '巴基斯坦 / Pakistan', currencyName: '巴基斯坦卢比 / Pakistani Rupee', searchTerms: 'pkr 巴基斯坦 pakistan 卢比 rupee' },
  { code: 'BDT', flag: '🇧🇩', continent: '亚洲', countryName: '孟加拉国 / Bangladesh', currencyName: '孟加拉塔卡 / Taka', searchTerms: 'bdt 孟加拉 bangladesh 塔卡 taka' },
  { code: 'LKR', flag: '🇱🇰', continent: '亚洲', countryName: '斯里兰卡 / Sri Lanka', currencyName: '斯里兰卡卢比 / Sri Lankan Rupee', searchTerms: 'lkr 斯里兰卡 sri lanka 卢比 rupee' },

  { code: 'AED', flag: '🇦🇪', continent: '中东', countryName: '阿联酋 / United Arab Emirates', currencyName: '阿联酋迪拉姆 / UAE Dirham', searchTerms: 'aed 阿联酋 uae dubai 迪拜 迪拉姆 dirham' },
  { code: 'SAR', flag: '🇸🇦', continent: '中东', countryName: '沙特阿拉伯 / Saudi Arabia', currencyName: '沙特里亚尔 / Saudi Riyal', searchTerms: 'sar 沙特 saudi arabia 利雅得 riyal 里亚尔' },
  { code: 'QAR', flag: '🇶🇦', continent: '中东', countryName: '卡塔尔 / Qatar', currencyName: '卡塔尔里亚尔 / Qatari Riyal', searchTerms: 'qar 卡塔尔 qatar 里亚尔 riyal' },
  { code: 'ILS', flag: '🇮🇱', continent: '中东', countryName: '以色列 / Israel', currencyName: '以色列新谢克尔 / Israeli Shekel', searchTerms: 'ils 以色列 israel 谢克尔 shekel' },
  { code: 'KWD', flag: '🇰🇼', continent: '中东', countryName: '科威特 / Kuwait', currencyName: '科威特第纳尔 / Kuwaiti Dinar', searchTerms: 'kwd 科威特 kuwait 第纳尔 dinar' },
  { code: 'OMR', flag: '🇴🇲', continent: '中东', countryName: '阿曼 / Oman', currencyName: '阿曼里亚尔 / Omani Rial', searchTerms: 'omr 阿曼 oman 里亚尔 rial' },
  { code: 'BHD', flag: '🇧🇭', continent: '中东', countryName: '巴林 / Bahrain', currencyName: '巴林第纳尔 / Bahraini Dinar', searchTerms: 'bhd 巴林 bahrain 第纳尔 dinar' },
  { code: 'JOD', flag: '🇯🇴', continent: '中东', countryName: '约旦 / Jordan', currencyName: '约旦第纳尔 / Jordanian Dinar', searchTerms: 'jod 约旦 jordan 第纳尔 dinar' },

  { code: 'USD', flag: '🇺🇸', continent: '美洲', countryName: '美国 / United States', currencyName: '美元 / US Dollar', searchTerms: 'usd 美国 united states 美元 dollar' },
  { code: 'CAD', flag: '🇨🇦', continent: '美洲', countryName: '加拿大 / Canada', currencyName: '加拿大元 / Canadian Dollar', searchTerms: 'cad 加拿大 canada dollar 加元' },
  { code: 'MXN', flag: '🇲🇽', continent: '美洲', countryName: '墨西哥 / Mexico', currencyName: '墨西哥比索 / Mexican Peso', searchTerms: 'mxn 墨西哥 mexico 比索 peso' },
  { code: 'BRL', flag: '🇧🇷', continent: '美洲', countryName: '巴西 / Brazil', currencyName: '巴西雷亚尔 / Brazilian Real', searchTerms: 'brl 巴西 brazil 雷亚尔 real' },
  { code: 'ARS', flag: '🇦🇷', continent: '美洲', countryName: '阿根廷 / Argentina', currencyName: '阿根廷比索 / Argentine Peso', searchTerms: 'ars 阿根廷 argentina 比索 peso' },
  { code: 'CLP', flag: '🇨🇱', continent: '美洲', countryName: '智利 / Chile', currencyName: '智利比索 / Chilean Peso', searchTerms: 'clp 智利 chile 比索 peso' },
  { code: 'COP', flag: '🇨🇴', continent: '美洲', countryName: '哥伦比亚 / Colombia', currencyName: '哥伦比亚比索 / Colombian Peso', searchTerms: 'cop 哥伦比亚 colombia 比索 peso' },
  { code: 'PEN', flag: '🇵🇪', continent: '美洲', countryName: '秘鲁 / Peru', currencyName: '秘鲁索尔 / Peruvian Sol', searchTerms: 'pen 秘鲁 peru 索尔 sol' },

  { code: 'ZAR', flag: '🇿🇦', continent: '非洲', countryName: '南非 / South Africa', currencyName: '南非兰特 / Rand', searchTerms: 'zar 南非 south africa 兰特 rand' },
  { code: 'EGP', flag: '🇪🇬', continent: '非洲', countryName: '埃及 / Egypt', currencyName: '埃及镑 / Egyptian Pound', searchTerms: 'egp 埃及 egypt 埃及镑 pound' },
  { code: 'MAD', flag: '🇲🇦', continent: '非洲', countryName: '摩洛哥 / Morocco', currencyName: '摩洛哥迪拉姆 / Moroccan Dirham', searchTerms: 'mad 摩洛哥 morocco 迪拉姆 dirham' },
  { code: 'NGN', flag: '🇳🇬', continent: '非洲', countryName: '尼日利亚 / Nigeria', currencyName: '尼日利亚奈拉 / Naira', searchTerms: 'ngn 尼日利亚 nigeria 奈拉 naira' },
  { code: 'KES', flag: '🇰🇪', continent: '非洲', countryName: '肯尼亚 / Kenya', currencyName: '肯尼亚先令 / Kenyan Shilling', searchTerms: 'kes 肯尼亚 kenya 先令 shilling' },
  { code: 'TZS', flag: '🇹🇿', continent: '非洲', countryName: '坦桑尼亚 / Tanzania', currencyName: '坦桑尼亚先令 / Tanzanian Shilling', searchTerms: 'tzs 坦桑尼亚 tanzania 先令 shilling' },

  { code: 'AUD', flag: '🇦🇺', continent: '大洋洲', countryName: '澳大利亚 / Australia', currencyName: '澳元 / Australian Dollar', searchTerms: 'aud 澳大利亚 australia 澳元 dollar' },
  { code: 'NZD', flag: '🇳🇿', continent: '大洋洲', countryName: '新西兰 / New Zealand', currencyName: '新西兰元 / New Zealand Dollar', searchTerms: 'nzd 新西兰 new zealand dollar 新西兰元' },
];

export const CONTINENTS = ['欧洲', '亚洲', '中东', '美洲', '非洲', '大洋洲'] as const;

export function getCurrencyOption(code: string) {
  return CURRENCY_OPTIONS.find((currency) => currency.code === code);
}
