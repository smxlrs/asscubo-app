import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, Language } from '../../../context/ThemeContext';
import { getTransportStrikes, VtTransportStrike } from '../../../lib/viaggiaTrenoService';

type RegionFilter = 'all' | 'national' | string;
type SelectorKey = 'region' | 'city' | 'mode';

const ZH_OFFICIAL_LABELS: Record<string, string> = {
  Italia: '意大利全国', Tutte: '全境',
  Abruzzo: '阿布鲁佐', Basilicata: '巴西利卡塔', Calabria: '卡拉布里亚', Campania: '坎帕尼亚',
  'Emilia-Romagna': '艾米利亚-罗马涅', 'Friuli Venezia Giulia': '弗留利-威尼斯朱利亚', Lazio: '拉齐奥',
  Liguria: '利古里亚', Lombardia: '伦巴第', Marche: '马尔凯', Molise: '莫利塞', Piemonte: '皮埃蒙特',
  Puglia: '普利亚', Sardegna: '撒丁岛', Sicilia: '西西里', Toscana: '托斯卡纳',
  'Trentino-Alto Adige': '特伦蒂诺-上阿迪杰', Umbria: '翁布里亚', 'Valle d\'Aosta': '奥斯塔山谷', Veneto: '威尼托',
  Generale: '综合行业', Plurisettoriale: '多行业', Aereo: '航空', Ferroviario: '铁路',
  'Appalti ferroviari': '铁路外包', 'Trasporto pubblico locale': '地方公共交通', Marittimo: '海运',
  'Trasporto merci': '货运', Elicotteri: '直升机', Taxi: '出租车', Ncc: '网约车',
  'Circolazione e sicurezza stradale': '道路交通',
  Nazionale: '全国性', Interregionale: '跨区域', Regionale: '大区级', Territoriale: '地区性',
  Provinciale: '省级', Locale: '本地', Aziendale: '企业内部', 'Da definire': '待定',
  Agrigento: '阿格里真托', Alessandria: '亚历山德里亚', Ancona: '安科纳', Arezzo: '阿雷佐',
  Bari: '巴里', Bergamo: '贝加莫', Bologna: '博洛尼亚', Brescia: '布雷西亚', Cagliari: '卡利亚里',
  Catania: '卡塔尼亚', Como: '科莫', Cosenza: '科森扎', Firenze: '佛罗伦萨', Foggia: '福贾',
  Genova: '热那亚', 'La Spezia': '拉斯佩齐亚', Latina: '拉蒂纳', Lecce: '莱切', Livorno: '里窝那',
  Messina: '墨西拿', Milano: '米兰', Modena: '摩德纳', Napoli: '那不勒斯', Novara: '诺瓦拉',
  Oristano: '奥里斯塔诺', Padova: '帕多瓦', Palermo: '巴勒莫', Parma: '帕尔马', Perugia: '佩鲁贾',
  Pisa: '比萨', Prato: '普拉托', Ravenna: '拉文纳', 'Reggio Calabria': '雷焦卡拉布里亚',
  Rimini: '里米尼', Roma: '罗马', Salerno: '萨莱诺', Sassari: '萨萨里', Savona: '萨沃纳',
  Siena: '锡耶纳', Torino: '都灵', Trento: '特伦托', Treviso: '特雷维索', Trieste: '的里雅斯特',
  Venezia: '威尼斯', Verona: '维罗纳', Vicenza: '维琴察', Viterbo: '维泰博',
};

