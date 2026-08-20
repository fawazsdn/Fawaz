import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';

import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';

export default function PrivacyScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  return (
    <OnboardingPage
      icon={ShieldCheck}
      iconTone={theme.colors.primary}
      title={t.onboarding.privacyTitle}
      body={t.onboarding.privacyBody}
      step={4}
      totalSteps={5}
      primaryLabel={t.onboarding.getStarted}
      onPrimary={() => {
        completeOnboarding();
        router.replace('/(auth)/phone');
      }}
    />
  );
}
