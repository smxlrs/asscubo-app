import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MDX } from './mdict/mdictReader';

export type DictionaryInfo = {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  orderIndex: number;
  isSystem: boolean;
  source: string;
};

export const DEFAULT_DICTS: DictionaryInfo[] = [
  { id: 'dict_1', name: '[外研社] 现代意汉词典', description: '意大利语常用语快速意汉查询，释义详尽规范', isEnabled: true, orderIndex: 1, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_2', name: '[外研社] 现代汉意词典', description: '汉语快速意语查询，包含常用短语和变体搭配', isEnabled: true, orderIndex: 2, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_3', name: '意汉词典', description: '中型意汉双语查词字典，快速释义必备', isEnabled: true, orderIndex: 3, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_4', name: '意汉汉意词典', description: '超大词汇量的综合意汉双向查词词典', isEnabled: true, orderIndex: 4, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_5', name: '意大利语动词搭配大全', description: '收录常用动词的句型、前置词搭配及例句搭配', isEnabled: true, orderIndex: 5, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_6', name: '意大利语动词变位词典', description: '全面列出常见动词的各时态人称变位表及变位规则', isEnabled: true, orderIndex: 6, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_7', name: '意大利语动词变位反查词典', description: '输入变位动词（如 mangiavo）一键反查原形（mangiare）', isEnabled: true, orderIndex: 7, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
  { id: 'dict_8', name: '意大利语同义词辨析词典', description: '精细化拆解拼写相近或释义重合的意语同义词辨析', isEnabled: true, orderIndex: 8, isSystem: true, source: '该词典来自互联网，仅供语言学习与学术交流使用。' },
];

const DICTS_CONFIG_KEY = 'user_dictionary_settings';
const DICT_DIR = `${FileSystem.documentDirectory}dicts`;

const DICT_ASSETS: { [key: string]: any } = {
  dict_1: require('../assets/dicts/1.[外研社]现代意汉汉意词典IT.mdx'),
  dict_2: require('../assets/dicts/2.[外研社]现代意汉汉意词典CN.mdx'),
  dict_3: require('../assets/dicts/3.意汉词典[45893].mdx'),
  dict_4: require('../assets/dicts/4.意汉汉意词典[109907].mdx'),
  dict_5: require('../assets/dicts/5.意大利语动词搭配大全.mdx'),
  dict_6: require('../assets/dicts/6.意大利语动词变位词典[8339].mdx'),
  dict_7: require('../assets/dicts/7.意大利语动词变位反查词典.mdx'),
  dict_8: require('../assets/dicts/8.意大利语同义词辨析词典.mdx'),
};

// Global cache for loaded MDX instances
const mdxInstances: { [dictId: string]: MDX } = {};
const mdxLoadingPromises: { [dictId: string]: Promise<MDX | null> } = {};

// Base64 to Uint8Array decoder (high-performance pure JS implementation)
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

function base64ToBytes(b64: string): Uint8Array {
  const len = b64.length;
  let placeHolders = 0;
  if (b64[len - 1] === '=') {
    placeHolders = 1;
    if (b64[len - 2] === '=') {
      placeHolders = 2;
    }
  }
  
  const bytes = new Uint8Array((len * 3 / 4) - placeHolders);
  let g = 0;
  
  for (let i = 0; i < len; i += 4) {
    const chunk = 
      (lookup[b64.charCodeAt(i)] << 18) |
      (lookup[b64.charCodeAt(i + 1)] << 12) |
      (lookup[b64.charCodeAt(i + 2)] << 6) |
      lookup[b64.charCodeAt(i + 3)];
      
    bytes[g++] = (chunk >> 16) & 0xff;
    if (g < bytes.length) bytes[g++] = (chunk >> 8) & 0xff;
    if (g < bytes.length) bytes[g++] = chunk & 0xff;
  }
  
  return bytes;
}

// Accent normalization for search friendliness
export function cleanWord(word: string): string {
  if (!word) return '';
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Copy MDX assets to local directory
export async function initDatabase(): Promise<any> {
  const dirInfo = await FileSystem.getInfoAsync(DICT_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DICT_DIR, { intermediates: true });
  }

  // Retrieve user config to see which dictionaries are enabled
  const config = await loadDictionariesConfig();
  const enabledIds = config.filter(d => d.isEnabled).map(d => d.id);

  for (const dict of DEFAULT_DICTS) {
    // Only copy enabled dictionaries to save local storage space,
    // or copy on-demand when user enables them.
    if (!enabledIds.includes(dict.id)) {
      continue;
    }

    const localPath = `${DICT_DIR}/${dict.id}.mdx`;
    const localInfo = await FileSystem.getInfoAsync(localPath);
    if (!localInfo.exists) {
      console.log(`Copying dictionary ${dict.name} to local storage...`);
      const assetRef = DICT_ASSETS[dict.id];
      if (assetRef) {
        try {
          const asset = Asset.fromModule(assetRef);
          await asset.downloadAsync();
          if (asset.localUri) {
            await FileSystem.copyAsync({
              from: asset.localUri,
              to: localPath
            });
            console.log(`Copied ${dict.name} to local path ${localPath}`);
          }
        } catch (e) {
          console.error(`Failed to copy dict asset ${dict.name}:`, e);
        }
      }
    }
  }
  return null;
}

// Lazy load MDX instance
export async function getOrLoadMDXInstance(dictId: string): Promise<MDX | null> {
  if (mdxInstances[dictId]) {
    return mdxInstances[dictId];
  }

  // Deduplicate loading calls
  if (mdxLoadingPromises[dictId] !== undefined) {
    return mdxLoadingPromises[dictId];
  }

  mdxLoadingPromises[dictId] = (async () => {
    try {
      const localPath = `${DICT_DIR}/${dictId}.mdx`;
      let localInfo = await FileSystem.getInfoAsync(localPath);
      
      // If file not in local storage (e.g. just enabled in settings), copy it first
      if (!localInfo.exists) {
        const assetRef = DICT_ASSETS[dictId];
        if (!assetRef) return null;
        
        const dirInfo = await FileSystem.getInfoAsync(DICT_DIR);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(DICT_DIR, { intermediates: true });
        }
        
        const asset = Asset.fromModule(assetRef);
        await asset.downloadAsync();
        if (asset.localUri) {
          await FileSystem.copyAsync({
            from: asset.localUri,
            to: localPath
          });
        }
      }

      console.log(`Loading MDX file into memory: ${dictId}...`);
      const startLoad = Date.now();
      const base64 = await FileSystem.readAsStringAsync(localPath, { encoding: 'base64' });
      const bytes = base64ToBytes(base64);
      console.log(`Decoded base64 for ${dictId} in ${Date.now() - startLoad}ms. File size: ${bytes.length} bytes.`);
      console.log(`First 20 bytes for ${dictId}:`, Array.from(bytes.subarray(0, 20)));
      console.log(`Last 20 bytes for ${dictId}:`, Array.from(bytes.subarray(bytes.length - 20)));
      
      const startParse = Date.now();
      const mdx = new MDX(bytes, undefined);
      console.log(`Parsed MDX ${dictId} in ${Date.now() - startParse}ms. Keywords count: ${mdx.keywordList.length}`);
      
      mdxInstances[dictId] = mdx;
      return mdx;
    } catch (e) {
      console.error(`Failed to load MDX instance ${dictId}:`, e);
      return null;
    } finally {
      delete mdxLoadingPromises[dictId];
    }
  })();

  return mdxLoadingPromises[dictId];
}

