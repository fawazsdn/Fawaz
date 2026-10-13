import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CalendarClock, Flag, MapPin, MessageCircle, Plus, Settings2, Share2, Trash2, UserPlus, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { useUser } from '@/hooks/useNeighborhood';
import { useAction } from '@/hooks/useAction';
import { archiveClub, cancelJoinRequest, deleteClubAnnouncement, joinClub, leaveClub, postClubAnnouncement } from '@/backend/actions';
import { links } from '@/config/links';
import { shareContent } from '@/utils/share';
import { displayName, formatRelativeTime, localizeDigits } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { ReportSheet } from '@/components/ReportSheet';
import { SkeletonCardRow } from '@/components/Skeleton';
import { UserRow } from '@/components/UserRow';
import { EventCard } from '@/features/events/EventCard';
import { InviteNeighborsSheet } from '@/features/neighbors/InviteNeighborsSheet';
import {
  CLUB_ICON,
  clubCategoryLabel,
  clubMemberState,
  clubPastEvents,
  clubUpcomingEvents,
  isActiveMemberState,
  isManagerState,
  myClubMembership,
} from '@/features/clubs/clubLogic';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const { run, pending } = useAction();

  const club = useStore((s) => s.clubs.find((c) => c.id === id));
  const syncStatus = useStore((s) => s.sync.status);
  const memberships = useStore((s) => s.clubMemberships);
  const events = useStore((s) => s.events);
  const allAnnouncements = useStore((s) => s.clubAnnouncements);
  const conversation = useStore((s) => s.conversations.find((c) => c.groupId === id));
  const users = useStore((s) => s.users);
  const decisions = useStore((s) => s.clubDecisions);
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === club?.neighborhoodId));
  const owner = useUser(club?.ownerId);

  const [confirm, setConfirm] = useState<'leave' | 'archive' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const membership = club ? myClubMembership(memberships, club.id, me) : undefined;
  const state = clubMemberState(membership);
  const active = isActiveMemberState(state);
  const manager = isManagerState(state);
  const isOwner = club?.ownerId === me;
  const upcoming = useMemo(() => (club ? clubUpcomingEvents(events, club.id) : []), [events, club]);
  const past = useMemo(() => (club ? clubPastEvents(events, club.id).slice(0, 5) : []), [events, club]);
  const announcements = useMemo(() => allAnnouncements.filter((a) => a.clubId === id), [allAnnouncements, id]);
  const pendingCount = useMemo(() => memberships.filter((m) => m.clubId === id && m.status === 'pending').length, [memberships, id]);
  const lastDecision = useMemo(() => decisions.find((d) => d.clubId === id && d.reason), [decisions, id]);

  if (!club) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.title} fallbackRoute="/clubs" />
        {syncStatus === 'loading' ? (
          <View style={{ padding: theme.spacing.md }}>
            <SkeletonCardRow count={2} />
          </View>
        ) : (
          <EmptyState title={t.errors.notFound} actionLabel={t.clubs.browseClubs} onAction={() => router.replace('/clubs')} />
        )}
      </View>
    );
  }

  const approved = club.reviewStatus === 'approved';
  const label = clubCategoryLabel(club, t.clubs.categories as Record<string, string>);
  const nbName = neighborhood ? (locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn) : null;
  const canEditApplication = isOwner && (club.reviewStatus === 'pending_review' || club.reviewStatus === 'needs_changes');

  const share = () =>
    shareContent({ title: club.name, message: t.clubs.shareMessage.replace('{club}', club.name), url: links.club(club.id) });

  const onJoin = () => run(() => joinClub(club.id));

  const postAnnouncement = async () => {
    const body = announcement.trim();
    if (body.length < 2) return;
    const res = await run(() => postClubAnnouncement(club.id, body));
    if (res.ok) setAnnouncement('');
  };

  const membershipAction = () => {
    if (!approved) return null;
    switch (state) {
      case 'pending':
        return (
          <>
            <Text style={theme.text('bodySmall', theme.colors.info)}>{t.clubs.requestPending}</Text>
            <Button
              label={t.clubs.cancelRequest}
              onPress={() => run(() => cancelJoinRequest(club.id))}
              variant="outline"
              loading={pending}
              fullWidth
            />
          </>
        );
      case 'banned':
        return <Text style={theme.text('bodySmall', theme.colors.danger)}>{t.clubs.bannedNotice}</Text>;
      case 'member':
      case 'moderator':
      case 'organizer':
        return null;
      default:
        return (
          <>
            {state === 'removed' ? <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.clubs.removedNotice}</Text> : null}
            {state === 'rejected' ? <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.clubs.rejectedNotice}</Text> : null}
            <Button
              label={club.membershipType === 'open' ? t.clubs.joinClub : t.clubs.requestToJoin}
              onPress={onJoin}
              loading={pending}
              fullWidth
              size="lg"
            />
          </>
        );
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader
        title=""
        transparent
        showBack
        fallbackRoute="/clubs"
        right={
          <View style={[theme.row(), { gap: 4 }]}>
            {approved ? (
              <IconButton accessibilityLabel={t.common.share} onPress={share}>
                <Share2 size={19} color={theme.colors.textPrimary} />
              </IconButton>
            ) : null}
            {!isOwner ? (
              <IconButton accessibilityLabel={t.clubs.reportClub} onPress={() => setReportOpen(true)}>
                <Flag size={18} color={theme.colors.textPrimary} />
              </IconButton>
            ) : null}
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 56 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {club.coverImage ? (
          <Image source={{ uri: club.coverImage }} style={styles.hero} contentFit="cover" />
        ) : (
          <View style={[styles.hero, styles.tile, { backgroundColor: theme.colors.successSurface }]}>
            <Text style={{ fontSize: 56 }}>{CLUB_ICON[club.category] ?? '✨'}</Text>
          </View>
        )}

        <View style={{ padding: theme.spacing.md, gap: 14 }}>
          <View style={[theme.row(), { gap: 12, alignItems: 'center' }]}>
            {club.logo ? <Image source={{ uri: club.logo }} style={[styles.logo, { borderColor: theme.colors.border }]} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={theme.text('heading1')}>{club.name}</Text>
              <View style={[theme.row(), { gap: 6, flexWrap: 'wrap', marginTop: 6 }]}>
                <Badge label={`${CLUB_ICON[club.category] ?? ''} ${label}`} tone="neutral" />
                {!approved ? (
                  <Badge
                    label={t.clubs.status[club.reviewStatus]}
                    tone={club.reviewStatus === 'rejected' || club.reviewStatus === 'suspended' ? 'danger' : 'warning'}
                  />
                ) : null}
                {manager ? <Badge label={t.clubs.roles[membership!.role]} tone="primary" /> : null}
              </View>
            </View>
          </View>

          {!approved ? (
            <Card>
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{t.clubs.statusNotice[club.reviewStatus]}</Text>
              {club.reviewNote || lastDecision?.reason ? (
                <View style={{ marginTop: 10 }}>
                  <Text style={theme.text('caption', theme.colors.textMuted)}>{t.clubs.reviewerNote}</Text>
                  <Text style={theme.text('bodySmall')}>{club.reviewNote ?? lastDecision?.reason}</Text>
                </View>
              ) : null}
              {canEditApplication ? (
                <View style={{ marginTop: 12 }}>
                  <Button
                    label={club.reviewStatus === 'needs_changes' ? t.clubs.editAndResubmit : t.common.edit}
                    onPress={() => router.push({ pathname: '/clubs/create', params: { edit: club.id } })}
                    variant="outline"
                    fullWidth
                  />
                </View>
              ) : null}
            </Card>
          ) : null}

          <View style={{ gap: 8 }}>
            {nbName ? <Meta icon={MapPin} text={nbName} /> : null}
            {approved ? <Meta icon={Users} text={t.clubs.memberCount.replace('{n}', localizeDigits(club.memberCount, locale))} /> : null}
            <Meta icon={Settings2} text={club.membershipType === 'open' ? t.clubs.membershipOpen : t.clubs.membershipApproval} />
            {club.meetingSchedule ? <Meta icon={CalendarClock} text={club.meetingSchedule} /> : null}
            {club.meetingLocation ? <Meta icon={MapPin} text={`${t.clubs.meetingLocation}: ${club.meetingLocation}`} /> : null}
          </View>

          <View style={{ gap: 10 }}>{membershipAction()}</View>

          {active && approved ? (
            <Button
              label={t.neighbors.inviteToClub}
              onPress={() => setInviteOpen(true)}
              variant="ghost"
              icon={<UserPlus size={16} color={theme.colors.primary} />}
              fullWidth
            />
          ) : null}

          {active && conversation && approved ? (
            <Button
              label={t.clubs.openChat}
              onPress={() => router.push(`/messages/${conversation.id}`)}
              variant="outline"
              icon={<MessageCircle size={16} color={theme.colors.primary} />}
              fullWidth
            />
          ) : null}

          {manager && approved ? (
            <View style={[theme.row(), { gap: 8, flexWrap: 'wrap' }]}>
              <Button
                label={t.clubs.newActivity}
                onPress={() => router.push({ pathname: '/event/create', params: { clubId: club.id } })}
                size="sm"
                icon={<Plus size={14} color={theme.colors.onPrimary} />}
              />
              <Button
                label={pendingCount > 0 ? `${t.clubs.members} · ${localizeDigits(pendingCount, locale)}` : t.clubs.members}
                onPress={() => router.push(`/clubs/${club.id}/members`)}
                variant="outline"
                size="sm"
              />
              <Button
                label={t.clubs.editClub}
                onPress={() => router.push({ pathname: '/clubs/create', params: { edit: club.id } })}
                variant="outline"
                size="sm"
              />
            </View>
          ) : active && approved ? (
            <Button label={t.clubs.members} onPress={() => router.push(`/clubs/${club.id}/members`)} variant="ghost" fullWidth />
          ) : null}

          <Section title={t.clubs.about}>
            <Text style={theme.text('body', theme.colors.textSecondary)}>{club.description}</Text>
          </Section>

          <View>
            {owner ? (
              <UserRow user={owner} subtitle={t.clubs.organizer} onPress={() => router.push(`/profile/${owner.id}`)} />
            ) : (
              <Text style={theme.text('bodySmall', theme.colors.textMuted)}>
                {t.clubs.organizer}: {t.common.neighbor}
              </Text>
            )}
          </View>

          {club.rules ? (
            <Section title={t.clubs.rules}>
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{club.rules}</Text>
            </Section>
          ) : null}

          {approved ? (
            <Section title={t.clubs.upcomingActivities}>
              {upcoming.length === 0 ? (
                <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.clubs.noUpcoming}</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {upcoming.slice(0, 6).map((e) => (
                    <EventCard key={e.id} event={e} compact />
                  ))}
                </View>
              )}
            </Section>
          ) : null}

          {approved && active ? (
            <Section title={t.clubs.announcements}>
              {manager ? (
                <View style={{ gap: 8, marginBottom: 12 }}>
                  <TextInput
                    value={announcement}
                    onChangeText={setAnnouncement}
                    placeholder={t.clubs.announcementPlaceholder}
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    maxLength={3000}
                    style={[
                      theme.text('body'),
                      styles.textArea,
                      { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                    ]}
                  />
                  <Button
                    label={t.clubs.postAnnouncement}
                    onPress={postAnnouncement}
                    disabled={announcement.trim().length < 2 || pending}
                    size="sm"
                  />
                </View>
              ) : null}
              {announcements.length === 0 ? (
                <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.clubs.noAnnouncements}</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {announcements.map((a) => {
                    const author = users.find((u) => u.id === a.authorId);
                    return (
                      <Card key={a.id}>
                        <View style={[theme.row(), { justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }]}>
                          <Text style={theme.text('caption', theme.colors.textMuted)}>
                            {author ? displayName(author) : t.common.neighbor} · {formatRelativeTime(a.createdAt, locale)}
                          </Text>
                          {manager ? (
                            <Pressable
                              onPress={() => run(() => deleteClubAnnouncement(a.id))}
                              accessibilityRole="button"
                              accessibilityLabel={t.common.delete}
                              hitSlop={8}
                            >
                              <Trash2 size={15} color={theme.colors.textMuted} />
                            </Pressable>
                          ) : null}
                        </View>
                        <Text style={theme.text('body')}>{a.body}</Text>
                      </Card>
                    );
                  })}
                </View>
              )}
            </Section>
          ) : approved && !active ? (
            <Text style={theme.text('caption', theme.colors.textMuted)}>{t.clubs.membersOnlyNotice}</Text>
          ) : null}

          {approved && past.length > 0 ? (
            <Section title={t.clubs.pastActivities}>
              <View style={{ gap: 12 }}>
                {past.map((e) => (
                  <EventCard key={e.id} event={e} compact />
                ))}
              </View>
            </Section>
          ) : null}

          {active && state !== 'organizer' ? (
            <Button label={t.clubs.leaveClub} onPress={() => setConfirm('leave')} variant="ghost" fullWidth />
          ) : null}
          {isOwner && club.reviewStatus !== 'archived' ? (
            <>
              {state === 'organizer' ? (
                <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center' }]}>{t.clubs.ownerCannotLeave}</Text>
              ) : null}
              <Button label={t.clubs.archiveClub} onPress={() => setConfirm('archive')} variant="danger" fullWidth />
            </>
          ) : null}
        </View>
      </ScrollView>

      <ConfirmationModal
        visible={confirm !== null}
        title={confirm === 'archive' ? t.clubs.archiveClub : t.clubs.leaveClub}
        body={confirm === 'archive' ? t.clubs.archiveConfirm : t.clubs.leaveConfirm}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const which = confirm;
          setConfirm(null);
          if (which === 'archive') {
            const res = await run(() => archiveClub(club.id));
            if (res.ok) router.replace('/clubs');
          } else {
            run(() => leaveClub(club.id));
          }
        }}
      />
      <InviteNeighborsSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        clubId={club.id}
        excludeUserIds={memberships
          .filter((m) => m.clubId === club.id && (m.status === 'active' || m.status === 'pending'))
          .map((m) => m.userId)}
      />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="group" targetId={club.id} />
    </KeyboardAvoidingView>
  );

  function Meta({ icon: Icon, text }: { icon: typeof Users; text: string }) {
    return (
      <View style={[theme.row(), { alignItems: 'center', gap: 8 }]}>
        <Icon size={16} color={theme.colors.textMuted} />
        <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { flex: 1 }]}>{text}</Text>
      </View>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View>
        <Text style={[theme.text('title'), { marginBottom: 8 }]}>{title}</Text>
        {children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: 60, height: 60, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth },
  textArea: { minHeight: 80, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, textAlignVertical: 'top' },
});
