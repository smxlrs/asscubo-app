import { Stack } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';

export default function SettingsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ 
      headerShown: false, 
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: colors.background }
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="theme" />
      <Stack.Screen name="language" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="tab-bar" />
      <Stack.Screen name="back-navigation" />
    </Stack>
  );
}
