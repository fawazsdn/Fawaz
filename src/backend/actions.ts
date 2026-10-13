import { supabase } from '@/lib/supabase';
import { getCurrentUserId, useStore } from '@/store/useStore';
import type {
  DiscoveredNeighbor,
  Interest,
  NeighborProfileInfo,
  NeighborSettings,
  NeighborState,
  User,
  Club,
  ClubCategory,
  ClubMembershipType,
  ClubReviewDecision,
  ClubReviewStatus,
  Comment,
  EventCategory,
  EventKind,
  EventOccasion,
  HelpCategory,
  IssueCategory,
  IssueStatus,
  ListingCondition,
  ListingType,
  LostFoundStatus,
  NamePrivacy,
  PostType,
  ReportReason,
  Recurrence,
  ReportTargetType,
} from '@/models';
import { resolveMediaUrls, uploadAvatar, uploadCommunityImage, uploadCommunityImages } from './media';
import { isInterest, mapClub, mapNeighborSettings, mapProfile, requestSync } from './sync';

/**
 * Every mutation in the app. Each one writes to Supabase (RLS decides what's
 * allowed — the client never pretends a write succeeded) and then re-syncs so
 * the UI reflects server truth. Errors are thrown as ActionError with a
 * stable `code` that screens map to a translated message.
 */

export type ActionErrorCode =
  'not_signed_in' | 'not_verified' | 'no_neighborhood' | 'offline' | 'closed' | 'forbidden' | 'invalid' | 'unknown';

export class ActionError extends Error {
  code: ActionErrorCode;
  /** Machine-readable reason raised by an RPC, e.g. 'not_adult', 'rate_limited', 'invalid:name'. */
  reason?: string;
  constructor(code: ActionErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    const m = (message ?? '').trim();
    if (/^[a-z_]+(:[a-z_]+)?$/.test(m)) this.reason = m;
  }
}

function toActionError(err: unknown): ActionError {
  if (err instanceof ActionError) return err;
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? String(err);
  if (msg === 'rate_limited') return new ActionError('invalid', msg);
  if (/network|fetch|Failed to fetch|timed out/i.test(msg)) return new ActionError('offline', msg);
  if (e?.code === '42501' || /row-level security|permission denied|access denied/i.test(msg)) return new ActionError('forbidden', msg);
  if (/closed/i.test(msg)) return new ActionError('closed', msg);
  if (e?.code === '22023' || e?.code === '23514' || e?.code === '23503') return new ActionError('invalid', msg);
  return new ActionError('unknown', msg);
}

async function run<T>(fn: () => Promise<T>, { resync = true } = {}): Promise<T> {
  try {
    const result = await fn();
    if (resync) await requestSync();
    return result;
  } catch (err) {
    throw toActionError(err);
  }
}

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

function me(): string {
  const id = getCurrentUserId();
  if (!id) throw new ActionError('not_signed_in');
  return id;
}

/** Content creation requires a verified membership (also enforced by RLS). */
function verifiedNeighborhood(): string {
  const { neighborhoodId, verification } = useStore.getState().session;
  if (!neighborhoodId) throw new ActionError('no_neighborhood');
  if (verification !== 'verified') throw new ActionError('not_verified');
  return neighborhoodId;
}

/** Rounds coordinates to ~110 m so exact homes are never published. */
export function approximateCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ---------------------------------------------------------------- profile --

export async function saveProfile(input: {
  firstName: string;
  lastName: string;
  namePrivacy: NamePrivacy;
  bio?: string;
  localAvatarUri?: string;
  locale?: 'ar' | 'en';
}) {
  return run(async () => {
    const uid = me();
    let avatarUrl: string | undefined;
    if (input.localAvatarUri && !/^https?:/.test(input.localAvatarUri)) avatarUrl = await uploadAvatar(input.localAvatarUri, uid);
    check(
      await supabase
        .from('profiles')
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          name_privacy: input.namePrivacy,
          bio: input.bio ?? null,
          profile_completed: true,
          ...(input.locale ? { locale: input.locale } : {}),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', uid),
    );
    useStore.getState().markProfileCreated();
  });
}

/** Creates/reactivates the real (pending) membership for the chosen neighborhood. */
export async function chooseNeighborhood(neighborhoodId: string) {
  return run(async () => {
    me();
    const row = check(await supabase.rpc('select_neighborhood', { target_neighborhood_id: neighborhoodId })) as {
      verification_status?: string;
    } | null;
    useStore.getState().patchSession({
      neighborhoodId,
      verification: row?.verification_status === 'verified' ? 'verified' : 'pending',
    });
  });
}

// ------------------------------------------------------------------ posts --

export async function createPost(input: {
  type: PostType;
  textAr: string;
  localImages: string[];
  audience: 'neighborhood' | 'city';
  geotag?: { lat: number; lng: number; label?: string };
}) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const imagePaths = await uploadCommunityImages(input.localImages, nb, uid);
    const row = check(
      await supabase
        .from('posts')
        .insert({
          type: input.type,
          author_id: uid,
          neighborhood_id: nb,
          text_ar: input.textAr,
          image_paths: imagePaths,
          audience: input.audience,
          approx_lat: input.geotag ? approximateCoordinate(input.geotag.lat) : null,
          approx_lng: input.geotag ? approximateCoordinate(input.geotag.lng) : null,
          location_label: input.geotag?.label ?? null,
        })
        .select('id')
        .single(),
    ) as { id: string };
    return row.id;
  });
}

