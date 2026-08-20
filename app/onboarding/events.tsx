import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';

import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

export default function EventsOnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <OnboardingPage
      icon={Trophy}
      iconTone={theme.colors.secondary}
      title={t.onboarding.eventsTitle}
      body={t.onboarding.eventsBody}
      step={3}
      totalSteps={5}
      primaryLabel={t.common.next}
      onPrimary={() => router.push('/onboarding/privacy')}
      topRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding/privacy')} hitSlop={10}>
          <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.common.skip}</Text>
        </Pressable>
      }
    />
  );
}
