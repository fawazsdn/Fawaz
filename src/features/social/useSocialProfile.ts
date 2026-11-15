import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { fetchSocialProfile, forgetHiddenProfile, type SocialProfile } from '@/backend/social';
import { useSocialStore } from '@/backend/socialState';
import { useCurrentUserId } from '@/store/useStore';

/**
 * How often an open profile re-checks that it may still be shown. The blocked
 * person can't see block rows (by design), so there is no event to listen to;
 * a short re-check bounds how long a block takes to reach an open screen.
 */
export const PROFILE_RECHECK_MS = 30_000;

/**
 * Loads the social profile card for the active viewer, refreshes it on focus,
 * when the app returns to the foreground, and every PROFILE_RECHECK_MS while
 * the screen is focused.
 */
export function useSocialProfile(userId: string | undefined) {
  const viewer = useCurrentUserId();
  const key = JSON.stringify([viewer, userId]);
  const request = useRef(0);
  const [result, setResult] = useState<{
    key: string;
    profile: SocialProfile | null;
    status: 'ready' | 'hidden' | 'unavailable' | 'error';
  }>();

  const setProfile = useCallback((profile: SocialProfile | null) => {
    setResult({ key, profile, status: profile ? 'ready' : 'hidden' });
  }, [key]);

  const reload = useCallback(async () => {
    if (!userId || !viewer) return;
    const id = ++request.current;
    try {
      const profile = await fetchSocialProfile(userId);
      if (id !== request.current) return;
      setProfile(profile);
      // Hidden by the server (e.g. they blocked you): forget what this device holds.
      if (!profile && userId !== viewer) void forgetHiddenProfile(userId);
    } catch {
      if (id !== request.current) return;
      const status = useSocialStore.getState().available === false ? 'unavailable' : 'error';
      setResult({ key, profile: null, status });
    }
  }, [key, setProfile, userId, viewer]);

  useFocusEffect(useCallback(() => {
    void reload();
    const timer = setInterval(() => void reload(), PROFILE_RECHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => {
      request.current++;
      clearInterval(timer);
      sub.remove();
    };
  }, [reload]));

  const current = result?.key === key ? result : undefined;
  return { profile: current?.profile ?? null, status: current?.status ?? 'loading', reload, setProfile };
}