export async function toggleReaction(postId: string, type: 'like' | 'helpful') {
  return run(async () => {
    const uid = me();
    const post = useStore.getState().posts.find((p) => p.id === postId);
    const mine = post?.reactions.some((r) => r.userId === uid);
    if (mine) check(await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', uid));
    else check(await supabase.from('post_reactions').insert({ post_id: postId, user_id: uid, type }));
  });
}

export async function toggleSavePost(postId: string) {
  return run(async () => {
    const uid = me();
    const saved = useStore
      .getState()
      .posts.find((p) => p.id === postId)
      ?.savedBy.includes(uid);
    if (saved) check(await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', uid));
    else check(await supabase.from('saved_posts').insert({ post_id: postId, user_id: uid }));
  });
}

export async function deletePost(postId: string) {
  return run(async () => {
    me();
    check(await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId));
  });
}

/** Loads a post's comments (with like state) into the store. */
export async function loadComments(postId: string): Promise<Comment[]> {
  try {
    const uid = getCurrentUserId();
    const rows = check(
      await supabase
        .from('post_comments')
        .select('*, comment_reactions(user_id)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
    ) as Record<string, unknown>[];
    const comments: Comment[] = rows.map((c) => ({
      id: c.id as string,
      postId: c.post_id as string,
      authorId: c.author_id as string,
      parentId: (c.parent_id as string | null) ?? undefined,
      textAr: c.body as string,
      createdAt: c.created_at as string,
      likedBy: ((c.comment_reactions as { user_id: string }[] | null) ?? []).map((r) => r.user_id),
      edited: !!c.edited_at,
    }));
    const others = useStore.getState().comments.filter((c) => c.postId !== postId);
    useStore.getState().applyEntities({ comments: [...others, ...comments] });
    // Make sure commenters' profiles are available.
    const missing = [...new Set(comments.map((c) => c.authorId))].filter((id) => !useStore.getState().getUser(id));
    if (missing.length > 0 && uid) await requestSync();
    return comments;
  } catch (err) {
    throw toActionError(err);
  }
}

export async function addComment(postId: string, text: string, parentId?: string) {
  return run(
    async () => {
      const uid = me();
      check(await supabase.from('post_comments').insert({ post_id: postId, author_id: uid, body: text, parent_id: parentId ?? null }));
      await loadComments(postId);
    },
    { resync: true },
  );
}

export async function editComment(commentId: string, postId: string, text: string) {
  return run(async () => {
    me();
    check(await supabase.from('post_comments').update({ body: text, edited_at: new Date().toISOString() }).eq('id', commentId));
    await loadComments(postId);
  });
}

export async function deleteComment(commentId: string, postId: string) {
  return run(async () => {
    me();
    check(await supabase.from('post_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId));
    await loadComments(postId);
  });
}

export async function toggleCommentLike(commentId: string, postId: string) {
  return run(
    async () => {
      const uid = me();
      const liked = useStore
        .getState()
        .comments.find((c) => c.id === commentId)
        ?.likedBy.includes(uid);
      if (liked) check(await supabase.from('comment_reactions').delete().eq('comment_id', commentId).eq('user_id', uid));
      else check(await supabase.from('comment_reactions').insert({ comment_id: commentId, user_id: uid, type: 'like' }));
      await loadComments(postId);
    },
    { resync: false },
  );
}

// ------------------------------------------------------------------ polls --

export async function createPoll(input: { question: string; options: string[]; closesInHours: number }) {
  return run(async () => {
    me();
    verifiedNeighborhood();
    const poll = check(
      await supabase.rpc('create_poll', { question: input.question, option_labels: input.options, closes_in_hours: input.closesInHours }),
    ) as { id: string; post_id: string };
    return poll;
  });
}

/** Votes or changes the resident's single vote atomically (server RPC). */
export async function voteInPoll(pollId: string, optionId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('vote_in_poll', { target_poll_id: pollId, target_option_id: optionId }));
  });
}

// ------------------------------------------------------- events/activities --

export interface EventInput {
  kind: EventKind;
  occasion?: EventOccasion;
  title: string;
  category: EventCategory;
  /** Required when category is 'other'; ignored otherwise. */
  customCategory?: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string;
  coordinate?: { lat: number; lng: number };
  capacity: number;
  audience: 'neighborhood' | 'city';
  recurring: boolean;
  localCoverImage?: string;
}

/** 'other' must carry a trimmed label (≤ 40); any other category carries none. */
function customCategoryFor(category: EventCategory, raw?: string): string | null {
  if (category !== 'other') return null;
  const v = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!v || v.length > 40) throw new ActionError('invalid', 'invalid:custom_category');
  return v;
}

