import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckSquare, Square } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { cancelEventInvitation, inviteNeighborsToEvent, inviteNeighborToClub } from '@/backend/actions';
import { displayName, localizeDigits } from '@/utils/format';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Exactly one target: an activity or a club. */
  eventId?: string;
  clubId?: string;
  /** People who can't be invited (already attending / already members). */
  excludeUserIds?: string[];
}

/**
 * Pick connected neighbors to invite. Only my real connections are listed;
 * the server re-checks eligibility, skips duplicates and never enrolls anyone.
 */
export function InviteNeighborsSheet({ visible, onClose, eventId, clubId, excludeUserIds = [] }: Props) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { run, pending } = useAction();
  const me = useStore((s) => s.session.supabaseUserId ?? '');
  const connections = useStore((s) => s.neighborConnections);
  const users = useStore((s) => s.users);
  const invitations = useStore((s) => s.eventInvitations);
  const [selected, setSelected] = useState<string[]>([]);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const mine = useMemo(
    () => (eventId ? invitations.filter((i) => i.eventId === eventId && i.inviterId === me) : []),
    [invitations, eventId, me],
  );
  const candidates = connections.filter((c) => !excludeUserIds.includes(c.userId));

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const send = async () => {
    if (selected.length === 0) return;
    if (eventId) {
      const res = await run(() => inviteNeighborsToEvent(eventId, selected));
      if (res.ok) setSentNote(t.neighbors.invitedCount.replace('{n}', localizeDigits(res.value, locale)));
    } else if (clubId) {
      let sent = 0;
      for (const id of selected) {
        const res = await run(() => inviteNeighborToClub(clubId, id));
        if (res.ok && res.value) sent += 1;
      }
      setSentNote(t.neighbors.invitedCount.replace('{n}', localizeDigits(sent, locale)));
    }
    setSelected([]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
        <Text style={theme.text('heading3')}>{clubId ? t.neighbors.inviteToClub : t.neighbors.inviteNeighbors}</Text>
        <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4, marginBottom: 10 }]}>{t.neighbors.inviteBody}</Text>
        {candidates.length === 0 ? (
          <Text style={[theme.text('bodySmall', theme.colors.textMuted), { paddingVertical: 16 }]}>{t.neighbors.noNeighborsToInvite}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {candidates.map((c) => {
              const u = users.find((x) => x.id === c.userId);
              const name = u ? displayName(u) : t.common.neighbor;
              const invitation = mine.find((i) => i.inviteeId === c.userId && i.status !== 'cancelled');
              const checked = selected.includes(c.userId);
              return (
                <View key={c.userId} style={[theme.row(), styles.row, { borderBottomColor: theme.colors.divider }]}>
                  <Avatar uri={u?.avatarUrl} name={name} size={38} />
                  <Text style={[theme.text('body'), { flex: 1 }]} numberOfLines={1}>
                    {name}
                  </Text>
                  {invitation ? (
                    <View style={[theme.row(), { gap: 8, alignItems: 'center' }]}>
                      <Text style={theme.text('caption', theme.colors.textMuted)}>{t.neighbors.inviteStatus[invitation.status]}</Text>
                      {invitation.status === 'pending' ? (
                        <Pressable onPress={() => run(() => cancelEventInvitation(invitation.id))} accessibilityRole="button" hitSlop={8}>
                          <Text style={theme.text('caption', theme.colors.danger)}>{t.neighbors.cancelInvite}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => toggle(c.userId)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      accessibilityLabel={name}
                      hitSlop={10}
                    >
                      {checked ? (
                        <CheckSquare size={22} color={theme.colors.primary} />
                      ) : (
                        <Square size={22} color={theme.colors.textMuted} />
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
        {sentNote ? <Text style={[theme.text('bodySmall', theme.colors.primary), { marginTop: 10 }]}>{sentNote}</Text> : null}
        <View style={{ marginTop: 12 }}>
          <Button label={t.neighbors.inviteSend} onPress={send} disabled={selected.length === 0 || pending} loading={pending} fullWidth />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
