import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Compass, LayoutGrid, Search, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EXPLORE_PAGE_SIZE, fetchExploreFeed, fetchExplorePhoto, type ExploreFeed } from '@/backend/exploreFeed';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { NoNeighborhoodState } from '@/components/NoNeighborhoodState';
import { VerifyGate, useNeedsVerification } from '@/components/VerifyGate';
import { PostCard } from '@/features/feed/PostCard';
import { useI18n } from '@/i18n/useI18n';
import type { Post } from '@/models';
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(active);
  const [failed, setFailed] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [more, setMore] = useState(false);
  const offset = useRef(0);
  const request = useRef(0);
  const busy = useRef(false);
  const enabled = useRef(false);

  const load = useCallback(async (reset: boolean) => {
    if (!enabled.current || (!reset && busy.current)) return;
    busy.current = true;
    const version = ++request.current;
    setLoading(true);
    setFailed(false);
    const start = reset ? 0 : offset.current;
    if (reset) {
      setPosts([]);
      setMore(false);
    }
    try {
      const next = await fetchExploreFeed(feed, start);
      if (request.current !== version) return;
      setPosts((old) => reset ? next : [...old, ...next.filter((row) => !old.some((item) => item.id === row.id))]);
      offset.current = start + next.length;
      setMore(next.length === EXPLORE_PAGE_SIZE && offset.current <= 10000);
    } catch {
      if (request.current !== version) return;
      setFailed(true);
      setPosts([]);
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
      setPosts([]);
      setLoading(false);
    };
  }, [active, foreground, load]));

  const refresh = useCallback(() => { void load(true); }, [load]);
  const friendFeed = feed === 'friends';
  const visible = active && foreground ? posts.filter((post) => !blocked.includes(post.authorId)) : [];
  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: theme.spacing.md, paddingBottom: bottom + 24 }}
      data={visible}
      keyExtractor={(post) => post.id}
      onRefresh={refresh}
      refreshing={loading && visible.length === 0}
      onEndReached={() => { if (more && !failed) void load(false); }}
      onEndReachedThreshold={0.5}
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
      renderItem={({ item }) => <ExplorePostCard key={JSON.stringify(item.imagePaths)} post={item} refresh={refresh} />}
    />
  );
}

export function ExplorePostCard({ post, refresh, onPress }: { post: Post; refresh?: () => void; onPress?: () => void }) {
  const [images, setImages] = useState<string[]>([]);
  const paths = post.imagePaths;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      for (const path of paths ?? []) {
        if (controller.signal.aborted) break;
        const photo = await fetchExplorePhoto(path, controller.signal).catch(() => null);
        if (photo && !controller.signal.aborted) setImages((old) => [...old, photo]);
      }
    }
    setImages([]);
    void load();
    return () => controller.abort();
  }, [paths]);
  return <PostCard post={{ ...post, images }} discovery onChanged={refresh} onPress={onPress} />;
}
