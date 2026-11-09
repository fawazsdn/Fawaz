import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { getCurrentUserId, useStore } from '@/store/useStore';
import type { Post, PostAudience } from '@/models';
import { ActionError } from './actions';
import { AVATAR_BUCKET, COMMUNITY_BUCKET, recordAttachment, resolveMediaUrls, uploadAvatar } from './media';
import { mapPost, requestSync } from './sync';
import { useSocialAvailable, useSocialStore } from './socialState';

/**
 * Follows, private accounts, social profile cards and multi-photo posts.
 *
 * These call database functions added by
 * supabase/migrations/20261109120000_social_follows_photo_posts.sql. Until
 * that migration is applied, the server reports the functions as missing:
 * `socialAvailable` turns false and every screen falls back to the existing
 * neighborhood-only behavior (no follow buttons, no new audiences, photos
 * stored exactly as before).
 */

type Row = Record<string, any>; // untyped PostgREST rows

export type FollowState = 'self' | 'none' | 'requested' | 'following';

export interface SocialProfile {
  id: string;
  firstName: string;
  lastName: string;
  namePrivacy: 'full' | 'first_last_initial' | 'first_only';
  avatarUrl?: string;
  bio?: string;
  isPrivate: boolean;
  verified: boolean;
  neighborhoodId?: string;
  memberSince: string;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  followState: FollowState;
  followsYou: boolean;
  requestedYou: boolean;
  canViewContent: boolean;
  fullProfile: boolean;
  blockedByYou: boolean;
}

export interface FollowEntry {
  userId: string;
  firstName: string;
  lastName: string;
  namePrivacy: 'full' | 'first_last_initial' | 'first_only';
  avatarUrl?: string;
  isPrivate: boolean;
  verified: boolean;
  followState: FollowState;
  since: string;
}

export { useSocialAvailable, useSocialStore };

function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '');
}

function fail(error: { code?: string; message?: string }): never {
  const msg = (error.message ?? '').trim();
  if (error.code === '42501' || msg === 'blocked' || msg === 'forbidden' || msg === 'not_verified') {
    throw new ActionError(msg === 'not_verified' ? 'not_verified' : 'forbidden', msg);
  }
  if (/network|fetch|timed out/i.test(msg)) throw new ActionError('offline', msg);
  if (error.code === '22023') throw new ActionError('invalid', msg);
  throw new ActionError('unknown', msg);
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (isMissingFunction(error)) {
    useSocialStore.getState().setAvailable(false);
    throw new ActionError('unknown', 'social_unavailable');
  }
  if (error) fail(error);
  useSocialStore.getState().setAvailable(true);
  return data as T;
}

/** Probes once whether the social backend exists. Never throws. */
export async function detectSocial(): Promise<boolean> {
  const { error } = await supabase.rpc('list_follow_requests');
  const ok = !isMissingFunction(error);
  useSocialStore.getState().setAvailable(ok);
  return ok;
}

function me(): string {
  const id = getCurrentUserId();
  if (!id) throw new ActionError('not_signed_in');
  return id;
}

// ---------------------------------------------------------------- profiles --

export function mapSocialProfile(j: Row): SocialProfile {
  return {
    id: j.id,
    firstName: j.first_name ?? '',
    lastName: j.last_name ?? '',
    namePrivacy: j.name_privacy ?? 'first_last_initial',
    avatarUrl: j.avatar_url ?? undefined,
    bio: j.bio ?? undefined,
    isPrivate: !!j.is_private,
    verified: !!j.verified,
    neighborhoodId: j.neighborhood_id ?? undefined,
    memberSince: j.member_since,
    postsCount: Number(j.posts_count ?? 0),
    followersCount: Number(j.followers_count ?? 0),
    followingCount: Number(j.following_count ?? 0),
    followState: j.follow_state ?? 'none',
    followsYou: !!j.follows_you,
    requestedYou: !!j.requested_you,
    canViewContent: !!j.can_view_content,
    fullProfile: !!j.full_profile,
    blockedByYou: !!j.blocked_by_you,
  };
}

