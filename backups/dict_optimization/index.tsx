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
import {
  initDatabase,
  searchWords,
  getDefinitions,
  loadDictionariesConfig,
  DictionaryInfo,
} from '../../../lib/db';

const { width } = Dimensions.get('window');
const HISTORY_LIMIT = 20;
const HISTORY_KEY = 'user_dictionary_history';

// HTML Tokenizer and Parser for Native Rendering
type ParserState = {
  bold: boolean;
  italic: boolean;
  color: string | null;
  linkTarget: string | null;
};

function parseHtmlToElements(
  html: string,
  onLinkPress: (word: string) => void,
  colors: any
): React.ReactNode[] {
  if (!html) return [];

  // Remove XML declarations or DOCTYPEs if present
  let cleanHtml = html
    .replace(/<\?xml.*?\?>/gi, '')
    .replace(/<!DOCTYPE.*?>/gi, '')
    .trim();

  // Split text by tags: e.g. <font color="red">, </font>, <br>, etc.
  const tokens = cleanHtml.split(/(<\/?[a-zA-Z0-9]+(?:\s+[^>]*?)?>)/g);
  
  const elements: React.ReactNode[] = [];
  const stateStack: ParserState[] = [{ bold: false, italic: false, color: null, linkTarget: null }];
  
  let keyCounter = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.startsWith('<') && token.endsWith('>')) {
      // It is a tag
      const isClosing = token.startsWith('</');
      const tagContent = token.replace(/<\/?|>|/g, '').trim();
      const parts = tagContent.split(/\s+/);
      const tagName = parts[0].toLowerCase();

      const currentState = { ...stateStack[stateStack.length - 1] };

      if (isClosing) {
        if (stateStack.length > 1) {
          stateStack.pop();
        }
      } else {
        // Handle opening tags
        if (tagName === 'b' || tagName === 'strong') {
          currentState.bold = true;
        } else if (tagName === 'i' || tagName === 'em') {
          currentState.italic = true;
        } else if (tagName === 'font') {
          // Parse attributes like color="..." or size="..."
          const colorMatch = token.match(/color=["']?([^"'\s>]+)["']?/i);
          if (colorMatch) {
            const parsedColor = colorMatch[1].toLowerCase();
            if (parsedColor === 'blue') currentState.color = '#3B82F6';
            else if (parsedColor === 'green') currentState.color = '#10B981';
            else if (parsedColor === 'red') currentState.color = '#EF4444';
            else currentState.color = parsedColor;
          }
        } else if (tagName === 'a') {
          const hrefMatch = token.match(/href=["']?entry:\/\/([^"'\s>]+)["']?/i);
          if (hrefMatch) {
            currentState.linkTarget = decodeURIComponent(hrefMatch[1]);
          }
        } else if (tagName === 'br') {
          elements.push(<Text key={`br-${keyCounter++}`}>{'\n'}</Text>);
          continue;
        } else if (tagName === 'hr') {
          elements.push(
            <View 
              key={`hr-${keyCounter++}`} 
              style={[styles.hrLine, { backgroundColor: colors.border }]} 
            />
          );
          continue;
        }
        stateStack.push(currentState);
      }
    } else {
      // It is plain text
      const currentState = stateStack[stateStack.length - 1];
      const textStyle: any = {
        color: currentState.color || colors.textPrimary,
        fontWeight: currentState.bold ? 'bold' : 'normal',
        fontStyle: currentState.italic ? 'italic' : 'normal',
      };

      if (currentState.linkTarget) {
        textStyle.color = '#3B82F6';
        textStyle.textDecorationLine = 'underline';
        const target = currentState.linkTarget;
        elements.push(
          <Text
            key={`link-${keyCounter++}`}
            style={textStyle}
            onPress={() => onLinkPress(target)}
          >
            {token}
          </Text>
        );
      } else {
        elements.push(
          <Text key={`text-${keyCounter++}`} style={textStyle}>
            {token}
          </Text>
        );
      }
    }
  }

  return elements;
}

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
                <ScrollView contentContainerStyle={styles.resultsScroll} showsVerticalScrollIndicator={false}>
                  {/* Word title banner */}
                  <View style={[styles.wordBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.wordTitle, { color: colors.textPrimary }]}>{activeWord}</Text>
                  </View>

                  {definitions.length > 0 ? (
                    definitions.map((defItem) => {
                      const dict = dictionaries.find(d => d.id === defItem.dict_id);
                      if (!dict) return null;
                      return (
                        <View
                          key={defItem.dict_id}
                          style={[styles.dictCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        >
                          {/* Dictionary name header */}
                          <View style={[styles.dictCardHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.dictName, { color: '#A31621' }]}>{dict.name}</Text>
                            <Text style={[styles.dictTag, { color: colors.textMuted }]}>
                              {dict.isSystem ? '内置词库' : '外部导入'}
                            </Text>
                          </View>

                          {/* HTML rendered definition */}
                          <View style={styles.dictCardBody}>
                            <Text selectable={true} style={styles.definitionText}>
                              {parseHtmlToElements(defItem.definition, handleSearch, colors)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.centerContainer}>
                      <Text style={[styles.noResultText, { color: colors.textPrimary }]}>未找到 "{activeWord}" 的释义</Text>
                      <Text style={[styles.hintText, { color: colors.textMuted, marginTop: 8 }]}>
                        请检查拼写，或者在右上角设置中开启更多词典库。
                      </Text>
                    </View>
                  )}
                </ScrollView>
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
    paddingVertical: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
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
    fontSize: 14,
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionDefText: {
    fontSize: 12,
    marginTop: 4,
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
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  wordTitle: {
    fontSize: 24,
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