export async function createEvent(input: EventInput) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const coverPath = input.localCoverImage ? await uploadCommunityImage(input.localCoverImage, nb, uid) : null;
    const row = check(
      await supabase
        .from('events')
        .insert({
          neighborhood_id: nb,
          host_id: uid,
          kind: input.kind,
          occasion: input.occasion ?? null,
          title: input.title,
          category: input.category,
          custom_category: customCategoryFor(input.category, input.customCategory),
          description: input.description,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          location_label: input.locationLabel,
          approx_lat: input.coordinate ? approximateCoordinate(input.coordinate.lat) : null,
          approx_lng: input.coordinate ? approximateCoordinate(input.coordinate.lng) : null,
          capacity: input.capacity,
          audience: input.audience,
          recurring: input.recurring,
          cover_image_path: coverPath,
        })
        .select('id')
        .single(),
    ) as { id: string };
    // The organizer takes the first spot.
    await supabase.rpc('rsvp_event', { target_event_id: row.id, desired_status: 'going' });
    return row.id;
  });
}

export interface ClubActivityInput extends Omit<EventInput, 'audience' | 'recurring'> {
  recurrence: Recurrence;
  /** Number of occurrences to schedule for a recurring activity (2–12). */
  occurrences: number;
  membersOnly: boolean;
}

/** Club activities: the server creates one events row per occurrence and notifies members once. */
export async function createClubActivity(clubId: string, input: ClubActivityInput) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const custom = customCategoryFor(input.category, input.customCategory);
    const coverPath = input.localCoverImage ? await uploadCommunityImage(input.localCoverImage, nb, uid) : null;
    return check(
      await supabase.rpc('create_club_activity', {
        target_club: clubId,
        p: {
          kind: input.kind,
          title: input.title,
          category: input.category,
          custom_category: custom,
          description: input.description,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          location_label: input.locationLabel,
          approx_lat: input.coordinate ? approximateCoordinate(input.coordinate.lat) : null,
          approx_lng: input.coordinate ? approximateCoordinate(input.coordinate.lng) : null,
          capacity: input.capacity,
          cover_image_path: coverPath,
          recurrence: input.recurrence,
          occurrences: input.occurrences,
          members_only: input.membersOnly,
        },
      }),
    ) as string;
  });
}

export interface EventEditInput {
  title: string;
  category: EventCategory;
  customCategory?: string;
  description: string;
  startsAt: string;
  endsAt: string;
  locationLabel: string;
  capacity: number;
  membersOnly?: boolean;
}

/**
 * Edits an activity the caller hosts or (for club activities) organizes.
 * scope 'future' applies the change to this and later occurrences of a
 * recurring series; RSVPs are kept, so nobody is registered twice.
 */
export async function updateEvent(eventId: string, input: EventEditInput, scope: 'one' | 'future' = 'one') {
  return run(async () => {
    me();
    const custom = customCategoryFor(input.category, input.customCategory);
    check(
      await supabase.rpc('update_club_activity', {
        target_event: eventId,
        scope,
        p: {
          title: input.title,
          category: input.category,
          custom_category: custom,
          description: input.description,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          location_label: input.locationLabel,
          capacity: input.capacity,
          ...(input.membersOnly === undefined ? {} : { members_only: input.membersOnly }),
        },
      }),
    );
  });
}

/** Cancels one occurrence or the rest of a series; attendees are notified once. */
export async function cancelActivity(eventId: string, scope: 'one' | 'future' = 'one') {
  return run(async () => {
    me();
    return check(await supabase.rpc('cancel_club_activity', { target_event: eventId, scope })) as number;
  });
}

export async function joinEvent(eventId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('rsvp_event', { target_event_id: eventId, desired_status: 'going' }));
  });
}

export async function leaveEvent(eventId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('leave_event', { target_event_id: eventId }));
  });
}

export async function cancelEvent(eventId: string) {
  return run(async () => {
    me();
    check(await supabase.from('events').update({ cancelled_at: new Date().toISOString() }).eq('id', eventId));
  });
}

// ------------------------------------------------------------------ issues --

export async function createIssue(input: {
  title: string;
  category: IssueCategory;
  description: string;
  localImages: string[];
  coordinate?: { lat: number; lng: number };
}) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const paths = await uploadCommunityImages(input.localImages, nb, uid);
    const row = check(
      await supabase
        .from('issues')
        .insert({
          neighborhood_id: nb,
          reporter_id: uid,
          title: input.title,
          category: input.category,
          description: input.description,
          image_paths: paths,
          approx_lat: input.coordinate ? approximateCoordinate(input.coordinate.lat) : null,
          approx_lng: input.coordinate ? approximateCoordinate(input.coordinate.lng) : null,
        })
        .select('id')
        .single(),
    ) as { id: string };
    await supabase.from('issue_engagements').insert([
      { issue_id: row.id, user_id: uid, kind: 'affected' },
      { issue_id: row.id, user_id: uid, kind: 'following' },
    ]);
    return row.id;
  });
}