/** The profile card for any resident whose id you have, or null when unavailable to you. */
export async function fetchSocialProfile(userId: string): Promise<SocialProfile | null> {
  const data = await rpc<Row | null>('social_profile', { target: userId });
  return data ? mapSocialProfile(data) : null;
}

export async function followUser(userId: string): Promise<FollowState> {
  me();
  const state = await rpc<FollowState>('follow_user', { target: userId });
  void requestSync();
  return state;
}

/** Unfollow, or withdraw a pending request. */
export async function unfollowUser(userId: string) {
  me();
  await rpc('unfollow_user', { target: userId });
  void requestSync();
}

export async function respondFollowRequest(userId: string, accept: boolean) {
  me();
  await rpc('respond_follow_request', { requester: userId, accept });
  void requestSync();
}

export async function removeFollower(userId: string) {
  me();
  await rpc('remove_follower', { follower: userId });
}

export async function setAccountPrivate(isPrivate: boolean) {
  me();
  await rpc('set_account_private', { make_private: isPrivate });
}

function mapEntry(r: Row): FollowEntry {
  return {
    userId: r.user_id,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    namePrivacy: r.name_privacy ?? 'first_last_initial',
    avatarUrl: r.avatar_url ?? undefined,
    isPrivate: !!r.is_private,
    verified: !!r.verified,
    followState: r.follow_state ?? 'none',
    since: r.created_at,
  };
}

export async function listFollows(userId: string, kind: 'followers' | 'following', search?: string): Promise<FollowEntry[]> {
  const rows = await rpc<Row[]>('list_follows', { target: userId, kind, search: search?.trim() || null, lim: 100, off: 0 });
  return (rows ?? []).map(mapEntry);
}

export async function listFollowRequests(): Promise<FollowEntry[]> {
  const rows = await rpc<Row[]>('list_follow_requests', {});
  return (rows ?? []).map((r) => mapEntry({ ...r, follow_state: 'none', is_private: false }));
}

// ------------------------------------------------------------------- posts --

