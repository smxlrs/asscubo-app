import { Stack } from 'expo-router';

export default function AboutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="association" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="feedback" />
    </Stack>
  );
}
