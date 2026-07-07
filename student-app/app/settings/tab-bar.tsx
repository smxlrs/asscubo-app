import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassBackground } from '../../components/GlassBackground';

const OPACITY_LEVELS = [1, 2, 3, 4];
const THUMB_SIZE = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function OpacityLevelSlider({
  level,
  onLevelPreview,
  onLevelChange,
  colors,
}: {
  level: number;
  onLevelPreview: (level: number) => void;
  onLevelChange: (level: number) => void;
  colors: any;
}) {
  const [trackWidth, setTrackWidth] = React.useState(0);
  const draggingRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const draftLevelRef = React.useRef(level);
  const levelRef = React.useRef(level);
  const onLevelPreviewRef = React.useRef(onLevelPreview);
  const onLevelChangeRef = React.useRef(onLevelChange);
  const usableWidthRef = React.useRef(1);
  const xRef = React.useRef(0);

  React.useEffect(() => {
    levelRef.current = level;
    onLevelPreviewRef.current = onLevelPreview;
    onLevelChangeRef.current = onLevelChange;
  }, [level, onLevelPreview, onLevelChange]);

  React.useEffect(() => {
    if (!draggingRef.current) {
      draftLevelRef.current = level;
    }
  }, [level]);

  const usableWidth = Math.max(1, trackWidth - THUMB_SIZE);
  const x = ((level - 1) / 3) * usableWidth;
  const progress = usableWidth > 0 ? x / usableWidth : 0;

  React.useEffect(() => {
    usableWidthRef.current = usableWidth;
    xRef.current = x;
  }, [usableWidth, x]);

  const panResponder = React.useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      draggingRef.current = true;
      startXRef.current = xRef.current;
      draftLevelRef.current = levelRef.current;
    },
    onPanResponderMove: (_, gestureState) => {
      const usable = usableWidthRef.current;
      const clampedX = clamp(startXRef.current + gestureState.dx, 0, usable);
      const nextLevel = 1 + (clampedX / usable) * 3;
      draftLevelRef.current = nextLevel;
      onLevelPreviewRef.current(nextLevel);
    },
    onPanResponderRelease: () => {
      draggingRef.current = false;
      const snappedLevel = clamp(Math.round(draftLevelRef.current), 1, 4);
      draftLevelRef.current = snappedLevel;
      onLevelPreviewRef.current(snappedLevel);
      onLevelChangeRef.current(snappedLevel);
    },
    onPanResponderTerminate: () => {
      draggingRef.current = false;
      const snappedLevel = clamp(Math.round(draftLevelRef.current), 1, 4);
      draftLevelRef.current = snappedLevel;
      onLevelPreviewRef.current(snappedLevel);
      onLevelChangeRef.current(snappedLevel);
    },
  })).current;

  return (
    <View
      style={styles.opacitySlider}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View style={[styles.opacityTrack, { left: THUMB_SIZE / 2, right: THUMB_SIZE / 2, backgroundColor: colors.border }]}>
        <View style={[styles.opacityTrackFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
        <View style={styles.opacityTicks}>
          {OPACITY_LEVELS.map((item) => (
            <View
              key={item}
              style={[
                styles.opacityTick,
                {
                  backgroundColor: item <= Math.round(level) ? colors.primary : colors.surfaceElevated,
                  borderColor: item <= Math.round(level) ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>
      <View
        style={[
          styles.opacityThumb,
          {
            left: x,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          },
        ]}
      />
      <View style={styles.opacityLabels}>
        {OPACITY_LEVELS.map((item) => (
          <Text
            key={item}
            style={[
              styles.opacityLabel,
              { color: item === Math.round(level) ? colors.primary : colors.textSecondary },
            ]}
          >
            {item}
          </Text>
        ))}
      </View>
    </View>
  );
}

function GlassOpacityPreview({
  level,
  colors,
  isDark,
}: {
  level: number;
  colors: any;
  isDark: boolean;
}) {
  const displayLevel = clamp(Math.round(level), 1, 4);
  const sliderLevel = Math.min(5, displayLevel + 1);

  return (
    <View style={styles.previewWrap}>
      <View style={[styles.previewStage, { backgroundColor: isDark ? '#111111' : '#F3F4F6' }]}>
        <Text style={[styles.previewGhostText, { color: isDark ? '#F5F5F5' : '#1D2939' }]}>
          预览文字从玻璃下方经过
        </Text>
        <View style={styles.previewDock}>
          <GlassBackground
            key={`dock-${displayLevel}`}
            borderRadius={22}
            isDark={isDark}
            blurStep={displayLevel}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.previewDockTint,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.20)' },
            ]}
          />
          <View style={[styles.previewSlider, { shadowColor: colors.primary }]}>
            <GlassBackground
              key={`slider-${sliderLevel}`}
              borderRadius={18}
              isDark={isDark}
              blurStep={sliderLevel}
            />
            <View style={[StyleSheet.absoluteFill, styles.previewSliderTint]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function TabBarSettingsScreen() {
  const { colors, t, isDark, tabBarStyle, setTabBarStyle, glassOpacityLevel, setGlassOpacityLevel } = useTheme();
  const [draftGlassOpacityLevel, setDraftGlassOpacityLevel] = React.useState(glassOpacityLevel);

  React.useEffect(() => {
    setDraftGlassOpacityLevel(glassOpacityLevel);
  }, [glassOpacityLevel]);

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('tabBarSetting')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.sectionHeaderContainer}>
          <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{t('tabBarSetting')}</Text>
        </View>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {([
            { id: 'traditional', label: t('tabBarTraditional') },
            { id: 'glassmorphism', label: t('tabBarGlassmorphism') }
          ] as { id: 'traditional' | 'glassmorphism'; label: string }[]).map((opt, index, arr) => (
            <Pressable 
              key={opt.id}
              style={[
                styles.rowPressable, 
                { 
                  borderBottomColor: colors.border,
                  borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth 
                }
              ]} 
              onPress={() => setTabBarStyle(opt.id)}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
              {tabBarStyle === opt.id && (
                <Text style={[styles.checkmark, { color: colors.primaryLight }]}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>

        {tabBarStyle === 'glassmorphism' && (
          <>
            <View style={styles.sectionHeaderContainer}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>透明度</Text>
            </View>
            <View style={[styles.section, styles.opacitySection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.opacityHeader}>
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>液态玻璃透明度</Text>
              </View>
              <GlassOpacityPreview
                level={draftGlassOpacityLevel}
                colors={colors}
                isDark={isDark}
              />
              <OpacityLevelSlider
                level={draftGlassOpacityLevel}
                onLevelPreview={setDraftGlassOpacityLevel}
                onLevelChange={setGlassOpacityLevel}
                colors={colors}
              />
            </View>
          </>
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
  rowValue: {
    fontSize: 13,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  opacitySection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  opacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewWrap: {
    marginBottom: 16,
  },
  previewStage: {
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  previewGhostText: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 26,
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.7,
  },
  previewDock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  previewSlider: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: '25%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  previewDockTint: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.60)',
  },
  previewSliderTint: {
    backgroundColor: 'rgba(174, 174, 178, 0.18)',
  },
  previewCaption: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
  },
  opacitySlider: {
    height: 56,
    justifyContent: 'flex-start',
  },
  opacityTrack: {
    position: 'absolute',
    top: 12,
    height: 6,
    borderRadius: 3,
  },
  opacityTrackFill: {
    height: 6,
    borderRadius: 3,
  },
  opacityTicks: {
    position: 'absolute',
    top: 0,
    right: -5,
    bottom: 0,
    left: -5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opacityTick: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  opacityThumb: {
    position: 'absolute',
    top: 7,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 2,
  },
  opacityLabels: {
    position: 'absolute',
    left: THUMB_SIZE / 2 - 4,
    right: THUMB_SIZE / 2 - 4,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opacityLabel: {
    width: 8,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