export async function markIssueAffected(issueId: string) {
  return run(async () => {
    const uid = me();
    const already = useStore
      .getState()
      .issues.find((i) => i.id === issueId)
      ?.affectedUserIds.includes(uid);
    if (!already) check(await supabase.from('issue_engagements').insert({ issue_id: issueId, user_id: uid, kind: 'affected' }));
  });
}

export async function toggleFollowIssue(issueId: string) {
  return run(async () => {
    const uid = me();
    const following = useStore
      .getState()
      .issues.find((i) => i.id === issueId)
      ?.followerIds.includes(uid);
    if (following)
      check(await supabase.from('issue_engagements').delete().eq('issue_id', issueId).eq('user_id', uid).eq('kind', 'following'));
    else check(await supabase.from('issue_engagements').insert({ issue_id: issueId, user_id: uid, kind: 'following' }));
  });
}

/** Staff only (enforced by RLS on issue_updates / issues_protect_status trigger). */
export async function setIssueStatus(issueId: string, status: IssueStatus, note?: string) {
  return run(async () => {
    const uid = me();
    check(await supabase.from('issue_updates').insert({ issue_id: issueId, author_id: uid, status, note: note ?? null }));
    check(await supabase.from('issues').update({ status }).eq('id', issueId));
  });
}

// -------------------------------------------------------------------- help --

export async function createHelpRequest(input: { title: string; category: HelpCategory; description: string }) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const row = check(
      await supabase
        .from('help_requests')
        .insert({ neighborhood_id: nb, requester_id: uid, title: input.title, category: input.category, description: input.description })
        .select('id')
        .single(),
    ) as { id: string };
    return row.id;
  });
}

export async function offerHelp(helpRequestId: string, message?: string) {
  return run(async () => {
    const uid = me();
    check(
      await supabase.from('help_request_responses').insert({ help_request_id: helpRequestId, responder_id: uid, message: message ?? null }),
    );
  });
}

export async function resolveHelpRequest(helpRequestId: string) {
  return run(async () => {
    me();
    check(await supabase.from('help_requests').update({ status: 'resolved' }).eq('id', helpRequestId));
  });
}

// ------------------------------------------------------------- marketplace --

export async function createListing(input: {
  title: string;
  description: string;
  localImages: string[];
  category: string;
  listingType: ListingType;
  price?: number;
  condition: ListingCondition;
}) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const paths = await uploadCommunityImages(input.localImages, nb, uid);
    const row = check(
      await supabase
        .from('marketplace_listings')
        .insert({
          neighborhood_id: nb,
          seller_id: uid,
          title: input.title,
          description: input.description,
          image_paths: paths,
          category: input.category,
          listing_type: input.listingType,
          price: input.listingType === 'sale' ? (input.price ?? 0) : null,
          condition: input.condition,
        })
        .select('id')
        .single(),
    ) as { id: string };
    return row.id;
  });
}

export async function toggleSaveListing(listingId: string) {
  return run(async () => {
    const uid = me();
    const saved = useStore
      .getState()
      .marketplaceListings.find((m) => m.id === listingId)
      ?.savedBy.includes(uid);
    if (saved) check(await supabase.from('marketplace_favorites').delete().eq('listing_id', listingId).eq('user_id', uid));
    else check(await supabase.from('marketplace_favorites').insert({ listing_id: listingId, user_id: uid }));
  });
}

export async function setListingStatus(listingId: string, status: 'available' | 'reserved' | 'sold') {
  return run(async () => {
    me();
    check(await supabase.from('marketplace_listings').update({ status }).eq('id', listingId));
  });
}

export async function requestBorrow(itemId: string) {
  return run(async () => {
    const uid = me();
    check(await supabase.from('borrow_requests').insert({ listing_id: itemId, requester_id: uid }));
  });
}

// ------------------------------------------------------------- businesses --

export async function recommendBusiness(businessId: string, text: string) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    check(
      await supabase.from('business_recommendations').insert({ business_id: businessId, author_id: uid, neighborhood_id: nb, body: text }),
    );
  });
}

// ------------------------------------------------------------- lost/found --

export async function createLostFound(input: {
  kind: 'pet' | 'item';
  title: string;
  description: string;
  localImage?: string;
  status: LostFoundStatus;
}) {
  return run(async () => {
    const uid = me();
    const nb = verifiedNeighborhood();
    const paths = input.localImage ? [await uploadCommunityImage(input.localImage, nb, uid)] : [];
    const row = check(
      await supabase
        .from('lost_found_posts')
        .insert({
          neighborhood_id: nb,
          author_id: uid,
          kind: input.kind,
          title: input.title,
          description: input.description,
          image_paths: paths,
          status: input.status,
          contact_method: 'in_app',
        })
        .select('id')
        .single(),
    ) as { id: string };
    return row.id;
  });
}

export async function markLostFoundStatus(id: string, status: LostFoundStatus) {
  return run(async () => {
    me();
    check(await supabase.from('lost_found_posts').update({ status }).eq('id', id));
  });
}

// --------------------------------------------------------------- messaging --

/** What lets two residents start a direct conversation without being connected neighbors. */
export type MessageContext = { type: 'event' | 'listing' | 'help' | 'borrow' | 'lost_found'; id: string };

