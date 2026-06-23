import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, Language } from '../../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  loadDictionariesConfig,
  saveDictionariesConfig,
  DictionaryInfo,
} from '../../../lib/db';

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

  // Move a dictionary up in display order
  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...dicts];
    
    // Swap elements
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    
    // Re-index orderIndex values
    const final = updated.map((item, idx) => ({
      ...item,
      orderIndex: idx + 1
    }));
    
    setDicts(final);
    await saveDictionariesConfig(final);
  };

  // Move a dictionary down in display order
  const handleMoveDown = async (index: number) => {
    if (index === dicts.length - 1) return;
    const updated = [...dicts];
    
    // Swap elements
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    
    // Re-index orderIndex values
    const final = updated.map((item, idx) => ({
      ...item,
      orderIndex: idx + 1
    }));
    
    setDicts(final);
    await saveDictionariesConfig(final);
  };

  // Future Manual Import dialog placeholder
  const handleManualImportPress = () => {
    Alert.alert(
      ls('alertTitle'),
      ls('alertMsg'),
      [{ text: ls('alertOk'), style: 'default' }]
    );
  };

  return (
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

      {loading ? (
        <View style={styles.centerContainer}>
          <Text style={{ color: colors.textSecondary }}>{ls('loading')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
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
                      onPress={() => handleMoveUp(idx)}
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
                      onPress={() => handleMoveDown(idx)}
                    >
                      <MaterialIcons 
                        name="keyboard-arrow-down" 
                        size={20} 
                        color={idx === dicts.length - 1 ? colors.textMuted : (isDark ? '#FF6B6B' : '#A31621')} 
                      />
                    </Pressable>
                  </View>
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
                { backgroundColor: pressed ? '#A31621cc' : '#A31621' }
              ]} 
              onPress={handleManualImportPress}
            >
              <Text style={styles.importBtnText}>{ls('importBtn')}</Text>
            </Pressable>
          </View>

        </ScrollView>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
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
    alignItems: 'center',
    gap: 12,
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 8,
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
