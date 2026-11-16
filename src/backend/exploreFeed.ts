import Constants from 'expo-constants';

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/store/useStore';
import { COMMUNITY_BUCKET } from './media';
import { mapNotification, mapPost } from './sync';

export const stagingExploreEnabled = Constants.expoConfig?.extra?.appVariant === 'staging';

export type ExploreFeed = 'community' | 'friends';
export const EXPLORE_PAGE_SIZE = 16;

export async function fetchExploreFeed(feed: ExploreFeed, offset: number, search?: string) {
  const viewer = getCurrentUserId();
  const { data, error } = await supabase.rpc('explore_social_feed', { feed, page_offset: offset, search_text: search ?? null });
  if (error) throw error;
  if (!viewer || viewer !== getCurrentUserId()) return [];
  return ((data ?? []) as Parameters<typeof mapPost>[0][]).map((row) =>
    mapPost(row, new Set(row.saved ? [row.id] : []), viewer, () => []),
  );
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

/** Storage checks the caller's RLS on each request. No transferable signed URL is created. */
export async function fetchExplorePhoto(path: string, signal: AbortSignal): Promise<string | null> {
  // Legacy external URLs and unrelated buckets are deliberately excluded.
  if (!path || path.includes(':') || path.includes('..') || path.startsWith('/')) return null;
  const { data, error } = await supabase.storage.from(COMMUNITY_BUCKET).download(path, {}, { signal, cache: 'no-store' });
  if (error || !data || signal.aborted || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(data.type)) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(!signal.aborted && typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(data);
  });
}