// Load dictionaries configuration from AsyncStorage
export async function loadDictionariesConfig(): Promise<DictionaryInfo[]> {
  try {
    const jsonValue = await AsyncStorage.getItem(DICTS_CONFIG_KEY);
    if (jsonValue !== null) {
      const stored: DictionaryInfo[] = JSON.parse(jsonValue);
      // Merge stored with default to handle cases where new dictionaries are added later
      const merged = [...stored];
      DEFAULT_DICTS.forEach(def => {
        if (!merged.some(item => item.id === def.id)) {
          merged.push(def);
        }
      });
      return merged.sort((a, b) => a.orderIndex - b.orderIndex);
    }
  } catch (e) {
    console.error('Failed to load dictionaries config:', e);
  }
  return [...DEFAULT_DICTS];
}

// Save dictionaries configuration to AsyncStorage
export async function saveDictionariesConfig(config: DictionaryInfo[]): Promise<void> {
  try {
    const jsonValue = JSON.stringify(config);
    await AsyncStorage.setItem(DICTS_CONFIG_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save dictionaries config:', e);
  }
}

// Strip HTML tags and return a clean text snippet
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/\s+/g, ' ')    // collapse whitespaces
    .trim();
}

export type SuggestionItem = {
  word: string;
  definition: string;
};

