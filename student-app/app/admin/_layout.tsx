import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export default function AdminLayout() {
  const { user, profile, loading } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading) {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        // Not authorized, redirect to home tab immediately
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Only render children stack when authenticated and role is admin or super_admin
  if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
