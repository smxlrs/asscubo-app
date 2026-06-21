import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Pressable, 
  ScrollView, 
  ActivityIndicator, 
  Dimensions,
  Animated,
  RefreshControl,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type Currency = {
  code: string;
  name: string;
  flag: string;
};

const CURRENCIES: Currency[] = [
  { code: 'EUR', name: '欧元', flag: '🇪🇺' },
  { code: 'CNY', name: '人民币', flag: '🇨🇳' },
  { code: 'USD', name: '美元', flag: '🇺🇸' },
  { code: 'GBP', name: '英镑', flag: '🇬🇧' },
  { code: 'JPY', name: '日元', flag: '🇯🇵' },
  { code: 'KRW', name: '韩元', flag: '🇰🇷' },
  { code: 'HKD', name: '港币', flag: '🇭🇰' },
];

const DEFAULT_RATES: Record<string, number> = {
  EUR: 1.0,
  CNY: 7.8256,
  USD: 1.0852,
  JPY: 170.25,
  KRW: 1495.3,
  GBP: 0.8543,
  HKD: 8.4721,
};

export default function RateConverterScreen() {
  const { colors, isDark } = useTheme();

  // Exchange rates state
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [lastUpdated, setLastUpdated] = useState<string>('使用默认汇率');
  const [loading, setLoading] = useState<boolean>(false);

  // Active currency editing
  const [activeCurrency, setActiveCurrency] = useState<string>('EUR');
  const [showKeypad, setShowKeypad] = useState<boolean>(true);
  const [inputValues, setInputValues] = useState<Record<string, string>>({
    EUR: '1',
    CNY: DEFAULT_RATES.CNY.toFixed(2),
    USD: DEFAULT_RATES.USD.toFixed(2),
    JPY: DEFAULT_RATES.JPY.toFixed(0),
    KRW: DEFAULT_RATES.KRW.toFixed(0),
    GBP: DEFAULT_RATES.GBP.toFixed(2),
    HKD: DEFAULT_RATES.HKD.toFixed(2),
  });

  // Toast state and animations
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimeoutRef = React.useRef<any>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(-20)).current;

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    
    const isSuccess = msg === '刷新成功';
    const fadeInDuration = isSuccess ? 150 : 250;
    const keepDuration = isSuccess ? 1000 : 2000;
    const fadeOutDuration = 250;

    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(-20);
    
    // Animate in
    if (isSuccess) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: fadeInDuration,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: fadeInDuration,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: fadeInDuration,
          useNativeDriver: true,
        })
      ]).start();
    }

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    toastTimeoutRef.current = setTimeout(() => {
      // Animate out
      if (isSuccess) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: fadeOutDuration,
          useNativeDriver: true,
        }).start(() => {
          setToastMessage(null);
        });
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: fadeOutDuration,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -20,
            duration: fadeOutDuration,
            useNativeDriver: true,
          })
        ]).start(() => {
          setToastMessage(null);
        });
      }
    }, keepDuration);
  };

  const fetchRates = async (isManual: boolean = false) => {
    setLoading(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/EUR');
      const data = await response.json();
      if (data && data.result === 'success' && data.rates) {
        setRates(data.rates);
        
        // Format last update time
        const date = new Date(data.time_last_update_unix * 1000);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        setLastUpdated(`更新于 ${date.toLocaleDateString()} ${hours}:${minutes}`);
        
        // Recalculate values based on new rates
        recalculate(inputValues[activeCurrency] || '0', activeCurrency, data.rates);
        
        if (isManual) {
          showToast('刷新成功');
        }
      } else {
        if (isManual) {
          showToast('⚠ 汇率数据异常', 'error');
        }
      }
    } catch (error) {
      console.log('Error fetching exchange rates:', error);
      setLastUpdated('离线模式 (默认汇率)');
      if (isManual) {
        showToast('⚠ 汇率更新失败，请检查网络', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const recalculate = (valueStr: string, sourceCode: string, currentRates: Record<string, number>) => {
    const value = parseFloat(valueStr) || 0;
    const rateInEUR = value / (currentRates[sourceCode] || 1);
    
    const newValues: Record<string, string> = {};
    
    CURRENCIES.forEach(currency => {
      if (currency.code === sourceCode) {
        newValues[currency.code] = valueStr;
      } else {
        const converted = rateInEUR * (currentRates[currency.code] || 0);
        // Format based on currency type (e.g. JPY, KRW usually don't show cents)
        if (currency.code === 'JPY' || currency.code === 'KRW') {
          newValues[currency.code] = converted.toFixed(0);
        } else {
          newValues[currency.code] = converted.toFixed(2);
        }
      }
    });
    
    setInputValues(newValues);
  };

  const handleKeyPress = (key: string) => {
    let currentInput = inputValues[activeCurrency] || '';

    if (key === 'C') {
      currentInput = '0';
    } else if (key === '⌫') {
      currentInput = currentInput.slice(0, -1);
      if (currentInput === '' || currentInput === '-') {
        currentInput = '0';
      }
    } else if (key === '.') {
      if (!currentInput.includes('.')) {
        currentInput = currentInput === '' ? '0.' : currentInput + '.';
      }
    } else {
      // Numbers or '00'
      if (currentInput === '0' && key !== '00') {
        currentInput = key;
      } else if (currentInput !== '0') {
        currentInput = currentInput + key;
      }
    }

    setInputValues(prev => ({
      ...prev,
      [activeCurrency]: currentInput
    }));
    recalculate(currentInput, activeCurrency, rates);
  };

  // Dynamic header currency info
  const getDynamicCardInfo = () => {
    const isCny = activeCurrency === 'CNY';
    const displayCode = isCny ? 'EUR' : activeCurrency;
    const displayName = isCny ? '欧元' : (CURRENCIES.find(c => c.code === activeCurrency)?.name || '');
    
    const rateToCny = isCny 
      ? (rates.CNY || DEFAULT_RATES.CNY)
      : (rates.CNY || DEFAULT_RATES.CNY) / (rates[activeCurrency] || DEFAULT_RATES[activeCurrency] || 1);
      
    return {
      label: `实时行情基准 (${displayName}兑人民币)`,
      value: `1 ${displayCode} = ${rateToCny.toFixed(4)} CNY`
    };
  };

  const cardInfo = getDynamicCardInfo();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, zIndex: 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>汇率换算</Text>
        <Pressable style={styles.refreshBtn} onPress={() => fetchRates(true)} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="refresh" size={24} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {/* Main Content Area */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => fetchRates(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressViewOffset={15}
          />
        }
      >
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{cardInfo.label}</Text>
            <Text style={[styles.infoValue, { color: colors.success }]}>
              {cardInfo.value}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <Text style={[styles.updatedText, { color: colors.textMuted }]}>{lastUpdated}</Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>数据来源：ExchangeRate-API</Text>
          </View>
        </View>

        {/* Currency List */}
        <View style={styles.currencyList}>
          {CURRENCIES.map((currency) => {
            const isActive = activeCurrency === currency.code;
            return (
              <Pressable
                key={currency.code}
                style={[
                  styles.currencyRow,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: isActive ? colors.primary : colors.border,
                    borderWidth: isActive ? 2 : 1
                  }
                ]}
                onPress={() => {
                  setActiveCurrency(currency.code);
                  setShowKeypad(true);
                }}
              >
                <View style={styles.currencyLeft}>
                  <Text style={styles.flag}>{currency.flag}</Text>
                  <View style={styles.codeContainer}>
                    <Text style={[styles.codeText, { color: colors.textPrimary }]}>{currency.code}</Text>
                    <Text style={[styles.nameText, { color: colors.textSecondary }]}>{currency.name}</Text>
                  </View>
                </View>
                
                <View style={styles.currencyRight}>
                  <Text 
                    numberOfLines={1} 
                    ellipsizeMode="tail" 
                    style={[
                      styles.valueText, 
                      { 
                        color: isActive ? colors.primary : colors.textPrimary,
                        fontWeight: isActive ? 'bold' : 'normal' 
                      }
                    ]}
                  >
                    {inputValues[currency.code] || '0'}
                  </Text>
                  {isActive && <View style={[styles.cursor, { backgroundColor: colors.primary }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Keyboard Toolbar for Collapse */}
      {showKeypad && (
        <View style={[styles.keypadToolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.toolbarTitle, { color: colors.textSecondary, fontSize: 12 }]}>
            输入源: {CURRENCIES.find(c => c.code === activeCurrency)?.name || activeCurrency}
          </Text>
          <Pressable style={styles.collapseBtn} onPress={() => setShowKeypad(false)}>
            <Text style={[styles.collapseText, { color: colors.primary, fontSize: 13, fontWeight: '600' }]}>收起键盘 ▾</Text>
          </Pressable>
        </View>
      )}

      {/* Calculator Keypad */}
      {showKeypad && (
        <View style={[styles.keypadContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.keypadRow}>
            {['7', '8', '9', '⌫'].map(key => (
              <Pressable 
                key={key} 
                style={[styles.keyBtn, { backgroundColor: isDark ? '#1C1C1C' : '#F2F4F7' }]}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={[styles.keyText, { color: key === '⌫' ? colors.error : colors.textPrimary }]}>{key}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.keypadRow}>
            {['4', '5', '6', 'C'].map(key => (
              <Pressable 
                key={key} 
                style={[styles.keyBtn, { backgroundColor: isDark ? '#1C1C1C' : '#F2F4F7' }]}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={[styles.keyText, { color: key === 'C' ? colors.primary : colors.textPrimary }]}>{key}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.keypadRow}>
            {['1', '2', '3', '.'].map(key => (
              <Pressable 
                key={key} 
                style={[styles.keyBtn, { backgroundColor: isDark ? '#1C1C1C' : '#F2F4F7' }]}
                onPress={() => handleKeyPress(key)}
              >
                <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.keypadRow}>
            {['00', '0', 'Done'].map(key => {
              const isDone = key === 'Done';
              return (
                <Pressable 
                  key={key} 
                  style={[
                    styles.keyBtn, 
                    isDone ? { flex: 2, backgroundColor: colors.primary } : { backgroundColor: isDark ? '#1C1C1C' : '#F2F4F7' }
                  ]}
                  onPress={() => isDone ? handleKeyPress('C') : handleKeyPress(key)} // Done clears back to 0 or resets
                >
                  <Text style={[styles.keyText, { color: isDone ? '#FFF' : colors.textPrimary }]}>
                    {isDone ? '重置' : key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
       {/* Toast Notification */}
       {toastMessage && (
         <Animated.View 
           style={[
             toastMessage === '刷新成功' ? styles.checkmarkBubble : styles.toastContainer, 
             { 
               opacity: fadeAnim,
               transform: toastMessage === '刷新成功' ? [] : [{ translateY: slideAnim }],
               backgroundColor: toastMessage === '刷新成功' ? '#FFFFFF' : colors.surface,
               borderColor: toastMessage === '刷新成功' ? 'transparent' : (toastType === 'success' ? colors.primary : colors.error),
               borderWidth: toastMessage === '刷新成功' ? 0 : 1,
             }
           ]}
         >
           {toastMessage === '刷新成功' ? (
             <MaterialIcons name="check" size={24} color={colors.primary} />
           ) : (
             <Text style={[styles.toastText, { color: toastType === 'success' ? colors.primary : colors.error }]}>{toastMessage}</Text>
           )}
         </Animated.View>
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingLeft: 12,
    minWidth: 44,
    alignItems: 'flex-end',
  },
  refreshText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  updatedText: {
    fontSize: 11,
  },
  currencyList: {
    gap: 12,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    height: 68,
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flag: {
    fontSize: 32,
    marginRight: 12,
  },
  codeContainer: {
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  nameText: {
    fontSize: 11,
    marginTop: 2,
  },
  currencyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    paddingLeft: 24,
  },
  valueText: {
    fontSize: 20,
    textAlign: 'right',
  },
  cursor: {
    width: 2,
    height: 20,
    marginLeft: 4,
  },
  keypadToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  toolbarTitle: {
    fontWeight: '500',
  },
  collapseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  collapseText: {
    textAlign: 'right',
  },
  keypadContainer: {
    padding: 8,
    paddingBottom: 24,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  keyBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  keyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  toastContainer: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 99999,
  },
  checkmarkBubble: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 104 : 142,
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 99999,
  },
  toastText: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
