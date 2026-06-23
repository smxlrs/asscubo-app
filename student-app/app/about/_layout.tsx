import { ExperimentalStack as Stack } from 'expo-router';

import { useTheme } from '../../context/ThemeContext';

export default function AboutLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ 
      headerShown: false
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="association" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="links" />
      <Stack.Screen name="platforms" />
    </Stack>
  );
}
