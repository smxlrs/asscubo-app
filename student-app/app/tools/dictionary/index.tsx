import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  StatusBar,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import {
  initDatabase,
  searchWords,
  getDefinitions,
  loadDictionariesConfig,
  getOrLoadMDXInstance,
  DictionaryInfo,
} from '../../../lib/db';

const { width } = Dimensions.get('window');
const HISTORY_LIMIT = 20;
const HISTORY_KEY = 'user_dictionary_history';

// Generate a unified HTML page to render definitions in a WebView with collapsible cards
const buildHtmlString = (
  defs: { dict_id: string; definition: string }[],
  dicts: DictionaryInfo[],
  collapsed: { [dictId: string]: boolean },
  themeColors: any,
  dark: boolean
) => {
  const cardsHtml = defs.map((defItem) => {
    const dict = dicts.find(d => d.id === defItem.dict_id);
    if (!dict) return '';
    const isCollapsed = !!collapsed[dict.id];
    const collapseClass = isCollapsed ? 'collapsed' : '';
    
    return `
      <div class="dict-card ${collapseClass}" data-dict-id="${dict.id}">
        <div class="dict-header">
          <div class="dict-header-left">
            <span class="dict-name">${dict.name}</span>
            <span class="dict-tag">${dict.isSystem ? '内置词库' : '外部导入'}</span>
          </div>
          <svg class="dict-toggle-icon" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </div>
        <div class="dict-body">
          <div class="shadow-container"></div>
          <template class="definition-template">${defItem.definition}</template>
        </div>
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      :root {
        --bg-color: ${themeColors.background};
        --card-bg: ${themeColors.surface};
        --border-color: ${themeColors.border};
        --text-primary: ${themeColors.textPrimary};
        --text-secondary: ${themeColors.textSecondary};
        --accent-color: #A31621;
      }
      
      body {
        background-color: var(--bg-color);
        color: var(--text-primary);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        margin: 0;
        padding: 4px 8px 20px 8px;
        -webkit-text-size-adjust: 100%;
      }

      .dict-card {
        background-color: var(--card-bg);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        margin-bottom: 8px;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      }

      .dict-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        background-color: var(--card-bg);
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        user-select: none;
      }

      .dict-header-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .dict-name {
        color: var(--accent-color);
        font-weight: bold;
        font-size: 12.5px;
      }

      .dict-tag {
        font-size: 8.5px;
        color: var(--text-secondary);
        background-color: var(--border-color);
        padding: 1px 4px;
        border-radius: 2px;
      }

      .dict-toggle-icon {
        width: 16px;
        height: 16px;
        transition: transform 0.2s ease;
        fill: var(--text-secondary);
      }

      .dict-body {
        /* Set base background white and text dark so that dark mode invert filters look perfect */
        background-color: #ffffff;
        color: #333333;
        overflow-x: auto;
      }

      .dict-card.collapsed .dict-body {
        display: none;
      }

      .dict-card.collapsed .dict-toggle-icon {
        transform: rotate(-90deg);
      }

      /* Invert HTML bodies for Dark Mode (smart filter) */
      ${dark ? `
        body.dark-mode .dict-body {
          filter: invert(0.9) hue-rotate(180deg);
        }
      ` : ''}
    </style>
    </head>
    <body class="${dark ? 'dark-mode' : ''}">
      ${cardsHtml}
      
      <script>
        // Mount isolated template HTML to Shadow DOM container to prevent outer layout breakage
        document.querySelectorAll('.dict-card').forEach(card => {
          const container = card.querySelector('.shadow-container');
          const template = card.querySelector('.definition-template');
          if (container && template) {
            const shadow = container.attachShadow({ mode: 'open' });
            shadow.appendChild(template.content.cloneNode(true));
            
            // Inject scoped CSS inside shadow root for tables, links and text inheritances
            const style = document.createElement('style');
            style.textContent = \`
              table {
                width: 100% !important;
                border-collapse: collapse;
                margin: 6px 0;
                font-size: 11.5px;
                box-sizing: border-box;
                color: inherit;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 4px 6px;
                text-align: left;
                color: inherit;
              }
              th {
                background-color: #eee;
                font-weight: bold;
              }
              tr:nth-child(even) {
                background-color: rgba(0, 0, 0, 0.02);
              }
              a {
                color: #3B82F6;
                text-decoration: none;
                font-weight: 500;
              }
              a:hover {
                text-decoration: underline;
              }
              /* Text alignments and baseline inheritance */
              span, div, p, td, th {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              }
              /* Dark Mode overrides inside Shadow Root */
              :host-context(.dark-mode) th, :host-context(.dark-mode) td {
                border-color: #444;
              }
              :host-context(.dark-mode) th {
                background-color: #2a2a2a;
              }
              :host-context(.dark-mode) tr:nth-child(even) {
                background-color: rgba(255, 255, 255, 0.03);
              }
            \`;
            shadow.appendChild(style);
          }
        });

        // Collapse toggle handler
        document.querySelectorAll('.dict-header').forEach(header => {
          header.addEventListener('click', () => {
            const card = header.closest('.dict-card');
            card.classList.toggle('collapsed');
            const dictId = card.getAttribute('data-dict-id');
            const isCollapsed = card.classList.contains('collapsed');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'toggleCollapse',
              dictId: dictId,
              isCollapsed: isCollapsed
            }));
          });
        });

        // Intercept entry links compost bubbles (composition path handles shadow DOM targets)
        document.addEventListener('click', e => {
          const path = e.composedPath();
          let link = null;
          for (const node of path) {
            if (node.tagName === 'A') {
              link = node;
              break;
            }
          }
          if (link) {
            const href = link.getAttribute('href');
            if (href && href.startsWith('entry://')) {
              e.preventDefault();
              const word = href.replace('entry://', '');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'link',
                word: decodeURIComponent(word)
              }));
            }
          }
        });
      </script>
    </body>
    </html>
  `;
};

export default function DictionaryScreen() {
  const { colors, isDark } = useTheme();

  // Search & input states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWord, setActiveWord] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<{ dict_id: string; definition: string }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  // Library & UI status states
  const [dictionaries, setDictionaries] = useState<DictionaryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [collapsedDicts, setCollapsedDicts] = useState<{ [dictId: string]: boolean }>({});

  const textInputRef = useRef<TextInput>(null);

  // Load dictionaries and history on focus (in case config changed in settings)
  useFocusEffect(
    React.useCallback(() => {
      async function init() {
        setLoading(true);
        try {
          // Initialize SQLite database
          await initDatabase();
          
          // Load dictionaries configurations
          const dicts = await loadDictionariesConfig();
          setDictionaries(dicts);

          // Load search history
          const storedHistory = await AsyncStorage.getItem(HISTORY_KEY);
          if (storedHistory) {
            setHistory(JSON.parse(storedHistory));
          }

          // Load collapsed state of dictionaries
          const storedCollapsed = await AsyncStorage.getItem('user_dictionary_collapsed');
          if (storedCollapsed) {
            setCollapsedDicts(JSON.parse(storedCollapsed));
          }

          // Pre-load enabled dictionary instances in the background concurrently to eliminate lookup lag
          const enabledIds = dicts.filter(d => d.isEnabled).map(d => d.id);
          Promise.all(enabledIds.map(id => getOrLoadMDXInstance(id))).catch(err => {
            console.error('Failed to preload dictionaries in background:', err);
          });
        } catch (e) {
          console.error('Failed to init dictionary screen:', e);
        } finally {
          setLoading(false);
        }
      }
      init();
    }, [])
  );

  // Filter enabled dictionaries IDs in order
  const enabledDictIds = useMemo(() => {
    return dictionaries
      .filter(d => d.isEnabled)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(d => d.id);
  }, [dictionaries]);

  // Handle prefix input to fetch suggestions dynamically
  useEffect(() => {
    if (!searchQuery.trim() || enabledDictIds.length === 0) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);

    const delayDebounce = setTimeout(async () => {
      try {
        const list = await searchWords(searchQuery, enabledDictIds);
        setSuggestions(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 120); // 120ms debounce for high performance typing

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, enabledDictIds]);

  // Save word search query to AsyncStorage history list
  const saveToHistory = async (word: string) => {
    const cleanWord = word.trim();
    if (!cleanWord) return;

    let updated = [cleanWord, ...history.filter(w => w.toLowerCase() !== cleanWord.toLowerCase())];
    if (updated.length > HISTORY_LIMIT) {
      updated = updated.slice(0, HISTORY_LIMIT);
    }
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  // Clear search history
  const handleClearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  // Perform word lookup definitions
  const handleSearch = async (word: string) => {
    if (!word.trim()) return;
    Keyboard.dismiss();
    setIsFocused(false);
    setSearchQuery(word);
    setActiveWord(word);
    setSearching(true);

    try {
      const defs = await getDefinitions(word, enabledDictIds);
      setDefinitions(defs);
      await saveToHistory(word);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setDefinitions([]);
    setActiveWord('');
    setIsFocused(true);
    textInputRef.current?.focus();
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'toggleCollapse') {
        const { dictId, isCollapsed } = data;
        setCollapsedDicts(prev => {
          const updated = { ...prev, [dictId]: isCollapsed };
          AsyncStorage.setItem('user_dictionary_collapsed', JSON.stringify(updated));
          return updated;
        });
      } else if (data.type === 'link') {
        handleSearch(data.word);
      }
    } catch (e) {
      console.error('Failed to parse WebView message:', e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header bar */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>意语词典</Text>
        <Pressable 
          style={styles.settingsButton} 
          onPress={() => router.push('/tools/dictionary/settings')}
        >
          <MaterialIcons name="settings" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="search" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            ref={textInputRef}
            style={[styles.input, { color: colors.textPrimary }]}
            placeholder={inputFocused ? "" : "请输入中文或意大利文"}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              setIsFocused(true);
              setInputFocused(true);
            }}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={() => handleSearch(searchQuery)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable style={styles.clearButton} onPress={handleClearSearch}>
              <MaterialIcons name="cancel" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#A31621" />
          <Text style={[styles.hintText, { color: colors.textSecondary, marginTop: 12 }]}>正在调装本地词库中...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* 1. Autocomplete Suggestions overlay when focused */}
          {isFocused && searchQuery.trim().length > 0 ? (
            <FlatList
              data={suggestions}
              keyExtractor={(item, idx) => `${item.word}-${idx}`}
              keyboardShouldPersistTaps="handled"
              style={[styles.suggestionsList, { backgroundColor: colors.background }]}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }
                  ]}
                  onPress={() => handleSearch(item.word)}
                >
                  <MaterialIcons name="description" size={20} color={colors.textMuted} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.suggestionText, { color: colors.textPrimary, fontWeight: 'bold' }]}>{item.word}</Text>
                    {item.definition ? (
                      <Text style={[styles.suggestionDefText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.definition}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={
                loadingSuggestions ? null : (
                  <View style={styles.paddingContainer}>
                    <Text style={[styles.hintText, { color: colors.textMuted }]}>未找到以 "{searchQuery}" 开头的词汇</Text>
                  </View>
                )
              }
            />
          ) : isFocused && searchQuery.trim().length === 0 ? (
            // 2. Search history & recent words when input is empty & focused
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.historyContainer}>
              <View style={styles.historyHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>最近查询记录</Text>
                {history.length > 0 && (
                  <Pressable onPress={handleClearHistory} style={styles.clearHistoryBtn}>
                    <Text style={{ color: '#A31621', fontSize: 12, fontWeight: 'bold' }}>清除全部</Text>
                  </Pressable>
                )}
              </View>
              {history.length > 0 ? (
                <View style={styles.historyChips}>
                  {history.map((word, idx) => (
                    <Pressable
                      key={`${word}-${idx}`}
                      style={({ pressed }) => [
                        styles.historyChip,
                        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }
                      ]}
                      onPress={() => handleSearch(word)}
                    >
                      <Text style={[styles.historyChipText, { color: colors.textPrimary }]}>{word}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.paddingContainer}>
                  <Text style={[styles.hintText, { color: colors.textMuted }]}>无历史查询，输入以开始查词。</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            // 3. Definition Results view
            <View style={{ flex: 1 }}>
              {searching ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color="#A31621" />
                </View>
              ) : activeWord ? (
                <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 6 }}>
                  {/* Word title banner */}
                  <View style={[styles.wordBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.wordTitle, { color: colors.textPrimary }]}>{activeWord}</Text>
                  </View>

                  {definitions.length > 0 ? (
                    <WebView
                      style={{ flex: 1, backgroundColor: 'transparent' }}
                      source={{
                        html: buildHtmlString(
                          definitions,
                          dictionaries,
                          collapsedDicts,
                          colors,
                          isDark
                        )
                      }}
                      onMessage={handleWebViewMessage}
                      originWhitelist={['*']}
                      showsVerticalScrollIndicator={false}
                    />
                  ) : (
                    <View style={styles.centerContainer}>
                      <Text style={[styles.noResultText, { color: colors.textPrimary }]}>未找到 "{activeWord}" 的释义</Text>
                      <Text style={[styles.hintText, { color: colors.textMuted, marginTop: 8 }]}>
                        请检查拼写，或者在右上角设置中开启更多词典库。
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                // Home page welcome when not searching
                <View style={styles.welcomeContainer}>
                  <Text style={styles.welcomeIcon}>🇮🇹</Text>
                  <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>意语智能词典</Text>
                  <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                    输入单词、变位反查或中文释义，快速调阅 8 套精编词库。
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 10,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  clearButton: {
    padding: 6,
  },
  clearIcon: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  paddingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
  },
  suggestionsList: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  suggestionDefText: {
    fontSize: 11,
    marginTop: 2,
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  clearHistoryBtn: {
    padding: 4,
  },
  historyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  historyChipText: {
    fontSize: 13,
  },
  resultsScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  wordBanner: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  wordTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  dictCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  dictCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dictName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dictTag: {
    fontSize: 11,
  },
  dictCardBody: {
    padding: 16,
  },
  definitionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  hrLine: {
    height: 1,
    width: '100%',
    marginVertical: 12,
  },
  dictCardFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  disclaimerText: {
    fontSize: 10.5,
    fontStyle: 'italic',
  },
  noResultText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  welcomeContainer: {
    flex: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  welcomeIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
