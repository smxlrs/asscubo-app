import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { getTperServiceAlerts, TperServiceAlert, translateItalianNotice } from '../../../lib/tperAlertsService';

const COPY = {
  zh: {
    title: '公交线路变动', subtitle: 'TPER 博洛尼亚官方服务公告', loading: '正在获取官方线路变动信息...', unavailable: '暂时无法获取公告。请稍后刷新。', empty: '近期没有仍在有效期内的线路变动公告。', all: '全部线路', source: '信息来源：TPER 官方公共频道公告', note: '仅供出行参考；实际服务以 TPER、站牌及现场公告为准。', published: '发布于', period: '有效时段', lines: '涉及线路', details: '公告详情', original: '意大利语原文', translated: '中文机器翻译', translate: '翻译', showOriginal: '查看原文', translating: '正在翻译...', translationFailed: '翻译暂时不可用，请查看意大利语原文。', openSource: '打开 TPER 原公告', close: '关闭', updated: '缓存更新', noPeriod: '未在公告中明确写明结束日期', translateSource: '机器翻译由 MyMemory 提供，仅供理解参考。', alert: '注意：该线路有变动信息，点击查看', alerts: '条线路变动',
  },
  'zh-Hant': {
    title: '公車路線變動', subtitle: 'TPER 博洛尼亞官方服務公告', loading: '正在取得官方路線變動資訊...', unavailable: '暫時無法取得公告，請稍後重新整理。', empty: '近期沒有仍在有效期內的路線變動公告。', all: '全部路線', source: '資訊來源：TPER 官方服務公告 RSS', note: '僅供出行參考；實際服務以 TPER、站牌及現場公告為準。', published: '發布於', period: '有效時段', lines: '涉及路線', details: '公告詳情', original: '義大利語原文', translated: '中文機器翻譯', translate: '翻譯', showOriginal: '查看原文', translating: '正在翻譯...', translationFailed: '翻譯暫時不可用，請查看義大利語原文。', openSource: '開啟 TPER 原公告', close: '關閉', updated: '快取更新', noPeriod: '公告未明確寫明結束日期', translateSource: '機器翻譯由 MyMemory 提供，僅供理解參考。', alert: '注意：該路線有變動資訊，點擊查看', alerts: '條路線變動',
  },
  en: {
    title: 'Bus service changes', subtitle: 'Official TPER Bologna notices', loading: 'Loading official service notices...', unavailable: 'Notices are temporarily unavailable. Please refresh later.', empty: 'There are no service-change notices currently within their effective period.', all: 'All lines', source: 'Source: TPER official service-notice RSS', note: 'For travel reference only. Follow TPER, stop signage and on-site notices for actual service.', published: 'Published', period: 'Effective period', lines: 'Affected lines', details: 'Notice details', original: 'Italian original', translated: 'Chinese machine translation', translate: 'Translate', showOriginal: 'Show original', translating: 'Translating...', translationFailed: 'Translation is temporarily unavailable. Please refer to the Italian original.', openSource: 'Open original TPER notice', close: 'Close', updated: 'Cache updated', noPeriod: 'No explicit end date is stated in this notice', translateSource: 'Machine translation by MyMemory; for understanding only.', alert: 'Notice: this line has a service change. Tap to view.', alerts: 'affected lines',
  },
  it: {
    title: 'Modifiche al servizio', subtitle: 'Avvisi ufficiali TPER Bologna', loading: 'Caricamento degli avvisi ufficiali...', unavailable: 'Gli avvisi non sono temporaneamente disponibili. Riprova piu tardi.', empty: 'Non ci sono avvisi di modifica del servizio ancora validi.', all: 'Tutte le linee', source: 'Fonte: RSS degli avvisi di servizio ufficiali TPER', note: 'Solo a scopo informativo. Per il servizio effettivo fare riferimento a TPER, paline e avvisi sul posto.', published: 'Pubblicato', period: 'Periodo di validita', lines: 'Linee interessate', details: 'Dettaglio avviso', original: 'Testo originale in italiano', translated: 'Traduzione automatica cinese', translate: 'Traduci', showOriginal: 'Mostra originale', translating: 'Traduzione in corso...', translationFailed: 'La traduzione non e disponibile. Consulta il testo originale in italiano.', openSource: 'Apri avviso originale TPER', close: 'Chiudi', updated: 'Cache aggiornata', noPeriod: 'L avviso non indica una data di fine esplicita', translateSource: 'Traduzione automatica fornita da MyMemory, solo per comprensione.', alert: 'Attenzione: questa linea ha una modifica. Tocca per vedere.', alerts: 'linee interessate',
  },
} as const;

