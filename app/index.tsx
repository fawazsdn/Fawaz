import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { SplashView } from '@/features/splash/SplashView';
import { useStore } from '@/store/useStore';

export default function SplashRedirect() {
  const router = useRouter();
  const session = useStore((s) => s.session);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!session.onboardingCompleted) {
        router.replace('/onboarding/welcome');
      } else if (!session.isAuthenticated) {
        router.replace('/(auth)/phone');
      } else if (!session.profileCreated) {
        router.replace('/(auth)/profile-setup');
      } else if (!session.cityId) {
        router.replace('/(auth)/select-city');
      } else if (!session.neighborhoodId) {
        router.replace('/(auth)/select-neighborhood');
      } else {
        router.replace('/(tabs)');
      }
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <SplashView />;
}
