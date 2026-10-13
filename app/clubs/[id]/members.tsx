import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import {
  removeClubMember,
  respondJoinRequest,
  sendNeighborRequest,
  setClubMemberRole,
  transferClubOwnership,
  unbanClubMember,
} from '@/backend/actions';
import type { ClubMembership, User } from '@/models';
import { displayName, localizeDigits } from '@/utils/format';
import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { UserRow } from '@/components/UserRow';
import { clubMemberState, isActiveMemberState, myClubMembership } from '@/features/clubs/clubLogic';

const ROLE_ORDER = { owner: 0, moderator: 1, member: 2 } as const;

type Pending = { kind: 'remove' | 'ban' | 'transfer'; member: ClubMembership; name: string } | null;

/**
 * Club members. Active members see the member list; organizers and moderators
 * also review join requests and moderate. Every action is re-authorized by the
 * server (moderators can't touch the organizer or other moderators, only the
 * organizer appoints moderators or transfers ownership).
 */
export default function ClubMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const { run, pending } = useAction();
  const club = useStore((s) => s.clubs.find((c) => c.id === id));
  const memberships = useStore((s) => s.clubMemberships);
  const users = useStore((s) => s.users);
  const [menuFor, setMenuFor] = useState<ClubMembership | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);

  const mine = club ? myClubMembership(memberships, club.id, me) : undefined;
  const state = clubMemberState(mine);
  const isOrganizer = state === 'organizer';
  const isManager = state === 'organizer' || state === 'moderator';

  const rows = useMemo(() => memberships.filter((m) => m.clubId === id), [memberships, id]);
  const active = useMemo(() => rows.filter((m) => m.status === 'active').sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]), [rows]);
  const requests = useMemo(() => rows.filter((m) => m.status === 'pending'), [rows]);
  const banned = useMemo(() => rows.filter((m) => m.status === 'banned'), [rows]);
  const connections = useStore((s) => s.neighborConnections);
  const neighborRequests = useStore((s) => s.neighborRequests);
  const connectedIds = useMemo(() => new Set(connections.map((c) => c.userId)), [connections]);
  const requestedIds = useMemo(() => new Set(neighborRequests.flatMap((r) => [r.requesterId, r.recipientId])), [neighborRequests]);
  const userOf = (uid: string): User | undefined => users.find((u) => u.id === uid);
  const nameOf = (uid: string) => {
    const u = userOf(uid);
    return u ? displayName(u) : t.common.neighbor;
  };

  if (!club || !isActiveMemberState(state)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.members} fallbackRoute={club ? `/clubs/${club.id}` : '/clubs'} />
        <EmptyState title={club ? t.clubs.membersOnlyNotice : t.errors.notFound} />
      </View>
    );
  }

  const menuItems = (m: ClubMembership): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    const name = nameOf(m.userId);
    if (isOrganizer && m.role === 'member') {
      items.push({ key: 'mod', label: t.clubs.makeModerator, onPress: () => run(() => setClubMemberRole(club.id, m.userId, 'moderator')) });
    }
    if (isOrganizer && m.role === 'moderator') {
      items.push({
        key: 'unmod',
        label: t.clubs.removeModerator,
        onPress: () => run(() => setClubMemberRole(club.id, m.userId, 'member')),
      });
    }
    if (isOrganizer)
      items.push({ key: 'transfer', label: t.clubs.transferOwnership, onPress: () => setConfirm({ kind: 'transfer', member: m, name }) });
    // Moderators may only act on regular members; the server enforces the same rule.
    if (m.role === 'member' || isOrganizer) {
      items.push({
        key: 'remove',
        label: t.clubs.remove,
        destructive: true,
        onPress: () => setConfirm({ kind: 'remove', member: m, name }),
      });
      items.push({ key: 'ban', label: t.clubs.ban, destructive: true, onPress: () => setConfirm({ kind: 'ban', member: m, name }) });
    }
    return items;
  };

  const renderRow = (m: ClubMembership, right?: React.ReactNode, subtitle?: string) => {
    const u = userOf(m.userId);
    if (!u) {
      return (
        <View key={m.userId} style={[theme.row(), { alignItems: 'center', paddingVertical: 10, gap: 8 }]}>
          <Text style={[theme.text('title'), { flex: 1 }]}>{t.common.neighbor}</Text>
          {right}
        </View>
      );
    }
    return (
      <UserRow
        key={m.userId}
        user={u}
        subtitle={subtitle ?? t.clubs.roles[m.role]}
        onPress={() => router.push(`/profile/${u.id}`)}
        right={right}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={`${t.clubs.members} · ${localizeDigits(active.length, locale)}`} fallbackRoute={`/clubs/${club.id}`} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48, gap: 20 }}>
        {isManager ? (
          <View>
            <Text style={[theme.text('title'), { marginBottom: 8 }]}>
              {t.clubs.pendingRequests} {requests.length > 0 ? `· ${localizeDigits(requests.length, locale)}` : ''}
            </Text>
            {requests.length === 0 ? (
              <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.clubs.noPending}</Text>
            ) : (
              requests.map((m) =>
                renderRow(
                  m,
                  <View style={[theme.row(), { gap: 6 }]}>
                    <Button
                      label={t.clubs.approve}
                      size="sm"
                      disabled={pending}
                      onPress={() => run(() => respondJoinRequest(club.id, m.userId, true))}
                    />
                    <Button
                      label={t.clubs.decline}
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onPress={() => run(() => respondJoinRequest(club.id, m.userId, false))}
                    />
                  </View>,
                  ' ',
                ),
              )
            )}
          </View>
        ) : null}

        <View>
          {active.map((m) =>
            renderRow(
              m,
              isManager && m.userId !== me && m.role !== 'owner' && menuItems(m).length > 0 ? (
                <IconButton accessibilityLabel={t.common.more} onPress={() => setMenuFor(m)}>
                  <MoreHorizontal size={18} color={theme.colors.textMuted} />
                </IconButton>
              ) : m.userId !== me && !connectedIds.has(m.userId) && !requestedIds.has(m.userId) ? (
                <Button
                  label={t.neighbors.addNeighbor}
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onPress={() => run(() => sendNeighborRequest(m.userId))}
                />
              ) : undefined,
            ),
          )}
        </View>

        {isManager && banned.length > 0 ? (
          <View>
            <Text style={[theme.text('title'), { marginBottom: 8 }]}>{t.clubs.banned}</Text>
            {banned.map((m) =>
              renderRow(
                m,
                <Button label={t.clubs.unban} size="sm" variant="outline" onPress={() => run(() => unbanClubMember(club.id, m.userId))} />,
                ' ',
              ),
            )}
          </View>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? nameOf(menuFor.userId) : undefined}
        items={
          menuFor
            ? menuItems(menuFor).map((i) => ({
                ...i,
                onPress: () => {
                  setMenuFor(null);
                  i.onPress();
                },
              }))
            : []
        }
      />
      <ConfirmationModal
        visible={confirm !== null}
        title={confirm?.kind === 'transfer' ? t.clubs.transferOwnership : confirm?.kind === 'ban' ? t.clubs.ban : t.clubs.remove}
        body={
          confirm
            ? (confirm.kind === 'transfer'
                ? t.clubs.transferConfirm
                : confirm.kind === 'ban'
                  ? t.clubs.banConfirm
                  : t.clubs.removeConfirm
              ).replace('{name}', confirm.name)
            : undefined
        }
        destructive={confirm?.kind !== 'transfer'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (!c) return;
          if (c.kind === 'transfer') run(() => transferClubOwnership(club.id, c.member.userId));
          else run(() => removeClubMember(club.id, c.member.userId, c.kind === 'ban'));
        }}
      />
    </View>
  );
}
