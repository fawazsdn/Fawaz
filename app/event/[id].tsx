import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Calendar, Clock, Map as MapIcon, MapPin, MessageCircle, Share2, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useUser } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { cancelEvent, getOrCreateDirectConversation, joinEvent, leaveEvent } from '@/backend/actions';
import { formatDay, formatTimeRange, localizeDigits } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { IconButton } from '@/components/IconButton';
import { UserRow } from '@/components/UserRow';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCardRow } from '@/components/Skeleton';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { CATEGORY_ICON, eventState } from '@/features/events/EventCard';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const { run, pending } = useAction();

  const event = useStore((s) => s.events.find((e) => e.id === id));
  const syncStatus = useStore((s) => s.sync.status);
  const conversations = useStore((s) => s.conversations);
  const users = useStore((s) => s.users);
  const host = useUser(event?.hostId);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!event) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/events" />
        {syncStatus === 'loading' ? (
          <View style={{ padding: theme.spacing.md }}>
            <SkeletonCardRow count={2} />
          </View>
        ) : (
          <EmptyState title={t.errors.genericTitle} body={t.errors.genericBody} />
        )}
      </View>
    );
  }

  const isOwn = event.hostId === me;
  const { going, spotsLeft, isFull, ended, started } = eventState(event);
  const waitlisted = event.attendees.filter((a) => a.status === 'waitlisted');
  const mine = event.attendees.find((a) => a.userId === me && (a.status === 'going' || a.status === 'waitlisted'));
  const myWaitlistPos = mine?.status === 'waitlisted' ? waitlisted.findIndex((a) => a.userId === me) + 1 : 0;
  const discussion = conversations.find((c) => c.eventId === event.id);
  const categoryLabel = (t.eventCreate.categories as Record<string, string>)[event.category] ?? event.category;
  const occasionLabel = event.occasion ? (t.occasions as Record<string, string>)[event.occasion] : null;
  const canRsvp = !event.cancelled && !started;

  const onJoin = () => {
    haptics.medium();
    run(() => joinEvent(event.id));
  };

  const messageHost = async () => {
    const res = await run(() => getOrCreateDirectConversation(event.hostId));
    if (res.ok) router.push(`/messages/${res.value}`);
  };

  const shareEvent = () =>
    shareContent({ title: event.title, message: `${event.title} — ${formatDay(event.startsAt, locale)} ${formatTimeRange(event.startsAt, event.endsAt, locale)}`, url: links.event(event.id) });

  const joinLabel = isFull ? t.events.joinWaitlist : t.events.join;
  const hasPin = event.approxLat != null && event.approxLng != null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title=""
        transparent
        showBack
        fallbackRoute="/events"
        right={
          <IconButton accessibilityLabel={t.common.share} onPress={shareEvent}>
            <Share2 size={19} color={theme.colors.textPrimary} />
          </IconButton>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {event.coverImage ? (
          <Image source={{ uri: event.coverImage }} style={styles.hero} contentFit="cover" />
        ) : (
          <View style={[styles.hero, styles.tile, { backgroundColor: theme.colors.successSurface }]}>
            <Text style={{ fontSize: 56 }}>{CATEGORY_ICON[event.category] ?? '📍'}</Text>
          </View>
        )}
        <View style={{ padding: theme.spacing.md }}>
          <View style={[theme.row(), { gap: 6, flexWrap: 'wrap' }]}>
            <Badge label={event.kind === 'activity' ? t.events.kindActivity : t.events.kindEvent} tone="primary" />
            <Badge label={categoryLabel} tone="neutral" />
            {occasionLabel ? <Badge label={occasionLabel} tone="info" /> : null}
            {event.cancelled ? <Badge label={t.events.cancelled} tone="danger" /> : ended ? <Badge label={t.events.ended} tone="warning" /> : null}
          </View>
          <Text style={[theme.text('heading1'), { marginTop: 10 }]}>{event.title}</Text>

          <View style={{ marginTop: 12, gap: 8 }}>
            <InfoRow icon={Calendar} text={formatDay(event.startsAt, locale)} />
            <InfoRow icon={Clock} text={`${formatTimeRange(event.startsAt, event.endsAt, locale)} · ${t.eventCreate.timesInSaudi}`} />
            <InfoRow icon={MapPin} text={event.locationLabel} />
            <InfoRow
              icon={Users}
              text={`${localizeDigits(going, locale)}/${localizeDigits(event.capacity, locale)} ${t.events.participants}${
                !isFull && !ended ? ` · ${localizeDigits(spotsLeft, locale)} ${t.events.spotsLeft}` : isFull ? ` · ${t.events.full}` : ''
              }${waitlisted.length > 0 ? ` · ${localizeDigits(waitlisted.length, locale)} ${t.events.waitlisted}` : ''}`}
            />
          </View>

          {hasPin ? (
            <Button
              label={t.events.viewOnMap}
              onPress={() => router.push({ pathname: '/(tabs)/map', params: { focus: event.id } })}
              variant="outline"
              size="sm"
              icon={<MapIcon size={15} color={theme.colors.primary} />}
            />
          ) : (
            <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{t.events.noLocationOnMap}</Text>
          )}

          {event.description ? <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 16 }]}>{event.description}</Text> : null}

          {event.rules ? (
            <Card style={{ marginTop: 14 }}>
              <Text style={theme.text('caption', theme.colors.textMuted)}>{event.rules}</Text>
            </Card>
          ) : null}

          <View style={{ marginTop: 16 }}>
            {host ? (
              <UserRow user={host} subtitle={t.events.organizer} onPress={() => router.push(`/profile/${host.id}`)} />
            ) : (
              <Text style={theme.text('bodySmall', theme.colors.textMuted)}>
                {t.events.organizer}: {t.common.neighbor}
              </Text>
            )}
          </View>

          {myWaitlistPos > 0 ? (
            <Text style={[theme.text('bodySmall', theme.colors.info), { marginTop: 12 }]}>
              {t.events.waitlistPosition}: {localizeDigits(myWaitlistPos, locale)}
            </Text>
          ) : null}

          <View style={{ marginTop: 16, gap: 10 }}>
            {canRsvp && !isOwn ? (
              mine ? (
                <Button
                  label={mine.status === 'waitlisted' ? t.events.leaveWaitlist : t.events.leave}
                  onPress={() => run(() => leaveEvent(event.id))}
                  variant="outline"
                  loading={pending}
                  fullWidth
                  size="lg"
                />
              ) : (
                <Button label={joinLabel} onPress={onJoin} loading={pending} fullWidth size="lg" />
              )
            ) : null}
            <Button label={t.events.share} onPress={shareEvent} variant="outline" icon={<Share2 size={16} color={theme.colors.primary} />} fullWidth />
            {discussion ? (
              <Button
                label={t.events.discussion}
                onPress={() => router.push(`/messages/${discussion.id}`)}
                variant="ghost"
                icon={<MessageCircle size={16} color={theme.colors.primary} />}
                fullWidth
              />
            ) : null}
            {!isOwn ? <Button label={t.events.messageHost} onPress={messageHost} variant="ghost" fullWidth /> : null}
            {isOwn && !event.cancelled && !ended ? <Button label={t.events.cancelEvent} onPress={() => setCancelOpen(true)} variant="danger" fullWidth /> : null}
          </View>

          {going > 0 ? (
            <View style={{ marginTop: 20 }}>
              <Text style={[theme.text('title'), { marginBottom: 8 }]}>{t.events.attendees}</Text>
              {event.attendees
                .filter((a) => a.status === 'going')
                .slice(0, 12)
                .map((a) => {
                  const u = users.find((x) => x.id === a.userId);
                  return u ? <UserRow key={a.userId} user={u} onPress={() => router.push(`/profile/${u.id}`)} /> : null;
                })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={cancelOpen}
        title={t.events.cancelEvent}
        body={event.title}
        destructive
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          run(() => cancelEvent(event.id));
        }}
      />
    </View>
  );

  function InfoRow({ icon: Icon, text }: { icon: typeof Calendar; text: string }) {
    return (
      <View style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
        <Icon size={16} color={theme.colors.textMuted} />
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { flex: 1 }]}>{text}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220 },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
