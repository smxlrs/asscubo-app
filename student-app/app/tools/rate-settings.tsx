import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { appAlert as Alert } from '../../lib/appAlert';
import {
  CONTINENTS,
  CURRENCY_OPTIONS,
  DEFAULT_DISPLAYED_CURRENCY_CODES,
  DISPLAYED_CURRENCIES_STORAGE_KEY,
  HOME_RATE_VISIBLE_STORAGE_KEY,
} from '../../lib/currencies';

const COPY = {
  zh: {
    title: '显示货币', search: '搜索国家/地区、货币或代码', selected: '已显示 {count} 种货币', note: '按旅行及日常使用频率排序；未选货币不会出现在换算页面。', atLeastOne: '请至少保留一种货币。', homeRate: '首页滚动显示今日汇率', homeRateDescription: '与“博学 · 连接在意生活”每 5 秒上下切换显示 EUR 兑 CNY 的实时汇率。',
  },
  'zh-Hant': {
    title: '顯示貨幣', search: '搜尋國家/地區、貨幣或代碼', selected: '已顯示 {count} 種貨幣', note: '按旅行及日常使用頻率排序；未選貨幣不會出現在換算頁面。', atLeastOne: '請至少保留一種貨幣。', homeRate: '首頁輪播顯示今日匯率', homeRateDescription: '每 5 秒與「博學 · 連接在意生活」上下切換顯示 EUR 兌 CNY 的即時匯率。',
  },
  en: {
    title: 'Display currencies', search: 'Search country/region, currency, or code', selected: '{count} currencies shown', note: 'Ordered by travel and everyday-use frequency. Hidden currencies stay out of the converter.', atLeastOne: 'Keep at least one currency selected.', homeRate: 'Rotate today’s rate on Home', homeRateDescription: 'Alternate the live EUR-to-CNY rate with the Home subtitle every 5 seconds.',
  },
  it: {
    title: 'Valute visualizzate', search: 'Cerca paese/regione, valuta o codice', selected: '{count} valute visualizzate', note: 'Ordinate per frequenza di viaggio e uso quotidiano. Le valute non selezionate non appaiono nel convertitore.', atLeastOne: 'Mantieni selezionata almeno una valuta.', homeRate: 'Alterna il cambio nella Home', homeRateDescription: 'Alterna il tasso EUR/CNY con il sottotitolo della Home ogni 5 secondi.',
  },
};