/**
 * Opens (or reuses) a direct conversation. A new thread needs an accepted
 * neighbor connection — or a context the other resident created, such as
 * their activity or listing. A pending neighbor request never grants
 * messaging (enforced by start_direct_conversation on the server).
 */
export async function getOrCreateDirectConversation(otherUserId: string, context?: MessageContext): Promise<string> {
  return run(async () => {
    me();
    const convo = check(
      await supabase.rpc('start_direct_conversation', {
        other_user_id: otherUserId,
        context_type: context?.type ?? null,
        context_id: context?.id ?? null,
      }),
    ) as { id: string };
    return convo.id;
  });
}

export async function sendMessage(conversationId: string, text: string, localImage?: string) {
  return run(async () => {
    const uid = me();
    let imagePath: string | null = null;
    if (localImage) {
      const nb = useStore.getState().session.neighborhoodId;
      if (!nb) throw new ActionError('no_neighborhood');
      imagePath = await uploadCommunityImage(localImage, nb, uid);
    }
    check(
      await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: uid, body: text || null, image_path: imagePath }),
    );
  });
}

export async function markConversationRead(conversationId: string) {
  return run(async () => {
    const uid = me();
    check(
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', uid),
    );
  });
}

// ----------------------------------------------------------- notifications --

export async function markNotificationRead(id: string) {
  return run(async () => {
    me();
    check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null));
  });
}

export async function markAllNotificationsRead() {
  return run(async () => {
    const uid = me();
    check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null));
  });
}

// ------------------------------------------------------- safety & social --

export async function thankUser(userId: string, reasonAr: string, message?: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('record_thanks', { target_user_id: userId, reason_ar: message ? `${reasonAr} — ${message}` : reasonAr }));
  });
}

export async function toggleBlockUser(userId: string) {
  return run(async () => {
    const uid = me();
    const blocked = useStore.getState().blockedUserIds.includes(userId);
    if (blocked) check(await supabase.from('user_blocks').delete().eq('blocker_id', uid).eq('blocked_id', userId));
    else check(await supabase.from('user_blocks').insert({ blocker_id: uid, blocked_id: userId }));
  });
}

export async function toggleMuteUser(userId: string) {
  return run(async () => {
    const uid = me();
    const muted = useStore.getState().mutedUserIds.includes(userId);
    if (muted) check(await supabase.from('user_mutes').delete().eq('muter_id', uid).eq('muted_id', userId));
    else check(await supabase.from('user_mutes').insert({ muter_id: uid, muted_id: userId }));
  });
}

export async function submitReport(targetType: ReportTargetType, targetId: string, reason: ReportReason, note?: string) {
  return run(async () => {
    const uid = me();
    check(
      await supabase
        .from('reports')
        .insert({ reporter_id: uid, target_type: targetType, target_id: targetId, reason, description: note ?? null }),
    );
  });
}

/** Staff only (RLS: reports_update_staff). */
export async function moderateReport(reportId: string, status: 'reviewed' | 'dismissed' | 'actioned') {
  return run(async () => {
    me();
    check(await supabase.from('reports').update({ status }).eq('id', reportId));
  });
}

/** Staff soft-delete (RLS restricts to owner or moderator/admin). */
export async function removeContent(targetType: ReportTargetType, targetId: string) {
  return run(async () => {
    me();
    const now = new Date().toISOString();
    if (targetType === 'post') check(await supabase.from('posts').update({ deleted_at: now }).eq('id', targetId));
    else if (targetType === 'comment') check(await supabase.from('post_comments').update({ deleted_at: now }).eq('id', targetId));
    else if (targetType === 'listing') check(await supabase.from('marketplace_listings').update({ deleted_at: now }).eq('id', targetId));
  });
}

export async function recordShare(channel: 'whatsapp' | 'native_share' | 'copy' | 'qr') {
  useStore.getState().recordReferralInviteSent();
  const uid = getCurrentUserId();
  if (!uid) return;
  await supabase.from('referral_events').insert({ user_id: uid, event_type: 'share', channel });
}

// ----------------------------------------------------------------- account --

/**
 * Permanent account deletion via the delete-account Edge Function (verifies
 * the caller's JWT, removes their storage objects, purges their rows and
 * deletes the auth user). Never just a local reset.
 */
export async function deleteAccount() {
  try {
    me();
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw error;
    if (!(data as { deleted?: boolean } | null)?.deleted) throw new ActionError('unknown', 'Account deletion did not complete');
    await supabase.auth.signOut().catch(() => {});
    useStore.getState().signOut();
  } catch (err) {
    throw toActionError(err);
  }
}

// ------------------------------------------------------------------ clubs --
// Every club write is a SECURITY DEFINER RPC that re-checks the caller's role,
// verified neighborhood, age declaration and the club's review status on the
// server. The client never sets review_status, roles or membership status.

export interface ClubEligibility {
  signedIn: boolean;
  verifiedNeighborhoodId: string | null;
  ageDeclared: boolean;
  isAdult: boolean;
  suspended: boolean;
  pendingApplications: number;
}

