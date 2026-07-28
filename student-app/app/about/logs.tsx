import React, { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { appAlert as Alert } from '../../lib/appAlert';
import { useTheme } from '../../context/ThemeContext';
import {
  buildLogFileContent,
  clearLogs,
  loadLogs,
  LogEntry,
  setDebugLoggingEnabled,
} from '../../lib/logger';

export default function LogsScreen() {
  const { colors } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const refreshLogs = useCallback(async () => {
    const entries = await loadLogs();
    setLogs([...entries].reverse());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshLogs();
    }, [refreshLogs])
  );

  const handleClear = async () => {
    await clearLogs();
    setLogs([]);
  };

  const handleDisableDebugMode = async () => {
    try {
      await setDebugLoggingEnabled(false);
      router.back();
    } catch (error) {
      console.warn('Failed to disable debug mode:', error);
    }
  };

  const handleExport = async () => {
    if (logs.length === 0) {
      Alert.alert('暂无日志', '请先复现问题，再导出调试日志。');
      return;
    }

    try {
      const fileName = `boxue-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, buildLogFileContent(), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('无法分享', '当前设备不支持系统文件分享。');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        dialogTitle: '导出博学调试日志',
        mimeType: 'text/plain',
        UTI: 'public.plain-text',
      });
    } catch (error) {
      console.warn('Failed to export logs:', error);
      Alert.alert('导出失败', '日志文件未能生成，请稍后重试。');
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    const pad = (value: number, width = 2) => value.toString().padStart(width, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  };

  const getLogColor = (type: LogEntry['type']) => {
    if (type === 'error') return '#EF4444';
    if (type === 'warn') return '#F59E0B';
    return colors.textPrimary;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>调试日志</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.logRow, { borderBottomColor: colors.border }]}>
            <View style={styles.logHeader}>
              <Text style={[styles.logTime, { color: colors.textMuted }]}>{formatTime(item.time)}</Text>
              <Text style={[styles.logType, { color: getLogColor(item.type) }]}>
                {item.type.toUpperCase()} · {item.category}
              </Text>
            </View>
            <Text style={[styles.logMessage, { color: getLogColor(item.type) }]} selectable>{item.message}</Text>
            {item.details ? <Text style={[styles.logDetails, { color: colors.textSecondary }]} selectable>{item.details}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<View style={styles.center}><Text style={{ color: colors.textSecondary }}>暂无日志信息</Text></View>}
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable style={[styles.footerButton, { backgroundColor: colors.border }]} onPress={handleClear}>
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>清空</Text>
        </Pressable>
        <Pressable style={[styles.footerButton, { backgroundColor: colors.primaryLight }]} onPress={handleExport}>
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>导出文件</Text>
        </Pressable>
        <Pressable style={[styles.footerButton, { backgroundColor: '#EF4444' }]} onPress={handleDisableDebugMode}>
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>关闭调试</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { padding: 40, justifyContent: 'center', alignItems: 'center' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1 },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  backArrow: { width: 10, height: 10, borderLeftWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }], marginHorizontal: 8, marginVertical: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  headerPlaceholder: { width: 50 },
  listContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  logRow: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  logTime: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  logType: { fontSize: 11, fontWeight: 'bold', textAlign: 'right' },
  logMessage: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 18 },
  logDetails: { marginTop: 4, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 16 },
  footer: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderTopWidth: 1 },
  footerButton: { flex: 1, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  buttonText: { fontSize: 12, fontWeight: '600' },
});
