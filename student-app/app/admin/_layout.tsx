import React, { useEffect } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AdminPermission } from '../../lib/adminPermissions';

const ROUTE_PERMISSIONS: Record<string, AdminPermission | AdminPermission[]> = {
  '/admin/notification': 'notifications.publish',
  '/admin/wechat-import': 'articles.sync',
  '/admin/wechat-sync': 'articles.sync',
  '/admin/manage-articles': 'articles.manage',
  '/admin/manage-notifications': 'notifications.manage',
  '/admin/manage-handbook': 'handbook.manage',
  '/admin/handbook-editor': 'handbook.manage',
  '/admin/manage-feedbacks': 'feedback.manage',
  '/admin/manage-users': ['users.moderate', 'users.delete'],
};

export default function AdminLayout() {
  const { user, profile, loading, hasAdminPermission } = useAuth();
  const { colors } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user || !profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
        // Not authorized, redirect to home tab immediately
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, loading]);

  useEffect(() => {
    if (loading || !profile || pathname === '/admin') return;

    if (pathname.startsWith('/admin/manage-user/')) {
      const authorized = hasAdminPermission('users.moderate') || hasAdminPermission('users.delete');
      if (!authorized) router.replace('/admin');
      return;
    }

    const requirement = ROUTE_PERMISSIONS[pathname];
    if (!requirement) return;
    const authorized = Array.isArray(requirement)
      ? requirement.some(hasAdminPermission)
      : hasAdminPermission(requirement);
    if (!authorized) router.replace('/admin');
  }, [hasAdminPermission, loading, pathname, profile]);

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

  return (
    <Stack screenOptions={{ 
      headerShown: false, 
      animation: 'slide_from_right',
      contentStyle: { backgroundColor: colors.background }
    }} />
  );
}
