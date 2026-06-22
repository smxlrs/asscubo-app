import { Stack } from 'expo-router';

export default function AboutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
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
