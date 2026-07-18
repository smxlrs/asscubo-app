import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';

const DELETE_ACCOUNT_URL = 'https://asscubo.it/delete-account';

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [url, setUrl] = useState(`${DELETE_ACCOUNT_URL}?t=${Date.now()}`);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View
            style={{
              width: 10,
              height: 10,
              borderLeftWidth: 2,
              borderBottomWidth: 2,
              borderColor: colors.primaryLight,
              transform: [{ rotate: '45deg' }],
              marginHorizontal: 8,
              marginVertical: 4,
            }}
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>删除账号与相关数据</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          cacheEnabled={false}
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />

        {loading && !error && (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primaryLight} />
          </View>
        )}

        {error && (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>Unable to load page. Please check your connection.</Text>
            <Pressable
              style={[styles.retryButton, { backgroundColor: colors.primaryLight }]}
              onPress={() => { setError(false); setLoading(true); setUrl(`${DELETE_ACCOUNT_URL}?t=${Date.now()}`); }}
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  errorText: { fontSize: 15, textAlign: 'center', lineHeight: 24 },
  retryButton: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
