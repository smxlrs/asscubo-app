import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import UsageAnalyticsScreen from '../../components/admin/UsageAnalyticsScreen';

export default function UsageAnalyticsUserScreen() {
  const { userId, days } = useLocalSearchParams<{ userId?: string; days?: string }>();
  if (typeof userId !== 'string' || !userId) return <Redirect href="/admin/usage-analytics" />;
  const period = Number(days);
  return <UsageAnalyticsScreen key={userId} detailUserId={userId} initialDays={[7, 30, 90].includes(period) ? period : 7} />;
}
