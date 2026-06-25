import React, { useState } from 'react';
import { StyleSheet, Text, Pressable, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const PRIVACY_URL = 'https://asscubo.it/privacy.html';

export default function PrivacyScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // 每次进入页面都生成新时间戳，强制跳过缓存
  const [url, setUrl] = useState(`${PRIVACY_URL}?t=${Date.now()}`);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={{
            width: 10,
            height: 10,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: colors.primaryLight,
            transform: [{ rotate: '45deg' }],
            marginHorizontal: 8,
            marginVertical: 4,
          }} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>隐私政策 / Privacy Policy</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* WebView */}
      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          cacheEnabled={false}
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />

        {/* Loading overlay */}
        {loading && !error && (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primaryLight} />
          </View>
        )}

        {/* Error overlay */}
        {error && (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
              无法加载页面，请检查网络连接。{'\n'}
              Unable to load page. Please check your connection.
            </Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: colors.primaryLight }]}
              onPress={() => { setError(false); setLoading(true); setUrl(`${PRIVACY_URL}?t=${Date.now()}`); }}
            >
              <Text style={styles.retryText}>重试 / Retry</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerPlaceholder: { width: 50 },
  webviewContainer: { flex: 1 },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
