import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Calendar, HandHeart, MessageCircle, Settings, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { displayName } from '@/utils/format';
import { messageService } from '@/services';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ThankSheet } from '@/features/profile/ThankSheet';
import { PostCard } from '@/features/feed/PostCard';
import { EventCard } from '@/features/events/EventCard';

const TIER_ORDER = ['new_neighbor', 'neighbor', 'contributor', 'community_builder', 'community_champion'] as const;

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

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
  const recommendations = useMemo(
    () => allRecommendations.filter((r) => r.authorId === id),
    [allRecommendations, id],
  );

  const [tab, setTab] = useState<'activity' | 'events' | 'recommendations'>('activity');
  const [thankOpen, setThankOpen] = useState(false);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const isOwn = user.id === CURRENT_USER_ID;
  const tierIndex = TIER_ORDER.indexOf(user.reputationTier);
  const progress = ((tierIndex + 1) / TIER_ORDER.length) * 100;

  const startConversation = async () => {
    const convo = await messageService.getOrCreateConversation(user.id);
    router.push(`/messages/${convo.id}`);
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
        right={
          isOwn ? (
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" hitSlop={8}>
              <Settings size={20} color={theme.colors.textPrimary} />
            </Pressable>
          ) : undefined
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
                  <>
                    <Button
                      label={t.profile.thankNeighbor}
                      onPress={() => setThankOpen(true)}
                      icon={<HandHeart size={16} color={theme.colors.onPrimary} />}
                    />
                    <Button
                      label={t.common.message}
                      onPress={startConversation}
                      variant="outline"
                      icon={<MessageCircle size={16} color={theme.colors.primary} />}
                    />
                  </>
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
