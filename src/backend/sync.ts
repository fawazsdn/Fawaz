import * as Network from 'expo-network';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { geographyService } from '@/services/geography';
import { emptyEntities, useStore, type EntityState } from '@/store/useStore';
import type {
  AlertItem,
  AppNotification,
  BorrowItem,
  Business,
  Comment,
  CommunityEvent,
  CommunityGroup,
  Conversation,
  HelpRequest,
  Institution,
  Issue,
  IssueUpdate,
  LostFoundPost,
  MarketplaceListing,
  Message,
  Neighborhood,
  Poll,
  Post,
  Recommendation,
  ReputationEvent,
  ReputationTier,
  User,
  VerificationStatus,
} from '@/models';
import { resolveMediaUrls } from './media';

/* eslint-disable @typescript-eslint/no-explicit-any -- PostgREST rows are mapped field-by-field below */
type Row = Record<string, any>;

const CONTENT_LIMIT = 200;

export function reputationTierFor(points: number): ReputationTier {
  if (points >= 150) return 'community_champion';
  if (points >= 75) return 'community_builder';
  if (points >= 30) return 'contributor';
  if (points >= 10) return 'neighbor';
  return 'new_neighbor';
}

function membershipToVerification(status: string | undefined): VerificationStatus {
  if (status === 'verified') return 'verified';
  if (status === 'rejected') return 'failed';
  if (status === 'pending') return 'pending';
  return 'not_started';
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    return true;
  }
}

function must<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`${label}: ${res.error.message}`);
  return (res.data ?? ([] as unknown)) as T;
}

/** Loads the neighborhood record (official geography) + real aggregate counts. */
async function loadNeighborhood(neighborhoodId: string): Promise<Neighborhood | null> {
  const n = await geographyService.getNeighborhood(neighborhoodId);
  if (!n) return null;
  let city = undefined as Awaited<ReturnType<typeof geographyService.getCity>>;
  if (n.centerLat == null) city = await geographyService.getCity(n.cityId);
  const { data } = await supabase.rpc('neighborhood_stats', { target_neighborhood_id: neighborhoodId });
  const stats = Array.isArray(data) ? (data[0] as Row | undefined) : undefined;
  return {
    id: n.id,
    cityId: n.cityId,
    regionId: n.regionId,
    nameAr: n.nameAr,
    nameEn: n.nameEn,
    centerLat: n.centerLat ?? city?.centerLat ?? 0,
    centerLng: n.centerLng ?? city?.centerLng ?? 0,
    hasBoundary: !!n.hasBoundary,
    residentsCount: stats ? Number(stats.residents) : null,
    eventsThisWeek: stats ? Number(stats.events_this_week) : null,
    openIssues: stats ? Number(stats.open_issues) : null,
    helpfulActions: stats ? Number(stats.helpful_actions) : null,
  };
}

interface Membership {
  neighborhood_id: string;
  verification_status: string;
}

/**
 * Pull everything the signed-in resident is allowed to see (RLS decides —
 * the client never filters for security) and replace the store's entities.
 */
