import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function BookingWebview() {
  const { colors, language } = useTheme();
  const params = useLocalSearchParams();

  // Route parameters passed from index.tsx
  const operator = (params.operator as string) || 'TI';
  const fromStation = (params.from as string) || '';
  const toStation = (params.to as string) || '';
  const travelDate = (params.date as string) || ''; // YYYY-MM-DD
  const travelTime = (params.time as string) || '08:00'; // HH:MM

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isCopilotCollapsed, setIsCopilotCollapsed] = useState(false);

  const webViewRef = useRef<WebView>(null);

  // Format date display for user: YYYY-MM-DD -> DD/MM/YYYY
  const formattedDateForUser = (() => {
    if (!travelDate) return '';
    const parts = travelDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return travelDate;
  })();

  // Resolve base URL depending on operator and language
  const getInitialUrl = () => {
    const isIt = language === 'it';
    if (operator === 'Italo') {
      return isIt ? 'https://www.italotreno.it' : 'https://www.italotreno.it/en';
    }
    if (operator === 'Trenord') {
      return 'https://www.trenord.it';
    }
    // Default Trenitalia
    return isIt ? 'https://www.trenitalia.com' : 'https://www.trenitalia.com/en.html';
  };

  const getPageTitle = () => {
    if (operator === 'Italo') return 'Italo Treno';
    if (operator === 'Trenord') return 'Trenord';
    return 'Trenitalia';
  };

  // Generate JS script to inject for form filling
  const getAutoFillScript = () => {
    // Escape stations for JS safety
    const safeFrom = fromStation.replace(/'/g, "\\'");
    const safeTo = toStation.replace(/'/g, "\\'");
    const safeDate = travelDate; // YYYY-MM-DD
    const safeTime = travelTime;

    return `
      (function() {
        console.log('Automated booking assistant running...');

        function setInputValue(el, val) {
          if (!el) return false;
          el.focus();
          el.value = val;
          // Trigger events for frameworks like React/Vue
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }

        // 1. Try filling departure/arrival
        var inputs = document.querySelectorAll('input');
        var fromEl = null;
        var toEl = null;
        var dateEl = null;
        var timeEl = null;

        inputs.forEach(function(input) {
          var ph = (input.placeholder || '').toLowerCase();
          var id = (input.id || '').toLowerCase();
          var name = (input.name || '').toLowerCase();

          // Match From / Da / Partenza
          if (ph.includes('from') || ph.includes('partenza') || ph === 'da' || id.includes('departure') || name.includes('from') || id.includes('origin') || id.includes('da')) {
            if (!fromEl) fromEl = input;
          }
          // Match To / A / Arrivo
          if (ph.includes('to') || ph.includes('arrivo') || ph === 'a' || id.includes('arrival') || name.includes('to') || id.includes('destination') || id.includes('a')) {
            if (!toEl) toEl = input;
          }
          // Match Date
          if (id.includes('date') || name.includes('date') || input.type === 'date' || ph.includes('date') || ph.includes('data')) {
            if (!dateEl) dateEl = input;
          }
          // Match Time
          if (id.includes('time') || name.includes('time') || id.includes('ora') || name.includes('ora') || ph.includes('time')) {
            if (!timeEl) timeEl = input;
          }
        });

        var filledAny = false;
        if (fromEl) filledAny = setInputValue(fromEl, '${safeFrom}') || filledAny;
        if (toEl) filledAny = setInputValue(toEl, '${safeTo}') || filledAny;
        
        // Handle date formatting
        if (dateEl) {
          // If input type is date, it expects YYYY-MM-DD
          if (dateEl.type === 'date') {
            filledAny = setInputValue(dateEl, '${safeDate}') || filledAny;
          } else {
            // Text inputs might expect DD/MM/YYYY or DD-MM-YYYY
            var parts = '${safeDate}'.split('-');
            var ddMMyyyy = parts[2] + '/' + parts[1] + '/' + parts[0];
            filledAny = setInputValue(dateEl, ddMMyyyy) || filledAny;
          }
        }

        if (timeEl) {
          filledAny = setInputValue(timeEl, '${safeTime}') || filledAny;
        }

        return filledAny;
      })();
    `;
  };

  const handleManualFill = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(getAutoFillScript());
    }
  };

  // Perform multiple autofill attempts to account for slow rendering SPA websites
  useEffect(() => {
    if (!isLoading && webViewRef.current) {
      // Attempt 1: Immediate
      webViewRef.current.injectJavaScript(getAutoFillScript());

      // Attempt 2: After 1s
      const t1 = setTimeout(() => {
        webViewRef.current?.injectJavaScript(getAutoFillScript());
      }, 1000);

      // Attempt 3: After 2.5s
      const t2 = setTimeout(() => {
        webViewRef.current?.injectJavaScript(getAutoFillScript());
      }, 2500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isLoading]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top Header Bar */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={28} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{getPageTitle()}</Text>
        <Pressable onPress={handleManualFill} style={styles.headerRightBtn}>
          <MaterialIcons name="autorenew" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Progress Bar */}
      {isLoading && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
        </View>
      )}

      {/* WebView Container */}
      <View style={styles.webviewWrapper}>
        <WebView
          ref={webViewRef}
          source={{ uri: getInitialUrl() }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36"
        />

        {/* Floating Copilot Helper */}
        {isCopilotCollapsed ? (
          /* Collapsed Bubble style */
          <Pressable
            onPress={() => setIsCopilotCollapsed(false)}
            style={[
              styles.collapsedBubble,
              { backgroundColor: colors.primary, shadowColor: colors.primary }
            ]}
          >
            <MaterialIcons name="smart-toy" size={24} color="#FFF" />
          </Pressable>
        ) : (
          /* Fully Expanded Assistant Panel */
          <View style={[styles.copilotPanel, { backgroundColor: colors.surface + 'EE', borderColor: colors.border }]}>
            {/* Header info */}
            <View style={styles.copilotHeader}>
              <View style={styles.assistantTitleRow}>
                <MaterialIcons name="smart-toy" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.copilotTitle, { color: colors.textPrimary }]}>
                  {language === 'zh' ? '智能购票助手' : (language === 'zh-Hant' ? '智能購票助手' : 'Booking Assistant')}
                </Text>
              </View>
              <Pressable onPress={() => setIsCopilotCollapsed(true)} style={styles.collapseBtn}>
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Travel route detail & instructions */}
            <Text style={[styles.copilotSubtitle, { color: colors.textSecondary }]}>
              {language === 'zh' 
                ? '提示：长按下方框内站名即可复制。如未自动填入，可点击右侧按钮重新尝试或直接粘贴。' 
                : (language === 'zh-Hant'
                  ? '提示：長按下方框內站名即可複製。如未自動填入，可點擊右側按鈕重新嘗試或直接貼上。'
                  : 'Tip: Long press text in boxes to copy. Tap Autofill to retry.')}
            </Text>

            <View style={styles.copilotGrid}>
              <View style={styles.gridLeft}>
                {/* Station row */}
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    {language === 'zh' ? '出发站' : 'From'}
                  </Text>
                  <View style={[styles.fieldValueBox, { backgroundColor: colors.background }]}>
                    <Text selectable={true} style={[styles.fieldValueText, { color: colors.textPrimary }]}>
                      {fromStation}
                    </Text>
                  </View>
                </View>

                {/* To station row */}
                <View style={styles.fieldRow}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                    {language === 'zh' ? '到达站' : 'To'}
                  </Text>
                  <View style={[styles.fieldValueBox, { backgroundColor: colors.background }]}>
                    <Text selectable={true} style={[styles.fieldValueText, { color: colors.textPrimary }]}>
                      {toStation}
                    </Text>
                  </View>
                </View>

                {/* Date/Time row */}
                <View style={styles.fieldRowInline}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                      {language === 'zh' ? '日期' : 'Date'}
                    </Text>
                    <View style={[styles.fieldValueBox, { backgroundColor: colors.background }]}>
                      <Text selectable={true} style={[styles.fieldValueText, { color: colors.textPrimary }]}>
                        {formattedDateForUser}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 0.8 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                      {language === 'zh' ? '时间' : 'Time'}
                    </Text>
                    <View style={[styles.fieldValueBox, { backgroundColor: colors.background }]}>
                      <Text selectable={true} style={[styles.fieldValueText, { color: colors.textPrimary }]}>
                        {travelTime}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Buttons Column */}
              <View style={styles.gridRight}>
                <Pressable
                  onPress={handleManualFill}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <MaterialIcons name="edit" size={18} color="#FFF" style={{ marginBottom: 4 }} />
                  <Text style={styles.actionBtnText}>
                    {language === 'zh' ? '智能填入' : (language === 'zh-Hant' ? '智能填入' : 'Autofill')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setIsCopilotCollapsed(true)}
                  style={({ pressed }) => [
                    styles.actionBtnSecondary,
                    { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }
                  ]}
                >
                  <MaterialIcons name="visibility-off" size={16} color={colors.textSecondary} style={{ marginBottom: 2 }} />
                  <Text style={[styles.actionBtnTextSecondary, { color: colors.textSecondary }]}>
                    {language === 'zh' ? '隐藏' : 'Hide'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerRightBtn: {
    padding: 10,
  },
  progressBarBg: {
    height: 3,
    width: '100%',
    backgroundColor: 'transparent',
  },
  progressBarFill: {
    height: '100%',
  },
  webviewWrapper: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  collapsedBubble: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  copilotPanel: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  copilotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  assistantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copilotTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  collapseBtn: {
    padding: 4,
  },
  copilotSubtitle: {
    fontSize: 11,
    lineHeight: 14,
    marginBottom: 8,
  },
  copilotGrid: {
    flexDirection: 'row',
  },
  gridLeft: {
    flex: 1.2,
    marginRight: 10,
  },
  gridRight: {
    flex: 0.5,
    justifyContent: 'space-between',
  },
  fieldRow: {
    marginBottom: 6,
  },
  fieldRowInline: {
    flexDirection: 'row',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 10,
    marginBottom: 2,
    fontWeight: '600',
  },
  fieldValueBox: {
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  fieldValueText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginBottom: 6,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionBtnSecondary: {
    borderRadius: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionBtnTextSecondary: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});
