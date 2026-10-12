import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Clock, MapPin, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useUser } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { joinEvent } from '@/backend/actions';
import type { CommunityEvent } from '@/models';
import { displayName, formatClock, formatShortDate, localizeDigits } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

export const CATEGORY_ICON: Record<string, string> = {
  football: '⚽️',
  padel: '🎾',
  walking: '🚶',
  cleanup: '🧹',
  coffee: '☕️',
  iftar: '🌙',
  kids: '🧒',
  family: '👨‍👩‍👧',
  community: '🤝',
};

export function eventState(event: CommunityEvent, now = Date.now()) {
  const going = event.attendees.filter((a) => a.status === 'going').length;
  return {
    going,
    spotsLeft: Math.max(0, event.capacity - going),
    isFull: going >= event.capacity,
    ended: new Date(event.endsAt).getTime() <= now,
    started: new Date(event.startsAt).getTime() <= now,
  };
}

/**
 * Activity/event card. Everything shown is from the event row and its real
 * attendee rows; when the organizer didn't upload a cover photo we show a
 * category tile, never a stock image.
 */
export function EventCard({ event, compact }: { event: CommunityEvent; compact?: boolean }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const { run, pending } = useAction();

  const host = useUser(event.hostId);
  const users = useStore((s) => s.users);
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === event.neighborhoodId));

  const { going, spotsLeft, isFull, ended, started } = eventState(event);
  const mine = event.attendees.find((a) => a.userId === me && (a.status === 'going' || a.status === 'waitlisted'));
  const avatars = event.attendees
    .filter((a) => a.status === 'going')
    .slice(0, 3)
    .map((a) => users.find((u) => u.id === a.userId))
    .filter((u): u is NonNullable<typeof u> => !!u);

  const onJoin = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    haptics.medium();
    run(() => joinEvent(event.id));
  };

  const status = event.cancelled ? t.events.cancelled : ended ? t.events.ended : null;
  const buttonLabel = mine
    ? mine.status === 'waitlisted'
      ? t.events.waitlisted
      : t.events.joined
    : isFull
      ? t.events.joinWaitlist
      : t.events.join;
  const categoryLabel = (t.eventCreate.categories as Record<string, string>)[event.category] ?? event.category;
  const occasionLabel = event.occasion ? (t.occasions as Record<string, string>)[event.occasion] : null;

  return (
    // accessibilityRole="link": the card navigates and contains its own real
    // button; react-native-web would otherwise nest <button> in <button>.
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="link"
      accessibilityLabel={event.title}
    >
      {event.coverImage ? (
        <Image source={{ uri: event.coverImage }} style={{ width: '100%', height: compact ? 110 : 150 }} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.tile, { height: compact ? 72 : 96, backgroundColor: theme.colors.successSurface }]}>
          <Text style={{ fontSize: compact ? 30 : 38 }}>{CATEGORY_ICON[event.category] ?? '📍'}</Text>
        </View>
      )}
      <View style={{ padding: 12 }}>
        <View style={[theme.row(), { alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }]}>
          <Badge label={event.kind === 'activity' ? t.events.kindActivity : t.events.kindEvent} tone="primary" />
          <Badge label={`${CATEGORY_ICON[event.category] ?? ''} ${categoryLabel}`} tone="neutral" />
          {occasionLabel ? <Badge label={occasionLabel} tone="info" /> : null}
          {status ? <Badge label={status} tone="warning" /> : null}
        </View>

        <Text style={theme.text('title')} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={[theme.row(), styles.meta]}>
          <Clock size={12} color={theme.colors.textMuted} />
          <Text style={theme.text('caption', theme.colors.textSecondary)} numberOfLines={1}>
            {formatShortDate(event.startsAt, locale)} · {formatClock(event.startsAt, locale)}
          </Text>
        </View>
        <View style={[theme.row(), styles.meta]}>
          <MapPin size={12} color={theme.colors.textMuted} />
          <Text style={[theme.text('caption', theme.colors.textMuted), { flexShrink: 1 }]} numberOfLines={1}>
            {event.locationLabel}
            {neighborhood ? ` · ${locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn}` : ''}
          </Text>
        </View>
        <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 2 }]} numberOfLines={1}>
          {t.events.organizer}: {host ? displayName(host) : t.common.neighbor}
        </Text>

        <View style={[theme.row(), styles.footer]}>
          <View style={[theme.row(), { alignItems: 'center', flexShrink: 1 }]}>
            {avatars.map((u, i) => (
              <View key={u.id} style={[styles.avatarStack, { marginStart: i === 0 ? 0 : -10, borderColor: theme.colors.surface }]}>
                <Avatar name={displayName(u)} uri={u.avatarUrl} size={24} />
              </View>
            ))}
            <View style={[theme.row(), { alignItems: 'center', gap: 3, marginStart: avatars.length > 0 ? 8 : 0 }]}>
              <Users size={12} color={theme.colors.textMuted} />
              <Text style={theme.text('caption', theme.colors.textMuted)}>
                {localizeDigits(`${going}/${event.capacity}`, locale)}
                {!isFull && !ended ? ` · ${localizeDigits(spotsLeft, locale)} ${t.events.spotsLeft}` : ''}
              </Text>
            </View>
          </View>
          {!event.cancelled && !started ? (
            <Button label={buttonLabel} size="sm" variant={mine ? 'outline' : 'primary'} onPress={onJoin} disabled={!!mine || pending} loading={pending} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tile: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  meta: { alignItems: 'center', gap: 4, marginTop: 4 },
  footer: { alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  avatarStack: { borderWidth: 2, borderRadius: 12 },
});
