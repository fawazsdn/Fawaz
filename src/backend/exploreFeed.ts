import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/store/useStore';
import type { Post } from '@/models';
import { COMMUNITY_BUCKET, PROFILE_PHOTO_BUCKET } from './media';
import { mapNotification, mapPost } from './sync';

export const stagingExploreEnabled = Constants.expoConfig?.extra?.appVariant === 'staging';

export type ExploreFeed = 'community' | 'friends';
export const EXPLORE_PAGE_SIZE = 16;

/** Display fields only. The server masks the last name and omits the photo path unless the viewer may see it. */
export interface ExploreAuthor {
  id: string;
  firstName: string;
  lastName: string;
  namePrivacy: 'full' | 'first_last_initial' | 'first_only';
  avatarPath?: string;
}

export interface ExploreItem {
  post: Post;
  author?: ExploreAuthor;
  area?: { ar: string; en: string };
}

/** Opaque keyset cursor from the last row of a page; null starts a new snapshot. */
export type ExploreCursor = Record<string, unknown> | null;

type FeedRow = Parameters<typeof mapPost>[0] & {
  author?: { id: string; first_name?: string; last_name?: string; name_privacy?: string; avatar_path?: string | null };
  area?: { name_ar?: string; name_en?: string };
  feed_cursor?: Record<string, unknown>;
};

export function mapExploreAuthor(a?: FeedRow['author'] | null): ExploreAuthor | undefined {
  if (!a?.id) return undefined;
  const privacy = a.name_privacy === 'full' || a.name_privacy === 'first_only' ? a.name_privacy : 'first_last_initial';
  return { id: a.id, firstName: a.first_name ?? '', lastName: a.last_name ?? '', namePrivacy: privacy, avatarPath: a.avatar_path ?? undefined };
}

export async function fetchExploreFeed(
  feed: ExploreFeed,
  cursor: ExploreCursor,
  search?: string,
): Promise<{ items: ExploreItem[]; next: ExploreCursor }> {
  const viewer = getCurrentUserId();
  const { data, error } = await supabase.rpc('explore_social_feed', { feed, cursor, search_text: search ?? null });
  if (error) throw error;
  if (!viewer || viewer !== getCurrentUserId()) return { items: [], next: null };
  const rows = (data ?? []) as FeedRow[];
  const items = rows.map((row) => ({
    post: mapPost(row, new Set(row.saved ? [row.id] : []), viewer, () => []),
    author: mapExploreAuthor(row.author),
    area: row.area ? { ar: row.area.name_ar ?? '', en: row.area.name_en ?? '' } : undefined,
  }));
  return { items, next: rows.length === EXPLORE_PAGE_SIZE ? rows[rows.length - 1].feed_cursor ?? null : null };
}

/** One author's display fields for a post opened on its own, through the same server rules as profile cards. */
export async function fetchExploreAuthor(authorId: string): Promise<ExploreAuthor | undefined> {
  const viewer = getCurrentUserId();
  const { data, error } = await supabase.rpc('social_profile', { target: authorId });
  if (error || viewer !== getCurrentUserId()) return undefined;
  return mapExploreAuthor(data as FeedRow['author']);
}

/** Recheck search candidates before showing their locally cached display names. */
export async function fetchVisibleExplorePeople(ids: string[]) {
  if (ids.length === 0) return [];
  const viewer = getCurrentUserId();
  const { data, error } = await supabase.from('profiles').select('id')
    .in('id', ids).eq('is_private', false).is('deleted_at', null);
  if (error) throw error;
  return viewer === getCurrentUserId() ? (data ?? []).map(({ id }) => id as string) : [];
}

/** Load notifications for the current viewer after RLS rechecks the actor and post. */
export async function fetchExploreNotifications(viewer: string) {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', viewer)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return viewer === getCurrentUserId() ? (data ?? []).map(mapNotification) : [];
}

/** Recheck post visibility without deriving or returning any signed links. */
export async function canOpenExplorePost(postId: string) {
  const viewer = getCurrentUserId();
  const { data, error } = await supabase.from('posts').select('id').eq('id', postId).is('deleted_at', null).maybeSingle();
  return !error && !!data && viewer === getCurrentUserId();
}

/**
 * Storage checks the caller's RLS on each request. No transferable signed URL is created, and
 * the result lives only in memory (callers drop it when the card scrolls away).
 */
export async function fetchExplorePhoto(
  path: string,
  signal: AbortSignal,
  bucket: typeof COMMUNITY_BUCKET | typeof PROFILE_PHOTO_BUCKET = COMMUNITY_BUCKET,
): Promise<string | null> {
  // Legacy external URLs and unrelated buckets are deliberately excluded.
  if (!path || path.includes(':') || path.includes('..') || path.startsWith('/')) return null;
  const { data, error } = await supabase.storage.from(bucket).download(path, {}, { signal, cache: 'no-store' });
  if (error || !data || signal.aborted || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(data.type)) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(!signal.aborted && typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(data);
  });
}