export async function getClubEligibility(): Promise<ClubEligibility> {
  return run(
    async () => {
      const r = (check(await supabase.rpc('my_club_eligibility')) ?? {}) as Record<string, unknown>;
      return {
        signedIn: !!r.signed_in,
        verifiedNeighborhoodId: (r.verified_neighborhood_id as string | null) ?? null,
        ageDeclared: !!r.age_declared,
        isAdult: !!r.is_adult,
        suspended: !!r.suspended,
        pendingApplications: Number(r.pending_applications ?? 0),
      };
    },
    { resync: false },
  );
}

/** Self-declared, set once, never readable by anyone. Returns whether the resident is 18+. */
export async function declareDateOfBirth(isoDate: string): Promise<boolean> {
  return run(
    async () => {
      me();
      return !!check(await supabase.rpc('declare_date_of_birth', { dob: isoDate }));
    },
    { resync: false },
  );
}

export interface ClubApplicationInput {
  name: string;
  description: string;
  category: ClubCategory;
  customCategory?: string;
  purpose: string;
  plannedActivities: string;
  meetingFrequency: string;
  neighborhoodBenefit: string;
  rules: string;
  membershipType: ClubMembershipType;
  meetingLocation?: string;
  meetingSchedule?: string;
  additionalInfo?: string;
  /** Newly picked local images (already cropped by the photo editor). */
  localCover?: string;
  localLogo?: string;
  /** Existing storage paths to keep when editing. */
  coverImagePath?: string | null;
  logoPath?: string | null;
}

async function clubPayload(input: ClubApplicationInput) {
  const uid = me();
  const nb = verifiedNeighborhood();
  const cover = input.localCover ? await uploadCommunityImage(input.localCover, nb, uid) : (input.coverImagePath ?? null);
  const logo = input.localLogo ? await uploadCommunityImage(input.localLogo, nb, uid) : (input.logoPath ?? null);
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    custom_category: input.category === 'other' ? (input.customCategory ?? null) : null,
    purpose: input.purpose,
    planned_activities: input.plannedActivities,
    meeting_frequency: input.meetingFrequency,
    neighborhood_benefit: input.neighborhoodBenefit,
    rules: input.rules,
    membership_type: input.membershipType,
    meeting_location: input.meetingLocation ?? null,
    meeting_schedule: input.meetingSchedule ?? null,
    additional_info: input.additionalInfo ?? null,
    cover_image_path: cover,
    logo_path: logo,
  };
}

/** The neighborhood is taken from the server-side verified membership, never from this payload. */
export async function submitClubApplication(input: ClubApplicationInput): Promise<string> {
  return run(async () => check(await supabase.rpc('submit_club_application', { p: await clubPayload(input) })) as string);
}

/** Pending/needs-changes: full edit and resubmit. Approved: organizers edit presentation and rules only. */
export async function updateClub(clubId: string, input: ClubApplicationInput) {
  return run(async () => {
    check(await supabase.rpc('update_club', { target_club: clubId, p: await clubPayload(input) }));
  });
}

/** Returns 'active' for open clubs, 'pending' when organizer approval is required. */
export async function joinClub(clubId: string): Promise<'active' | 'pending'> {
  return run(async () => {
    me();
    return check(await supabase.rpc('join_club', { target_club: clubId })) as 'active' | 'pending';
  });
}

export async function cancelJoinRequest(clubId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('cancel_join_request', { target_club: clubId }));
  });
}

export async function leaveClub(clubId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('leave_club', { target_club: clubId }));
  });
}

export async function respondJoinRequest(clubId: string, userId: string, approve: boolean) {
  return run(async () => {
    me();
    check(await supabase.rpc('respond_join_request', { target_club: clubId, target_user: userId, approve }));
  });
}

export async function setClubMemberRole(clubId: string, userId: string, role: 'moderator' | 'member') {
  return run(async () => {
    me();
    check(await supabase.rpc('set_member_role', { target_club: clubId, target_user: userId, new_role: role }));
  });
}

export async function removeClubMember(clubId: string, userId: string, ban = false) {
  return run(async () => {
    me();
    check(await supabase.rpc('remove_club_member', { target_club: clubId, target_user: userId, ban }));
  });
}

export async function unbanClubMember(clubId: string, userId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('unban_club_member', { target_club: clubId, target_user: userId }));
  });
}

export async function transferClubOwnership(clubId: string, newOwnerId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('transfer_club_ownership', { target_club: clubId, new_owner: newOwnerId }));
  });
}

export async function archiveClub(clubId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('archive_club', { target_club: clubId }));
  });
}

export async function postClubAnnouncement(clubId: string, body: string) {
  return run(async () => {
    me();
    return check(await supabase.rpc('post_club_announcement', { target_club: clubId, body })) as string;
  });
}

export async function deleteClubAnnouncement(announcementId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('delete_club_announcement', { target_announcement: announcementId }));
  });
}

/** Club organizers/moderators can hide a message in their club chat. */
export async function hideClubMessage(messageId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('moderate_club_message', { target_message: messageId }));
  });
}

