import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { fetchClubApplications, type AdminClubApplication } from '@/backend/actions';
import type { ClubReviewStatus } from '@/models';
import { formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';

const TABS: ClubReviewStatus[] = ['pending_review', 'needs_changes', 'approved', 'suspended', 'rejected'];

/**
 * Admin review queue. Visible only to profiles.app_role = 'admin'; the
 * admin_club_applications RPC refuses everyone else, so hiding the screen is a
 * convenience, not the security boundary.
 */
export default function AdminClubsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const isAdmin = useStore((s) => s.currentUser()?.role === 'admin');
  const [status, setStatus] = useState<ClubReviewStatus>('pending_review');
  const [rows, setRows] = useState<AdminClubApplication[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRows(await fetchClubApplications(status));
    } catch {
      setFailed(true);
    }
  }, [status]);

  useEffect(() => {
    if (!isAdmin) return;
    setRows(null);
    load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title={t.clubs.admin.title} fallbackRoute="/settings" />
        <EmptyState title={t.clubs.admin.notAdmin} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.clubs.admin.title} fallbackRoute="/settings" />
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={TABS.map((s) => ({ key: s, label: t.clubs.status[s] }))}
          selected={status}
          onSelect={(k) => setStatus(k as ClubReviewStatus)}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.md, gap: 10, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        {failed ? (
          <EmptyState title={t.errors.genericTitle} actionLabel={t.common.retry} onAction={load} />
        ) : rows === null ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : rows.length === 0 ? (
          <EmptyState title={t.clubs.admin.empty} compact />
        ) : (
          rows.map((r) => (
            <Card key={r.clubId} onPress={() => router.push(`/admin/clubs/${r.clubId}`)} accessibilityLabel={r.name}>
              <Text style={theme.text('title')} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>
                {r.ownerName || t.common.neighbor} · {(locale === 'ar' ? r.neighborhoodNameAr : r.neighborhoodNameEn) ?? r.neighborhoodId}
                {r.submittedAt ? ` · ${formatRelativeTime(r.submittedAt, locale)}` : ''}
              </Text>
              <View style={[theme.row(), { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
                <Badge label={r.ownerIsAdult ? t.clubs.admin.adult : t.clubs.admin.notAdult} tone={r.ownerIsAdult ? 'success' : 'danger'} />
                <Badge
                  label={r.ownerVerifiedNeighborhood === r.neighborhoodId ? t.clubs.admin.verifiedNeighborhood : t.clubs.admin.notVerified}
                  tone={r.ownerVerifiedNeighborhood === r.neighborhoodId ? 'success' : 'warning'}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