const LOCALIZED: Record<Language, Record<string, string>> = {
  zh: {
    title: '近期交通罢工', subtitle: '意大利全国及地区交通罢工',
    loading: '正在获取官方罢工信息...', unavailable: '暂时无法获取官方罢工信息，请稍后刷新。',
    empty: '近期没有符合条件的交通罢工信息', source: '信息来源：意大利基础设施与交通部',
    disclaimer: '信息由官方定期更新，仅供出行参考。实际服务以运营商和现场公告为准。',
    strikeDate: '罢工日期', sector: '交通方式', scope: '影响范围', location: '地区', duration: '时段', affected: '涉及人员/单位', unions: '工会', announced: '公布日期',
    filterRegion: '地区', filterCity: '城市/省份', filterMode: '交通方式', allRegions: '全部地区', nationalOnly: '仅全国性', allCities: '全部城市/省份', allModes: '全部方式', notApplicable: '不适用', select: '选择',
  },
  'zh-Hant': {
    title: '近期交通罷工', subtitle: '義大利全國及地區交通罷工',
    loading: '正在取得官方罷工資訊...', unavailable: '暫時無法取得官方罷工資訊，請稍後重新整理。',
    empty: '近期沒有符合條件的交通罷工資訊', source: '資訊來源：義大利基礎設施與交通部',
    disclaimer: '資訊由官方定期更新，僅供出行參考。實際服務以營運商和現場公告為準。',
    strikeDate: '罷工日期', sector: '交通方式', scope: '影響範圍', location: '地區', duration: '時段', affected: '涉及人員/單位', unions: '工會', announced: '公布日期',
    filterRegion: '地區', filterCity: '城市/省份', filterMode: '交通方式', allRegions: '全部地區', nationalOnly: '僅全國性', allCities: '全部城市/省份', allModes: '全部方式', notApplicable: '不適用', select: '選擇',
  },
  en: {
    title: 'Upcoming Transport Strikes', subtitle: 'National and local transport strikes in Italy',
    loading: 'Loading official strike information...', unavailable: 'Official strike information is temporarily unavailable. Please refresh later.',
    empty: 'No upcoming strikes match this filter.', source: 'Source: Italian Ministry of Infrastructure and Transport',
    disclaimer: 'The official feed is updated periodically and is for travel reference only. Follow operators and local notices for actual service.',
    strikeDate: 'Strike date', sector: 'Transport mode', scope: 'Scope', location: 'Location', duration: 'Duration', affected: 'Affected staff/operator', unions: 'Union', announced: 'Announced',
    filterRegion: 'Region', filterCity: 'City / province', filterMode: 'Transport', allRegions: 'All regions', nationalOnly: 'National only', allCities: 'All cities / provinces', allModes: 'All modes', notApplicable: 'Not applicable', select: 'Select',
  },
  it: {
    title: 'Scioperi dei trasporti', subtitle: 'Scioperi nazionali e locali in Italia',
    loading: 'Caricamento delle informazioni ufficiali...', unavailable: 'Le informazioni ufficiali sugli scioperi non sono disponibili. Riprova più tardi.',
    empty: 'Nessuno sciopero imminente corrisponde al filtro.', source: 'Fonte: Ministero delle Infrastrutture e dei Trasporti',
    disclaimer: 'Il feed ufficiale è aggiornato periodicamente e ha valore informativo. Per il servizio effettivo seguire gli avvisi degli operatori.',
    strikeDate: 'Data dello sciopero', sector: 'Trasporto', scope: 'Rilevanza', location: 'Luogo', duration: 'Modalità', affected: 'Personale/operatore interessato', unions: 'Sindacati', announced: 'Proclamato il',
    filterRegion: 'Regione', filterCity: 'Città / provincia', filterMode: 'Trasporto', allRegions: 'Tutte le regioni', nationalOnly: 'Solo nazionali', allCities: 'Tutte le città / province', allModes: 'Tutti i trasporti', notApplicable: 'Non applicabile', select: 'Seleziona',
  },
};

