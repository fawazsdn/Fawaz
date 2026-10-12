import type { Href } from 'expo-router';

import { requestSync } from '@/backend/sync';
import { useStore } from '@/store/useStore';

/**
 * After any successful sign-in/up, load the resident's real server state
 * (profile completion + active neighborhood membership) and decide where to
 * go. Existing accounts land straight in the app with their data intact.
 */
export async function routeAfterAuth(): Promise<Href> {
  await requestSync();
  const { session } = useStore.getState();
  if (!session.profileCreated) return '/(auth)/profile-setup';
  if (!session.neighborhoodId) return '/(auth)/select-city';
  return '/(tabs)';
}
