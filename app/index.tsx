import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { SplashView } from '@/features/splash/SplashView';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { routeAfterAuth } from '@/features/auth/routeAfterAuth';

/**
 * Launch router. Decides from the REAL Supabase session (restored from
 * secure storage by supabase-js), not from local flags: no session → sign
 * in; session → load the resident's server state and continue where they
 * left off (profile → neighborhood → app).
 */
export default function SplashRedirect() {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const minDelay = new Promise((r) => setTimeout(r, 700));
    (async () => {
      const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      const session = data.session;
      let target: Parameters<typeof router.replace>[0];
      if (!session) {
        target = useStore.getState().session.onboardingCompleted ? '/(auth)/sign-in' : '/onboarding/welcome';
      } else {
        const provider = session.user.app_metadata?.provider;
        useStore
          .getState()
          .setSupabaseAuth(session.user.id, provider === 'apple' || provider === 'google' ? provider : 'email', session.user.email);
        target = await routeAfterAuth();
      }
      await minDelay;
      if (alive) router.replace(target);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once at launch
  }, []);

  return <SplashView />;
}