export default function TransportStrikesScreen() {
  const { colors, language } = useTheme();
  const [strikes, setStrikes] = useState<VtTransportStrike[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<RegionFilter>('all');
  const [city, setCity] = useState('all');
  const [mode, setMode] = useState('all');
  const [activeSelector, setActiveSelector] = useState<SelectorKey | null>(null);
  const [showRefreshSuccess, setShowRefreshSuccess] = useState(false);
  const [listTop, setListTop] = useState(0);
  const refreshSuccessOpacity = useRef(new Animated.Value(0)).current;
  const refreshSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = (key: string) => LOCALIZED[language]?.[key] || LOCALIZED.en[key] || key;
  const localizeOfficial = (value: string) => language === 'zh' || language === 'zh-Hant' ? ZH_OFFICIAL_LABELS[value] || value : value;

  const loadStrikes = useCallback(async (minimumDuration = 0) => {
    const startedAt = Date.now();
    setLoading(true);
    const result = await getTransportStrikes();
    const remaining = Math.max(0, minimumDuration - (Date.now() - startedAt));
    if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    setStrikes(result.strikes);
    setAvailable(result.available);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStrikes();
  }, [loadStrikes]);

  useEffect(() => () => {
    if (refreshSuccessTimer.current) clearTimeout(refreshSuccessTimer.current);
  }, []);

  const showSuccessFeedback = useCallback(() => {
    if (refreshSuccessTimer.current) clearTimeout(refreshSuccessTimer.current);
    setShowRefreshSuccess(true);
    refreshSuccessOpacity.setValue(0);
    Animated.timing(refreshSuccessOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    refreshSuccessTimer.current = setTimeout(() => {
      Animated.timing(refreshSuccessOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setShowRefreshSuccess(false));
    }, 1000);
  }, [refreshSuccessOpacity]);

  const handleRefresh = useCallback(async () => {
    await loadStrikes(1000);
    showSuccessFeedback();
  }, [loadStrikes, showSuccessFeedback]);

  const regionOptions = useMemo(() => [...new Set(strikes
    .map((strike) => strike.region.trim())
    .filter((value) => value && value !== 'Italia'))].sort(), [strikes]);

  const cityOptions = useMemo(() => {
    if (region === 'national') return [];
    return [...new Set(strikes
      .filter((strike) => region === 'all' || strike.region === region)
      .map((strike) => strike.province.trim())
      .filter((value) => value && value !== 'Tutte'))].sort();
  }, [strikes, region]);

  const modeOptions = useMemo(() => [...new Set(strikes.map((strike) => strike.sector.trim()).filter(Boolean))].sort(), [strikes]);

  const filteredStrikes = useMemo(() => strikes.filter((strike) => {
    const matchesRegion = region === 'all' || (region === 'national' ? strike.relevance === 'Nazionale' : strike.region === region);
    const matchesCity = city === 'all' || strike.province === city;
    const matchesMode = mode === 'all' || strike.sector === mode;
    return matchesRegion && matchesCity && matchesMode;
  }), [strikes, region, city, mode]);

  const selectorOptions = activeSelector === 'region'
    ? [{ value: 'all', label: t('allRegions') }, { value: 'national', label: t('nationalOnly') }, ...regionOptions.map((value) => ({ value, label: localizeOfficial(value) }))]
    : activeSelector === 'city'
      ? [{ value: 'all', label: t('allCities') }, ...cityOptions.map((value) => ({ value, label: localizeOfficial(value) }))]
      : [{ value: 'all', label: t('allModes') }, ...modeOptions.map((value) => ({ value, label: localizeOfficial(value) }))];

  const selectedLabel = (key: SelectorKey) => {
    if (key === 'region') return region === 'all' ? t('allRegions') : region === 'national' ? t('nationalOnly') : localizeOfficial(region);
    if (key === 'city') return region === 'national' ? t('notApplicable') : city === 'all' ? t('allCities') : localizeOfficial(city);
    return mode === 'all' ? t('allModes') : localizeOfficial(mode);
  };

  const selectedOfficialName = (key: SelectorKey) => {
    if (key === 'region' && region !== 'all' && region !== 'national') return region;
    if (key === 'city' && region !== 'national' && city !== 'all') return city;
    return null;
  };

  const selectOption = (value: string) => {
    if (activeSelector === 'region') {
      setRegion(value);
      setCity('all');
    } else if (activeSelector === 'city') {
      setCity(value);
    } else if (activeSelector === 'mode') {
      setMode(value);
    }
    setActiveSelector(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.headerButton} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <View style={styles.headerTitle}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('subtitle')}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh" onPress={handleRefresh} style={styles.headerButton} hitSlop={10}>
          <MaterialIcons name="refresh" size={23} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={[styles.filters, { borderBottomColor: colors.border }]}>
        {(['region', 'city', 'mode'] as SelectorKey[]).map((key) => {
          const disabled = key === 'city' && region === 'national';
          const icon = key === 'region' ? 'map' : key === 'city' ? 'location-city' : 'directions-transit';
          return (
            <Pressable
              key={key}
              disabled={disabled}
              onPress={() => setActiveSelector(key)}
              style={[styles.selector, { borderColor: colors.border, backgroundColor: colors.surface }, disabled && styles.selectorDisabled]}
            >
              <View style={styles.selectorLabelRow}>
                <MaterialIcons name={icon} size={15} color={disabled ? colors.textMuted : colors.primary} />
                <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>{t(`filter${key.charAt(0).toUpperCase()}${key.slice(1)}`)}</Text>
              </View>
              <View style={styles.selectorValueRow}>
                {selectedOfficialName(key) ? (
                  <OfficialName
                    value={selectedOfficialName(key)!}
                    localizeOfficial={localizeOfficial}
                    style={[styles.selectorValue, { color: disabled ? colors.textMuted : colors.textPrimary }]}
                    originalColor={colors.textMuted}
                  />
                ) : <Text numberOfLines={1} style={[styles.selectorValue, { color: disabled ? colors.textMuted : colors.textPrimary }]}>{selectedLabel(key)}</Text>}
                <MaterialIcons name="keyboard-arrow-down" size={18} color={disabled ? colors.textMuted : colors.textSecondary} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        onLayout={(event) => setListTop(event.nativeEvent.layout.y)}
        refreshControl={<RefreshControl refreshing={loading && available !== null} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} progressViewOffset={64} />}
      >
        {loading && available === null ? (
          <View style={styles.statusContainer}><ActivityIndicator color={colors.primary} /><Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('loading')}</Text></View>
        ) : !available ? (
          <View style={styles.statusContainer}><MaterialIcons name="cloud-off" size={42} color={colors.textMuted} /><Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('unavailable')}</Text></View>
        ) : filteredStrikes.length === 0 ? (
          <View style={styles.statusContainer}><MaterialIcons name="event-available" size={42} color={colors.textMuted} /><Text style={[styles.statusText, { color: colors.textSecondary }]}>{t('empty')}</Text></View>
        ) : filteredStrikes.map((strike) => <StrikeCard key={strike.id} strike={strike} t={t} colors={colors} localizeOfficial={localizeOfficial} />)}

        <View style={[styles.sourceBox, { borderTopColor: colors.border }]}>
          <Text style={[styles.sourceText, { color: colors.textSecondary }]}>{t('source')}</Text>
          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>{t('disclaimer')}</Text>
        </View>
      </ScrollView>

      {showRefreshSuccess ? (
        <Animated.View style={[styles.checkmarkBubble, { top: listTop + 264, opacity: refreshSuccessOpacity, backgroundColor: colors.surface }]}>
          <MaterialIcons name="check" size={24} color={colors.primary} />
        </Animated.View>
      ) : null}

      <Modal visible={activeSelector !== null} transparent animationType="fade" onRequestClose={() => setActiveSelector(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveSelector(null)}>
          <Pressable style={[styles.selectorModal, { backgroundColor: colors.surface }]} onPress={() => undefined}>
            <View style={[styles.selectorModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.selectorModalTitle, { color: colors.textPrimary }]}>{activeSelector ? t(`filter${activeSelector.charAt(0).toUpperCase()}${activeSelector.slice(1)}`) : ''}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.selectorOptions}>
              {selectorOptions.map((option) => {
                const selected = (activeSelector === 'region' && region === option.value) || (activeSelector === 'city' && city === option.value) || (activeSelector === 'mode' && mode === option.value);
                const isOfficialPlace = (activeSelector === 'region' || activeSelector === 'city') && option.value !== 'all' && option.value !== 'national';
                return (
                  <Pressable key={option.value} onPress={() => selectOption(option.value)} style={styles.selectorOption}>
                    {isOfficialPlace ? (
                      <OfficialName value={option.value} localizeOfficial={localizeOfficial} style={[styles.selectorOptionText, { color: colors.textPrimary }]} originalColor={colors.textMuted} />
                    ) : <Text style={[styles.selectorOptionText, { color: selected ? colors.primary : colors.textPrimary }]}>{option.label}</Text>}
                    {selected ? <MaterialIcons name="check" size={20} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function OfficialName({ value, localizeOfficial, style, originalColor }: { value: string; localizeOfficial: (value: string) => string; style: any; originalColor: string }) {
  const localized = localizeOfficial(value);
  return (
    <Text numberOfLines={1} style={style}>
      {localized}
      {localized !== value ? <Text style={[styles.officialOriginal, { color: originalColor }]}> / {value}</Text> : null}
    </Text>
  );
}

function StrikeCard({ strike, t, colors, localizeOfficial }: { strike: VtTransportStrike; t: (key: string) => string; colors: any; localizeOfficial: (value: string) => string }) {
  const dateLabel = strike.startDate === strike.endDate ? strike.startDate : `${strike.startDate} - ${strike.endDate}`;
  const location = [localizeOfficial(strike.region), localizeOfficial(strike.province)].filter(Boolean).join(' / ');
  const details = [
    [t('sector'), localizeOfficial(strike.sector)], [t('scope'), localizeOfficial(strike.relevance)], [t('location'), location],
    [t('duration'), strike.modalities], [t('affected'), strike.category], [t('unions'), strike.unions], [t('announced'), strike.declarationDate],
  ].filter(([, value]) => Boolean(value));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.dateBadge, { backgroundColor: colors.primary }]}><MaterialIcons name="event-busy" size={17} color="#FFF" /><Text style={styles.dateText}>{t('strikeDate')}: {dateLabel}</Text></View>
        <Text style={[styles.relevance, { color: colors.primary }]}>{localizeOfficial(strike.relevance)}</Text>
      </View>
      {details.map(([label, value]) => <View key={label} style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.textPrimary }]}>{value}</Text></View>)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { minHeight: 66, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, alignItems: 'center', paddingHorizontal: 4 }, title: { fontSize: 19, fontWeight: '700' }, subtitle: { marginTop: 2, fontSize: 12 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 7, borderBottomWidth: StyleSheet.hairlineWidth }, selector: { flex: 1, minWidth: 0, minHeight: 56, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, justifyContent: 'center' }, selectorDisabled: { opacity: 0.55 },
  selectorLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 }, selectorLabel: { flex: 1, fontSize: 10 }, selectorValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 }, selectorValue: { flex: 1, minWidth: 0, marginTop: 3, fontSize: 12, fontWeight: '600' }, officialOriginal: { fontSize: 10, fontWeight: '400' },
  checkmarkBubble: { position: 'absolute', left: '50%', marginLeft: -20, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 4, zIndex: 30 },
  content: { padding: 16, paddingBottom: 40 }, statusContainer: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }, statusText: { marginTop: 12, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  card: { marginBottom: 12, borderWidth: 1, borderRadius: 12, padding: 14 }, cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 }, dateText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, relevance: { fontSize: 14, fontWeight: '700' }, detailRow: { marginTop: 8 }, detailLabel: { fontSize: 12, marginBottom: 2 }, detailValue: { fontSize: 14, lineHeight: 20 },
  sourceBox: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 }, sourceText: { fontSize: 12, fontWeight: '600' }, disclaimer: { marginTop: 5, fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(0, 0, 0, 0.38)' }, selectorModal: { width: '100%', maxHeight: '68%', borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 10 }, selectorModalHeader: { paddingHorizontal: 20, paddingVertical: 17, borderBottomWidth: StyleSheet.hairlineWidth }, selectorModalTitle: { fontSize: 17, fontWeight: '700' }, selectorOptions: { paddingVertical: 6 }, selectorOption: { minHeight: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, selectorOptionText: { flex: 1, fontSize: 15 },
});
