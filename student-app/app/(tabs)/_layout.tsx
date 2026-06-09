import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONTS } from '../../constants/theme';

function TabIcon({ emoji, focused, label }: { emoji: string; focused: boolean; label: string }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const { session, loading } = useAuth();

  if (!loading && !session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} label="首页" />,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📢" focused={focused} label="公告" />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} label="活动" />,
        }}
      />
      <Tabs.Screen
        name="handbook"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📖" focused={focused} label="手册" />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} label="社群" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} label="我的" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
  },
  tabIconActive: {
    backgroundColor: COLORS.primarySoft,
  },
  tabEmoji: { fontSize: 20 },
  tabLabel: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.medium,
  },
});
