import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, Text, View, type ViewToken } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Compass, LayoutGrid, Search, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchExploreFeed, fetchExplorePhoto, type ExploreCursor, type ExploreFeed, type ExploreItem } from '@/backend/exploreFeed';
import { PROFILE_PHOTO_BUCKET } from '@/backend/media';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { NoNeighborhoodState } from '@/components/NoNeighborhoodState';
import { VerifyGate, useNeedsVerification } from '@/components/VerifyGate';
import { PostCard } from '@/features/feed/PostCard';
import { useI18n } from '@/i18n/useI18n';
import { useCurrentUserId, useStore } from '@/store/useStore';
import { useTheme } from '@/theme/useTheme';

export function ExploreSocialFeed() {
  const theme = useTheme();
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const viewer = useCurrentUserId();
  const neighborhood = useStore((s) => s.session.neighborhoodId);
  const needsVerification = useNeedsVerification();
  const [feed, setFeed] = useState<ExploreFeed>('community');
  const [width, setWidth] = useState(0);
  const pager = useRef<ScrollView>(null);
  const pages: ExploreFeed[] = isRTL ? ['friends', 'community'] : ['community', 'friends'];

  useEffect(() => {
    if (width) pager.current?.scrollTo({ x: (isRTL ? 1 : 0) * width, animated: false });
    // When layout direction or page size changes, start from the Community page.
    setFeed('community');
  }, [isRTL, width]);

  if (!neighborhood) return <NoNeighborhoodState />;

  return (
    <View style={{ flex: 1, paddingTop: top + 8, backgroundColor: theme.colors.background }}>
      <View style={[theme.row(), { alignItems: 'center', paddingHorizontal: theme.spacing.md, gap: 6, marginBottom: 14 }]}>
        <Text accessibilityRole="header" style={[theme.text('heading1'), { flex: 1 }]}>{t.discover.title}</Text>
        <IconButton accessibilityLabel={t.discover.searchPlaceholder} onPress={() => router.push('/search')}>
          <Search size={21} color={theme.colors.primary} />
        </IconButton>
        <IconButton accessibilityLabel={t.discover.directory} onPress={() => router.push('/explore/directory')}>
          <LayoutGrid size={21} color={theme.colors.primary} />
        </IconButton>
      </View>
      <View style={[theme.row(), {
        marginHorizontal: theme.spacing.md, marginBottom: 12, gap: 4, padding: 4,
        borderRadius: theme.radii.lg, backgroundColor: theme.colors.backgroundAlt,
      }]}>
        {(['community', 'friends'] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: feed === tab }}
            onPress={() => {
              setFeed(tab);
              pager.current?.scrollTo({ x: pages.indexOf(tab) * width, animated: true });
            }}
            style={{
              flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radii.md,
              backgroundColor: feed === tab ? theme.colors.primary : 'transparent',
            }}
          >
            <Text style={theme.text('title', feed === tab ? theme.colors.onPrimary : theme.colors.textSecondary)}>
              {tab === 'community' ? t.discover.communityFeed : t.discover.friendsFeed}
            </Text>
          </Pressable>
        ))}
      </View>
      {needsVerification || !viewer ? <VerifyGate /> : (
        <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <ScrollView
              ref={pager}
              style={{ flex: 1, direction: 'ltr' }}
              horizontal
              pagingEnabled
              bounces={false}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const page = pages[Math.round(e.nativeEvent.contentOffset.x / width)];
                if (page) setFeed(page);
              }}
            >
              {pages.map((page) => (
                <View key={page} style={{ width }} accessibilityElementsHidden={page !== feed} importantForAccessibility={page === feed ? 'auto' : 'no-hide-descendants'}>
                  <FeedList
                    key={`${viewer}:${neighborhood}:${page}`}
                    feed={page}
                    active={page === feed}
                    bottom={bottom}
                  />
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}
    </View>
  );
}

