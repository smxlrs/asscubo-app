import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Share, FlatList, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLogs, LogEntry } from '../../lib/logger';

export default function LogsScreen() {
  const { colors, t } = useTheme();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Load logs using getLogs helper
    setLogs([...getLogs()].reverse());
  }, []);

  const handleClear = () => {
    const logsList = getLogs();
    logsList.length = 0; // Clear the array in-place
    setLogs([]);
  };

  const handleDisableDebugMode = async () => {
    try {
      await AsyncStorage.setItem('@ag_debug_mode', 'false');
      router.back();
    } catch (e) {
      console.warn('Failed to disable debug mode:', e);
    }
  };

  const handleShare = async () => {
    if (logs.length === 0) return;
    const logString = logs
      .map(log => `[${log.time}] [${log.type.toUpperCase()}] ${log.message}`)
      .reverse()
      .join('\n');
    try {
      await Share.share({
        title: 'App Debug Logs',
        message: logString,
      });
    } catch (e) {
      console.warn('Failed to share logs:', e);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const padMs = (n: number) => n.toString().padStart(3, '0');
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${padMs(d.getMilliseconds())}`;
    } catch (e) {
      return isoString;
    }
  };

  const getLogColor = (type: 'log' | 'warn' | 'error') => {
    if (type === 'error') return '#EF4444';
    if (type === 'warn') return '#F59E0B';
    return colors.textPrimary;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>调试日志</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item, index) => `${item.time}-${index}`}
        renderItem={({ item }) => (
          <View style={[styles.logRow, { borderBottomColor: colors.border }]}>
            <View style={styles.logHeader}>
              <Text style={[styles.logTime, { color: colors.textMuted }]}>{formatTime(item.time)}</Text>
              <Text style={[styles.logType, { color: getLogColor(item.type) }]}>
                {item.type.toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.logMessage, { color: getLogColor(item.type) }]} selectable>
              {item.message}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary }}>暂无日志信息</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Footer Actions */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable 
          style={[styles.footerButton, { backgroundColor: colors.border }]} 
          onPress={handleClear}
        >
          <Text style={[styles.buttonText, { color: colors.textPrimary }]}>清空日志</Text>
        </Pressable>
        <Pressable 
          style={[styles.footerButton, { backgroundColor: colors.primaryLight }]} 
          onPress={handleShare}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>分享日志</Text>
        </Pressable>
        <Pressable 
          style={[styles.footerButton, { backgroundColor: '#EF4444' }]} 
          onPress={handleDisableDebugMode}
        >
          <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>关闭调试模式</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backArrow: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: 8,
    marginVertical: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  logRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTime: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  logType: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  logMessage: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  footer: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
