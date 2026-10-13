import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { localizeDigits } from '@/utils/format';

/** Home entry point to Neighbors; shows a real pending-request count when there is one. */
export function MeetNeighborsCard() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useStore((s) => s.session.supabaseUserId ?? '');
  const incoming = useStore((s) => s.neighborRequests.filter((r) => r.recipientId === me && r.status === 'pending').length);
  const Chevron = theme.isRTL ? ChevronLeft : ChevronRight;

  return (
    <Pressable
      onPress={() => router.push(incoming > 0 ? '/neighbors?tab=requests' : '/neighbors')}
      accessibilityRole="button"
      accessibilityLabel={t.neighbors.meet}
      style={({ pressed }) => [
        theme.row(),
        {
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.successSurface,
        }}
      >
        <Users size={20} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={theme.text('title')}>{t.neighbors.meet}</Text>
        <Text style={theme.text('caption', theme.colors.textSecondary)}>
          {incoming > 0 ? `${t.neighbors.requests} · ${localizeDigits(incoming, locale)}` : t.neighbors.meetBody}
        </Text>
      </View>
      <Chevron size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}
