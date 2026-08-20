import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';

import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

export default function CommunityScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <OnboardingPage
      icon={MessageCircle}
      iconTone={theme.colors.info}
      title={t.onboarding.communityTitle}
      body={t.onboarding.communityBody}
      step={1}
      totalSteps={5}
      primaryLabel={t.common.next}
      onPrimary={() => router.push('/onboarding/help')}
      topRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding/help')} hitSlop={10}>
          <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.common.skip}</Text>
        </Pressable>
      }
    />
  );
}