export async function syncAll(): Promise<void> {
  const store = useStore.getState();
  const me = store.session.supabaseUserId;
  if (!me) return;

  if (!(await isOnline())) {
    store.setSync({ status: 'offline' });
    return;
  }
  store.setSync({ status: 'loading', error: null });

  try {
    // 1. Who am I, and which neighborhood am I actually a member of (server truth)?
    const [profileRes, membershipRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', me).maybeSingle(),
      supabase.from('neighborhood_memberships').select('neighborhood_id, verification_status').eq('user_id', me).eq('active', true).maybeSingle(),
    ]);
    if (profileRes.error) throw new Error(`profile: ${profileRes.error.message}`);
    const myProfile = profileRes.data as Row | null;
    const membership = membershipRes.data as Membership | null;

    const neighborhoodId = membership?.neighborhood_id ?? store.session.neighborhoodId;
    const verification = membership ? membershipToVerification(membership.verification_status) : store.session.verification;
    useStore.getState().patchSession({
      neighborhoodId: neighborhoodId ?? null,
      verification,
      profileCreated: !!myProfile?.profile_completed || store.session.profileCreated,
    });

    const neighborhood = neighborhoodId ? await loadNeighborhood(neighborhoodId) : null;
    const verified = verification === 'verified' && !!neighborhoodId;

    // 2. Personal data that never depends on neighborhood verification.
    const [notificationsRes, blocksRes, mutesRes, referralRes, attributedRes, reportsRes] = await Promise.all([
      supabase.from('notifications').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(100),
      supabase.from('user_blocks').select('blocked_id').eq('blocker_id', me),
      supabase.from('user_mutes').select('muted_id').eq('muter_id', me),
      supabase.from('referrals').select('code').eq('user_id', me).maybeSingle(),
      supabase.from('referral_events').select('id', { count: 'exact', head: true }).eq('user_id', me).eq('event_type', 'signup_attributed'),
      supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    const entities: EntityState = emptyEntities();
    entities.neighborhoods = neighborhood ? [neighborhood] : [];
    entities.notifications = must(notificationsRes, 'notifications').map(mapNotification);
    entities.blockedUserIds = must(blocksRes, 'blocks').map((r: Row) => r.blocked_id);
    entities.mutedUserIds = must(mutesRes, 'mutes').map((r: Row) => r.muted_id);
    entities.reports = (reportsRes.data ?? []).map((r: Row) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reasonType: r.reason,
      note: r.description ?? undefined,
      createdAt: r.created_at,
      status: r.status,
    }));
    useStore.getState().setReferral({ code: (referralRes.data as Row | null)?.code ?? undefined, joinedCount: attributedRes.count ?? null });

    // 3. Conversations the resident is a member of.
    const myConvRes = await supabase.from('conversation_members').select('conversation_id, last_read_at').eq('user_id', me).is('left_at', null);
    const myConvRows = must(myConvRes, 'conversation_members') as Row[];
    const convIds = myConvRows.map((r) => r.conversation_id as string);
    if (convIds.length > 0) {
      const [convRes, membersRes, messagesRes] = await Promise.all([
        supabase.from('conversations').select('*').in('id', convIds),
        supabase.from('conversation_members').select('conversation_id, user_id, last_read_at').in('conversation_id', convIds).is('left_at', null),
        supabase.from('messages').select('*').in('conversation_id', convIds).is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
      ]);
      const members = must(membersRes, 'members') as Row[];
      const lastRead = new Map(myConvRows.map((r) => [r.conversation_id as string, r.last_read_at as string | null]));
      entities.conversations = (must(convRes, 'conversations') as Row[]).map((c) => ({
        id: c.id,
        kind: c.kind,
        participantIds: members.filter((m) => m.conversation_id === c.id).map((m) => m.user_id),
        eventId: c.event_id ?? undefined,
        isGroup: c.kind !== 'direct',
        title: c.title ?? undefined,
        lastMessageAt: c.last_message_at,
        lastReadAt: lastRead.get(c.id) ?? undefined,
      }));
      const messageRows = (must(messagesRes, 'messages') as Row[]).reverse();
      const messageUrls = await resolveMediaUrls(messageRows.map((m) => m.image_path));
      entities.messages = messageRows.map((m) => {
        const msg = mapMessage(m, lastRead.get(m.conversation_id) ?? null, me);
        // For my own messages, "read" means another member's last_read_at has passed it.
        const readers =
          m.sender_id === me
            ? members
                .filter((x) => x.conversation_id === m.conversation_id && x.user_id !== me && x.last_read_at && new Date(x.last_read_at).getTime() >= new Date(m.created_at).getTime())
                .map((x) => x.user_id as string)
            : [];
        return { ...msg, readBy: m.sender_id === me ? [me, ...readers] : msg.readBy, image: m.image_path ? messageUrls[m.image_path] : undefined };
      });
    }

    // 4. Neighborhood content — only readable by verified members (RLS).
    if (verified && neighborhoodId) {
      const nb = neighborhoodId;
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const [postsRes, savedRes, pollsRes, myVotesRes, eventsRes, listingsRes, favRes, lostRes, helpRes, issuesRes, bizRes, alertsRes, instRes, groupsRes, borrowRes] =
        await Promise.all([
          supabase
            .from('posts')
            .select('*, post_reactions(user_id, type), post_comments(count)')
            .eq('neighborhood_id', nb)
            .order('created_at', { ascending: false })
            .limit(CONTENT_LIMIT),
          supabase.from('saved_posts').select('post_id').eq('user_id', me),
          supabase.from('polls').select('*, poll_options(id, text_ar, position)').eq('neighborhood_id', nb).order('created_at', { ascending: false }).limit(CONTENT_LIMIT),
          supabase.from('poll_votes').select('poll_id, option_id').eq('user_id', me),
          supabase
            .from('events')
            .select('*, event_attendees(user_id, status, joined_at, waitlist_position)')
            .eq('neighborhood_id', nb)
            .gte('ends_at', since)
            .order('starts_at', { ascending: true })
            .limit(CONTENT_LIMIT),
          supabase.from('marketplace_listings').select('*').eq('neighborhood_id', nb).neq('status', 'archived').order('created_at', { ascending: false }).limit(CONTENT_LIMIT),
          supabase.from('marketplace_favorites').select('listing_id').eq('user_id', me),
          supabase.from('lost_found_posts').select('*').eq('neighborhood_id', nb).order('created_at', { ascending: false }).limit(CONTENT_LIMIT),
          supabase.from('help_requests').select('*, help_request_responses(responder_id, status)').eq('neighborhood_id', nb).order('created_at', { ascending: false }).limit(CONTENT_LIMIT),
          supabase.from('issues').select('*, issue_engagements(user_id, kind), issue_updates(id, status, note, created_at)').eq('neighborhood_id', nb).order('created_at', { ascending: false }).limit(CONTENT_LIMIT),
          supabase.from('businesses').select('*, business_neighborhoods!inner(neighborhood_id), business_recommendations(id, author_id, body, sentiment, created_at, deleted_at)').eq('business_neighborhoods.neighborhood_id', nb).limit(CONTENT_LIMIT),
          supabase.from('community_alerts').select('*').eq('neighborhood_id', nb).order('created_at', { ascending: false }).limit(50),
          supabase.from('institutions').select('*, institution_content(*)').eq('neighborhood_id', nb).limit(50),
          supabase.from('community_groups').select('*').eq('neighborhood_id', nb).limit(100),
          supabase.from('borrow_listings').select('*, borrow_requests(requester_id, status, created_at)').eq('neighborhood_id', nb).order('created_at', { ascending: false }).limit(CONTENT_LIMIT),
        ]);

      const saved = new Set((must(savedRes, 'saved') as Row[]).map((r) => r.post_id));
      const favs = new Set((must(favRes, 'favorites') as Row[]).map((r) => r.listing_id));
      const myVotes = new Map((must(myVotesRes, 'votes') as Row[]).map((r) => [r.poll_id, r.option_id]));

      const postRows = must(postsRes, 'posts') as Row[];
      const pollRows = must(pollsRes, 'polls') as Row[];
      const eventRows = must(eventsRes, 'events') as Row[];
      const listingRows = must(listingsRes, 'listings') as Row[];
      const lostRows = must(lostRes, 'lost_found') as Row[];
      const helpRows = must(helpRes, 'help') as Row[];
      const issueRows = must(issuesRes, 'issues') as Row[];
      const bizRows = must(bizRes, 'businesses') as Row[];
      const instRows = must(instRes, 'institutions') as Row[];
      const borrowRows = must(borrowRes, 'borrow') as Row[];

      // Aggregate poll results (individual votes are private by RLS).
      const pollIds = pollRows.map((p) => p.id);
      const counts = new Map<string, number>();
      if (pollIds.length > 0) {
        const { data: results } = await supabase.rpc('get_poll_results', { target_poll_ids: pollIds });
        for (const r of (results ?? []) as Row[]) counts.set(r.option_id, Number(r.vote_count));
      }

      // Resolve all private media paths to signed URLs in one batch.
      const paths: string[] = [];
      postRows.forEach((p) => paths.push(...(p.image_paths ?? [])));
      eventRows.forEach((e) => e.cover_image_path && paths.push(e.cover_image_path));
      listingRows.forEach((m) => paths.push(...(m.image_paths ?? [])));
      lostRows.forEach((l) => paths.push(...(l.image_paths ?? [])));
      issueRows.forEach((i) => paths.push(...(i.image_paths ?? [])));
      borrowRows.forEach((b) => paths.push(...(b.image_paths ?? [])));
      bizRows.forEach((b) => b.cover_image_path && paths.push(b.cover_image_path));
      instRows.forEach((i) => i.cover_image_path && paths.push(i.cover_image_path));
      const urls = await resolveMediaUrls(paths);
      const img = (p?: string | null) => (p ? urls[p] : undefined);
      const imgs = (ps?: string[] | null) => (ps ?? []).map((p) => urls[p]).filter((u): u is string => !!u);

      entities.posts = postRows.map((p) => mapPost(p, saved, me, imgs));
      entities.polls = pollRows.map((p) => mapPoll(p, counts, myVotes.get(p.id)));
      entities.events = eventRows.map((e) => mapEvent(e, img));
      entities.marketplaceListings = listingRows.map((m) => mapListing(m, favs, me, imgs));
      entities.lostFound = lostRows.map((l) => mapLostFound(l, imgs));
      entities.helpRequests = helpRows.map(mapHelp);
      entities.issues = issueRows.map((i) => mapIssue(i, imgs));
      entities.issueUpdates = issueRows.flatMap((i) =>
        ((i.issue_updates ?? []) as Row[]).map((u): IssueUpdate => ({ id: u.id, issueId: i.id, status: u.status, note: u.note ?? undefined, createdAt: u.created_at })),
      );
      entities.businesses = bizRows.map((b) => mapBusiness(b, img));
      entities.recommendations = bizRows.flatMap((b) =>
        ((b.business_recommendations ?? []) as Row[])
          .filter((r) => !r.deleted_at)
          .map((r): Recommendation => ({ id: r.id, businessId: b.id, authorId: r.author_id, textAr: r.body, createdAt: r.created_at, sentiment: r.sentiment })),
      );
      entities.alerts = (must(alertsRes, 'alerts') as Row[])
        .filter((a) => !a.expires_at || new Date(a.expires_at).getTime() > Date.now())
        .map(
          (a): AlertItem => ({
            id: a.id,
            titleAr: a.title_ar,
            bodyAr: a.body_ar,
            severity: a.severity,
            neighborhoodId: a.neighborhood_id,
            createdAt: a.created_at,
            expiresAt: a.expires_at ?? undefined,
          }),
        );
      entities.institutions = instRows.map((i) => mapInstitution(i, img));
      entities.communityGroups = (must(groupsRes, 'groups') as Row[]).map(
        (g): CommunityGroup => ({ id: g.id, name: g.name, description: g.description, neighborhoodId: g.neighborhood_id, memberCount: 0 }),
      );
      entities.borrowItems = borrowRows.map((b) => mapBorrow(b, imgs));
    }

    // 5. Profiles for every person referenced (RLS only returns neighbors who
    //    share a verified neighborhood, plus the resident themself).
    const userIds = new Set<string>([me]);
    entities.posts.forEach((p) => userIds.add(p.authorId));
    entities.events.forEach((e) => {
      userIds.add(e.hostId);
      e.attendees.forEach((a) => userIds.add(a.userId));
    });
    entities.marketplaceListings.forEach((m) => userIds.add(m.sellerId));
    entities.lostFound.forEach((l) => userIds.add(l.authorId));
    entities.helpRequests.forEach((h) => {
      userIds.add(h.requesterId);
      h.offeredBy.forEach((id) => userIds.add(id));
    });
    entities.issues.forEach((i) => userIds.add(i.reporterId));
    entities.recommendations.forEach((r) => userIds.add(r.authorId));
    entities.conversations.forEach((c) => c.participantIds.forEach((id) => userIds.add(id)));
    entities.borrowItems.forEach((b) => userIds.add(b.ownerId));
    entities.notifications.forEach((n) => n.actorId && userIds.add(n.actorId));

    const ids = [...userIds];
    const [profilesRes, repRes] = await Promise.all([
      supabase.from('profiles').select('*').in('id', ids).is('deleted_at', null),
      supabase.from('reputation_events').select('*').in('user_id', ids).order('created_at', { ascending: false }).limit(500),
    ]);
    const reputation = (repRes.data ?? []) as Row[];
    entities.reputationEvents = reputation.map(
      (r): ReputationEvent => ({ id: r.id, userId: r.user_id, type: r.type, reasonAr: r.reason_ar, fromUserId: r.actor_id ?? undefined, createdAt: r.created_at }),
    );
    entities.users = (must(profilesRes, 'profiles') as Row[]).map((p) =>
      mapProfile(p, {
        isSelf: p.id === me,
        neighborhoodId: neighborhoodId ?? '',
        verification: p.id === me ? verification : 'verified',
        eventsHosted: entities.events.filter((e) => e.hostId === p.id).length,
        neighborsHelped: entities.helpRequests.filter((h) => h.offeredBy.includes(p.id)).length,
        thanksReceived: reputation.filter((r) => r.user_id === p.id && r.type === 'thanks').length,
      }),
    );

    useStore.getState().applyEntities(entities);
    useStore.getState().setSync({ status: 'ready', lastSyncedAt: new Date().toISOString(), error: null });
  } catch (err) {
    const online = await isOnline();
    useStore.getState().setSync({ status: online ? 'error' : 'offline', error: err instanceof Error ? err.message : String(err) });
  }
}