function FeedList({ feed, active, bottom }: { feed: ExploreFeed; active: boolean; bottom: number }) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const blocked = useStore((s) => s.blockedUserIds);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(active);
  const [failed, setFailed] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [more, setMore] = useState(false);
  // Indexes of the rows on screen; photos load only for these and their neighbors.
  const [near, setNear] = useState<{ first: number; last: number }>({ first: 0, last: 2 });
  const cursor = useRef<ExploreCursor>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const enabled = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (!enabled.current || (!reset && busy.current)) return;
    busy.current = true;
    const version = ++request.current;
    setLoading(true);
    setFailed(false);
    if (reset) {
      cursor.current = null;
      setItems([]);
      setMore(false);
    }
    try {
      const page = await fetchExploreFeed(feed, cursor.current);
      if (request.current !== version) return;
      setItems((old) => reset ? page.items : [...old, ...page.items.filter((row) => !old.some((item) => item.post.id === row.post.id))]);
      cursor.current = page.next;
      setMore(page.next !== null);
    } catch {
      if (request.current !== version) return;
      setFailed(true);
      setItems([]);
      setMore(false);
    } finally {
      if (request.current === version) {
        setLoading(false);
        busy.current = false;
      }
    }
  }, [feed]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!active || !foreground) return;
    enabled.current = true;
    void load(true);
    return () => {
      enabled.current = false;
      request.current++;
      setItems([]);
      setLoading(false);
    };
  }, [active, foreground, load]));

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const indexes = viewableItems.map((v) => v.index).filter((i): i is number => i !== null);
    if (indexes.length) setNear({ first: Math.min(...indexes), last: Math.max(...indexes) });
  }).current;

  const refresh = useCallback(() => { void load(true); }, [load]);
  const friendFeed = feed === 'friends';
  const visible = active && foreground ? items.filter((item) => !blocked.includes(item.post.authorId)) : [];
  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: theme.spacing.md, paddingBottom: bottom + 24 }}
      data={visible}
      keyExtractor={(item) => item.post.id}
      onRefresh={refresh}
      refreshing={loading && visible.length === 0}
      onEndReached={() => { if (more && !failed) void load(false); }}
      onEndReachedThreshold={0.5}
      // Keep few rows mounted: an unmounted row releases its photos.
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      onViewableItemsChanged={onViewable}
      viewabilityConfig={VIEWABILITY}
      ListFooterComponent={loading && visible.length > 0 ? <ActivityIndicator color={theme.colors.primary} /> : null}
      ListEmptyComponent={loading ? null : failed ? (
        <EmptyState title={t.discover.feedError} actionLabel={t.discover.feedRetry} onAction={refresh} />
      ) : (
        <EmptyState
          icon={friendFeed ? Users : Compass}
          title={friendFeed ? t.discover.friendsEmpty : t.discover.communityEmpty}
          body={friendFeed ? t.discover.friendsEmptyBody : t.discover.communityEmptyBody}
          actionLabel={friendFeed ? t.discover.findNeighbors : undefined}
          onAction={() => router.push('/neighbors')}
        />
      )}
      renderItem={({ item, index }) => (
        <ExplorePostCard
          key={JSON.stringify(item.post.imagePaths)}
          item={item}
          nearScreen={index >= near.first - 1 && index <= near.last + 1}
          refresh={refresh}
        />
      )}
    />
  );
}

const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

/**
 * Loads a post's photos and its author's photo only while the card is on or next to the screen,
 * and only the visible carousel photo plus the next one. Everything is released when the card
 * moves away. Photos stay in memory (data URIs); nothing is cached on disk.
 */
export function ExplorePostCard({ item, nearScreen = true, refresh, onPress }: {
  item: ExploreItem; nearScreen?: boolean; refresh?: () => void; onPress?: () => void;
}) {
  const { post, author, area } = item;
  const paths = post.imagePaths ?? [];
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, string>>({});
  const [avatar, setAvatar] = useState<string>();
  const wanted = nearScreen ? [photoIndex - 1, photoIndex, photoIndex + 1].filter((i) => i >= 0 && i < paths.length) : [];
  const wantedKey = wanted.join(',');

  useEffect(() => {
    const keep = wantedKey ? wantedKey.split(',').map(Number) : [];
    setLoaded((old) => Object.fromEntries(Object.entries(old).filter(([i]) => keep.includes(Number(i)))));
    const controller = new AbortController();
    void (async () => {
      for (const i of keep) {
        if (controller.signal.aborted) break;
        const photo = await fetchExplorePhoto(paths[i], controller.signal).catch(() => null);
        if (photo && !controller.signal.aborted) setLoaded((old) => (i in old ? old : { ...old, [i]: photo }));
      }
    })();
    return () => controller.abort();
    // paths is stable for a card (the list keys cards by their photo paths).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);

  const avatarPath = nearScreen ? author?.avatarPath : undefined;
  useEffect(() => {
    setAvatar(undefined);
    if (!avatarPath) return;
    const controller = new AbortController();
    void fetchExplorePhoto(avatarPath, controller.signal, PROFILE_PHOTO_BUCKET)
      .then((photo) => { if (photo && !controller.signal.aborted) setAvatar(photo); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [avatarPath]);

  // Placeholders keep the card's height while photos are not loaded, so scrolling doesn't jump.
  const images = paths.map((_, i) => loaded[i] ?? '');
  return (
    <PostCard
      post={{ ...post, images }}
      discovery
      discoveryAuthor={author}
      discoveryAvatar={avatar}
      discoveryArea={area}
      onPhotoIndexChange={setPhotoIndex}
      onChanged={refresh}
      onPress={onPress}
    />
  );
}
