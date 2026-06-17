import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

function TabIcon({ label, icon, focused, activeColor, inactiveColor }: { label: string; icon: string; focused: boolean; activeColor: string; inactiveColor: string }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: focused ? activeColor : inactiveColor, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, t } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('home')} icon="🏠" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('notifications')} icon="📢" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('tools')} icon="🛠️" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label={t('profile')} icon="👤" focused={focused} activeColor={colors.primary} inactiveColor={colors.textMuted} />
          ),
        }}
      />
    </Tabs>
  );
}
