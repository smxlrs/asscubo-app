import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as QuickActions from 'expo-quick-actions';

export interface QuickActionConfig {
  id: string;
  titleKey: string;
  subtitleKey: string;
  href: string;
  iosIcon: string;
  androidIcon: string;
}

export const ALL_QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: 'dictionary',
    titleKey: 'quickAction_dictionary',
    subtitleKey: 'quickAction_dictionary_desc',
    href: '/tools/dictionary',
    iosIcon: 'symbol:book.closed.fill',
    androidIcon: 'ic_menu_search',
  },
  {
    id: 'bus',
    titleKey: 'quickAction_bus',
    subtitleKey: 'quickAction_bus_desc',
    href: '/tools/bus',
    iosIcon: 'symbol:bus.fill',
    androidIcon: 'ic_menu_mylocation',
  },
  {
    id: 'handbook',
    titleKey: 'quickAction_handbook',
    subtitleKey: 'quickAction_handbook_desc',
    href: '/tools/handbook',
    iosIcon: 'symbol:doc.text.fill',
    androidIcon: 'ic_menu_info_details',
  },
  {
    id: 'train',
    titleKey: 'quickAction_train',
    subtitleKey: 'quickAction_train_desc',
    href: '/tools/train',
    iosIcon: 'symbol:tram.fill',
    androidIcon: 'ic_menu_directions',
  },
  {
    id: 'classroom',
    titleKey: 'quickAction_classroom',
    subtitleKey: 'quickAction_classroom_desc',
    href: '/tools/classroom',
    iosIcon: 'symbol:square.grid.2x2.fill',
    androidIcon: 'ic_menu_agenda',
  },
  {
    id: 'studyroom',
    titleKey: 'quickAction_studyroom',
    subtitleKey: 'quickAction_studyroom_desc',
    href: '/tools/studyroom',
    iosIcon: 'symbol:calendar.fill',
    androidIcon: 'ic_menu_sort_by_size',
  },
  {
    id: 'articles',
    titleKey: 'quickAction_articles',
    subtitleKey: 'quickAction_articles_desc',
    href: '/(tabs)/notifications',
    iosIcon: 'symbol:newspaper.fill',
    androidIcon: 'ic_menu_view_list_alt',
  },
  {
    id: 'announcements',
    titleKey: 'quickAction_announcements',
    subtitleKey: 'quickAction_announcements_desc',
    href: '/(tabs)/announcements',
    iosIcon: 'symbol:bell.fill',
    androidIcon: 'ic_menu_notifications',
  },
  {
    id: 'settings',
    titleKey: 'quickAction_settings',
    subtitleKey: 'quickAction_settings_desc',
    href: '/settings',
    iosIcon: 'symbol:gearshape.fill',
    androidIcon: 'ic_menu_manage',
  },
];

export const DEFAULT_QUICK_ACTIONS = ['dictionary', 'bus', 'handbook', 'settings'];
const STORAGE_KEY = '@ag_quick_actions';

/**
 * Get the saved quick action IDs from AsyncStorage.
 * Falls back to DEFAULT_QUICK_ACTIONS if not set.
 */
export async function getSavedQuickActionIds(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load quick actions configuration:', e);
  }
  return DEFAULT_QUICK_ACTIONS;
}

/**
 * Save quick action IDs to AsyncStorage.
 */
export async function saveQuickActionIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save quick actions configuration:', e);
  }
}

/**
 * Map IDs to expo-quick-actions format and register them on the device.
 */
export function registerQuickActions(ids: string[], t: (key: string) => string): void {
  try {
    const items = ids
      .map(id => {
        const config = ALL_QUICK_ACTIONS.find(a => a.id === id);
        if (!config) return null;

        return {
          id: config.id,
          title: t(config.titleKey),
          subtitle: t(config.subtitleKey),
          icon: Platform.OS === 'ios' ? config.iosIcon : config.androidIcon,
          params: { href: config.href },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    QuickActions.setItems(items);
  } catch (e) {
    console.warn('Failed to set native quick actions:', e);
  }
}
