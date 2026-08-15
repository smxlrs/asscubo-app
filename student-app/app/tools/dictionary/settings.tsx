import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Switch,
  StatusBar,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, Language } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList from 'react-native-draggable-flatlist';
import {
  importDictionaryFile,
  loadDictionariesConfig,
  removeImportedDictionary,
  saveDictionariesConfig,
  DictionaryInfo,
} from '../../../lib/db';
import { appAlert as Alert } from '../../../lib/appAlert';

const LOCALIZED_STRINGS: Record<Language, Record<string, string>> = {
  zh: {
    title: '词典库管理',
    loading: '正在载入设置...',
    installedDicts: '已安装的词典库 ({count} 个)',
    listDesc: '点击右侧开关启用/禁用词典，使用上下箭头（▲/▼）调整查词时的渲染顺序。',
    importTitle: '手动导入外部词典',
    importDesc: '支持自定义导入符合 MDict 规范的 .mdx 词库文件。',
    importBtn: '导入本地词典',
    alertTitle: '导入词典库',
    alertMsg: '自定义词典功能即将上线！\n\n未来版本中，您可以将外部购买或收集的 .mdx 格式词库文件（如朗氏、意意词典等）放入手机指定的本地文件夹中，App 将自动完成解压与索引入库。',
    alertOk: '我知道了',
  },
  'zh-Hant': {
    title: '詞典庫管理',
    loading: '正在載入設置...',
    installedDicts: '已安裝的詞典庫 ({count} 個)',
    listDesc: '點擊右側開關啟用/禁用詞典，使用上下箭頭（▲/▼）調整查詞時的渲染順序。',
    importTitle: '手動導入外部詞典',
    importDesc: '支持自定義導入符合 MDict 規範的 .mdx 詞庫文件。',
    importBtn: '導入本地詞典',
    alertTitle: '導入詞典庫',
    alertMsg: '自定義詞典功能即將上線！\n\n未來版本中，您可以將外部購買或收集看 .mdx 格式詞庫文件（如朗氏、意意詞典等）放入手機指定的本地文件夾中，App 將自動完成解壓與索引入庫。',
    alertOk: '我知道了',
  },
  en: {
    title: 'Dictionary Management',
    loading: 'Loading settings...',
    installedDicts: 'Installed Dictionaries ({count})',
    listDesc: 'Toggle switch to enable/disable. Use arrows (▲/▼) to reorder search results rendering.',
    importTitle: 'Import External Dictionaries',
    importDesc: 'Import custom .mdx dictionary files compliant with MDict specifications.',
    importBtn: 'Import Local Dict',
    alertTitle: 'Import Dictionary',
    alertMsg: 'Custom dictionary import is coming soon!\n\nIn future versions, you can place external .mdx dictionaries (such as Zingarelli, Garzanti, etc.) in a designated local folder on your device. The app will automatically index and load them.',
    alertOk: 'Got it',
  },
  it: {
    title: 'Gestione Dizionari',
    loading: 'Caricamento impostazioni...',
    installedDicts: 'Dizionari Installati ({count})',
    listDesc: 'Attiva/disattiva gli switch. Usa le frecce (▲/▼) per riordinare la sequenza di visualizzazione.',
    importTitle: 'Importa Dizionari Esterni',
    importDesc: 'Supporta l\'importazione personalizzata di file dizionario .mdx conformi alle specifiche MDict.',
    importBtn: 'Importa Dizionario',
    alertTitle: 'Importa Dizionario',
    alertMsg: 'L\'importazione di dizionari personalizzati sarà presto disponibile!\n\nNelle versioni future, potrai inserire dizionari esterni .mdx (come Zingarelli, Garzanti, ecc.) in una cartella locale. L\'app li indicizzerà e li caricherà automaticamente.',
    alertOk: 'Ho capito',
  }
};

