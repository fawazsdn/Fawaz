import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { haptics } from '@/utils/haptics';

/** Compact Home entry point into the full Invites & Rewards screen — the
 * primary growth surface (see app/invite/index.tsx). */
export function InviteNeighborhoodCard() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        router.push('/invite');
      }}
      accessibilityRole="button"
      accessibilityLabel={t.home.inviteBannerTitle}
      style={({ pressed }) => [
        theme.row(),
        {
          alignItems: 'center',
          gap: 12,
          padding: 14,
          backgroundColor: theme.colors.successSurface,
          borderRadius: theme.radii.lg,
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
          backgroundColor: theme.colors.accent + '33',
        }}
      >
        <Users size={19} color={theme.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={theme.text('title')}>{t.home.inviteBannerTitle}</Text>
        <Text style={theme.text('caption', theme.colors.textSecondary)} numberOfLines={1}>
          {t.home.inviteBannerBody}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.primary,
        }}
      >
        <Text style={theme.text('button', theme.colors.onPrimary)}>{t.home.inviteBannerCta}</Text>
      </View>
    </Pressable>
  );
}
