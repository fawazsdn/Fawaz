import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CalendarDays, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import type { Club } from '@/models';
import { localizeDigits } from '@/utils/format';
import { Badge } from '@/components/Badge';
import { CLUB_ICON, clubCategoryLabel, clubUpcomingEvents } from './clubLogic';

interface Props {
  club: Club;
  /** Horizontal carousel variant. */
  compact?: boolean;
  /** Shown for the resident's own applications (pending, changes requested...). */
  showStatus?: boolean;
}

export function ClubCard({ club, compact, showStatus }: Props) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const events = useStore((s) => s.events);
  const upcoming = clubUpcomingEvents(events, club.id).length;
  const label = clubCategoryLabel(club, t.clubs.categories as Record<string, string>);
  const statusTone =
    club.reviewStatus === 'approved'
      ? 'success'
      : club.reviewStatus === 'rejected' || club.reviewStatus === 'suspended'
        ? 'danger'
        : 'warning';

  return (
    <Pressable
      onPress={() => router.push(`/clubs/${club.id}`)}
      accessibilityRole="link"
      accessibilityLabel={club.name}
      style={({ pressed }) => [
        styles.card,
        compact && { width: 240 },
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {club.coverImage ? (
        <Image
          source={{ uri: club.coverImage }}
          style={{ width: '100%', height: compact ? 96 : 120 }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.tile, { height: compact ? 72 : 88, backgroundColor: theme.colors.successSurface }]}>
          <Text style={{ fontSize: compact ? 30 : 36 }}>{CLUB_ICON[club.category] ?? '✨'}</Text>
        </View>
      )}
      <View style={[theme.row(), { padding: 12, gap: 10, alignItems: 'flex-start' }]}>
        {club.logo ? (
          <Image source={{ uri: club.logo }} style={[styles.logo, { borderColor: theme.colors.border }]} contentFit="cover" />
        ) : null}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={theme.text('title')} numberOfLines={1}>
            {club.name}
          </Text>
          <View style={[theme.row(), { gap: 6, flexWrap: 'wrap' }]}>
            <Badge label={`${CLUB_ICON[club.category] ?? ''} ${label}`} tone="neutral" />
            {showStatus && club.reviewStatus !== 'approved' ? <Badge label={t.clubs.status[club.reviewStatus]} tone={statusTone} /> : null}
          </View>
          {!compact && club.description ? (
            <Text style={theme.text('bodySmall', theme.colors.textSecondary)} numberOfLines={2}>
              {club.description}
            </Text>
          ) : null}
          {club.reviewStatus === 'approved' ? (
            <View style={[theme.row(), { gap: 14, alignItems: 'center' }]}>
              <View style={[theme.row(), styles.meta]}>
                <Users size={14} color={theme.colors.textMuted} />
                <Text style={theme.text('caption', theme.colors.textMuted)}>
                  {t.clubs.memberCount.replace('{n}', localizeDigits(club.memberCount, locale))}
                </Text>
              </View>
              {upcoming > 0 ? (
                <View style={[theme.row(), styles.meta]}>
                  <CalendarDays size={14} color={theme.colors.primary} />
                  <Text style={theme.text('caption', theme.colors.primary)}>
                    {t.clubs.upcomingCount.replace('{n}', localizeDigits(upcoming, locale))}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tile: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  meta: { alignItems: 'center', gap: 4 },
});
