import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BadgeCheck,
  Calendar,
  Camera,
  HandHeart,
  Images,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Settings,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { fetchProfile, getOrCreateDirectConversation, toggleBlockUser } from '@/backend/actions';
import { fetchAuthorPosts, removeFollower, respondFollowRequest } from '@/backend/social';
import { useSocialAvailable } from '@/backend/socialState';
import type { CommunityEvent, Post } from '@/models';
import { displayName, localizeDigits } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { ActionSheet, type ActionSheetItem } from '@/components/ActionSheet';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { IconButton } from '@/components/IconButton';
import { ReportSheet } from '@/components/ReportSheet';
import { SkeletonCardRow } from '@/components/Skeleton';
import { ThankSheet } from '@/features/profile/ThankSheet';
import { PostCard } from '@/features/feed/PostCard';
import { EventCard } from '@/features/events/EventCard';
import { NeighborButton } from '@/features/neighbors/NeighborButton';
import { useNeighborProfile } from '@/features/neighbors/useNeighborProfile';
import { FollowButton } from '@/features/social/FollowButton';
import { ProfilePhotoViewer } from '@/features/social/ProfilePhotoViewer';
import { useSocialProfile } from '@/features/social/useSocialProfile';
import { imageCachePolicy } from '@/backend/mediaPrivacy';

const TIER_ORDER = ['new_neighbor', 'neighbor', 'contributor', 'community_builder', 'community_champion'] as const;
type Tab = 'posts' | 'activities' | 'events' | 'recommendations';
const TABS: Tab[] = ['posts', 'activities', 'events', 'recommendations'];

