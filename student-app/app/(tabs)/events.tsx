import React from 'react';
import { Redirect } from 'expo-router';

// Keep the legacy tab route compatible while using the dedicated tools module.
export default function LegacyEventsRoute() {
  return <Redirect href="/tools/events" />;
}
