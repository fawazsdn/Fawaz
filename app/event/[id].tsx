import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Calendar,
  Clock,
  Flag,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Pencil,
  Repeat,
  Share2,
  Shield,
  UserPlus,
  Users,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useUser } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { cancelActivity, getOrCreateDirectConversation, joinEvent, leaveEvent, respondEventInvitation } from '@/backend/actions';
import { InviteNeighborsSheet } from '@/features/neighbors/InviteNeighborsSheet';
import { displayName, formatDay, formatTimeRange, localizeDigits } from '@/utils/format';
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
import { Chip } from '@/components/Chip';
import { ReportSheet } from '@/components/ReportSheet';
import { CATEGORY_ICON, eventState } from '@/features/events/EventCard';
import { eventCategoryBadge } from '@/features/events/categories';

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
  const club = useStore((s) => (event?.clubId ? s.clubs.find((c) => c.id === event.clubId) : undefined));
  const myClubRole = useStore((s) =>
    event?.clubId ? s.clubMemberships.find((m) => m.clubId === event.clubId && m.userId === me && m.status === 'active')?.role : undefined,
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelScope, setCancelScope] = useState<'one' | 'future'>('one');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const myInvitation = useStore((s) => s.eventInvitations.find((i) => i.eventId === id && i.inviteeId === me && i.status === 'pending'));
  const inviter = useUser(myInvitation?.inviterId);

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
  const categoryLabel = eventCategoryBadge(event, t.eventCreate.categories as Record<string, string>);
  const occasionLabel = event.occasion ? (t.occasions as Record<string, string>)[event.occasion] : null;
  const canRsvp = !event.cancelled && !started;
  const managesClub = myClubRole === 'owner' || myClubRole === 'moderator';
  const canManage = isOwn || managesClub;
  // Members-only club activities: RSVP is refused server-side for non-members, so
  // point neighbors to the club instead of showing a Join button that would fail.
  const blockedMembersOnly = event.membersOnly && !myClubRole;

  const onJoin = () => {
    haptics.medium();
    run(() => joinEvent(event.id));
  };

  const messageHost = async () => {
    const res = await run(() => getOrCreateDirectConversation(event.hostId, { type: 'event', id: event.id }));
    if (res.ok) router.push(`/messages/${res.value}`);
  };

  const shareEvent = () =>
    shareContent({
      title: event.title,
      message: `${event.title} — ${formatDay(event.startsAt, locale)} ${formatTimeRange(event.startsAt, event.endsAt, locale)}`,
      url: links.event(event.id),
    });

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
          <View style={[theme.row(), { gap: 4 }]}>
            <IconButton accessibilityLabel={t.common.share} onPress={shareEvent}>
              <Share2 size={19} color={theme.colors.textPrimary} />
            </IconButton>
            {!isOwn ? (
              <IconButton accessibilityLabel={t.common.report} onPress={() => setReportOpen(true)}>
                <Flag size={18} color={theme.colors.textPrimary} />
              </IconButton>
            ) : null}
          </View>
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
            {event.membersOnly ? <Badge label={t.events.membersOnly} tone="warning" /> : null}
            {event.cancelled ? (
              <Badge label={t.events.cancelled} tone="danger" />
            ) : ended ? (
              <Badge label={t.events.ended} tone="warning" />
            ) : null}
          </View>
          <Text style={[theme.text('heading1'), { marginTop: 10 }]}>{event.title}</Text>

          <View style={{ marginTop: 12, gap: 8 }}>
            <InfoRow icon={Calendar} text={formatDay(event.startsAt, locale)} />
            <InfoRow icon={Clock} text={`${formatTimeRange(event.startsAt, event.endsAt, locale)} · ${t.eventCreate.timesInSaudi}`} />
            <InfoRow icon={MapPin} text={event.locationLabel} />
            {event.recurrence !== 'none' ? <InfoRow icon={Repeat} text={t.eventCreate.recurrenceOptions[event.recurrence]} /> : null}
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

          {event.description ? (
            <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 16 }]}>{event.description}</Text>
          ) : null}

          {event.rules ? (
            <Card style={{ marginTop: 14 }}>
              <Text style={theme.text('caption', theme.colors.textMuted)}>{event.rules}</Text>
            </Card>
          ) : null}

          {club ? (
            <Card style={{ marginTop: 16 }} onPress={() => router.push(`/clubs/${club.id}`)}>
              <View style={[theme.row(), { alignItems: 'center', gap: 10 }]}>
                <Shield size={18} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={theme.text('caption', theme.colors.textMuted)}>{t.events.organizedByClub}</Text>
                  <Text style={theme.text('bodySmall')} numberOfLines={1}>
                    {club.name}
                  </Text>
                </View>
              </View>
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

          {myInvitation && canRsvp && !mine ? (
            <Card style={{ marginTop: 16 }}>
              <Text style={[theme.text('bodySmall'), { marginBottom: 10 }]}>
                {t.neighbors.invitationFrom.replace('{name}', inviter ? displayName(inviter) : t.common.neighbor)}
              </Text>
              <View style={[theme.row(), { gap: 8 }]}>
                <Button
                  label={t.neighbors.acceptInvite}
                  onPress={() => run(() => respondEventInvitation(myInvitation.id, true))}
                  loading={pending}
                />
                <Button
                  label={t.neighbors.declineInvite}
                  variant="outline"
                  disabled={pending}
                  onPress={() => run(() => respondEventInvitation(myInvitation.id, false))}
                />
              </View>
            </Card>
          ) : null}

          <View style={{ marginTop: 16, gap: 10 }}>
            {canRsvp && !isOwn && blockedMembersOnly && !mine ? (
              <>
                <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.events.membersOnlyHint}</Text>
                {club ? <Button label={t.clubs.viewClub} onPress={() => router.push(`/clubs/${club.id}`)} fullWidth size="lg" /> : null}
              </>
            ) : canRsvp && !isOwn ? (
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
            {canRsvp && (isOwn || mine) ? (
              <Button
                label={t.neighbors.inviteNeighbors}
                onPress={() => setInviteOpen(true)}
                variant="outline"
                icon={<UserPlus size={16} color={theme.colors.primary} />}
                fullWidth
              />
            ) : null}
            <Button
              label={t.events.share}
              onPress={shareEvent}
              variant="outline"
              icon={<Share2 size={16} color={theme.colors.primary} />}
              fullWidth
            />
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
            {canManage && !event.cancelled && !started ? (
              <Button
                label={t.common.edit}
                onPress={() => router.push({ pathname: '/event/create', params: { edit: event.id } })}
                variant="outline"
                icon={<Pencil size={16} color={theme.colors.primary} />}
                fullWidth
              />
            ) : null}
            {canManage && !event.cancelled && !ended ? (
              <Button label={t.events.cancelEvent} onPress={() => setCancelOpen(true)} variant="danger" fullWidth />
            ) : null}
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

      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="event" targetId={event.id} />
      <InviteNeighborsSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        eventId={event.id}
        excludeUserIds={event.attendees.filter((a) => a.status === 'going' || a.status === 'waitlisted').map((a) => a.userId)}
      />
      <ConfirmationModal
        visible={cancelOpen}
        title={t.events.cancelEvent}
        body={event.seriesId ? `${event.title}\n\n${t.events.cancelSeriesHint}` : event.title}
        destructive
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false);
          run(() => cancelActivity(event.id, cancelScope));
        }}
      >
        {event.seriesId ? (
          <View style={[theme.row(), { gap: 8, flexWrap: 'wrap', marginTop: 8 }]}>
            <Chip label={t.eventCreate.applyThis} selected={cancelScope === 'one'} onPress={() => setCancelScope('one')} />
            <Chip label={t.eventCreate.applyFuture} selected={cancelScope === 'future'} onPress={() => setCancelScope('future')} />
          </View>
        ) : null}
      </ConfirmationModal>
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