let pending: Promise<void> | null = null;
let rerun = false;

/** Coalesces concurrent sync requests (realtime bursts, pull-to-refresh, mutations). */
export function requestSync(): Promise<void> {
  if (pending) {
    rerun = true;
    return pending;
  }
  pending = (async () => {
    do {
      rerun = false;
      await syncAll();
    } while (rerun);
  })().finally(() => {
    pending = null;
  });
  return pending;
}

let channel: RealtimeChannel | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;

function scheduleSync() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    void requestSync();
  }, 700);
}

/**
 * Live updates: new messages, notifications, poll results, RSVPs and posts.
 * Realtime enforces each table's SELECT policy per subscriber, so a resident
 * only receives events for rows they could already read.
 */
export function startRealtime(userId: string, neighborhoodId: string | null) {
  stopRealtime();
  let ch = supabase
    .channel(`haratna:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleSync)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, scheduleSync)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, scheduleSync)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendees' }, scheduleSync);
  if (neighborhoodId) {
    const filter = `neighborhood_id=eq.${neighborhoodId}`;
    ch = ch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter }, scheduleSync);
  }
  channel = ch.subscribe();
}

export function stopRealtime() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}

// ---------------------------------------------------------------------------
// Row -> model mappers
// ---------------------------------------------------------------------------

export function mapProfile(
  p: Row,
  extra: { isSelf: boolean; neighborhoodId: string; verification: VerificationStatus; eventsHosted: number; neighborsHelped: number; thanksReceived: number },
): User {
  const points = Number(p.reputation_points ?? 0);
  return {
    id: p.id,
    firstName: p.first_name ?? '',
    lastName: p.last_name ?? '',
    avatarUrl: p.avatar_url ?? undefined,
    bio: p.bio ?? undefined,
    namePrivacy: p.name_privacy ?? 'first_last_initial',
    neighborhoodId: extra.neighborhoodId,
    verification: extra.verification,
    role: p.app_role ?? 'resident',
    memberSince: p.created_at,
    reputationPoints: points,
    reputationTier: reputationTierFor(points),
    stats: { neighborsHelped: extra.neighborsHelped, eventsHosted: extra.eventsHosted, thanksReceived: extra.thanksReceived },
    isSelf: extra.isSelf,
  };
}

export function mapPost(p: Row, saved: Set<string>, me: string, imgs: (ps?: string[] | null) => string[]): Post {
  const commentCount = Array.isArray(p.post_comments) ? Number(p.post_comments[0]?.count ?? 0) : 0;
  return {
    id: p.id,
    type: p.type,
    authorId: p.author_id,
    neighborhoodId: p.neighborhood_id,
    textAr: p.text_ar ?? '',
    textEn: p.text_en ?? undefined,
    images: imgs(p.image_paths),
    createdAt: p.created_at,
    reactions: ((p.post_reactions ?? []) as Row[]).map((r) => ({ userId: r.user_id, type: r.type })),
    commentCount,
    savedBy: saved.has(p.id) ? [me] : [],
    linkedEntityId: p.linked_entity_id ?? undefined,
    audience: p.audience,
    pinned: !!p.pinned,
    approxLat: p.approx_lat ?? undefined,
    approxLng: p.approx_lng ?? undefined,
    locationLabel: p.location_label ?? undefined,
  };
}

export function mapPoll(p: Row, counts: Map<string, number>, myOptionId: string | undefined): Poll {
  const options = ((p.poll_options ?? []) as Row[])
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ id: o.id, textAr: o.text_ar, votes: counts.get(o.id) ?? 0 }));
  return {
    id: p.id,
    postId: p.post_id ?? '',
    question: p.question,
    options,
    closesAt: p.closes_at,
    neighborhoodId: p.neighborhood_id,
    totalVotes: options.reduce((s, o) => s + o.votes, 0),
    myOptionId,
    allowChange: p.allow_change !== false,
  };
}

export function mapEvent(e: Row, img: (p?: string | null) => string | undefined): CommunityEvent {
  return {
    id: e.id,
    kind: e.kind === 'activity' ? 'activity' : 'event',
    occasion: e.occasion ?? undefined,
    title: e.title,
    category: e.category,
    coverImage: img(e.cover_image_path),
    description: e.description ?? '',
    hostId: e.host_id,
    neighborhoodId: e.neighborhood_id,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    locationLabel: e.location_label,
    approxLat: e.approx_lat ?? undefined,
    approxLng: e.approx_lng ?? undefined,
    capacity: e.capacity,
    audience: e.audience,
    recurring: !!e.recurring,
    rules: e.rules ?? undefined,
    cancelled: !!e.cancelled_at,
    attendees: ((e.event_attendees ?? []) as Row[])
      .filter((a) => a.status !== 'cancelled')
      .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0))
      .map((a) => ({ userId: a.user_id, status: a.status, joinedAt: a.joined_at })),
  };
}

function mapListing(m: Row, favs: Set<string>, me: string, imgs: (ps?: string[] | null) => string[]): MarketplaceListing {
  return {
    id: m.id,
    title: m.title,
    description: m.description ?? '',
    images: imgs(m.image_paths),
    category: m.category,
    listingType: m.listing_type,
    price: m.price != null ? Number(m.price) : undefined,
    condition: m.condition,
    sellerId: m.seller_id,
    neighborhoodId: m.neighborhood_id,
    approxDistanceM: m.approx_distance_m ?? 0,
    createdAt: m.created_at,
    savedBy: favs.has(m.id) ? [me] : [],
    status: m.status === 'archived' ? 'sold' : m.status,
  };
}

function mapLostFound(l: Row, imgs: (ps?: string[] | null) => string[]): LostFoundPost {
  return {
    id: l.id,
    kind: l.kind,
    title: l.title,
    description: l.description,
    image: imgs(l.image_paths)[0],
    status: l.status,
    neighborhoodId: l.neighborhood_id,
    authorId: l.author_id,
    createdAt: l.created_at,
  };
}

function mapHelp(h: Row): HelpRequest {
  return {
    id: h.id,
    title: h.title,
    category: h.category,
    description: h.description,
    requesterId: h.requester_id,
    neighborhoodId: h.neighborhood_id,
    createdAt: h.created_at,
    approxDistanceM: h.approx_distance_m ?? 0,
    offeredBy: ((h.help_request_responses ?? []) as Row[]).filter((r) => r.status !== 'declined').map((r) => r.responder_id),
    status: h.status === 'cancelled' ? 'resolved' : h.status,
  };
}

function mapIssue(i: Row, imgs: (ps?: string[] | null) => string[]): Issue {
  const eng = (i.issue_engagements ?? []) as Row[];
  return {
    id: i.id,
    title: i.title,
    category: i.category,
    description: i.description,
    images: imgs(i.image_paths),
    neighborhoodId: i.neighborhood_id,
    reporterId: i.reporter_id,
    status: i.status,
    affectedUserIds: eng.filter((e) => e.kind === 'affected').map((e) => e.user_id),
    followerIds: eng.filter((e) => e.kind === 'following').map((e) => e.user_id),
    createdAt: i.created_at,
    approxLat: i.approx_lat ?? undefined,
    approxLng: i.approx_lng ?? undefined,
  };
}

function mapBusiness(b: Row, img: (p?: string | null) => string | undefined): Business {
  const recs = ((b.business_recommendations ?? []) as Row[]).filter((r) => !r.deleted_at);
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    coverImage: img(b.cover_image_path),
    logo: b.logo_path ?? undefined,
    description: b.description ?? '',
    neighborhoodIds: ((b.business_neighborhoods ?? []) as Row[]).map((n) => n.neighborhood_id),
    hours: b.hours ?? '',
    phoneMasked: b.phone ?? '',
    communityVerified: !!b.verified,
    recommendationCount: recs.length,
    approxLat: b.approx_lat ?? undefined,
    approxLng: b.approx_lng ?? undefined,
    locationLabel: b.location_label ?? undefined,
  };
}

function mapInstitution(i: Row, img: (p?: string | null) => string | undefined): Institution {
  const content = (i.institution_content ?? []) as Row[];
  return {
    id: i.id,
    type: i.type,
    name: i.name,
    neighborhoodId: i.neighborhood_id,
    coverImage: img(i.cover_image_path),
    verified: !!i.verified,
    announcements: content.filter((c) => c.kind === 'announcement').map((c) => ({ id: c.id, textAr: c.body_ar ?? c.title_ar ?? '', createdAt: c.created_at })),
    classes: content.filter((c) => c.kind === 'class').map((c) => ({ id: c.id, titleAr: c.title_ar ?? '', schedule: c.schedule ?? '' })),
    volunteerOpportunities: content.filter((c) => c.kind === 'volunteer').map((c) => ({ id: c.id, titleAr: c.title_ar ?? '', spotsLeft: c.spots_left ?? 0 })),
  };
}

function mapBorrow(b: Row, imgs: (ps?: string[] | null) => string[]): BorrowItem {
  return {
    id: b.id,
    title: b.title,
    category: b.category,
    image: imgs(b.image_paths)[0],
    ownerId: b.owner_id,
    neighborhoodId: b.neighborhood_id,
    available: !!b.available,
    description: b.description ?? '',
    requests: ((b.borrow_requests ?? []) as Row[])
      .filter((r) => r.status === 'pending' || r.status === 'accepted' || r.status === 'declined')
      .map((r) => ({ userId: r.requester_id, status: r.status, createdAt: r.created_at })),
  };
}

export function mapNotification(n: Row): AppNotification {
  return {
    id: n.id,
    userId: n.user_id,
    type: n.type,
    titleAr: n.title_ar,
    titleEn: n.title_en ?? undefined,
    bodyAr: n.body_ar,
    bodyEn: n.body_en ?? undefined,
    createdAt: n.created_at,
    read: !!n.read_at,
    deepLink: n.deep_link,
    actorId: n.actor_id ?? undefined,
  };
}

/**
 * readBy is derived from the conversation's last_read_at: a message counts as
 * read by me when it's mine or older than my last read marker.
 */
export function mapMessage(m: Row, myLastReadAt: string | null, me: string): Message {
  const readByMe = m.sender_id !== me && !!myLastReadAt && new Date(m.created_at).getTime() <= new Date(myLastReadAt).getTime();
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    text: m.body ?? undefined,
    image: m.image_path ?? undefined,
    replyToId: m.reply_to_id ?? undefined,
    createdAt: m.created_at,
    readBy: m.sender_id === me ? [me] : readByMe ? [m.sender_id, me] : [m.sender_id],
  };
}

export type { Comment, Conversation };
