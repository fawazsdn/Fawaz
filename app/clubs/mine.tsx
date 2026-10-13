import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar } from '@/components/FilterBar';
import { ClubCard } from '@/features/clubs/ClubCard';
import { EventCard } from '@/features/events/EventCard';

type Tab = 'joined' | 'organize' | 'pending' | 'upcoming';

/** My Clubs: clubs I joined, clubs I organize, pending requests/applications, and my clubs' upcoming activities. */
export default function MyClubsScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const me = useCurrentUserId();
  const clubs = useStore((s) => s.clubs);
  const memberships = useStore((s) => s.clubMemberships);
  const events = useStore((s) => s.events);
  const [tab, setTab] = useState<Tab>('joined');

  const mine = useMemo(() => memberships.filter((m) => m.userId === me), [memberships, me]);
  const byId = useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);
  const joined = useMemo(
    () => mine.filter((m) => m.status === 'active' && m.role === 'member').flatMap((m) => byId.get(m.clubId) ?? []),
    [mine, byId],
  );
  const organize = useMemo(
    () =>
      mine
        .filter((m) => m.status === 'active' && (m.role === 'owner' || m.role === 'moderator'))
        .flatMap((m) => byId.get(m.clubId) ?? [])
        .filter((c) => c.reviewStatus === 'approved' || c.reviewStatus === 'suspended'),
    [mine, byId],
  );
  const applications = useMemo(
    () => clubs.filter((c) => c.ownerId === me && c.reviewStatus !== 'approved' && c.reviewStatus !== 'suspended'),
    [clubs, me],
  );
  const requests = useMemo(() => mine.filter((m) => m.status === 'pending').flatMap((m) => byId.get(m.clubId) ?? []), [mine, byId]);
  const activeIds = useMemo(() => new Set(mine.filter((m) => m.status === 'active').map((m) => m.clubId)), [mine]);
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => e.clubId && activeIds.has(e.clubId) && !e.cancelled && new Date(e.endsAt).getTime() > Date.now())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [events, activeIds],
  );

  const browse = <Button label={t.clubs.browseClubs} onPress={() => router.push('/clubs')} variant="outline" size="sm" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.clubs.myClubs} fallbackRoute="/clubs" />
      <View style={{ marginBottom: 10 }}>
        <FilterBar
          options={[
            { key: 'joined', label: t.clubs.joined },
            { key: 'organize', label: t.clubs.organize },
            { key: 'pending', label: t.clubs.pending },
            { key: 'upcoming', label: t.clubs.upcomingClubActivities },
          ]}
          selected={tab}
          onSelect={(k) => setTab(k as Tab)}
        />
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48, gap: 12 }}>
        {tab === 'joined' ? (
          joined.length === 0 ? (
            <EmptyState title={t.clubs.noJoined} actionLabel={t.clubs.browseClubs} onAction={() => router.push('/clubs')} compact />
          ) : (
            joined.map((c) => <ClubCard key={c.id} club={c} />)
          )
        ) : null}

        {tab === 'organize' ? (
          organize.length === 0 ? (
            <EmptyState title={t.clubs.noOrganize} actionLabel={t.clubs.createClub} onAction={() => router.push('/clubs/create')} compact />
          ) : (
            organize.map((c) => <ClubCard key={c.id} club={c} showStatus />)
          )
        ) : null}

        {tab === 'pending' ? (
          applications.length + requests.length === 0 ? (
            <EmptyState title={t.clubs.noPendingMine} compact />
          ) : (
            <>
              {applications.length > 0 ? <Text style={theme.text('title')}>{t.clubs.myApplications}</Text> : null}
              {applications.map((c) => (
                <ClubCard key={c.id} club={c} showStatus />
              ))}
              {requests.length > 0 ? <Text style={[theme.text('title'), { marginTop: 8 }]}>{t.clubs.myJoinRequests}</Text> : null}
              {requests.map((c) => (
                <ClubCard key={c.id} club={c} />
              ))}
            </>
          )
        ) : null}

        {tab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <EmptyState title={t.clubs.noUpcoming} compact />
              {browse}
            </View>
          ) : (
            upcoming.map((e) => <EventCard key={e.id} event={e} />)
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
