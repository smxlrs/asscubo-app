import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  ALL_QUICK_ACTIONS, 
  getSavedQuickActionIds, 
  saveQuickActionIds, 
  registerQuickActions 
} from '../../lib/quickActions';

const MAPPED_ICONS: Record<string, { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string }> = {
  dictionary: { name: 'translate', color: '#3B82F6' },
  bus: { name: 'bus', color: '#10B981' },
  handbook: { name: 'book-open-page-variant', color: '#EC4899' },
  train: { name: 'train', color: '#EF4444' },
  classroom: { name: 'school', color: '#8B5CF6' },
  studyroom: { name: 'library', color: '#6366F1' },
  articles: { name: 'newspaper-variant-outline', color: '#F59E0B' },
  announcements: { name: 'bell-outline', color: '#14B8A6' },
  settings: { name: 'cog-outline', color: '#6B7280' },
};

export default function QuickActionsSettingsScreen() {
  const { colors, t } = useTheme();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreferences() {
      const ids = await getSavedQuickActionIds();
      setSelectedIds(ids);
      setLoading(false);
    }
    loadPreferences();
  }, []);

  const handleToggle = async (id: string) => {
    const isSelected = selectedIds.includes(id);
    let newSelectedIds: string[];

    if (isSelected) {
      // Trying to deselect
      if (selectedIds.length <= 1) {
        Alert.alert(t('tip'), t('quickActionMinAlert'));
        return;
      }
      newSelectedIds = selectedIds.filter(x => x !== id);
    } else {
      // Trying to select
      if (selectedIds.length >= 4) {
        Alert.alert(t('tip'), t('quickActionMaxAlert'));
        return;
      }
      newSelectedIds = [...selectedIds, id];
    }

    setSelectedIds(newSelectedIds);
    await saveQuickActionIds(newSelectedIds);
    registerQuickActions(newSelectedIds, t);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backArrow, { borderColor: colors.primaryLight }]} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('quickActionSetting')}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.descriptionContainer}>
          <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
            {t('quickActionDescription')}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {ALL_QUICK_ACTIONS.map((action, index, arr) => {
            const isSelected = selectedIds.includes(action.id);
            const iconConfig = MAPPED_ICONS[action.id] || { name: 'help-circle-outline', color: '#6B7280' };

            return (
              <View 
                key={action.id}
                style={[
                  styles.row, 
                  { 
                    borderBottomColor: colors.border,
                    borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth 
                  }
                ]}
              >
                <View style={styles.iconWrapper}>
                  <MaterialCommunityIcons name={iconConfig.name} size={22} color={iconConfig.color} />
                </View>
                <View style={styles.labelCol}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t(action.titleKey)}</Text>
                  <Text style={[styles.rowSubLabel, { color: colors.textSecondary }]}>{t(action.subtitleKey)}</Text>
                </View>
                <Switch
                  value={isSelected}
                  onValueChange={() => handleToggle(action.id)}
                  trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
                  thumbColor={isSelected ? colors.primaryLight : '#F3F4F6'}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  descriptionContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  labelCol: {
    flex: 1,
    paddingRight: 16,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSubLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
});