// High performance prefix search across all enabled MDX files
export async function searchWords(query: string, enabledDictIds: string[]): Promise<SuggestionItem[]> {
  if (!query || enabledDictIds.length === 0) return [];
  const cleanedQuery = cleanWord(query);
  if (!cleanedQuery) return [];

  const allSuggestions: SuggestionItem[] = [];
  const seen = new Set<string>();

  // Fetch prefix matching suggestions from each dictionary
  for (const dictId of enabledDictIds) {
    try {
      const mdx = await getOrLoadMDXInstance(dictId);
      if (!mdx) continue;

      // Query keys starting with prefix from matching key blocks on demand
      const list = mdx.searchPrefix(cleanedQuery);
      
      let count = 0;
      for (const item of list) {
        const keyText = item.keyText;
        if (!seen.has(keyText)) {
          seen.add(keyText);

          // Get a quick preview definition
          let preview = '';
          const definitionRes = mdx.lookup(keyText);
          if (definitionRes && definitionRes.definition) {
            preview = stripHtml(definitionRes.definition);
          }

          allSuggestions.push({
            word: keyText,
            definition: preview
          });
          count++;
          if (count >= 15) break;
        }
      }
    } catch (e) {
      console.error(`Failed to search words in ${dictId}:`, e);
    }
  }

  // Sort suggestions by length and alphabetical order to give the best matches
  return allSuggestions
    .sort((a, b) => {
      const cleanA = cleanWord(a.word);
      const cleanB = cleanWord(b.word);
      // Perfect match first
      if (cleanA === cleanedQuery && cleanB !== cleanedQuery) return -1;
      if (cleanB === cleanedQuery && cleanA !== cleanedQuery) return 1;
      
      // Sort by length first (shorter words are usually more relevant prefix matches)
      if (a.word.length !== b.word.length) {
        return a.word.length - b.word.length;
      }
      return a.word.localeCompare(b.word);
    })
    .slice(0, 20);
}

// Retrieve definitions from all enabled dictionaries, ordered by user preference
export async function getDefinitions(word: string, enabledDictIds: string[]): Promise<{ dict_id: string; definition: string }[]> {
  if (!word || enabledDictIds.length === 0) return [];
  const cleanedTarget = cleanWord(word);

  const lookupPromises = enabledDictIds.map(async (dictId) => {
    try {
      const mdx = await getOrLoadMDXInstance(dictId);
      if (!mdx) return null;

      // Try exact lookup first
      let res = mdx.lookup(word);
      if (res && res.definition) {
        return {
          dict_id: dictId,
          definition: res.definition
        };
      } else {
        // Fallback: Try accent-insensitive / case-insensitive search in matching block
        const keyBlockInfoId = mdx.lookupKeyInfoByWord(word);
        if (keyBlockInfoId >= 0) {
          const partialList = mdx.lookupPartialKeyBlockListByKeyInfoId(keyBlockInfoId);
          const matchedItem = partialList.find((item: any) => {
            if (!item.cleanKey) {
              item.cleanKey = cleanWord(item.keyText);
            }
            return item.cleanKey === cleanedTarget;
          });

          if (matchedItem) {
            const fetchRes = mdx.fetch(matchedItem);
            if (fetchRes && fetchRes.definition) {
              return {
                dict_id: dictId,
                definition: fetchRes.definition
              };
            }
          }
        }
      }
    } catch (e) {
      console.error(`Failed to get definition from ${dictId}:`, e);
    }
    return null;
  });

  const resolvedResults = await Promise.all(lookupPromises);
  return resolvedResults.filter((r): r is { dict_id: string; definition: string } => r !== null);
}