export default function ProfileScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const me = useCurrentUserId();
  const { run } = useAction();
  const socialOn = useSocialAvailable();
  const isOwn = id === me;

  const user = useStore((s) => s.getUser(id ?? ''));
  const { profile: sp, status: spStatus, reload: reloadSocial, setProfile } = useSocialProfile(id);
  const neighborhoodId = user?.neighborhoodId || sp?.neighborhoodId;
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === neighborhoodId));
  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allPosts = useStore((s) => s.posts);
  const allEvents = useStore((s) => s.events);
  const allRecommendations = useStore((s) => s.recommendations);
  const businesses = useStore((s) => s.businesses);
  const myInterests = useStore((s) => s.myInterests);
  const theirInterests = useStore((s) => (id ? s.profileInterests[id] : undefined));
  const blocked = useStore((s) => s.blockedUserIds.includes(id ?? ''));
  const existingThread = useStore((s) =>
    s.conversations.some((c) => c.kind === 'direct' && c.participantIds.includes(id ?? '') && c.participantIds.includes(me)),
  );
  const { info, reload: reloadNeighbor } = useNeighborProfile(isOwn ? undefined : id);

  const [authorPosts, setAuthorPosts] = useState<Post[] | null>(null);
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'posts');
  const [thankOpen, setThankOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'done'>('loading');

  // Profiles opened from discovery, a follow list or a link may not be in the
  // synced store yet; RLS decides whether this resident may see them at all.
  useEffect(() => {
    if (!id || isOwn) {
      setLoadState('done');
      return;
    }
    fetchProfile(id)
      .catch(() => null)
      .finally(() => setLoadState('done'));
  }, [id, isOwn]);

  const canViewContent = isOwn || !sp || sp.canViewContent;
  useEffect(() => {
    if (!id || !socialOn || !canViewContent) return;
    fetchAuthorPosts(id)
      .then(setAuthorPosts)
      .catch(() => setAuthorPosts(null));
  }, [id, socialOn, canViewContent, sp?.followState]);

  const posts = useMemo(() => authorPosts ?? allPosts.filter((p) => p.authorId === id), [authorPosts, allPosts, id]);
  const photoPosts = useMemo(() => posts.filter((p) => p.images.length > 0), [posts]);
  const textPosts = useMemo(() => posts.filter((p) => p.images.length === 0), [posts]);
  const hosted = useMemo(() => allEvents.filter((e) => e.hostId === id), [allEvents, id]);
  const activities = useMemo(() => hosted.filter((e) => e.kind === 'activity'), [hosted]);
  const events = useMemo(() => hosted.filter((e) => e.kind !== 'activity'), [hosted]);
  const recommendations = useMemo(() => allRecommendations.filter((r) => r.authorId === id), [allRecommendations, id]);

  const waiting = !user && (loadState === 'loading' || (socialOn && spStatus === 'loading'));
  if (!user && !sp) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/" />
        {waiting || (spStatus === 'loading' && loadState === 'loading') ? (
          <View style={{ padding: theme.spacing.md }}>
            <SkeletonCardRow count={2} />
          </View>
        ) : (
          <EmptyState title={t.social.unavailable} />
        )}
      </View>
    );
  }

  const person = {
    firstName: user?.firstName ?? sp?.firstName ?? '',
    lastName: user?.lastName ?? sp?.lastName ?? '',
    namePrivacy: user?.namePrivacy ?? sp?.namePrivacy ?? 'first_last_initial',
  };
  const name = displayName(person);
  const avatarUrl = user?.avatarUrl ?? sp?.avatarUrl;
  const avatarPath = user?.avatarPath ?? sp?.avatarPath;
  const verified = sp ? sp.verified : user?.verification === 'verified';
  const bio = user?.bio ?? sp?.bio;
  const interests = isOwn ? myInterests : (theirInterests ?? []);
  const canMessage = !isOwn && !blocked && (existingThread || !!info?.canMessage);
  const tierIndex = user ? TIER_ORDER.indexOf(user.reputationTier) : 0;
  const progress = ((tierIndex + 1) / TIER_ORDER.length) * 100;
  const tile = (Math.min(width, 640) - 2 * 2) / 3;

  const refresh = () => {
    void reloadSocial();
    reloadNeighbor();
  };

  const startConversation = async () => {
    const res = await run(() => getOrCreateDirectConversation(id!));
    if (res.ok) router.push(`/messages/${res.value}`);
  };

  const answerRequest = async (accept: boolean) => {
    const res = await run(() => respondFollowRequest(id!, accept));
    if (res.ok) refresh();
  };

  const openList = (kind: 'followers' | 'following') => {
    if (canViewContent) router.push(`/follows/${id}?tab=${kind}`);
  };

  const menuItems: ActionSheetItem[] = [
    ...(sp?.followsYou ? [{ key: 'remove', label: t.social.removeFollower, onPress: () => setRemoveOpen(true) }] : []),
    { key: 'report', label: t.common.report, onPress: () => setReportOpen(true) },
    {
      key: 'block',
      label: blocked ? t.common.unblock : t.common.block,
      destructive: !blocked,
      onPress: async () => {
        setMenuOpen(false);
        await run(() => toggleBlockUser(id!));
        refresh();
      },
    },
  ];

  const tabLabel: Record<Tab, string> = {
    posts: t.social.tabPosts,
    activities: t.social.tabActivities,
    events: t.social.tabEvents,
    recommendations: t.social.tabRecommendations,
  };
  const TabIcon: Record<Tab, typeof Images> = { posts: Images, activities: Sparkles, events: Calendar, recommendations: HandHeart };

  type Item = { key: string; kind: 'grid'; row: Post[] } | { key: string; kind: 'post'; post: Post } | { key: string; kind: 'event'; event: CommunityEvent } | { key: string; kind: 'rec'; rec: (typeof recommendations)[number] };
  const items: Item[] = !canViewContent
    ? []
    : tab === 'posts'
      ? [
          ...Array.from({ length: Math.ceil(photoPosts.length / 3) }, (_, i) => ({
            key: `g${i}`,
            kind: 'grid' as const,
            row: photoPosts.slice(i * 3, i * 3 + 3),
          })),
          ...textPosts.map((p) => ({ key: p.id, kind: 'post' as const, post: p })),
        ]
      : tab === 'activities'
        ? activities.map((e) => ({ key: e.id, kind: 'event' as const, event: e }))
        : tab === 'events'
          ? events.map((e) => ({ key: e.id, kind: 'event' as const, event: e }))
          : recommendations.map((r) => ({ key: r.id, kind: 'rec' as const, rec: r }));

  const header = (
    <View style={{ padding: theme.spacing.md }}>
      {/* Identity */}
      <View style={[theme.row(), { alignItems: 'center', gap: 18 }]}>
        <Pressable onPress={() => setPhotoOpen(true)} accessibilityRole="imagebutton" accessibilityLabel={t.social.profilePhoto} testID="profile-avatar">
          <Avatar uri={avatarUrl} name={name} size={88} ring />
          {isOwn ? (
            <View style={[styles.cameraBadge, { backgroundColor: theme.colors.primary, borderColor: theme.colors.background }]}>
              <Camera size={12} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={[theme.row(), { flex: 1, justifyContent: 'space-around' }]}>
          <Count value={sp?.postsCount ?? posts.length} label={t.social.posts} />
          {sp ? (
            <>
              <Count value={sp.followersCount} label={t.social.followers} onPress={() => openList('followers')} testID="followers-count" />
              <Count value={sp.followingCount} label={t.social.following} onPress={() => openList('following')} testID="following-count" />
            </>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <View style={[theme.row(), { alignItems: 'center', gap: 5 }]}>
          <Text style={theme.text('heading3')} numberOfLines={1}>
            {name}
          </Text>
          {verified ? <BadgeCheck size={17} color={theme.colors.primary} accessibilityLabel={t.social.verifiedResident} /> : null}
          {sp?.isPrivate ? <Lock size={14} color={theme.colors.textMuted} accessibilityLabel={t.social.privateAccount} /> : null}
        </View>
        {neighborhood ? (
          <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn}</Text>
        ) : null}
        {sp?.followsYou && !isOwn ? <Text style={theme.text('caption', theme.colors.textMuted)}>{t.social.followsYou}</Text> : null}
        {bio ? <Text style={[theme.text('body'), { marginTop: 6 }]}>{bio}</Text> : null}
        {interests.length > 0 ? (
          <View style={[theme.row(), { gap: 6, flexWrap: 'wrap', marginTop: 10 }]}>
            {interests.map((i) => (
              <Chip key={i} label={t.neighbors.interests[i]} selected={!isOwn && !!info?.sharedInterests.includes(i)} />
            ))}
          </View>
        ) : null}
      </View>

      {/* Actions */}
      <View style={[theme.row(), { gap: 8, marginTop: 14 }]}>
        {isOwn ? (
          <>
            <View style={{ flex: 1 }}>
              <Button label={t.profile.editProfile} onPress={() => router.push('/settings/edit-profile')} variant="outline" fullWidth />
            </View>
            {socialOn ? (
              <IconButton accessibilityLabel={t.social.followRequests} onPress={() => router.push('/follow-requests')}>
                <UserPlus size={20} color={theme.colors.textPrimary} />
              </IconButton>
            ) : null}
          </>
        ) : (
          <>
            {sp && !blocked ? (
              <View style={{ flex: 1 }}>
                <FollowButton
                  userId={id!}
                  name={name}
                  state={sp.followState}
                  followsYou={sp.followsYou}
                  onChanged={(followState) => {
                    setProfile({ ...sp, followState });
                    void reloadSocial();
                  }}
                />
              </View>
            ) : null}
            {canMessage ? (
              <View style={{ flex: 1 }}>
                <Button
                  label={t.social.message}
                  onPress={startConversation}
                  variant="outline"
                  fullWidth
                  icon={<MessageCircle size={16} color={theme.colors.primary} />}
                />
              </View>
            ) : null}
          </>
        )}
      </View>

      {sp?.requestedYou && !isOwn ? (
        <View style={[styles.requestBox, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.md }]}>
          <Text style={[theme.text('bodySmall'), { flex: 1 }]}>{t.social.requestedYou}</Text>
          <Button label={t.social.accept} size="sm" onPress={() => answerRequest(true)} />
          <Button label={t.social.decline} size="sm" variant="outline" onPress={() => answerRequest(false)} />
        </View>
      ) : null}
      {blocked ? <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 10 }]}>{t.social.blockedNotice}</Text> : null}

      {/* Tabs */}
      {canViewContent ? (
        <View style={[theme.row(), styles.tabs, { borderColor: theme.colors.border }]} accessibilityRole="tablist">
          {TABS.map((k) => {
            const Icon = TabIcon[k];
            const active = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={[styles.tab, active && { borderBottomColor: theme.colors.primary }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tabLabel[k]}
                testID={`profile-tab-${k}`}
              >
                <Icon size={20} color={active ? theme.colors.primary : theme.colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={[styles.lockBox, { borderColor: theme.colors.border }]} testID="private-profile">
          <Lock size={28} color={theme.colors.textMuted} />
          <Text style={[theme.text('title'), { marginTop: 8 }]}>{t.social.privateAccountTitle}</Text>
          <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { textAlign: 'center' }]}>{t.social.privateAccountBody}</Text>
        </View>
      )}
    </View>
  );

  const footer = user ? (
    <View style={{ padding: theme.spacing.md, paddingBottom: 60 }}>
      <Text style={[theme.text('title'), { marginBottom: 10 }]}>{t.social.neighborhoodStats}</Text>
      <View style={[styles.statsCard, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.md }]}>
        <View style={[theme.row(), { alignItems: 'center', gap: 6, marginBottom: 6 }]}>
          <Sparkles size={14} color={theme.colors.primary} />
          <Text style={theme.text('bodySmall')}>{t.reputation[user.reputationTier]}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.colors.primary }]} />
        </View>
        <View style={[theme.row(), { marginTop: 14 }]}>
          <Stat value={user.stats.neighborsHelped} label={t.profile.neighborsHelped} />
          <Stat value={user.stats.eventsHosted} label={t.profile.eventsHosted} />
          <Stat value={user.stats.thanksReceived} label={t.profile.thanksReceived} />
        </View>
        {info?.neighborCount != null || info?.mutualCount ? (
          <View style={[theme.row(), { gap: 6, alignItems: 'center', marginTop: 12 }]}>
            <Users size={14} color={theme.colors.textMuted} />
            <Text style={theme.text('caption', theme.colors.textMuted)}>
              {[
                info?.neighborCount != null ? t.neighbors.neighborCount.replace('{n}', localizeDigits(info.neighborCount, locale)) : null,
                info?.mutualCount ? t.neighbors.mutual.replace('{n}', localizeDigits(info.mutualCount, locale)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ) : null}
        <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 10 }]}>
          {t.profile.memberSince} {new Date(user.memberSince).getFullYear()}
        </Text>
      </View>

      {info && info.sharedClubs.length > 0 ? (
        <View style={[theme.row(), { gap: 6, flexWrap: 'wrap', marginTop: 12 }]}>
          {info.sharedClubs.map((c) => (
            <Chip key={c.id} label={c.name} icon={<Shield size={13} color={theme.colors.textSecondary} />} onPress={() => router.push(`/clubs/${c.id}`)} />
          ))}
        </View>
      ) : null}

      {!isOwn ? (
        <View style={{ alignItems: 'center', gap: 10, marginTop: 14 }}>
          <NeighborButton userId={user.id} name={name} info={info} onChanged={reloadNeighbor} />
          <Button
            label={t.profile.thankNeighbor}
            onPress={() => setThankOpen(true)}
            variant="ghost"
            icon={<HandHeart size={16} color={theme.colors.primary} />}
          />
          {!canMessage && !blocked && info && info.state !== 'blocked' ? (
            <Text style={[theme.text('caption', theme.colors.textMuted), { textAlign: 'center' }]}>{t.neighbors.messageAfterConnect}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  ) : (
    <View style={{ height: 60 }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={name}
        fallbackRoute="/"
        right={
          isOwn ? (
            <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel={t.profile.settings} hitSlop={8}>
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
        data={items}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        renderItem={({ item }) => {
          if (item.kind === 'grid') {
            return (
              <View style={[theme.row(), { gap: 2, marginBottom: 2, paddingHorizontal: 0 }]}>
                {item.row.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/post/${p.id}`)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={p.textAr || t.social.tabPosts}
                    testID="grid-tile"
                  >
                    <Image source={{ uri: p.images[0] }} cachePolicy={imageCachePolicy(p.images[0])} style={{ width: tile, height: tile, backgroundColor: theme.colors.backgroundAlt }} contentFit="cover" transition={120} />
                    {p.images.length > 1 ? (
                      <View style={styles.multiBadge}>
                        <Images size={14} color="#fff" />
                      </View>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            );
          }
          return (
            <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 12, marginTop: item.kind === 'post' ? 8 : 0 }}>
              {item.kind === 'post' ? (
                <PostCard post={item.post} />
              ) : item.kind === 'event' ? (
                <EventCard event={item.event} />
              ) : (
                <RecommendationRow recommendation={item.rec} businesses={businesses} />
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          canViewContent ? (
            <View style={{ paddingHorizontal: theme.spacing.md }}>
              <EmptyState
                icon={tab === 'events' || tab === 'activities' ? Calendar : Images}
                title={tab === 'posts' ? t.social.noPhotoPosts : tab === 'recommendations' ? t.emptyStates.noResults : t.emptyStates.noEvents}
                compact
              />
            </View>
          ) : null
        }
      />

      <ProfilePhotoViewer
        visible={photoOpen}
        uri={avatarUrl}
        path={avatarPath}
        name={name}
        isOwn={isOwn}
        onClose={() => setPhotoOpen(false)}
        onChanged={refresh}
      />
      {user ? <ThankSheet visible={thankOpen} onClose={() => setThankOpen(false)} userId={user.id} /> : null}
      <ActionSheet visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={id ?? ''} />
      <ConfirmationModal
        visible={removeOpen}
        title={t.social.removeFollowerConfirm.replace('{name}', name)}
        confirmLabel={t.social.remove}
        destructive
        onCancel={() => setRemoveOpen(false)}
        onConfirm={async () => {
          setRemoveOpen(false);
          const res = await run(() => removeFollower(id!));
          if (res.ok) refresh();
        }}
      />
    </View>
  );
}

function Count({ value, label, onPress, testID }: { value: number; label: string; onPress?: () => void; testID?: string }) {
  const theme = useTheme();
  const { locale } = useI18n();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', minWidth: 64 }} accessibilityRole={onPress ? 'button' : 'text'} testID={testID}>
      <Text style={theme.text('heading3')}>{localizeDigits(value, locale)}</Text>
      <Text style={theme.text('caption', theme.colors.textSecondary)} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 12 },
  tabs: { marginTop: 18, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: -16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  lockBox: { alignItems: 'center', gap: 4, paddingVertical: 28, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  statsCard: { padding: 14 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  multiBadge: { position: 'absolute', top: 6, right: 6 },
  recRow: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
