import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ThemeSettingsScreen() {
  const { 
    colors, 
    t, 
    themeMode, 
    setThemeMode, 
    customStart, 
    setCustomStart, 
    customEnd, 
    setCustomEnd
  } = useTheme();

  const adjustCustomTime = (type: 'start' | 'end', unit: 'hour' | 'min', operation: '+' | '-') => {
    const timeStr = type === 'start' ? customStart : customEnd;
    let [h, m] = timeStr.split(':').map(Number);

    if (unit === 'hour') {
      if (operation === '+') h = (h + 1) % 24;
      else h = (h - 1 + 24) % 24;
    } else {
      if (operation === '+') m = (m + 5) % 60;
      else m = (m - 5 + 60) % 60;
    }

    const paddedH = h.toString().padStart(2, '0');
    const paddedM = m.toString().padStart(2, '0');
    const formatted = `${paddedH}:${paddedM}`;

    if (type === 'start') {
      setCustomStart(formatted);
    } else {
      setCustomEnd(formatted);
    }
  };

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('themeSetting')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('themeSetting')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            { id: 'light', label: t('lightMode') },
            { id: 'dark', label: t('darkMode') },
            { id: 'system', label: t('systemMode') },
            { id: 'custom', label: t('customMode') }
          ] as { id: ThemeMode; label: string }[]).map((mode, index, arr) => (
            <Pressable 
              key={mode.id}
              style={[
                styles.rowPressable, 
                { 
                  borderBottomColor: colors.border,
                  borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth
                }
              ]} 
              onPress={() => setThemeMode(mode.id)}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{mode.label}</Text>
              {themeMode === mode.id && (
                <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {themeMode === 'custom' && (
          <View style={[styles.customTimeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.customTimeRangeInfo, { color: colors.textSecondary }]}>
              {t('customTimeRange')}
            </Text>
            
            <View style={styles.timePickerRow}>
              <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>{t('startTime')}</Text>
              <View style={styles.timeControls}>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'hour', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customStart.split(':')[0]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'hour', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
                
                <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
                
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'min', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customStart.split(':')[1]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('start', 'min', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.timePickerRow, { marginTop: 15 }]}>
              <Text style={[styles.timeLabel, { color: colors.textPrimary }]}>{t('endTime')}</Text>
              <View style={styles.timeControls}>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'hour', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customEnd.split(':')[0]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'hour', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
                
                <Text style={[styles.timeSeparator, { color: colors.textSecondary }]}>:</Text>
                
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'min', '-')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>-</Text>
                </Pressable>
                <Text style={[styles.timeText, { color: colors.textPrimary }]}>{customEnd.split(':')[1]}</Text>
                <Pressable style={[styles.timeBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => adjustCustomTime('end', 'min', '+')}>
                  <Text style={[styles.timeBtnText, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
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
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerPlaceholder: {
    width: 50,
  },
  content: {
    flex: 1,
  },
  sectionHeaderContainer: {
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  rowPressable: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowLabel: {
    fontSize: 15,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  customTimeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  customTimeRangeInfo: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeText: {
    width: 32,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeSeparator: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
});
