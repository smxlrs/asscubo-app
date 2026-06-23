import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Defer the replacement to the next tick, ensuring the native stack 
    // container has completed its initial mounting phase before popping.
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    // Render a background color matching the splash screen (#B8362C)
    // to provide a seamless visual transition during the quick redirect.
    <View style={{ flex: 1, backgroundColor: '#B8362C' }} />
  );
}

