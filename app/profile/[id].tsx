import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Calendar, HandHeart, MessageCircle, MoreHorizontal, Settings, Shield, Sparkles, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { fetchProfile, getOrCreateDirectConversation, toggleBlockUser } from '@/backend/actions';
import { displayName, localizeDigits } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ThankSheet } from '@/features/profile/ThankSheet';
import { PostCard } from '@/features/feed/PostCard';
import { EventCard } from '@/features/events/EventCard';
import { ActionSheet } from '@/components/ActionSheet';
import { IconButton } from '@/components/IconButton';
import { ReportSheet } from '@/components/ReportSheet';
import { SkeletonCardRow } from '@/components/Skeleton';
import { NeighborButton } from '@/features/neighbors/NeighborButton';
import { useNeighborProfile } from '@/features/neighbors/useNeighborProfile';

const TIER_ORDER = ['new_neighbor', 'neighbor', 'contributor', 'community_builder', 'community_champion'] as const;

export default function ProfileScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const me = useCurrentUserId();
  const { run } = useAction();
  const user = useStore((s) => s.getUser(id ?? ''));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === user?.neighborhoodId));
  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allPosts = useStore((s) => s.posts);
  const allEvents = useStore((s) => s.events);
  const allRecommendations = useStore((s) => s.recommendations);
  const businesses = useStore((s) => s.businesses);
  const posts = useMemo(() => allPosts.filter((p) => p.authorId === id), [allPosts, id]);
  const events = useMemo(() => allEvents.filter((e) => e.hostId === id), [allEvents, id]);
  const recommendations = useMemo(() => allRecommendations.filter((r) => r.authorId === id), [allRecommendations, id]);

  const [tab, setTab] = useState<'activity' | 'events' | 'recommendations'>(
    initialTab === 'events' || initialTab === 'recommendations' ? initialTab : 'activity',
  );
  const [thankOpen, setThankOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'done'>('loading');
  const isOwn = id === me;
  const { info, reload } = useNeighborProfile(isOwn ? undefined : id);
  const myInterests = useStore((s) => s.myInterests);
  const theirInterests = useStore((s) => (id ? s.profileInterests[id] : undefined));
  const blocked = useStore((s) => s.blockedUserIds.includes(id ?? ''));
  const existingThread = useStore((s) =>
    s.conversations.some((c) => c.kind === 'direct' && c.participantIds.includes(id ?? '') && c.participantIds.includes(me)),
  );

  // Profiles opened from discovery (or a link) may not be in the synced store yet;
  // RLS decides whether this resident may see them at all.
  useEffect(() => {
    if (!id || isOwn) {
      setLoadState('done');
      return;
    }
    fetchProfile(id)
      .catch(() => null)
      .finally(() => setLoadState('done'));
  }, [id, isOwn]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/" />
        {loadState === 'loading' ? (
          <View style={{ padding: theme.spacing.md }}>
            <SkeletonCardRow count={2} />
          </View>
        ) : (
          <EmptyState title={t.errors.notFound} />
        )}
      </View>
    );
  }

  const interests = isOwn ? myInterests : (theirInterests ?? []);
  const canMessage = !isOwn && !blocked && (existingThread || !!info?.canMessage);
  const tierIndex = TIER_ORDER.indexOf(user.reputationTier);
  const progress = ((tierIndex + 1) / TIER_ORDER.length) * 100;

  const startConversation = async () => {
    const res = await run(() => getOrCreateDirectConversation(user.id));
    if (res.ok) router.push(`/messages/${res.value}`);
  };

  const tabs = [
    { key: 'activity' as const, label: t.profile.activity },
    { key: 'events' as const, label: t.profile.events },
    { key: 'recommendations' as const, label: t.profile.recommendations },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={displayName(user)}
        fallbackRoute="/"
        right={
          isOwn ? (
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" hitSlop={8}>
              <Settings size={20} color={theme.colors.textPrimary} />
            </Pressable>
          ) : (
            <IconButton accessibilityLabel={t.common.more} onPress={() => setMenuOpen(true)}>
              <MoreHorizontal size={20} color={theme.colors.textPrimary} />
            </IconButton>
          )
        }
      />

      <FlatList
        data={tab === 'activity' ? posts : tab === 'events' ? events : recommendations}
        keyExtractor={(item: { id: string }) => item.id}
        contentContainerStyle={{ paddingBottom: 60 }}
        ListHeaderComponent={
          <View style={{ padding: theme.spacing.md }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Avatar uri={user.avatarUrl} name={displayName(user)} size={92} ring />
              <View style={[theme.row(), { alignItems: 'center', gap: 5, marginTop: 10 }]}>
                <Text style={theme.text('heading2')}>{displayName(user)}</Text>
                {user.verification === 'verified' ? <BadgeCheck size={18} color={theme.colors.primary} /> : null}
              </View>
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>
                {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn}
              </Text>
              {user.bio ? <Text style={[theme.text('body', theme.colors.textSecondary), styles.bio]}>{user.bio}</Text> : null}

              {info?.neighborCount != null || info?.mutualCount ? (
                <View style={[theme.row(), { gap: 6, alignItems: 'center', marginTop: 8 }]}>
                  <Users size={14} color={theme.colors.textMuted} />
                  <Text style={theme.text('caption', theme.colors.textMuted)}>
                    {[
                      info?.neighborCount != null
                        ? t.neighbors.neighborCount.replace('{n}', localizeDigits(info.neighborCount, locale))
                        : null,
                      info?.mutualCount ? t.neighbors.mutual.replace('{n}', localizeDigits(info.mutualCount, locale)) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              ) : null}

              {interests.length > 0 ? (
                <View style={{ width: '100%', marginTop: 12 }}>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 6, textAlign: 'center' }]}>
                    {t.neighbors.interestsTitle}
                  </Text>
                  <View style={[theme.row(), { gap: 6, flexWrap: 'wrap', justifyContent: 'center' }]}>
                    {interests.map((i) => (
                      <Chip key={i} label={t.neighbors.interests[i]} selected={!isOwn && !!info?.sharedInterests.includes(i)} />
                    ))}
                  </View>
                </View>
              ) : null}

              {info && info.sharedClubs.length > 0 ? (
                <View style={{ width: '100%', marginTop: 12 }}>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginBottom: 6, textAlign: 'center' }]}>
                    {t.neighbors.sharedClubs}
                  </Text>
                  <View style={[theme.row(), { gap: 6, flexWrap: 'wrap', justifyContent: 'center' }]}>
                    {info.sharedClubs.map((c) => (
                      <Chip
                        key={c.id}
                        label={c.name}
                        icon={<Shield size={13} color={theme.colors.textSecondary} />}
                        onPress={() => router.push(`/clubs/${c.id}`)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={[styles.tierWrap, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.md }]}>
                <View style={[theme.row(), { alignItems: 'center', gap: 6, marginBottom: 6 }]}>
                  <Sparkles size={14} color={theme.colors.primary} />
                  <Text style={theme.text('bodySmall')}>{t.reputation[user.reputationTier]}</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.colors.primary }]} />
                </View>
              </View>

              <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 10 }]}>
                {t.profile.memberSince} {new Date(user.memberSince).getFullYear()}
              </Text>

              <View style={[theme.row(), styles.statsRow]}>
                <Stat value={user.stats.neighborsHelped} label={t.profile.neighborsHelped} />
                <Stat value={user.stats.eventsHosted} label={t.profile.eventsHosted} />
                <Stat value={user.stats.thanksReceived} label={t.profile.thanksReceived} />
              </View>

              <View style={[theme.row(), { gap: 10, marginTop: 16 }]}>
                {isOwn ? (
                  <Button label={t.profile.editProfile} onPress={() => router.push('/settings/edit-profile')} variant="outline" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <NeighborButton userId={user.id} name={displayName(user)} info={info} onChanged={reload} />
                    <View style={[theme.row(), { gap: 10 }]}>
                      <Button
                        label={t.profile.thankNeighbor}
                        onPress={() => setThankOpen(true)}
                        variant="outline"
                        icon={<HandHeart size={16} color={theme.colors.primary} />}
                      />
                      {canMessage ? (
                        <Button
                          label={t.common.message}
                          onPress={startConversation}
                          variant="outline"
                          icon={<MessageCircle size={16} color={theme.colors.primary} />}
                        />
                      ) : null}
                    </View>
                    {!canMessage && !blocked && info?.state !== 'blocked' ? (
                      <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center' }]}>
                        {t.neighbors.messageAfterConnect}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </View>

            <View style={[theme.row(), { gap: 8, marginBottom: 12 }]}>
              {tabs.map((tb) => (
                <Chip key={tb.key} label={tb.label} selected={tab === tb.key} onPress={() => setTab(tb.key)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 12 }}>
            {tab === 'activity' ? (
              <PostCard post={item as never} />
            ) : tab === 'events' ? (
              <EventCard event={item as never} />
            ) : (
              <RecommendationRow recommendation={item as never} businesses={businesses} />
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: theme.spacing.md }}>
            <EmptyState
              icon={tab === 'events' ? Calendar : undefined}
              title={tab === 'activity' ? t.emptyStates.noPosts : tab === 'events' ? t.emptyStates.noEvents : t.emptyStates.noResults}
              compact
            />
          </View>
        }
      />

      <ThankSheet visible={thankOpen} onClose={() => setThankOpen(false)} userId={user.id} />
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            key: 'report',
            label: t.common.report,
            onPress: () => {
              setMenuOpen(false);
              setReportOpen(true);
            },
          },
          {
            key: 'block',
            label: blocked ? t.common.unblock : t.common.block,
            destructive: !blocked,
            onPress: async () => {
              setMenuOpen(false);
              await run(() => toggleBlockUser(user.id));
              reload();
            },
          },
        ]}
      />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={user.id} />
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={theme.text('heading3')}>{value}</Text>
      <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function RecommendationRow({
  recommendation,
  businesses,
}: {
  recommendation: { id: string; businessId: string; textAr: string };
  businesses: { id: string; name: string }[];
}) {
  const theme = useTheme();
  const router = useRouter();
  const business = businesses.find((b) => b.id === recommendation.businessId);
  return (
    <Pressable
      onPress={() => router.push(`/business/${recommendation.businessId}`)}
      style={[styles.recRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md }]}
    >
      <Text style={theme.text('title')}>{business?.name}</Text>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 4 }]}>{recommendation.textAr}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bio: { textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  tierWrap: { width: '100%', padding: 12, marginTop: 16 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  statsRow: { width: '100%', marginTop: 18 },
  recRow: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
