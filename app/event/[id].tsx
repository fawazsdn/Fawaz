import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, MessageCircle, Share2, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { displayName, formatClock, formatDay } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { messageService } from '@/services';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { UserRow } from '@/components/UserRow';
import { MapPlaceholder } from '@/components/MapPlaceholder';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmationModal } from '@/components/ConfirmationModal';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const event = useStore((s) => s.events.find((e) => e.id === id));
  const host = useStore((s) => s.getUser(event?.hostId ?? ''));
  const users = useStore((s) => s.users);
  const joinEvent = useStore((s) => s.joinEvent);
  const leaveEvent = useStore((s) => s.leaveEvent);
  const cancelEvent = useStore((s) => s.cancelEvent);
  const isOwn = event?.hostId === CURRENT_USER_ID;

  const [cancelOpen, setCancelOpen] = useState(false);

  if (!event || !host) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const going = event.attendees.filter((a) => a.status === 'going');
  const waitlisted = event.attendees.filter((a) => a.status === 'waitlisted');
  const mine = event.attendees.find((a) => a.userId === CURRENT_USER_ID);
  const isFull = going.length >= event.capacity;

  const onJoin = () => {
    haptics.medium();
    joinEvent(event.id);
  };

  const messageHost = async () => {
    const convo = await messageService.getOrCreateConversation(host.id);
    router.push(`/messages/${convo.id}`);
  };

  const openDiscussion = async () => {
    const convoId = useStore.getState().conversations.find((c) => c.eventId === event.id)?.id;
    if (convoId) router.push(`/messages/${convoId}`);
    else await messageHost();
  };

  const joinLabel = mine ? (mine.status === 'waitlisted' ? t.events.waitlisted : t.events.joined) : isFull ? t.events.joinWaitlist : t.events.join;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="" transparent showBack right={<Share2 size={19} color={theme.colors.textPrimary} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Image source={{ uri: event.coverImage }} style={styles.hero} />
        <View style={{ padding: theme.spacing.md }}>
          <Badge label={t.eventCreate.categories[event.category]} tone="primary" />
          <Text style={[theme.text('heading1'), { marginTop: 10 }]}>{event.title}</Text>

          <View style={{ marginTop: 12, gap: 8 }}>
            <View style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
              <Calendar size={16} color={theme.colors.textMuted} />
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>
                {formatDay(event.startsAt, locale)} · {formatClock(event.startsAt, locale)} - {formatClock(event.endsAt, locale)}
              </Text>
            </View>
            <View style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
              <MapPin size={16} color={theme.colors.textMuted} />
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{event.locationLabel}</Text>
            </View>
            <View style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
              <Users size={16} color={theme.colors.textMuted} />
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>
                {going.length}/{event.capacity} {t.events.attendees.toLowerCase()}
                {waitlisted.length > 0 ? ` · ${waitlisted.length} ${t.events.waitlisted}` : ''}
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <MapPlaceholder centerLat={event.approxLat} centerLng={event.approxLng} pins={[{ id: event.id, lat: event.approxLat, lng: event.approxLng, color: theme.colors.primary }]} height={140} />
          </View>

          <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 16 }]}>{event.description}</Text>

          {event.rules ? (
            <Card style={{ marginTop: 14 }}>
              <Text style={theme.text('caption', theme.colors.textMuted)}>{event.rules}</Text>
            </Card>
          ) : null}

          <View style={{ marginTop: 16 }}>
            <UserRow user={host} subtitle={t.events.host} onPress={() => router.push(`/profile/${host.id}`)} />
          </View>

          {event.cancelled ? (
            <Badge label={t.common.cancel} tone="danger" />
          ) : isOwn ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Button label={t.common.share} variant="outline" fullWidth />
              <Button label={t.events.discussion} onPress={openDiscussion} variant="outline" icon={<MessageCircle size={16} color={theme.colors.primary} />} fullWidth />
              <Button label={t.common.cancel} onPress={() => setCancelOpen(true)} variant="danger" fullWidth />
            </View>
          ) : (
            <View style={{ marginTop: 16, gap: 10 }}>
              {mine ? (
                <Button label={t.events.leave} onPress={() => leaveEvent(event.id)} variant="outline" fullWidth size="lg" />
              ) : (
                <Button label={joinLabel} onPress={onJoin} fullWidth size="lg" />
              )}
              <Button label={t.events.messageHost} onPress={messageHost} variant="outline" fullWidth />
              <Button label={t.events.discussion} onPress={openDiscussion} variant="ghost" icon={<MessageCircle size={16} color={theme.colors.primary} />} fullWidth />
            </View>
          )}

          {going.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <Text style={[theme.text('title'), { marginBottom: 8 }]}>{t.events.attendees}</Text>
              {going.slice(0, 6).map((a) => {
                const u = users.find((x) => x.id === a.userId);
                return u ? <UserRow key={a.userId} user={u} onPress={() => router.push(`/profile/${u.id}`)} /> : null;
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={cancelOpen}
        title={t.common.cancel}
        body={event.title}
        destructive
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => {
          cancelEvent(event.id);
          setCancelOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220 },
});