/** Posts by one author that the signed-in resident may see (RLS decides), newest first. */
export async function fetchAuthorPosts(authorId: string): Promise<Post[]> {
  const uid = me();
  const [{ data, error }, savedRes] = await Promise.all([
    supabase
      .from('posts')
      .select('*, post_reactions(user_id, type), post_comments(count)')
      .eq('author_id', authorId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(90),
    supabase.from('saved_posts').select('post_id').eq('user_id', uid),
  ]);
  if (error) fail(error);
  const rows = (data ?? []) as Row[];
  const saved = new Set(((savedRes.data ?? []) as Row[]).map((r) => r.post_id as string));
  const urls = await resolveMediaUrls(rows.flatMap((p) => p.image_paths ?? []));
  return rows.map((p) => mapPost(p, saved, uid, (ps) => (ps ?? []).map((x) => urls[x]).filter((u): u is string => !!u)));
}

/** Loads one post (e.g. opened from a notification or a follow) into the store. */
export async function fetchPost(postId: string): Promise<Post | null> {
  const uid = me();
  const { data, error } = await supabase
    .from('posts')
    .select('*, post_reactions(user_id, type), post_comments(count)')
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const { data: savedRow } = await supabase.from('saved_posts').select('post_id').eq('user_id', uid).eq('post_id', postId);
  const urls = await resolveMediaUrls((data as Row).image_paths ?? []);
  const post = mapPost(data as Row, new Set(((savedRow ?? []) as Row[]).map((r) => r.post_id)), uid, (ps) =>
    (ps ?? []).map((x) => urls[x]).filter((u): u is string => !!u),
  );
  const others = useStore.getState().posts.filter((p) => p.id !== post.id);
  useStore.getState().applyEntities({ posts: [post, ...others] });
  return post;
}

/** Caption, audience and location edits. Photos can be reordered or removed, never added. */
export async function updatePost(
  postId: string,
  patch: { caption?: string; audience?: PostAudience; locationLabel?: string | null; imagePaths?: string[] },
) {
  me();
  const update: Row = {};
  if (patch.caption !== undefined) update.text_ar = patch.caption;
  if (patch.audience !== undefined) update.audience = patch.audience;
  if (patch.locationLabel !== undefined) update.location_label = patch.locationLabel;
  if (patch.imagePaths !== undefined) update.image_paths = patch.imagePaths;
  const { error } = await supabase.from('posts').update(update).eq('id', postId);
  if (error) fail(error);
  await requestSync();
}

/** Removes a comment as its author, as the post's author (moderation) or as staff. */
export async function deletePostComment(commentId: string) {
  me();
  await rpc('delete_post_comment', { target_comment: commentId });
}

// ------------------------------------------------------------------ photos --

export const MAX_POST_PHOTOS = 10;
const MAX_EDGE = 2048;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function isAcceptedImageType(mimeType?: string | null): boolean {
  // The iOS photo library doesn't always report a type; the re-encode below normalizes anything it can decode.
  return !mimeType || ACCEPTED_TYPES.includes(mimeType.toLowerCase());
}

/**
 * Re-encodes a picked photo as a JPEG no larger than 2048px on its long edge.
 * Re-encoding drops all metadata (EXIF location, device, timestamps), so no
 * GPS coordinates ever leave the phone.
 */
export async function preparePhoto(uri: string, width?: number, height?: number): Promise<{ uri: string; width: number; height: number }> {
  const long = Math.max(width ?? 0, height ?? 0);
  let ctx = ImageManipulator.manipulate(uri);
  if (long > MAX_EDGE) ctx = ctx.resize((width ?? 0) >= (height ?? 0) ? { width: MAX_EDGE } : { height: MAX_EDGE });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

function randomName() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/**
 * Uploads prepared photos to the private post-photo folder
 * (community-media/posts/<uid>/...). Storage policy: only you can read them
 * until a post you can see references them.
 */
export async function uploadPostPhotos(localUris: string[], neighborhoodId: string): Promise<string[]> {
  const uid = me();
  if (localUris.length > MAX_POST_PHOTOS) throw new ActionError('invalid', 'invalid:images');
  const paths: string[] = [];
  for (const uri of localUris) {
    const res = await fetch(uri);
    const body = await res.arrayBuffer();
    if (body.byteLength < 1 || body.byteLength > MAX_UPLOAD_BYTES) throw new ActionError('invalid', 'invalid:image_size');
    const path = `posts/${uid}/${randomName()}`;
    const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    await recordAttachment(uid, COMMUNITY_BUCKET, path, body.byteLength, neighborhoodId);
    paths.push(path);
  }
  return paths;
}

/** Removes uploads whose post was never created (e.g. the insert was refused). */
export async function discardUploads(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(COMMUNITY_BUCKET).remove(paths).catch(() => undefined);
  await supabase.from('media_attachments').delete().in('object_path', paths);
}

// ------------------------------------------------------------ profile photo --

function avatarPath(url?: string | null): string | null {
  const m = url?.match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function deleteOldAvatar(uid: string, oldUrl?: string | null) {
  const path = avatarPath(oldUrl);
  // Only ever touch files in your own folder.
  if (!path || !path.startsWith(`${uid}/`)) return;
  await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => undefined);
  await supabase.from('media_attachments').delete().eq('object_path', path);
}

/** Replaces the profile photo (already cropped and re-encoded by the editor) and deletes the old file. */
export async function changeAvatar(localUri: string, oldUrl?: string | null) {
  const uid = me();
  const url = await uploadAvatar(localUri, uid);
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
  if (error) fail(error);
  await deleteOldAvatar(uid, oldUrl);
  await requestSync();
  return url;
}

/** Removes the profile photo; the app falls back to the initials avatar. */
export async function removeAvatar(oldUrl?: string | null) {
  const uid = me();
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', uid);
  if (error) fail(error);
  await deleteOldAvatar(uid, oldUrl);
  await requestSync();
}
