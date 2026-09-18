import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

/**
 * Keeps the local session store in sync with the real Supabase auth session:
 * restores it on cold start, and reacts to sign-out / expiry events that can
 * happen while the app is running (e.g. a revoked or expired refresh token).
 * Only Apple/Google sessions are affected — the still-present local
 * phone/OTP flow never creates a Supabase session, so it's untouched here.
 */
export function useSupabaseSessionSync() {
  const setSupabaseAuth = useStore((s) => s.setSupabaseAuth);
  const signOut = useStore((s) => s.signOut);
  const authProvider = useStore((s) => s.session.authProvider);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const session = data.session;
      if (session) {
        const provider = session.user.app_metadata?.provider;
        setSupabaseAuth(session.user.id, provider === 'apple' ? 'apple' : 'google');
      } else if (authProvider === 'apple' || authProvider === 'google') {
        // locally "authenticated" but the real Supabase session is gone (expired/revoked) — don't fake it
        signOut();
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        signOut();
        return;
      }
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const provider = session.user.app_metadata?.provider;
        setSupabaseAuth(session.user.id, provider === 'apple' ? 'apple' : 'google');
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once; store actions are stable
  }, []);
}
