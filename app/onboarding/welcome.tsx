import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Home } from 'lucide-react-native';

import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t, toggleLocale } = useI18n();

  return (
    <OnboardingPage
      icon={Home}
      title={t.onboarding.welcomeTitle}
      body={t.onboarding.welcomeBody}
      step={0}
      totalSteps={5}
      primaryLabel={t.onboarding.start}
      onPrimary={() => router.push('/onboarding/community')}
      topRight={
        <Pressable accessibilityRole="button" onPress={toggleLocale} hitSlop={10}>
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.onboarding.switchToEnglish}</Text>
        </Pressable>
      }
    />
  );
}
