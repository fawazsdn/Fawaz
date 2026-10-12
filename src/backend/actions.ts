import { supabase } from '@/lib/supabase';
import { getCurrentUserId, useStore } from '@/store/useStore';
import type {
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
  ReportTargetType,
} from '@/models';
import { uploadAvatar, uploadCommunityImage, uploadCommunityImages } from './media';
import { requestSync } from './sync';

/**
 * Every mutation in the app. Each one writes to Supabase (RLS decides what's
 * allowed — the client never pretends a write succeeded) and then re-syncs so
 * the UI reflects server truth. Errors are thrown as ActionError with a
 * stable `code` that screens map to a translated message.
 */

export type ActionErrorCode = 'not_signed_in' | 'not_verified' | 'no_neighborhood' | 'offline' | 'closed' | 'forbidden' | 'invalid' | 'unknown';

export class ActionError extends Error {
  code: ActionErrorCode;
  constructor(code: ActionErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

function toActionError(err: unknown): ActionError {
  if (err instanceof ActionError) return err;
  const e = err as { code?: string; message?: string } | null;
  const msg = e?.message ?? String(err);
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

export async function saveProfile(input: { firstName: string; lastName: string; namePrivacy: NamePrivacy; bio?: string; localAvatarUri?: string; locale?: 'ar' | 'en' }) {
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
    const row = check(await supabase.rpc('select_neighborhood', { target_neighborhood_id: neighborhoodId })) as { verification_status?: string } | null;
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
    const saved = useStore.getState().posts.find((p) => p.id === postId)?.savedBy.includes(uid);
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
      await supabase.from('post_comments').select('*, comment_reactions(user_id)').eq('post_id', postId).order('created_at', { ascending: true }),
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
      const liked = useStore.getState().comments.find((c) => c.id === commentId)?.likedBy.includes(uid);
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
    const already = useStore.getState().issues.find((i) => i.id === issueId)?.affectedUserIds.includes(uid);
    if (!already) check(await supabase.from('issue_engagements').insert({ issue_id: issueId, user_id: uid, kind: 'affected' }));
  });
}

export async function toggleFollowIssue(issueId: string) {
  return run(async () => {
    const uid = me();
    const following = useStore.getState().issues.find((i) => i.id === issueId)?.followerIds.includes(uid);
    if (following) check(await supabase.from('issue_engagements').delete().eq('issue_id', issueId).eq('user_id', uid).eq('kind', 'following'));
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
    check(await supabase.from('help_request_responses').insert({ help_request_id: helpRequestId, responder_id: uid, message: message ?? null }));
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
    const saved = useStore.getState().marketplaceListings.find((m) => m.id === listingId)?.savedBy.includes(uid);
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
    check(await supabase.from('business_recommendations').insert({ business_id: businessId, author_id: uid, neighborhood_id: nb, body: text }));
  });
}

// ------------------------------------------------------------- lost/found --

export async function createLostFound(input: { kind: 'pet' | 'item'; title: string; description: string; localImage?: string; status: LostFoundStatus }) {
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

export async function getOrCreateDirectConversation(otherUserId: string): Promise<string> {
  return run(async () => {
    me();
    const convo = check(await supabase.rpc('get_or_create_direct_conversation', { other_user_id: otherUserId })) as { id: string };
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
    check(await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: uid, body: text || null, image_path: imagePath }));
  });
}

export async function markConversationRead(conversationId: string) {
  return run(async () => {
    const uid = me();
    check(await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', uid));
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
    check(await supabase.from('reports').insert({ reporter_id: uid, target_type: targetType, target_id: targetId, reason, description: note ?? null }));
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
