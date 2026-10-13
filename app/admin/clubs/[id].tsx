import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { CheckSquare, Square } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import {
  fetchClubApplications,
  fetchClubForReview,
  reviewClub,
  sendClubInactivityReminder,
  type AdminClubApplication,
  type AdminClubDetail,
  type ReviewDecision,
} from '@/backend/actions';
import { formatFullDate, formatRelativeTime, localizeDigits } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { CLUB_ICON, clubCategoryLabel } from '@/features/clubs/clubLogic';

/** One club application: every field, applicant context, history, signals, and the decision controls. */
export default function AdminClubReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const me = useCurrentUserId();
  const isAdmin = useStore((s) => s.currentUser()?.role === 'admin');
  const { run, pending } = useAction();
  const [detail, setDetail] = useState<AdminClubDetail | null | undefined>(undefined);
  const [applicant, setApplicant] = useState<AdminClubApplication | undefined>();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => t.clubs.admin.checklist.map(() => false));
  const [reminded, setReminded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, apps] = await Promise.all([fetchClubForReview(id), fetchClubApplications(null)]);
      setDetail(d);
      setApplicant(apps.find((a) => a.clubId === id));
    } catch {
      setDetail(null);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.admin.title} fallbackRoute="/admin/clubs" />
        <EmptyState title={t.clubs.admin.notAdmin} />
      </View>
    );
  }
  if (detail === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.admin.title} fallbackRoute="/admin/clubs" />
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} />
      </View>
    );
  }
  if (detail === null) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.admin.title} fallbackRoute="/admin/clubs" />
        <EmptyState title={t.errors.notFound} actionLabel={t.common.retry} onAction={load} />
      </View>
    );
  }

  const { club, decisions, signals } = detail;
  const ownClub = club.ownerId === me;
  const status = club.reviewStatus;
  const allChecked = checked.every(Boolean);

  const decide = async (decision: ReviewDecision) => {
    const needsReason = decision !== 'approved' && decision !== 'reinstated';
    if (needsReason && !reason.trim()) {
      setReasonError(true);
      return;
    }
    setReasonError(false);
    const res = await run(() => reviewClub(club.id, decision, reason));
    if (res.ok) {
      setReason('');
      load();
    }
  };

  const fieldRows: [string, string | undefined][] = [
    [t.clubs.fields.description, club.description],
    [t.clubs.fields.purpose, club.purpose],
    [t.clubs.fields.plannedActivities, club.plannedActivities],
    [t.clubs.fields.meetingFrequency, (t.clubs.frequency as Record<string, string>)[club.meetingFrequency] ?? club.meetingFrequency],
    [t.clubs.fields.benefit, club.neighborhoodBenefit],
    [t.clubs.fields.rules, club.rules],
    [t.clubs.fields.membershipType, club.membershipType === 'open' ? t.clubs.membershipOpen : t.clubs.membershipApproval],
    [t.clubs.fields.meetingLocation, club.meetingLocation],
    [t.clubs.fields.meetingSchedule, club.meetingSchedule],
    [t.clubs.fields.additionalInfo, club.additionalInfo],
  ];

  const signal = (label: string, value: string) => (
    <View key={label} style={[theme.row(), { justifyContent: 'space-between', paddingVertical: 4 }]}>
      <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{label}</Text>
      <Text style={theme.text('bodySmall')}>{value}</Text>
    </View>
  );
  const n = (v: number) => localizeDigits(v, locale);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title={club.name} fallbackRoute="/admin/clubs" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[theme.row(), { gap: 6, flexWrap: 'wrap' }]}>
          <Badge
            label={t.clubs.status[status]}
            tone={status === 'approved' ? 'success' : status === 'pending_review' ? 'warning' : 'danger'}
          />
          <Badge
            label={`${CLUB_ICON[club.category]} ${clubCategoryLabel(club, t.clubs.categories as Record<string, string>)}`}
            tone="neutral"
          />
        </View>

        {club.coverImage || club.logo ? (
          <View style={[theme.row(), { gap: 10 }]}>
            {club.coverImage ? <Image source={{ uri: club.coverImage }} style={styles.cover} contentFit="cover" /> : null}
            {club.logo ? <Image source={{ uri: club.logo }} style={styles.logo} contentFit="cover" /> : null}
          </View>
        ) : null}

        <Card>
          <Text style={[theme.text('title'), { marginBottom: 6 }]}>{t.clubs.admin.applicant}</Text>
          <Text style={theme.text('body')}>{applicant?.ownerName || t.common.neighbor}</Text>
          <View style={[theme.row(), { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
            <Badge
              label={signals.ownerIsAdult ? t.clubs.admin.adult : t.clubs.admin.notAdult}
              tone={signals.ownerIsAdult ? 'success' : 'danger'}
            />
            <Badge
              label={`${t.clubs.admin.verifiedNeighborhood}: ${
                applicant?.ownerVerifiedNeighborhood
                  ? applicant.ownerVerifiedNeighborhood === club.neighborhoodId
                    ? ((locale === 'ar' ? applicant.neighborhoodNameAr : applicant.neighborhoodNameEn) ?? club.neighborhoodId)
                    : applicant.ownerVerifiedNeighborhood
                  : t.clubs.admin.notVerified
              }`}
              tone={applicant?.ownerVerifiedNeighborhood === club.neighborhoodId ? 'success' : 'warning'}
            />
          </View>
          {club.submittedAt ? (
            <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 8 }]}>
              {t.clubs.admin.submitted}: {formatFullDate(club.submittedAt, locale)}
            </Text>
          ) : null}
        </Card>

        <Card>
          {fieldRows
            .filter(([, v]) => !!v)
            .map(([label, value]) => (
              <View key={label} style={{ marginBottom: 10 }}>
                <Text style={theme.text('caption', theme.colors.textMuted)}>{label}</Text>
                <Text style={theme.text('bodySmall')}>{value}</Text>
              </View>
            ))}
        </Card>

        <Card>
          <Text style={[theme.text('title'), { marginBottom: 6 }]}>{t.clubs.admin.signals}</Text>
          {signal(t.clubs.admin.signalMembers, n(signals.memberCount))}
          {signal(t.clubs.admin.signalPending, n(signals.pendingRequests))}
          {signal(t.clubs.admin.signalUpcoming, n(signals.upcomingActivities))}
          {signal(t.clubs.admin.signalPast90, n(signals.activitiesLast90Days))}
          {signal(t.clubs.admin.signalMessages30, n(signals.messagesLast30Days))}
          {signal(t.clubs.admin.signalAnnouncements30, n(signals.announcementsLast30Days))}
          {signal(t.clubs.admin.signalReports, n(signals.reportsOpen))}
          {signal(
            t.clubs.admin.signalLastActivity,
            signals.lastActivityAt ? formatRelativeTime(signals.lastActivityAt, locale) : t.clubs.admin.never,
          )}
          {status === 'approved' ? (
            <View style={{ marginTop: 10, gap: 6 }}>
              <Button
                label={reminded ? t.clubs.admin.reminderSent : t.clubs.admin.sendReminder}
                disabled={reminded || pending}
                variant="outline"
                size="sm"
                onPress={async () => {
                  const res = await run(() => sendClubInactivityReminder(club.id));
                  if (res.ok) setReminded(true);
                }}
              />
              <Text style={theme.text('caption', theme.colors.textMuted)}>{t.clubs.admin.reminderNote}</Text>
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={[theme.text('title'), { marginBottom: 6 }]}>{t.clubs.admin.history}</Text>
          {decisions.map((d) => (
            <View key={d.id} style={{ paddingVertical: 6 }}>
              <Text style={theme.text('bodySmall')}>
                {t.clubs.admin.decisions[d.decision]} · {formatRelativeTime(d.createdAt, locale)}
              </Text>
              {d.reason ? <Text style={theme.text('caption', theme.colors.textMuted)}>{d.reason}</Text> : null}
            </View>
          ))}
        </Card>

        {ownClub ? (
          <Text style={theme.text('bodySmall', theme.colors.danger)}>{t.clubs.errors.not_authorized}</Text>
        ) : (
          <Card>
            {status === 'pending_review' ? (
              <>
                <Text style={[theme.text('title'), { marginBottom: 6 }]}>{t.clubs.admin.checklistTitle}</Text>
                {t.clubs.admin.checklist.map((item, i) => (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: checked[i] }}
                    onPress={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                    style={[theme.row(), { gap: 8, paddingVertical: 6, alignItems: 'flex-start' }]}
                  >
                    {checked[i] ? (
                      <CheckSquare size={18} color={theme.colors.primary} />
                    ) : (
                      <Square size={18} color={theme.colors.textMuted} />
                    )}
                    <Text style={[theme.text('bodySmall'), { flex: 1 }]}>{item}</Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            {status !== 'rejected' ? (
              <View style={{ marginTop: 10 }}>
                <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 6 }]}>{t.clubs.admin.reasonLabel}</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={2000}
                  style={[
                    theme.text('body'),
                    styles.reason,
                    { borderColor: reasonError ? theme.colors.danger : theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}
                />
                {reasonError ? <Text style={theme.text('caption', theme.colors.danger)}>{t.clubs.admin.reasonRequired}</Text> : null}
              </View>
            ) : null}

            <View style={{ gap: 8, marginTop: 12 }}>
              {status === 'pending_review' ? (
                <>
                  <Button label={t.clubs.admin.approve} onPress={() => decide('approved')} disabled={!allChecked || pending} fullWidth />
                  <Button
                    label={t.clubs.admin.requestChanges}
                    onPress={() => decide('needs_changes')}
                    variant="outline"
                    disabled={pending}
                    fullWidth
                  />
                  <Button label={t.clubs.admin.reject} onPress={() => decide('rejected')} variant="danger" disabled={pending} fullWidth />
                </>
              ) : null}
              {status === 'needs_changes' ? (
                <Button label={t.clubs.admin.reject} onPress={() => decide('rejected')} variant="danger" disabled={pending} fullWidth />
              ) : null}
              {status === 'approved' ? (
                <>
                  <Button
                    label={t.clubs.admin.suspend}
                    onPress={() => decide('suspended')}
                    variant="outline"
                    disabled={pending}
                    fullWidth
                  />
                  <Button label={t.clubs.admin.revoke} onPress={() => decide('revoked')} variant="danger" disabled={pending} fullWidth />
                </>
              ) : null}
              {status === 'suspended' ? (
                <>
                  <Button label={t.clubs.admin.reinstate} onPress={() => decide('reinstated')} disabled={pending} fullWidth />
                  <Button label={t.clubs.admin.revoke} onPress={() => decide('revoked')} variant="danger" disabled={pending} fullWidth />
                </>
              ) : null}
            </View>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, height: 110, borderRadius: 12 },
  logo: { width: 110, height: 110, borderRadius: 55 },
  reason: { minHeight: 80, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, textAlignVertical: 'top' },
});