// ------------------------------------------------------- club review (admin) --
// These RPCs refuse anyone whose profiles.app_role is not 'admin'; hiding the
// screens from non-admins is only a convenience.

export interface AdminClubApplication {
  clubId: string;
  name: string;
  reviewStatus: ClubReviewStatus;
  submittedAt?: string;
  ownerId: string;
  ownerName: string;
  ownerIsAdult: boolean;
  ownerVerifiedNeighborhood: string | null;
  neighborhoodId: string;
  neighborhoodNameAr?: string;
  neighborhoodNameEn?: string;
}

export async function fetchClubApplications(status: ClubReviewStatus | null): Promise<AdminClubApplication[]> {
  return run(
    async () => {
      const rows = (check(await supabase.rpc('admin_club_applications', { status_filter: status })) ?? []) as Record<string, any>[];
      return rows.map((r) => ({
        clubId: r.club_id,
        name: r.name,
        reviewStatus: r.review_status,
        submittedAt: r.submitted_at ?? undefined,
        ownerId: r.owner_id,
        ownerName: r.owner_name ?? '',
        ownerIsAdult: !!r.owner_is_adult,
        ownerVerifiedNeighborhood: r.owner_verified_neighborhood ?? null,
        neighborhoodId: r.neighborhood_id,
        neighborhoodNameAr: r.neighborhood_name_ar ?? undefined,
        neighborhoodNameEn: r.neighborhood_name_en ?? undefined,
      }));
    },
    { resync: false },
  );
}

export interface AdminClubDetail {
  club: Club;
  decisions: ClubReviewDecision[];
  signals: {
    memberCount: number;
    pendingRequests: number;
    upcomingActivities: number;
    activitiesLast90Days: number;
    messagesLast30Days: number;
    announcementsLast30Days: number;
    lastActivityAt: string | null;
    inactivityRemindedAt: string | null;
    ownerIsAdult: boolean;
    reportsOpen: number;
  };
}

export async function fetchClubForReview(clubId: string): Promise<AdminClubDetail | null> {
  return run(
    async () => {
      const [clubRes, decisionsRes, signalsRes] = await Promise.all([
        supabase.from('community_groups').select('*').eq('id', clubId).maybeSingle(),
        supabase.from('club_review_decisions').select('*').eq('club_id', clubId).order('created_at', { ascending: false }),
        supabase.rpc('admin_club_signals', { target_club: clubId }),
      ]);
      const row = check(clubRes) as Record<string, any> | null;
      if (!row) return null;
      const s = (check(signalsRes) ?? {}) as Record<string, any>;
      const urls = await resolveMediaUrls([row.cover_image_path, row.logo_path].filter(Boolean));
      return {
        club: mapClub(row, Number(s.member_count ?? 0), (p) => (p ? urls[p] : undefined)),
        decisions: ((check(decisionsRes) ?? []) as Record<string, any>[]).map((d) => ({
          id: d.id,
          clubId: d.club_id,
          adminId: d.admin_id ?? undefined,
          decision: d.decision,
          reason: d.reason ?? undefined,
          createdAt: d.created_at,
        })),
        signals: {
          memberCount: Number(s.member_count ?? 0),
          pendingRequests: Number(s.pending_requests ?? 0),
          upcomingActivities: Number(s.upcoming_activities ?? 0),
          activitiesLast90Days: Number(s.activities_last_90_days ?? 0),
          messagesLast30Days: Number(s.messages_last_30_days ?? 0),
          announcementsLast30Days: Number(s.announcements_last_30_days ?? 0),
          lastActivityAt: s.last_activity_at ?? null,
          inactivityRemindedAt: s.inactivity_reminded_at ?? null,
          ownerIsAdult: !!s.owner_is_adult,
          reportsOpen: Number(s.reports_open ?? 0),
        },
      };
    },
    { resync: false },
  );
}

export type ReviewDecision = 'approved' | 'rejected' | 'needs_changes' | 'suspended' | 'revoked' | 'reinstated';

export async function reviewClub(clubId: string, decision: ReviewDecision, reason?: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('review_club', { target_club: clubId, decision, reason: reason?.trim() || null }));
  });
}

export async function sendClubInactivityReminder(clubId: string) {
  return run(
    async () => {
      me();
      check(await supabase.rpc('send_club_inactivity_reminder', { target_club: clubId }));
    },
    { resync: false },
  );
}

// -------------------------------------------------------------- neighbors --
// Connections are mutual and server-enforced: a request creates nothing until
// the recipient accepts it. Discovery is opt-in (neighbor_settings).

export async function sendNeighborRequest(userId: string): Promise<NeighborState> {
  return run(async () => {
    me();
    return check(await supabase.rpc('send_neighbor_request', { target: userId })) as NeighborState;
  });
}

export async function cancelNeighborRequest(userId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('cancel_neighbor_request', { target: userId }));
  });
}

export async function respondNeighborRequest(requestId: string, accept: boolean) {
  return run(async () => {
    me();
    return check(await supabase.rpc('respond_neighbor_request', { request: requestId, accept })) as string;
  });
}

