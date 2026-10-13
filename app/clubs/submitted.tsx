import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';

/** Shown after a club application is accepted by the server (status pending_review). */
export default function ClubSubmittedScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.clubs.submittedTitle} fallbackRoute="/clubs" />
      <View style={{ flex: 1, padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <CheckCircle2 size={56} color={theme.colors.primary} strokeWidth={1.75} />
        <Text style={[theme.text('heading3'), { textAlign: 'center' }]}>{t.clubs.submittedBody}</Text>
        <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
          {id ? <Button label={t.clubs.viewApplication} onPress={() => router.replace(`/clubs/${id}`)} fullWidth /> : null}
          <Button label={t.clubs.myClubs} onPress={() => router.replace('/clubs/mine')} variant="outline" fullWidth />
        </View>
      </View>
    </View>
  );
}
