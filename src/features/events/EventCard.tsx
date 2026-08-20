import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Calendar, MapPin, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { CommunityEvent } from '@/models';
import { displayName, formatClock, formatShortDate } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';

const CATEGORY_ICON: Record<string, string> = {
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

export function EventCard({ event, compact }: { event: CommunityEvent; compact?: boolean }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const host = useStore((s) => s.getUser(event.hostId));
  const joinEvent = useStore((s) => s.joinEvent);
  const users = useStore((s) => s.users);

  const going = event.attendees.filter((a) => a.status === 'going');
  const mine = event.attendees.find((a) => a.userId === CURRENT_USER_ID);
  const isFull = going.length >= event.capacity;
  const avatars = going.slice(0, 3).map((a) => users.find((u) => u.id === a.userId)).filter(Boolean);

  const onJoin = () => {
    haptics.medium();
    joinEvent(event.id);
  };

  const buttonLabel = mine
    ? mine.status === 'waitlisted'
      ? t.events.waitlisted
      : t.events.joined
    : isFull
      ? t.events.joinWaitlist
      : t.events.join;

  return (
    <Pressable
      onPress={() => router.push(`/event/${event.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="button"
    >
      <Image source={{ uri: event.coverImage }} style={{ width: '100%', height: compact ? 110 : 150 }} contentFit="cover" transition={150} />
      <View style={{ padding: 12 }}>
        <View style={[theme.row(), { alignItems: 'center', gap: 6, marginBottom: 6 }]}>
          <Badge label={`${CATEGORY_ICON[event.category] ?? ''} ${formatClock(event.startsAt, locale)}`} tone="primary" />
          <Badge label={formatShortDate(event.startsAt, locale)} tone="neutral" />
        </View>

        <Text style={theme.text('title')} numberOfLines={1}>
          {event.title}
        </Text>

        <View style={[theme.row(), { alignItems: 'center', gap: 4, marginTop: 4 }]}>
          <MapPin size={12} color={theme.colors.textMuted} />
          <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
            {event.locationLabel}
          </Text>
        </View>

        {host ? (
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 2 }]}>
            {t.events.host}: {displayName(host)}
          </Text>
        ) : null}

        <View style={[theme.row(), styles.footer]}>
          <View style={[theme.row(), { alignItems: 'center' }]}>
            {avatars.map((u, i) => (
              <View key={u!.id} style={[styles.avatarStack, { marginStart: i === 0 ? 0 : -10, borderColor: theme.colors.surface }]}>
                <Avatar name={displayName(u!)} uri={u!.avatarUrl} size={24} />
              </View>
            ))}
            <View style={[theme.row(), { alignItems: 'center', gap: 3, marginStart: avatars.length > 0 ? 8 : 0 }]}>
              <Users size={12} color={theme.colors.textMuted} />
              <Text style={theme.text('caption', theme.colors.textMuted)}>
                {going.length}/{event.capacity}
              </Text>
            </View>
          </View>
          <Button label={buttonLabel} size="sm" variant={mine ? 'outline' : 'primary'} onPress={onJoin} disabled={!!mine} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  footer: { alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  avatarStack: { borderWidth: 2, borderRadius: 12 },
});