function normalizeLine(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function dateLabel(value: string | null, language: string) {
  if (!value) return '-';
  const locale = language === 'it' ? 'it-IT' : language === 'en' ? 'en-GB' : 'zh-CN';
  return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BusServiceAlertsScreen() {
  const { colors, language } = useTheme();
  const params = useLocalSearchParams<{ line?: string }>();
  const copy = COPY[language] || COPY.en;
  const [alerts, setAlerts] = useState<TperServiceAlert[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [line, setLine] = useState(params.line ? normalizeLine(params.line) : 'all');
  const [lineSelectorVisible, setLineSelectorVisible] = useState(false);
  const [selected, setSelected] = useState<TperServiceAlert | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getTperServiceAlerts();
    setAlerts(result.alerts);
    setAvailable(result.available);
    setLastSyncedAt(result.lastSyncedAt);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const lines = useMemo(() => [...new Set(alerts.flatMap((alert) => alert.affected_lines.map(normalizeLine)))].sort(compareLines), [alerts]);
  const filteredAlerts = useMemo(() => line === 'all' ? alerts : alerts.filter((alert) => alert.affected_lines.map(normalizeLine).includes(line)), [alerts, line]);

  const openNotice = (alert: TperServiceAlert) => {
    setSelected(alert);
    setTranslated(null);
    setShowTranslation(false);
    setTranslationError(false);
  };

  const toggleTranslation = async () => {
    if (!selected) return;
    if (translated) {
      setShowTranslation((current) => !current);
      return;
    }
    setTranslating(true);
    setTranslationError(false);
    try {
      setTranslated(await translateItalianNotice(selected.description));
      setShowTranslation(true);
    } catch {
      setTranslationError(true);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{copy.subtitle}</Text>
        </View>
        <Pressable onPress={load} style={styles.headerButton} hitSlop={10} accessibilityRole="button" accessibilityLabel="Refresh">
          <MaterialIcons name="refresh" size={23} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => setLineSelectorVisible(true)} style={[styles.lineSelector, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.lineSelectorLabelRow}>
            <MaterialIcons name="directions-bus" size={16} color={colors.primary} />
            <Text style={[styles.lineSelectorLabel, { color: colors.textSecondary }]}>{copy.lines}</Text>
          </View>
          <View style={styles.lineSelectorValueRow}>
            <Text numberOfLines={1} style={[styles.lineSelectorValue, { color: colors.textPrimary }]}>{line === 'all' ? copy.all : line}</Text>
            <MaterialIcons name="keyboard-arrow-down" size={19} color={colors.textSecondary} />
          </View>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading && available !== null} onRefresh={load} tintColor={colors.primary} />}>
        {loading && available === null ? <Status icon="sync" text={copy.loading} colors={colors} busy /> : null}
        {!loading && !available ? <Status icon="cloud-off" text={copy.unavailable} colors={colors} /> : null}
        {!loading && available && filteredAlerts.length === 0 ? <Status icon="event-available" text={copy.empty} colors={colors} /> : null}
        {filteredAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} copy={copy} colors={colors} language={language} onPress={() => openNotice(alert)} />)}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{copy.source}</Text>
          {lastSyncedAt ? <Text style={[styles.footerSubtext, { color: colors.textMuted }]}>{copy.updated}: {dateLabel(lastSyncedAt, language)}</Text> : null}
          <Text style={[styles.footerSubtext, { color: colors.textMuted }]}>{copy.note}</Text>
        </View>
      </ScrollView>

      <Modal visible={selected !== null} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <SafeAreaView edges={['bottom']} style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{copy.details}</Text>
              <Pressable onPress={() => setSelected(null)} style={styles.closeIcon} hitSlop={8} accessibilityRole="button" accessibilityLabel={copy.close}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            {selected ? <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>{selected.title}</Text>
              <AlertMeta alert={selected} copy={copy} colors={colors} language={language} />
              <Text style={[styles.originalLabel, { color: colors.textSecondary }]}>{showTranslation ? copy.translated : copy.original}</Text>
              <Text style={[styles.description, { color: colors.textPrimary }]}>{showTranslation && translated ? translated : selected.description}</Text>
              {translationError ? <Text style={[styles.translationError, { color: colors.error }]}>{copy.translationFailed}</Text> : null}
              {showTranslation ? <Text style={[styles.translateSource, { color: colors.textMuted }]}>{copy.translateSource}</Text> : null}
              <Pressable onPress={toggleTranslation} disabled={translating} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: translating ? 0.65 : 1 }]}>
                {translating ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name={showTranslation ? 'language' : 'translate'} size={18} color="#fff" />}
                <Text style={styles.primaryButtonText}>{translating ? copy.translating : showTranslation ? copy.showOriginal : copy.translate}</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL(selected.source_url)} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                <MaterialIcons name="open-in-new" size={17} color={colors.primary} />
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{copy.openSource}</Text>
              </Pressable>
            </ScrollView> : null}
          </SafeAreaView>
        </View>
      </Modal>

      <Modal visible={lineSelectorVisible} transparent animationType="fade" onRequestClose={() => setLineSelectorVisible(false)}>
        <Pressable style={styles.selectorBackdrop} onPress={() => setLineSelectorVisible(false)}>
          <Pressable style={[styles.selectorModal, { backgroundColor: colors.surface }]} onPress={() => undefined}>
            <View style={[styles.selectorModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.selectorModalTitle, { color: colors.textPrimary }]}>{copy.lines}</Text>
            </View>
            <ScrollView contentContainerStyle={styles.selectorOptions}>
              {[{ value: 'all', label: copy.all }, ...lines.map((value) => ({ value, label: value }))].map((option) => {
                const selectedLine = line === option.value;
                return <Pressable key={option.value} onPress={() => { setLine(option.value); setLineSelectorVisible(false); }} style={[styles.selectorOption, { borderColor: selectedLine ? colors.primary : colors.border, backgroundColor: selectedLine ? colors.primary : colors.background }]}>
                  <Text numberOfLines={1} style={[styles.selectorOptionText, { color: selectedLine ? '#FFFFFF' : colors.textPrimary }]}>{option.label}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function compareLines(a: string, b: string) {
  const aNumber = Number.parseInt(a.match(/\d+/)?.[0] || '999999', 10);
  const bNumber = Number.parseInt(b.match(/\d+/)?.[0] || '999999', 10);
  return aNumber - bNumber || a.localeCompare(b, undefined, { numeric: true });
}

function Status({ icon, text, colors, busy = false }: { icon: any; text: string; colors: any; busy?: boolean }) {
  return <View style={styles.status}>{busy ? <ActivityIndicator color={colors.primary} /> : <MaterialIcons name={icon} size={42} color={colors.textMuted} />}<Text style={[styles.statusText, { color: colors.textSecondary }]}>{text}</Text></View>;
}

function AlertMeta({ alert, copy, colors, language }: { alert: TperServiceAlert; copy: any; colors: any; language: string }) {
  return <View style={styles.meta}>
    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{copy.published}: {dateLabel(alert.published_at, language)}</Text>
    <Text style={[styles.metaText, { color: colors.textSecondary }]}>{copy.period}: {alert.effective_period || copy.noPeriod}</Text>
    {alert.affected_lines.length ? <Text style={[styles.metaText, { color: colors.textSecondary }]}>{copy.lines}: {alert.affected_lines.join(', ')}</Text> : null}
  </View>;
}

function AlertCard({ alert, copy, colors, language, onPress }: { alert: TperServiceAlert; copy: any; colors: any; language: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: '#E5A100' }]}>
    <View style={styles.cardTitleRow}><MaterialIcons name="campaign" size={22} color="#E5A100" /><Text numberOfLines={2} style={[styles.cardTitle, { color: colors.textPrimary }]}>{alert.title}</Text></View>
    <AlertMeta alert={alert} copy={copy} colors={colors} language={language} />
    <Text numberOfLines={3} style={[styles.preview, { color: colors.textSecondary }]}>{alert.description}</Text>
    <View style={styles.cardMore}><Text style={[styles.cardMoreText, { color: colors.primary }]}>{copy.details}</Text><MaterialIcons name="chevron-right" size={19} color={colors.primary} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, header: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, titleBlock: { flex: 1, alignItems: 'center' }, title: { fontSize: 18, fontWeight: '700' }, subtitle: { fontSize: 11, marginTop: 2 }, filterBar: { height: 63, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, justifyContent: 'center' }, lineSelector: { height: 43, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, lineSelectorLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, lineSelectorLabel: { fontSize: 12, fontWeight: '600' }, lineSelectorValueRow: { maxWidth: '58%', flexDirection: 'row', alignItems: 'center', gap: 3 }, lineSelectorValue: { fontSize: 14, fontWeight: '700' }, list: { flex: 1 }, content: { padding: 16, paddingBottom: 32, gap: 12 }, status: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 }, statusText: { fontSize: 14, textAlign: 'center', lineHeight: 21 }, card: { borderWidth: 1, borderLeftWidth: 5, borderRadius: 12, padding: 14 }, cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', lineHeight: 22 }, meta: { gap: 3, marginTop: 11 }, metaText: { fontSize: 12, lineHeight: 17 }, preview: { fontSize: 13, lineHeight: 19, marginTop: 11 }, cardMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }, cardMoreText: { fontSize: 13, fontWeight: '700' }, footer: { marginTop: 10, paddingTop: 14, gap: 5, borderTopWidth: StyleSheet.hairlineWidth }, footerText: { fontSize: 12, fontWeight: '600' }, footerSubtext: { fontSize: 11, lineHeight: 16 }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }, modal: { maxHeight: '88%', borderTopLeftRadius: 18, borderTopRightRadius: 18 }, modalHeader: { height: 58, paddingLeft: 20, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth }, modalTitle: { fontSize: 17, fontWeight: '700' }, closeIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, modalContent: { padding: 20, paddingBottom: 20 }, noticeTitle: { fontSize: 19, fontWeight: '700', lineHeight: 26 }, originalLabel: { fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 7 }, description: { fontSize: 15, lineHeight: 23 }, translationError: { marginTop: 10, fontSize: 13, lineHeight: 19 }, translateSource: { marginTop: 9, fontSize: 11, lineHeight: 16 }, primaryButton: { marginTop: 20, height: 46, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' }, secondaryButton: { marginTop: 10, height: 44, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, secondaryButtonText: { fontSize: 14, fontWeight: '700' }, selectorBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.42)' }, selectorModal: { maxHeight: '70%', borderRadius: 10 }, selectorModalHeader: { height: 54, paddingHorizontal: 18, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth }, selectorModalTitle: { fontSize: 16, fontWeight: '700' }, selectorOptions: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, selectorOption: { width: '22%', height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, selectorOptionText: { fontSize: 13, fontWeight: '700' },
});
