import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { HeartHandshake } from 'lucide-react-native';

import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

export default function HelpScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <OnboardingPage
      icon={HeartHandshake}
      iconTone={theme.colors.warning}
      title={t.onboarding.helpTitle}
      body={t.onboarding.helpBody}
      step={2}
      totalSteps={5}
      primaryLabel={t.common.next}
      onPrimary={() => router.push('/onboarding/events')}
      topRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding/events')} hitSlop={10}>
          <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.common.skip}</Text>
        </Pressable>
      }
    />
  );
}
