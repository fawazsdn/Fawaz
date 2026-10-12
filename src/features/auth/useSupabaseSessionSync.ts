import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { requestSync, startRealtime, stopRealtime } from '@/backend/sync';
import { clearMediaCache } from '@/backend/media';

function providerOf(user: { app_metadata?: { provider?: string } }) {
  const p = user.app_metadata?.provider;
  return p === 'apple' || p === 'google' ? p : 'email';
}

/**
 * Keeps the app in lock-step with the real Supabase auth session:
 * - restores it on cold start (persisted securely by supabase-js),
 * - reacts to sign-in / sign-out / token refresh / revocation,
 * - loads the resident's data and subscribes to realtime while signed in,
 * - refreshes when the app returns to the foreground.
 * There is no local-only "logged in" state: no Supabase session, no access.
 */
export function useSupabaseSessionSync() {
  const userId = useStore((s) => s.session.supabaseUserId);
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const session = data.session;
      const store = useStore.getState();
      if (session) {
        store.setSupabaseAuth(session.user.id, providerOf(session.user), session.user.email);
      } else if (store.session.isAuthenticated || store.session.supabaseUserId) {
        store.signOut();
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const store = useStore.getState();
      if (event === 'SIGNED_OUT') {
        stopRealtime();
        clearMediaCache();
        store.signOut();
        return;
      }
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
        store.setSupabaseAuth(session.user.id, providerOf(session.user), session.user.email);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Load real data + realtime for the signed-in resident.
  useEffect(() => {
    if (!userId) return;
    void requestSync();
    startRealtime(userId, neighborhoodId);
    return () => stopRealtime();
  }, [userId, neighborhoodId]);

  // Refresh on foreground (realtime can miss events while suspended).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useStore.getState().session.supabaseUserId) void requestSync();
    });
    return () => sub.remove();
  }, []);
}