export async function removeNeighbor(userId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('remove_neighbor', { target: userId }));
  });
}

export async function discoverNeighbors(search?: string): Promise<DiscoveredNeighbor[]> {
  return run(
    async () => {
      me();
      const rows = (check(await supabase.rpc('discover_neighbors', { search: search?.trim() || null, max_results: 60 })) ?? []) as Record<
        string,
        any
      >[];
      return rows.map((r) => ({
        userId: r.user_id,
        firstName: r.first_name ?? '',
        lastName: r.last_name ?? '',
        avatarUrl: r.avatar_url ?? undefined,
        bio: r.bio ?? undefined,
        sharedInterests: ((r.shared_interests ?? []) as string[]).filter(isInterest),
        mutualCount: r.mutual_count ?? null,
        state: r.state,
      }));
    },
    { resync: false },
  );
}

export async function fetchNeighborProfile(userId: string): Promise<NeighborProfileInfo | null> {
  return run(
    async () => {
      me();
      const r = check(await supabase.rpc('neighbor_profile', { target: userId })) as Record<string, any> | null;
      if (!r) return null;
      return {
        state: r.state,
        incomingRequestId: r.incoming_request_id ?? null,
        acceptsRequests: r.accepts_requests !== false,
        neighborCount: r.neighbor_count ?? null,
        mutualCount: r.mutual_count ?? null,
        sharedInterests: ((r.shared_interests ?? []) as string[]).filter(isInterest),
        sharedClubs: (r.shared_clubs ?? []) as { id: string; name: string }[],
        canMessage: !!r.can_message,
      };
    },
    { resync: false },
  );
}

/** Loads one profile the resident is allowed to see (RLS) into the store, e.g. from discovery. */
export async function fetchProfile(userId: string): Promise<User | null> {
  return run(
    async () => {
      me();
      const [profileRes, interestsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).is('deleted_at', null).maybeSingle(),
        supabase.from('user_interests').select('interests').eq('user_id', userId).maybeSingle(),
      ]);
      const row = check(profileRes) as Record<string, any> | null;
      if (!row) return null;
      const { session, users } = useStore.getState();
      const user = mapProfile(row, {
        isSelf: row.id === session.supabaseUserId,
        neighborhoodId: session.neighborhoodId ?? '',
        verification: 'verified',
        eventsHosted: 0,
        neighborsHelped: 0,
        thanksReceived: 0,
      });
      const existing = users.find((u) => u.id === userId);
      const merged = existing ? { ...user, stats: existing.stats } : user;
      useStore.getState().applyEntities({ users: [...users.filter((u) => u.id !== userId), merged] });
      useStore
        .getState()
        .setProfileInterests(userId, (((interestsRes.data as Record<string, any> | null)?.interests ?? []) as string[]).filter(isInterest));
      return merged;
    },
    { resync: false },
  );
}

export async function updateNeighborSettings(patch: Partial<NeighborSettings>) {
  return run(async () => {
    me();
    const p: Record<string, boolean> = {};
    if (patch.discoverable !== undefined) p.discoverable = patch.discoverable;
    if (patch.allowRequests !== undefined) p.allow_requests = patch.allowRequests;
    if (patch.showNeighborCount !== undefined) p.show_neighbor_count = patch.showNeighborCount;
    if (patch.showInterests !== undefined) p.show_interests = patch.showInterests;
    if (patch.showSharedClubs !== undefined) p.show_shared_clubs = patch.showSharedClubs;
    if (patch.allowNeighborMessages !== undefined) p.allow_neighbor_messages = patch.allowNeighborMessages;
    const row = check(await supabase.rpc('update_neighbor_settings', { p })) as Record<string, any>;
    useStore.getState().applyEntities({ neighborSettings: mapNeighborSettings(row) });
  });
}

export async function setMyInterests(interests: Interest[]) {
  return run(async () => {
    me();
    check(await supabase.rpc('set_my_interests', { interests }));
    useStore.getState().applyEntities({ myInterests: interests });
  });
}

/** Invites connected neighbors; the server skips anyone ineligible and never enrolls them. */
export async function inviteNeighborsToEvent(eventId: string, userIds: string[]): Promise<number> {
  return run(async () => {
    me();
    return Number(check(await supabase.rpc('invite_neighbors_to_event', { target_event: eventId, invitees: userIds })) ?? 0);
  });
}

export async function respondEventInvitation(invitationId: string, accept: boolean) {
  return run(async () => {
    me();
    return check(await supabase.rpc('respond_event_invitation', { invitation: invitationId, accept })) as string;
  });
}

export async function cancelEventInvitation(invitationId: string) {
  return run(async () => {
    me();
    check(await supabase.rpc('cancel_event_invitation', { invitation: invitationId }));
  });
}

/** Returns false when the neighbor was already invited or is already in the club. */
export async function inviteNeighborToClub(clubId: string, userId: string): Promise<boolean> {
  return run(async () => {
    me();
    return !!check(await supabase.rpc('invite_neighbor_to_club', { target_club: clubId, invitee: userId }));
  });
}
