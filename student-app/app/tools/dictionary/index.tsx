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
import { router, useFocusEffect, useNavigation } from 'expo-router';
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
  isMDXInstanceLoaded,
  getSingleDefinition,
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
  dark: boolean,
  enabledDictIds: string[]
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
          <div class="fallback-container"></div>
        </div>
      </div>
    `;
  }).join('');

  const escapedDefsJson = JSON.stringify(defs.map(d => ({
    dict_id: d.dict_id,
    definition: d.definition
  }))).replace(/</g, '\\u003c');

  const dictsConfigJson = JSON.stringify(dicts.map(d => ({
    id: d.id,
    name: d.name,
    isSystem: d.isSystem
  }))).replace(/</g, '\\u003c');

  const enabledDictIdsJson = JSON.stringify(enabledDictIds).replace(/</g, '\\u003c');

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
        background-color: ${dark ? '#1e1e1e' : '#ffffff'};
        color: ${dark ? '#e0e0e0' : '#333333'};
        overflow-x: auto;
      }

      .dict-card.collapsed .dict-body {
        display: none;
      }

      .dict-card.collapsed .dict-toggle-icon {
        transform: rotate(-90deg);
      }

      /* Fallback styles in case Shadow DOM is not supported */
      .dict-content {
        padding: 10px 14px;
      }

      .dict-content table {
        width: 100% !important;
        border-collapse: collapse;
        margin: 6px 0;
        font-size: 11.5px;
        box-sizing: border-box;
        color: inherit;
      }

      .dict-content th, .dict-content td {
        border: 1px solid ${dark ? '#444' : '#ddd'};
        padding: 4px 6px;
        text-align: left;
        color: inherit;
      }

      .dict-content th {
        background-color: ${dark ? '#2d2d2d' : '#eee'};
        font-weight: bold;
      }

      .dict-content tr:nth-child(even) {
        background-color: ${dark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'};
      }

      .dict-content a {
        color: #3B82F6;
        text-decoration: none;
        font-weight: 500;
      }

      .dict-content a:hover {
        text-decoration: underline;
      }

      /* Native contrast overrides for hardcoded black text and white backgrounds in dark mode */
      ${dark ? `
        .dict-content * {
          text-shadow: none !important;
        }
        .dict-content [style*="color: black"], 
        .dict-content [style*="color:#000000"], 
        .dict-content [style*="color:#000"],
        .dict-content [color="black"],
        .dict-content [color="#000000"],
        .dict-content [color="#000"] {
          color: #e0e0e0 !important;
        }
        .dict-content [style*="background-color: white"],
        .dict-content [style*="background-color:#ffffff"],
        .dict-content [style*="background-color:#fff"],
        .dict-content [bgcolor="white"],
        .dict-content [bgcolor="#ffffff"],
        .dict-content [bgcolor="#fff"] {
          background-color: transparent !important;
        }
      ` : ''}
    </style>
    </head>
    <body class="${dark ? 'dark-mode' : ''}">
      <div id="cards-container">${cardsHtml}</div>
      
      <script>
        // Forward JavaScript runtime errors inside WebView to React Native for easy debugging
        window.onerror = function(message, source, lineno, colno, error) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: message,
              line: lineno,
              col: colno
            }));
          }
          return true;
        };

        window.DEFINITIONS_DATA = ${escapedDefsJson};
        window.DICTIONARIES_CONFIG = ${dictsConfigJson};
        window.ENABLED_DICT_IDS = ${enabledDictIdsJson};

        window.isDarkColor = function(colorStr) {
          colorStr = colorStr.trim().toLowerCase();
          if (!colorStr) return false;
          if (colorStr === 'black' || colorStr === 'darkgray' || colorStr === 'dimgray' || colorStr === '#0b0b3b' || colorStr === '#0b173b') return true;
          if (colorStr === 'inherit' || colorStr === 'transparent' || colorStr === 'initial') return false;
          
          if (colorStr.indexOf('#') === 0) {
            var hex = colorStr.substring(1);
            var r, g, b;
            if (hex.length === 3) {
              r = parseInt(hex[0] + hex[0], 16);
              g = parseInt(hex[1] + hex[1], 16);
              b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
              r = parseInt(hex.substring(0, 2), 16);
              g = parseInt(hex.substring(2, 4), 16);
              b = parseInt(hex.substring(4, 6), 16);
            } else {
              return false;
            }
            var brightness = Math.sqrt(0.299*r*r + 0.587*g*g + 0.114*b*b);
            return brightness < 135;
          }
          
          if (colorStr.indexOf('rgb') === 0) {
            var matches = colorStr.match(/\\d+/g);
            if (matches && matches.length >= 3) {
              var r = parseInt(matches[0]);
              var g = parseInt(matches[1]);
              var b = parseInt(matches[2]);
              var brightness = Math.sqrt(0.299*r*r + 0.587*g*g + 0.114*b*b);
              return brightness < 135;
            }
          }
          return false;
        };

        window.isLightColor = function(colorStr) {
          colorStr = colorStr.trim().toLowerCase();
          if (!colorStr) return false;
          if (colorStr === 'white' || colorStr === 'lightgray' || colorStr === 'whitesmoke') return true;
          
          if (colorStr.indexOf('#') === 0) {
            var hex = colorStr.substring(1);
            var r, g, b;
            if (hex.length === 3) {
              r = parseInt(hex[0] + hex[0], 16);
              g = parseInt(hex[1] + hex[1], 16);
              b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
              r = parseInt(hex.substring(0, 2), 16);
              g = parseInt(hex.substring(2, 4), 16);
              b = parseInt(hex.substring(4, 6), 16);
            } else {
              return false;
            }
            var brightness = Math.sqrt(0.299*r*r + 0.587*g*g + 0.114*b*b);
            return brightness > 200;
          }
          
          if (colorStr.indexOf('rgb') === 0) {
            var matches = colorStr.match(/\\d+/g);
            if (matches && matches.length >= 3) {
              var r = parseInt(matches[0]);
              var g = parseInt(matches[1]);
              var b = parseInt(matches[2]);
              var brightness = Math.sqrt(0.299*r*r + 0.587*g*g + 0.114*b*b);
              return brightness > 200;
            }
          }
          return false;
        };

        window.adjustColors = function(root) {
          var elements = root.querySelectorAll('*');
          for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            
            var colorAttr = el.getAttribute('color');
            if (colorAttr && window.isDarkColor(colorAttr)) {
              el.setAttribute('color', '#e2e8f0');
            }
            
            if (el.style && el.style.color && window.isDarkColor(el.style.color)) {
              el.style.color = '#e2e8f0';
            }
            
            if (el.style && el.style.backgroundColor && window.isLightColor(el.style.backgroundColor)) {
              el.style.backgroundColor = 'transparent';
            }
            
            var bgColorAttr = el.getAttribute('bgcolor');
            if (bgColorAttr && window.isLightColor(bgColorAttr)) {
              el.setAttribute('bgcolor', 'transparent');
            }
          }
        };

        window.mountCardContent = function(card, definitionHtml) {
          var container = card.querySelector('.shadow-container');
          var fallback = card.querySelector('.fallback-container');
          var html = definitionHtml;
          
          if (container) {
            try {
              var shadow = container.attachShadow({ mode: 'open' });
              
              var style = document.createElement('style');
              style.textContent = \`
                :host {
                  display: block;
                  padding: 10px 14px;
                  color: inherit;
                  background-color: inherit;
                }
                table {
                  width: 100% !important;
                  border-collapse: collapse;
                  margin: 6px 0;
                  font-size: 11.5px;
                  box-sizing: border-box;
                  color: inherit;
                }
                th, td {
                  border: 1px solid ${dark ? '#444' : '#ddd'};
                  padding: 4px 6px;
                  text-align: left;
                  color: inherit;
                }
                th {
                  background-color: ${dark ? '#2d2d2d' : '#eee'};
                  font-weight: bold;
                }
                tr:nth-child(even) {
                  background-color: ${dark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'};
                }
                a {
                  color: #3B82F6;
                  text-decoration: none;
                  font-weight: 500;
                }
                a:hover {
                  text-decoration: underline;
                }
                span, div, p, td, th {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                }
                /* Contrast overrides inside Shadow Root */
                \${dark ? \`
                  [style*="color: black"], 
                  [style*="color:#000000"], 
                  [style*="color:#000"],
                  [color="black"],
                  [color="#000000"],
                  [color="#000"] {
                    color: #e0e0e0 !important;
                  }
                  [style*="background-color: white"],
                  [style*="background-color:#ffffff"],
                  [style*="background-color:#fff"],
                  [bgcolor="white"],
                  [bgcolor="#ffffff"],
                  [bgcolor="#fff"] {
                    background-color: transparent !important;
                  }
                \` : ''}
              \`;
              shadow.appendChild(style);

              var contentDiv = document.createElement('div');
              contentDiv.innerHTML = html;
              if (${dark}) {
                window.adjustColors(contentDiv);
              }
              shadow.appendChild(contentDiv);
              if (fallback) {
                fallback.style.display = 'none';
              }
            } catch (err) {
              console.error('Shadow DOM mounting failed, falling back:', err);
              if (fallback) {
                fallback.className = 'dict-content';
                fallback.innerHTML = html;
                if (${dark}) {
                  window.adjustColors(fallback);
                }
              }
              if (container) {
                container.style.display = 'none';
              }
            }
          }
        };

        window.appendDefinition = function(defItem) {
          // Prevent duplicates
          if (document.querySelector('.dict-card[data-dict-id="' + defItem.dict_id + '"]')) return;

          var card = document.createElement('div');
          card.className = 'dict-card';
          card.setAttribute('data-dict-id', defItem.dict_id);
          
          var dict = window.DICTIONARIES_CONFIG.find(function(d) { return d.id === defItem.dict_id; });
          var dictName = dict ? dict.name : defItem.dict_id;
          var dictTag = dict && dict.isSystem ? '内置词库' : '外部导入';
          
          card.innerHTML = \`
            <div class="dict-header">
              <div class="dict-header-left">
                <span class="dict-name">\` + dictName + \`</span>
                <span class="dict-tag">\` + dictTag + \`</span>
              </div>
              <svg class="dict-toggle-icon" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </div>
            <div class="dict-body">
              <div class="shadow-container"></div>
              <div class="fallback-container"></div>
            </div>
          \`;

          var container = document.getElementById('cards-container') || document.body;
          var cards = Array.from(container.querySelectorAll('.dict-card'));
          var inserted = false;
          var targetIdx = window.ENABLED_DICT_IDS.indexOf(defItem.dict_id);
          
          for (var i = 0; i < cards.length; i++) {
            var cId = cards[i].getAttribute('data-dict-id');
            var cIdx = window.ENABLED_DICT_IDS.indexOf(cId);
            if (cIdx > targetIdx) {
              container.insertBefore(card, cards[i]);
              inserted = true;
              break;
            }
          }
          if (!inserted) {
            container.appendChild(card);
          }

          // Add collapse toggle handler
          var header = card.querySelector('.dict-header');
          header.addEventListener('click', function() {
            card.classList.toggle('collapsed');
            var dictId = card.getAttribute('data-dict-id');
            var isCollapsed = card.classList.contains('collapsed');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'toggleCollapse',
                dictId: dictId,
                isCollapsed: isCollapsed
              }));
            }
          });

          // Mount content
          window.mountCardContent(card, defItem.definition);
        };

        // Mount initial definitions
        (function() {
          var defs = window.DEFINITIONS_DATA || [];
          defs.forEach(function(defItem) {
            var card = document.querySelector('.dict-card[data-dict-id="' + defItem.dict_id + '"]');
            if (card) {
              window.mountCardContent(card, defItem.definition);
            }
          });
        })();

        // Add collapse toggle handlers to initial cards
        document.querySelectorAll('.dict-header').forEach(function(header) {
          header.addEventListener('click', function() {
            var card = header.closest('.dict-card');
            card.classList.toggle('collapsed');
            var dictId = card.getAttribute('data-dict-id');
            var isCollapsed = card.classList.contains('collapsed');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'toggleCollapse',
                dictId: dictId,
                isCollapsed: isCollapsed
              }));
            }
          });
        });

        // Intercept entry links
        document.addEventListener('click', function(e) {
          var path = e.composedPath();
          var link = null;
          for (var i = 0; i < path.length; i++) {
            if (path[i].tagName === 'A') {
              link = path[i];
              break;
            }
          }
          if (link) {
            var href = link.getAttribute('href');
            if (href && href.indexOf('entry://') === 0) {
              e.preventDefault();
              var word = href.replace('entry://', '');
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'link',
                  word: word
                }));
              }
            }
          }
        });

        // Process any queued definitions that arrived while loading
        window.addEventListener('load', function() {
          if (window.PENDING_DEFS) {
            window.PENDING_DEFS.forEach(window.appendDefinition);
            window.PENDING_DEFS = [];
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
  const [backgroundSearching, setBackgroundSearching] = useState(false);
  const [backgroundProgress, setBackgroundProgress] = useState({ loaded: 0, total: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [collapsedDicts, setCollapsedDicts] = useState<{ [dictId: string]: boolean }>({});
  const collapsedDictsRef = useRef<{ [dictId: string]: boolean }>({});

  const textInputRef = useRef<TextInput>(null);
  const currentSearchRef = useRef<string>('');
  const webviewRef = useRef<WebView>(null);
  const initialDefinitionsRef = useRef<{ dict_id: string; definition: string }[]>([]);

  // Filter enabled dictionaries IDs in order
  const enabledDictIds = useMemo(() => {
    return dictionaries
      .filter(d => d.isEnabled)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(d => d.id);
  }, [dictionaries]);

  const [webViewHtml, setWebViewHtml] = useState<string>('');
  const definitionsRef = useRef<{ dict_id: string; definition: string }[]>([]);

  // Update definitionsRef whenever definitions state updates
  useEffect(() => {
    definitionsRef.current = definitions;
  }, [definitions]);

  // Regenerate WebView HTML on theme color change or configuration updates (only when word active)
  useEffect(() => {
    if (activeWord) {
      const html = buildHtmlString(
        definitionsRef.current,
        dictionaries,
        collapsedDictsRef.current,
        colors,
        isDark,
        enabledDictIds
      );
      setWebViewHtml(html);
    }
  }, [colors, isDark, dictionaries, enabledDictIds]);

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
            const parsed = JSON.parse(storedCollapsed);
            setCollapsedDicts(parsed);
            collapsedDictsRef.current = parsed;
          }

          // Preload the first few enabled dictionaries silently in the background
          const enabledIds = dicts
            .filter(d => d.isEnabled)
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map(d => d.id);
          
          if (enabledIds.length > 0) {
            setTimeout(async () => {
              try {
                console.log(`[Dictionary] Preloading primary dictionary: ${enabledIds[0]}`);
                await getOrLoadMDXInstance(enabledIds[0]);
                console.log(`[Dictionary] Primary dictionary ${enabledIds[0]} preloaded`);

                if (enabledIds.length > 1) {
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  console.log(`[Dictionary] Preloading secondary dictionary: ${enabledIds[1]}`);
                  await getOrLoadMDXInstance(enabledIds[1]);
                  console.log(`[Dictionary] Secondary dictionary ${enabledIds[1]} preloaded`);
                }
              } catch (err) {
                console.warn('[Dictionary] Background preloading failed:', err);
              }
            }, 300);
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

  // Perform word lookup definitions progressively
  const handleSearch = async (word: string) => {
    if (!word.trim()) return;
    Keyboard.dismiss();
    setIsFocused(false);
    setSearchQuery(word);
    setActiveWord(word);
    
    // Track search sequence to avoid race conditions
    currentSearchRef.current = word;
    
    // Clear old definitions first, and start primary search spinner
    setDefinitions([]);
    initialDefinitionsRef.current = [];
    setWebViewHtml('');
    setSearching(true);
    setBackgroundSearching(false);

    try {
      await saveToHistory(word);

      // Separate enabled dictionaries by their loaded status
      const loadedDictIds = enabledDictIds.filter(id => isMDXInstanceLoaded(id));
      const pendingDictIds = enabledDictIds.filter(id => !isMDXInstanceLoaded(id));

      const initialDefs: { dict_id: string; definition: string }[] = [];

      // 1. First stage: Query already loaded dictionaries instantly
      if (loadedDictIds.length > 0) {
        const lookupPromises = loadedDictIds.map(async (dictId) => {
          try {
            return await getSingleDefinition(word, dictId);
          } catch (e) {
            console.error(`Failed to lookup already loaded dict ${dictId}:`, e);
            return null;
          }
        });
        const results = await Promise.all(lookupPromises);
        results.forEach(res => {
          if (res) initialDefs.push(res);
        });
      }

      // Check if user has navigated away or searched another word before updating state
      if (currentSearchRef.current !== word) return;

      // Render initial results instantly and turn off main spinner
      initialDefinitionsRef.current = initialDefs;
      setDefinitions(initialDefs);
      const html = buildHtmlString(
        initialDefs,
        dictionaries,
        collapsedDictsRef.current,
        colors,
        isDark,
        enabledDictIds
      );
      setWebViewHtml(html);
      setSearching(false);

      // 2. Second stage: progressive background querying for pending dictionaries
      if (pendingDictIds.length > 0) {
        setBackgroundSearching(true);
        setBackgroundProgress({ loaded: 0, total: pendingDictIds.length });

        (async () => {
          let loadedCount = 0;
          const currentWord = word;
          
          for (const dictId of pendingDictIds) {
            // Stop background loading if search target changed
            if (currentSearchRef.current !== currentWord) break;
            
            try {
              // Yield control to let React Native UI thread paint and keep animations fluid, giving GC enough time
              await new Promise(resolve => setTimeout(resolve, 250));
              if (currentSearchRef.current !== currentWord) break;
              
              const def = await getSingleDefinition(currentWord, dictId);
              if (currentSearchRef.current !== currentWord) break;
              
              if (def) {
                setDefinitions(prev => {
                  if (currentSearchRef.current !== currentWord) return prev;
                  const newDefs = [...prev, def];
                  // Maintain user preferred dictionary display order
                  return newDefs.sort((a, b) => {
                    const idxA = enabledDictIds.indexOf(a.dict_id);
                    const idxB = enabledDictIds.indexOf(b.dict_id);
                    return idxA - idxB;
                  });
                });

                // Inject dynamically to WebView without page reload
                const defJson = JSON.stringify(def).replace(/</g, '\\u003c');
                webviewRef.current?.injectJavaScript(`
                  if (window.appendDefinition) {
                    window.appendDefinition(${defJson});
                  } else {
                    window.PENDING_DEFS = window.PENDING_DEFS || [];
                    window.PENDING_DEFS.push(${defJson});
                  }
                `);
              }
            } catch (err) {
              console.error(`Progressive background lookup error for ${dictId}:`, err);
            } finally {
              if (currentSearchRef.current === currentWord) {
                loadedCount++;
                setBackgroundProgress({ loaded: loadedCount, total: pendingDictIds.length });
              }
            }
          }
          
          if (currentSearchRef.current === currentWord) {
            setBackgroundSearching(false);
          }
        })();
      }
    } catch (err) {
      console.error('Error during progressive search:', err);
      if (currentSearchRef.current === word) {
        setSearching(false);
        setBackgroundSearching(false);
      }
    }
  };

  const handleClearSearch = () => {
    currentSearchRef.current = '';
    setSearchQuery('');
    setSuggestions([]);
    setDefinitions([]);
    setActiveWord('');
    setSearching(false);
    setBackgroundSearching(false);
    setWebViewHtml('');
    setIsFocused(true);
    textInputRef.current?.focus();
  };

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If there is an active word showing definitions, intercept the back action,
      // clear the search to go back to the wait-for-input state, and prevent screen exit.
      if (activeWord) {
        e.preventDefault();
        handleClearSearch();
      }
    });

    return unsubscribe;
  }, [navigation, activeWord]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'toggleCollapse') {
        const { dictId, isCollapsed } = data;
        const updated = { ...collapsedDictsRef.current, [dictId]: isCollapsed };
        collapsedDictsRef.current = updated;
        setCollapsedDicts(updated);
        AsyncStorage.setItem('user_dictionary_collapsed', JSON.stringify(updated));
      } else if (data.type === 'link') {
        handleSearch(data.word);
      } else if (data.type === 'error') {
        console.warn(`[WebView JS Error] ${data.message} at line ${data.line}:${data.col}`);
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
      <View style={styles.searchBarRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
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
        <Pressable 
          style={({ pressed }) => [
            styles.queryButton, 
            { backgroundColor: '#A31621', opacity: pressed ? 0.8 : 1 }
          ]} 
          onPress={() => handleSearch(searchQuery)}
        >
          <Text style={styles.queryButtonText}>查询</Text>
        </Pressable>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Text style={[styles.wordTitle, { color: colors.textPrimary }]}>{activeWord}</Text>
                      {backgroundSearching && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <ActivityIndicator size="small" color="#A31621" style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                            正在检索其余 {backgroundProgress.total - backgroundProgress.loaded} 个词库...
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {(definitions.length > 0 || backgroundSearching) ? (
                    <WebView
                      ref={webviewRef}
                      style={{ flex: 1, backgroundColor: 'transparent' }}
                      source={{ html: webViewHtml }}
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
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 10,
  },
  queryButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
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