export default function RateSettingsScreen() {
  const { colors, language } = useTheme();
  const copy = COPY[language as keyof typeof COPY] || COPY.zh;
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [collapsedContinents, setCollapsedContinents] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(DEFAULT_DISPLAYED_CURRENCY_CODES);
  const [showHomeRate, setShowHomeRate] = useState(true);
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISPLAYED_CURRENCIES_STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;
        const valid = CURRENCY_OPTIONS.filter((currency) => parsed.includes(currency.code)).map((currency) => currency.code);
        if (valid.length > 0) setSelected(valid);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(HOME_RATE_VISIBLE_STORAGE_KEY)
      .then((stored) => setShowHomeRate(stored !== 'false'))
      .catch(() => undefined);
  }, []);

  const toggleHomeRate = async (enabled: boolean) => {
    setShowHomeRate(enabled);
    await AsyncStorage.setItem(HOME_RATE_VISIBLE_STORAGE_KEY, String(enabled));
  };

  const closeSearch = useCallback(() => {
    setIsSearching(false);
    setQuery('');
  }, []);

  const handleBack = useCallback(() => {
    if (isSearching) {
      closeSearch();
      return;
    }
    router.back();
  }, [closeSearch, isSearching]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isSearching) return false;
      closeSearch();
      return true;
    });
    return () => subscription.remove();
  }, [closeSearch, isSearching]));

  useEffect(() => {
    if (!isSearching) return;
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => clearTimeout(timeout);
  }, [isSearching]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return CURRENCY_OPTIONS;
    return CURRENCY_OPTIONS.filter((currency) =>
      `${currency.code} ${currency.countryName} ${currency.currencyName} ${currency.searchTerms}`.toLowerCase().includes(term)
    );
  }, [query]);

  const toggleCurrency = async (code: string) => {
    const isSelected = selected.includes(code);
    if (isSelected && selected.length === 1) {
      Alert.alert(copy.title, copy.atLeastOne);
      return;
    }

    const next = isSelected
      ? selected.filter((item) => item !== code)
      : CURRENCY_OPTIONS.filter((currency) => [...selected, code].includes(currency.code)).map((currency) => currency.code);
    setSelected(next);
    await AsyncStorage.setItem(DISPLAYED_CURRENCIES_STORAGE_KEY, JSON.stringify(next));
  };

  const toggleContinent = (continent: string) => {
    setCollapsedContinents((current) => current.includes(continent)
      ? current.filter((item) => item !== continent)
      : [...current, continent]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={handleBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        {isSearching ? (
          <View style={[styles.headerSearchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialIcons name="search" size={19} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={copy.search}
              placeholderTextColor={colors.textMuted}
              style={[styles.headerSearchInput, { color: colors.textPrimary }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        ) : (
          <Text style={[styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
        )}
        <Pressable style={styles.searchButton} onPress={() => isSearching ? closeSearch() : setIsSearching(true)} hitSlop={12}>
          <MaterialIcons name={isSearching ? 'close' : 'search'} size={23} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.topArea}>
        <Text style={[styles.summary, { color: colors.primary }]}>{copy.selected.replace('{count}', String(selected.length))}</Text>
        <Text style={[styles.note, { color: colors.textSecondary }]}>{copy.note}</Text>
        <View style={[styles.homeRateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.homeRateTextWrap}>
            <Text style={[styles.homeRateTitle, { color: colors.textPrimary }]}>{copy.homeRate}</Text>
            <Text style={[styles.homeRateDescription, { color: colors.textSecondary }]}>{copy.homeRateDescription}</Text>
          </View>
          <Switch value={showHomeRate} onValueChange={toggleHomeRate} trackColor={{ false: colors.border, true: colors.primary + '88' }} thumbColor={showHomeRate ? colors.primary : colors.textMuted} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {CONTINENTS.map((continent) => {
          const currencies = filtered.filter((currency) => currency.continent === continent);
          if (currencies.length === 0) return null;
          const isCollapsed = !isSearching && collapsedContinents.includes(continent);
          return (
            <View key={continent} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{continent}</Text>
                <Pressable onPress={() => toggleContinent(continent)} hitSlop={10} accessibilityLabel={isCollapsed ? `展开${continent}` : `收起${continent}`}>
                  <MaterialIcons name={isCollapsed ? 'keyboard-arrow-down' : 'keyboard-arrow-up'} size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              {!isCollapsed && <View style={[styles.sectionList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {currencies.map((currency, index) => {
                  const isSelected = selected.includes(currency.code);
                  return (
                    <Pressable
                      key={currency.code}
                      onPress={() => toggleCurrency(currency.code)}
                      style={[
                        styles.currencyRow,
                        index < currencies.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      ]}
                    >
                      <Text style={styles.flag}>{currency.flag}</Text>
                      <View style={styles.currencyInfo}>
                        <Text style={[styles.currencyCode, { color: colors.textPrimary }]}>{currency.code}</Text>
                        <Text style={[styles.currencyLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                          {currency.countryName} · {currency.currencyName}
                        </Text>
                      </View>
                      <MaterialIcons name={isSelected ? 'check-box' : 'check-box-outline-blank'} size={24} color={isSelected ? colors.primary : colors.textMuted} />
                    </Pressable>
                  );
                })}
              </View>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  searchButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  headerSearchBox: { flex: 1, height: 38, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  headerSearchInput: { flex: 1, height: '100%', fontSize: 14, marginLeft: 7, paddingVertical: 0 },
  topArea: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  summary: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  homeRateRow: { marginTop: 16, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  homeRateTextWrap: { flex: 1, paddingRight: 12 },
  homeRateTitle: { fontSize: 14, fontWeight: '700' },
  homeRateDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  listContent: { padding: 16, paddingTop: 8, paddingBottom: 32 },
  section: { marginTop: 16 },
  sectionHeader: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 4, paddingRight: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  sectionList: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  currencyRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  flag: { fontSize: 27, marginRight: 12 },
  currencyInfo: { flex: 1, minWidth: 0, paddingRight: 12 },
  currencyCode: { fontSize: 16, fontWeight: '700' },
  currencyLabel: { fontSize: 12, marginTop: 3 },
});
