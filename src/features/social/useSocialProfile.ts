import { useCallback, useEffect, useState } from 'react';

import { fetchSocialProfile, type SocialProfile } from '@/backend/social';
import { useSocialStore } from '@/backend/socialState';

/** Loads the social profile card. status 'unavailable' = backend not deployed; 'hidden' = not visible to you. */
export function useSocialProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'hidden' | 'unavailable' | 'error'>('loading');

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const p = await fetchSocialProfile(userId);
      setProfile(p);
      setStatus(p ? 'ready' : 'hidden');
    } catch {
      setStatus(useSocialStore.getState().available === false ? 'unavailable' : 'error');
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, status, reload, setProfile };
}