export default function DictionarySettingsScreen() {
  const { colors, isDark, language } = useTheme();
  const activeLang = (['zh', 'zh-Hant', 'en', 'it'].includes(language) ? language : 'zh') as Language;
  const ls = (key: string) => {
    return LOCALIZED_STRINGS[activeLang]?.[key] || LOCALIZED_STRINGS['zh'][key] || key;
  };
  const [dicts, setDicts] = useState<DictionaryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({
    visible: false,
    phase: 'copying' as 'copying' | 'reading' | 'indexing' | 'cancelling',
    completed: 0,
    total: 0,
    fileName: '',
    fileIndex: 0,
    fileTotal: 0,
  });
  const cancelImportRef = useRef(false);
  const [builtInExpanded, setBuiltInExpanded] = useState(true);
  const [importedExpanded, setImportedExpanded] = useState(true);

  const builtInDicts = dicts.filter((dictionary) => dictionary.isSystem);
  const importedDicts = dicts.filter((dictionary) => !dictionary.isSystem);
  const builtInLabel = activeLang === 'en' ? 'Built-in Dictionaries' : activeLang === 'it' ? 'Dizionari Integrati' : '内置词典库';
  const importedLabel = activeLang === 'en' ? 'Imported Dictionaries' : activeLang === 'it' ? 'Dizionari Importati' : '手动导入词典库';

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await loadDictionariesConfig();
        setDicts(config);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Update enable/disable switch
  const handleToggleSwitch = async (id: string, value: boolean) => {
    const updated = dicts.map(item => {
      if (item.id === id) {
        return { ...item, isEnabled: value };
      }
      return item;
    });
    setDicts(updated);
    await saveDictionariesConfig(updated);
  };

  const handleDragEnd = async (isSystem: boolean, reorderedGroup: DictionaryInfo[]) => {
    const otherGroup = dicts.filter((dictionary) => dictionary.isSystem !== isSystem);
    const ordered = isSystem
      ? [...reorderedGroup, ...otherGroup]
      : [...otherGroup, ...reorderedGroup];
    const final = ordered.map((dictionary, index) => ({ ...dictionary, orderIndex: index + 1 }));
    setDicts(final);
    await saveDictionariesConfig(final);
  };

  const handleManualImportPress = async () => {
    if (importing) return;
    try {
      const result = await File.pickFileAsync({
        multipleFiles: true,
        mimeTypes: ['application/octet-stream', 'application/x-mdict', '*/*'],
      });
      if (result.canceled || !result.result) return;

      const selectedFiles = result.result;
      if (selectedFiles.length === 0) return;

      cancelImportRef.current = false;
      setImporting(true);
      for (const [fileIndex, selectedFile] of selectedFiles.entries()) {
        setImportProgress({
          visible: true,
          phase: 'copying',
          completed: 0,
          total: 0,
          fileName: selectedFile.name,
          fileIndex: fileIndex + 1,
          fileTotal: selectedFiles.length,
        });
        await importDictionaryFile(selectedFile, selectedFile.name, {
          shouldCancel: () => cancelImportRef.current,
          onProgress: (phase, progress) => {
            setImportProgress({
              visible: true,
              phase,
              completed: progress?.completed ?? 0,
              total: progress?.total ?? 0,
              fileName: selectedFile.name,
              fileIndex: fileIndex + 1,
              fileTotal: selectedFiles.length,
            });
          },
        });
      }
      const config = await loadDictionariesConfig();
      setDicts(config);
      Alert.alert(
        activeLang === 'en' ? 'Dictionaries imported' : activeLang === 'it' ? 'Dizionari importati' : '词典已导入',
        activeLang === 'en'
          ? `${selectedFiles.length} dictionaries are ready to use.`
          : activeLang === 'it'
            ? `${selectedFiles.length} dizionari sono pronti all'uso.`
            : `${selectedFiles.length}本词典已经可以使用。`,
        [{ text: ls('alertOk'), style: 'default' }]
      );
    } catch (error) {
      if (cancelImportRef.current) return;
      console.error('Failed to import dictionary:', error);
      Alert.alert(
        activeLang === 'en' ? 'Import failed' : activeLang === 'it' ? 'Importazione non riuscita' : '导入失败',
        error instanceof Error ? error.message : (activeLang === 'en' ? 'Unable to import this dictionary file.' : '无法导入这个词典文件。'),
        [{ text: ls('alertOk'), style: 'default' }]
      );
    } finally {
      setImporting(false);
      setImportProgress((current) => ({ ...current, visible: false }));
    }
  };

  const requestImportCancel = () => {
    if (!importing) return;
    cancelImportRef.current = true;
    setImportProgress((current) => ({ ...current, phase: 'cancelling' }));
  };

  const handleDeleteImportedDictionary = (dictionary: DictionaryInfo) => {
    Alert.alert(
      activeLang === 'en' ? 'Remove dictionary?' : activeLang === 'it' ? 'Rimuovere il dizionario?' : '删除词典？',
      activeLang === 'en' ? `Remove ${dictionary.name} from this device?` : activeLang === 'it' ? `Rimuovere ${dictionary.name} da questo dispositivo?` : `从本机移除“${dictionary.name}”？`,
      [
        { text: activeLang === 'en' ? 'Cancel' : activeLang === 'it' ? 'Annulla' : '取消', style: 'cancel' },
        {
          text: activeLang === 'en' ? 'Remove' : activeLang === 'it' ? 'Rimuovi' : '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeImportedDictionary(dictionary.id);
              setDicts(await loadDictionariesConfig());
            } catch (error) {
              console.error('Failed to remove imported dictionary:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Settings Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#A31621" />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{ls('title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Modal transparent visible={importProgress.visible} animationType="fade" onRequestClose={requestImportCancel} statusBarTranslucent>
        <View style={styles.progressOverlay}>
          <View style={[styles.progressCard, { backgroundColor: colors.surfaceElevated || colors.surface, borderColor: colors.border }]}>
            <View style={[styles.progressIcon, { backgroundColor: isDark ? '#A3162133' : '#A3162114' }]}>
              <MaterialIcons name={importProgress.phase === 'cancelling' ? 'hourglass-top' : 'library-books'} size={24} color={isDark ? '#FF8D8D' : '#A31621'} />
            </View>
            <Text style={[styles.progressTitle, { color: colors.textPrimary }]}>
              {activeLang === 'en' ? 'Importing dictionary' : activeLang === 'it' ? 'Importazione dizionario' : '正在导入词典'}
            </Text>
            {importProgress.fileTotal > 0 && (
              <Text style={[styles.progressFileName, { color: colors.textMuted }]} numberOfLines={1}>
                {importProgress.fileIndex} / {importProgress.fileTotal} - {importProgress.fileName}
              </Text>
            )}
            <Text style={[styles.progressMessage, { color: colors.textSecondary }]}>
              {importProgress.phase === 'copying'
                ? (activeLang === 'en' ? 'Copying dictionary file...' : activeLang === 'it' ? 'Copia del file dizionario...' : '正在复制词典文件...')
                : importProgress.phase === 'reading'
                  ? (activeLang === 'en' ? 'Reading dictionary entries...' : activeLang === 'it' ? 'Lettura delle voci del dizionario...' : '正在读取词条...')
                  : importProgress.phase === 'cancelling'
                    ? (activeLang === 'en' ? 'Cancelling and cleaning up...' : activeLang === 'it' ? 'Annullamento e pulizia...' : '正在取消并清理文件...')
                    : (activeLang === 'en' ? 'Building search index...' : activeLang === 'it' ? 'Creazione indice di ricerca...' : '正在建立检索索引...')}
            </Text>
            {importProgress.total > 0 ? (
              <>
                <View style={[styles.progressTrack, { backgroundColor: isDark ? '#FFFFFF1A' : '#0000000E' }]}>
                  <View style={[styles.progressFill, { width: `${Math.round((importProgress.completed / importProgress.total) * 100)}%` }]} />
                </View>
                <Text style={[styles.progressCount, { color: colors.textMuted }]}>
                  {importProgress.completed.toLocaleString()} / {importProgress.total.toLocaleString()} ({Math.round((importProgress.completed / importProgress.total) * 100)}%)
                </Text>
              </>
            ) : (
              <ActivityIndicator size="small" color={isDark ? '#FF8D8D' : '#A31621'} style={styles.progressSpinner} />
            )}
            <Pressable style={[styles.cancelImportButton, { borderColor: isDark ? '#FF8D8D66' : '#A3162150', opacity: importProgress.phase === 'cancelling' ? 0.55 : 1 }]} onPress={requestImportCancel} disabled={importProgress.phase === 'cancelling'}>
              <Text style={[styles.cancelImportText, { color: isDark ? '#FF8D8D' : '#A31621' }]}>
                {activeLang === 'en' ? 'Cancel import' : activeLang === 'it' ? 'Annulla importazione' : '取消导入'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={{ color: colors.textSecondary }}>{ls('loading')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.groupHeader} onPress={() => setBuiltInExpanded((value) => !value)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{builtInLabel} ({builtInDicts.length})</Text>
            <MaterialIcons name={builtInExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={26} color={colors.textSecondary} />
          </Pressable>
          {builtInExpanded && (
            <>
              <View style={[styles.notice, { backgroundColor: isDark ? '#A316211C' : '#A316210D', borderColor: isDark ? '#FF8D8D45' : '#A3162130' }]}>
                <MaterialIcons name="info-outline" size={20} color={isDark ? '#FF8D8D' : '#A31621'} />
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  {activeLang === 'en' ? 'The built-in dictionaries below are provided for language learning and academic exchange.' : activeLang === 'it' ? 'I dizionari integrati seguenti sono destinati allo studio linguistico e allo scambio accademico.' : '以下内置词典来源于网络，仅供语言学习与学术交流使用。'}
                </Text>
              </View>
              <DraggableFlatList
                data={builtInDicts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                activationDistance={28}
                onDragEnd={({ data }) => handleDragEnd(true, data)}
                renderItem={({ item, getIndex, drag, isActive }) => (
                  <View style={[styles.dictCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isActive ? 0.82 : item.isEnabled ? 1 : 0.7 }]}>
                    <View style={styles.cardMain}>
                      <View style={styles.cardLeft}>
                        <Text style={[styles.dictTitle, { color: colors.textPrimary }]}>{(getIndex() ?? 0) + 1}. {item.name}</Text>
                        <Text style={[styles.dictDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                      </View>
                      <View style={styles.cardRight}>
                        <Switch value={item.isEnabled} onValueChange={(value) => handleToggleSwitch(item.id, value)} trackColor={{ false: isDark ? '#3A3A3C' : '#D1D1D6', true: isDark ? '#FF6B6B' : '#A31621' }} thumbColor={item.isEnabled ? '#FFFFFF' : (isDark ? '#8E8E93' : '#F4F3F4')} />
                        <Pressable accessibilityRole="button" accessibilityLabel="Drag to reorder" style={styles.dragHandle} onLongPress={drag} delayLongPress={120}>
                          <MaterialIcons name="drag-handle" size={24} color={isDark ? '#FF8D8D' : '#A31621'} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              />
            </>
          )}

          <Pressable style={[styles.groupHeader, styles.importGroupHeader]} onPress={() => setImportedExpanded((value) => !value)}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{importedLabel} ({importedDicts.length})</Text>
            <MaterialIcons name={importedExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={26} color={colors.textSecondary} />
          </Pressable>
          {importedExpanded && (
            <>
              <DraggableFlatList
                data={importedDicts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                activationDistance={28}
                onDragEnd={({ data }) => handleDragEnd(false, data)}
                renderItem={({ item, getIndex, drag, isActive }) => (
                  <View style={[styles.dictCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: isActive ? 0.82 : item.isEnabled ? 1 : 0.7 }]}>
                    <View style={styles.cardMain}>
                      <View style={styles.cardLeft}>
                        <Text style={[styles.dictTitle, { color: colors.textPrimary }]}>{(getIndex() ?? 0) + 1}. {item.name}</Text>
                        <Text style={[styles.dictDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                        <Text style={[styles.dictSource, { color: colors.textMuted }]}>Source: {item.source}</Text>
                      </View>
                      <View style={styles.cardRight}>
                        <Switch value={item.isEnabled} onValueChange={(value) => handleToggleSwitch(item.id, value)} trackColor={{ false: isDark ? '#3A3A3C' : '#D1D1D6', true: isDark ? '#FF6B6B' : '#A31621' }} thumbColor={item.isEnabled ? '#FFFFFF' : (isDark ? '#8E8E93' : '#F4F3F4')} />
                        <Pressable accessibilityRole="button" accessibilityLabel="Drag to reorder" style={styles.dragHandle} onLongPress={drag} delayLongPress={120}>
                          <MaterialIcons name="drag-handle" size={24} color={isDark ? '#FF8D8D' : '#A31621'} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Remove imported dictionary" style={styles.removeBtn} onPress={() => handleDeleteImportedDictionary(item)}>
                          <MaterialIcons name="delete-outline" size={20} color={isDark ? '#FF8D8D' : '#A31621'} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              />
              <View style={[styles.importCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.importLeft}>
                  <MaterialIcons name="upload-file" size={28} color={isDark ? '#FF8D8D' : '#A31621'} style={styles.importIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.importTitle, { color: colors.textPrimary }]}>{ls('importTitle')}</Text>
                    <Text style={[styles.importDesc, { color: colors.textSecondary }]}>{ls('importDesc')}</Text>
                  </View>
                </View>
                <Pressable style={({ pressed }) => [styles.importBtn, { backgroundColor: pressed || importing ? '#A31621cc' : '#A31621' }]} onPress={handleManualImportPress} disabled={importing}>
                  <Text style={styles.importBtnText}>{importing ? (activeLang === 'en' ? 'Indexing...' : activeLang === 'it' ? 'Indicizzazione...' : '正在建立索引...') : ls('importBtn')}</Text>
                </Pressable>
              </View>
            </>
          )}
          <View style={styles.legacyHidden}>
          
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {ls('installedDicts').replace('{count}', String(dicts.length))}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            {ls('listDesc')}
          </Text>

          {/* Dictionaries Config List */}
          {dicts.map((item, idx) => (
            <View 
              key={item.id} 
              style={[
                styles.dictCard, 
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  opacity: item.isEnabled ? 1 : 0.7 
                }
              ]}
            >
              <View style={styles.cardMain}>
                <View style={styles.cardLeft}>
                  <Text style={[styles.dictTitle, { color: colors.textPrimary }]}>
                    {idx + 1}. {item.name}
                  </Text>
                  <Text style={[styles.dictDesc, { color: colors.textSecondary }]}>
                    {item.description}
                  </Text>
                  <Text style={[styles.dictSource, { color: colors.textMuted }]}>
                    ⚠️ {item.source}
                  </Text>
                </View>

                {/* Switch enable/disable */}
                <View style={styles.cardRight}>
                  <Switch
                    value={item.isEnabled}
                    onValueChange={(val) => handleToggleSwitch(item.id, val)}
                    trackColor={{ 
                      false: isDark ? '#3A3A3C' : '#D1D1D6', 
                      true: isDark ? '#FF6B6B' : '#A31621' 
                    }}
                    thumbColor={item.isEnabled ? '#FFFFFF' : (isDark ? '#8E8E93' : '#F4F3F4')}
                    ios_backgroundColor={isDark ? '#3A3A3C' : '#D1D1D6'}
                  />
                  
                  {/* Reordering Controls */}
                  <View style={styles.reorderControls}>
                    <Pressable 
                      style={[
                        styles.arrowBtn, 
                        {
                          borderColor: isDark ? '#FF6B6B40' : '#A3162130',
                          backgroundColor: isDark ? '#FF6B6B10' : '#A3162108',
                        },
                        idx === 0 && styles.disabledBtn
                      ]} 
                      disabled={idx === 0}
                      onPress={() => undefined}
                    >
                      <MaterialIcons 
                        name="keyboard-arrow-up" 
                        size={20} 
                        color={idx === 0 ? colors.textMuted : (isDark ? '#FF6B6B' : '#A31621')} 
                      />
                    </Pressable>
                    <Pressable 
                      style={[
                        styles.arrowBtn, 
                        {
                          borderColor: isDark ? '#FF6B6B40' : '#A3162130',
                          backgroundColor: isDark ? '#FF6B6B10' : '#A3162108',
                        },
                        idx === dicts.length - 1 && styles.disabledBtn
                      ]} 
                      disabled={idx === dicts.length - 1}
                      onPress={() => undefined}
                    >
                      <MaterialIcons 
                        name="keyboard-arrow-down" 
                        size={20} 
                        color={idx === dicts.length - 1 ? colors.textMuted : (isDark ? '#FF6B6B' : '#A31621')} 
                      />
                    </Pressable>
                  </View>
                  {!item.isSystem && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove imported dictionary"
                      style={styles.removeBtn}
                      onPress={() => handleDeleteImportedDictionary(item)}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={isDark ? '#FF8D8D' : '#A31621'} />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          ))}

          {/* Future Manual Import section */}
          <View style={[styles.importCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.importLeft}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>📁</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.importTitle, { color: colors.textPrimary }]}>{ls('importTitle')}</Text>
                <Text style={[styles.importDesc, { color: colors.textSecondary }]}>
                  {ls('importDesc')}
                </Text>
              </View>
            </View>
            <Pressable 
              style={({ pressed }) => [
                styles.importBtn, 
                { backgroundColor: pressed || importing ? '#A31621cc' : '#A31621' }
              ]} 
              onPress={handleManualImportPress}
              disabled={importing}
            >
              <Text style={styles.importBtnText}>{importing ? (activeLang === 'en' ? 'Importing...' : activeLang === 'it' ? 'Importazione...' : '正在导入...') : ls('importBtn')}</Text>
            </Pressable>
          </View>

          </View>
        </ScrollView>
      )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  progressCard: {
    width: '100%',
    maxWidth: 376,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'stretch',
  },
  progressIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  progressTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    textAlign: 'left',
    marginBottom: 8,
  },
  progressFileName: {
    fontSize: 13,
    marginBottom: 10,
  },
  progressMessage: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 18,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#A31621',
  },
  progressCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  progressSpinner: {
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  cancelImportButton: {
    minHeight: 42,
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelImportText: {
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  groupHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importGroupHeader: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  dictCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    paddingRight: 16,
  },
  dictTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dictDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  dictSource: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragHandle: {
    width: 32,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 8,
  },
  removeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importIcon: {
    marginRight: 12,
  },
  legacyHidden: {
    display: 'none',
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A3162130',
    backgroundColor: '#A3162108',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    borderColor: '#EAEAEA',
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  arrowIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  importCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 20,
    marginTop: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  importLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  importDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  importBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  importBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
