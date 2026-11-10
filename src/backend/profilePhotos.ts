import { supabase } from '@/lib/supabase';
import { AVATAR_BUCKET, PROFILE_PHOTO_BUCKET, recordAttachment, resolveMediaUrls } from './media';
import { useSocialStore } from './socialState';
import { PRIVATE_UPLOAD_CACHE_CONTROL, PROFILE_PHOTO_LINK_SECONDS } from './mediaPrivacy';

/**
 * Profile photos live in the private `profile-photos` bucket once
 * 20261109130000_private_profile_photos.sql is applied. Rows carry
 * `avatar_path`; the app turns it into a 1-hour signed URL, and the storage
 * policy only signs it for people allowed to see the photo (owner, staff,
 * followers of a private account, verified residents for a public one;
 * never across a block). Legacy `avatar_url` (public bucket) is only a
 * fallback until the photo has been moved.
 */

type Row = Record<string, any>; // untyped PostgREST rows

export const PROFILE_PHOTO_TTL_SECONDS = PROFILE_PHOTO_LINK_SECONDS;
const PUBLIC_AVATAR_MARKER = '/storage/v1/object/public/avatars/';

/** True once the backend exposes avatar_path (the private-photo migration is applied). */
export function notePrivatePhotoSupport(row: Row | null | undefined) {
  if (row && typeof row === 'object' && 'avatar_path' in row) useSocialStore.getState().setPrivatePhotos(true);
}

export function publicAvatarPath(url?: string | null): string | null {
  if (!url) return null;
  const i = url.indexOf(PUBLIC_AVATAR_MARKER);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + PUBLIC_AVATAR_MARKER.length).split('?')[0]);
}

/**
 * Replaces avatar_url with a signed URL for rows that have avatar_path.
 * Works for profile rows, social cards and follow-list entries.
 */
export async function withSignedAvatars<T extends Row>(rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.avatar_path as string | null | undefined).filter((p): p is string => !!p);
  if (paths.length === 0) return rows;
  const urls = await resolveMediaUrls(paths, PROFILE_PHOTO_BUCKET, PROFILE_PHOTO_TTL_SECONDS);
  return rows.map((r) => (r.avatar_path ? { ...r, avatar_url: urls[r.avatar_path] ?? null } : r));
}

function randomName() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/** Uploads an edited local JPEG into <uid>/ of the private bucket and returns its path. */
export async function uploadProfilePhoto(localUri: string, userId: string): Promise<string> {
  const path = `${userId}/${randomName()}`;
  const res = await fetch(localUri);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false, cacheControl: PRIVATE_UPLOAD_CACHE_CONTROL });
  if (error) throw error;
  await recordAttachment(userId, PROFILE_PHOTO_BUCKET, path, body.byteLength, null);
  return path;
}

/**
 * Deletes one of the user's own private profile-photo files plus its record.
 * Legacy files in the public `avatars` bucket are never deleted by the app:
 * clearing avatar_url archives the link on the server, and the originals are
 * removed only by the owner-approved cleanup after device tests.
 */
export async function deleteOwnPhoto(userId: string, ref: { path?: string | null; url?: string | null }) {
  if (!ref.path || !ref.path.startsWith(`${userId}/`)) return;
  await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([ref.path]).catch(() => undefined);
  await supabase.from('media_attachments').delete().eq('object_path', ref.path);
}

/** Private copy name for a legacy photo; the same rule as the operator script, so copies are never duplicated. */
export function privateCopyPath(userId: string, legacyPath: string): string {
  const base = (legacyPath.split('/').pop() ?? 'photo.jpg').replace(/[^A-Za-z0-9._-]/g, '_');
  return `${userId}/legacy-${base}`;
}

let selfMigration: Promise<boolean> | null = null;

/**
 * Copies the signed-in user's own legacy public avatar into private storage
 * and points avatar_path at the copy. Non-destructive: the public original and
 * avatar_url stay, so build 13 keeps showing the photo and a rollback loses
 * nothing. Idempotent (deterministic copy name). Returns true when a private
 * copy is in place (or there is nothing to copy).
 */
export function ensurePrivateAvatar(userId: string, row: Row | null | undefined): Promise<boolean> {
  if (!row || !useSocialStore.getState().privatePhotos) return Promise.resolve(false);
  const legacyPath = publicAvatarPath(row.avatar_url);
  if (!legacyPath) return Promise.resolve(true);
  // Only ever copy a file from the user's own folder.
  if (!legacyPath.startsWith(`${userId}/`)) return Promise.resolve(false);
  const target = privateCopyPath(userId, legacyPath);
  if (row.avatar_path === target) return Promise.resolve(true);
  if (selfMigration) return selfMigration;
  selfMigration = (async () => {
    try {
      const { data: blob, error } = await supabase.storage.from(AVATAR_BUCKET).download(legacyPath);
      if (error || !blob) return false;
      const body = await blob.arrayBuffer();
      const up = await supabase.storage
        .from(PROFILE_PHOTO_BUCKET)
        .upload(target, body, { contentType: 'image/jpeg', upsert: true, cacheControl: PRIVATE_UPLOAD_CACHE_CONTROL });
      if (up.error) return false;
      await recordAttachment(userId, PROFILE_PHOTO_BUCKET, target, body.byteLength, null);
      // A legacy link is always the newest photo (e.g. uploaded later from build
      // 13), so it replaces whatever private photo was there before.
      const { error: updateError } = await supabase.from('profiles').update({ avatar_path: target }).eq('id', userId);
      if (updateError) return false;
      if (row.avatar_path && row.avatar_path !== target) await deleteOwnPhoto(userId, { path: row.avatar_path });
      return true;
    } catch {
      return false;
    } finally {
      selfMigration = null;
    }
  })();
  return selfMigration;
}

/**
 * Moves the user's private profile photo to a new file and deletes the old
 * one. Deleting the object is the only way to cut off links that were already
 * issued (and their CDN-cached copies, within about a minute). Called after
 * the user blocks someone, removes a follower or makes the account private.
 * Best effort: a failure leaves the photo where it was.
 */
export async function rotateProfilePhoto(userId: string): Promise<boolean> {
  try {
    const { data: row } = await supabase.from('profiles').select('avatar_path').eq('id', userId).maybeSingle();
    const current = (row as Row | null)?.avatar_path as string | undefined;
    if (!current || !current.startsWith(`${userId}/`)) return false;
    const next = `${userId}/${randomName()}`;
    const { error: copyError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).copy(current, next);
    if (copyError) return false;
    const { error: updateError } = await supabase.from('profiles').update({ avatar_path: next }).eq('id', userId);
    if (updateError) {
      await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([next]).catch(() => undefined);
      return false;
    }
    // Owners can insert and delete their attachment records (not update them).
    const { data: att } = await supabase.from('media_attachments').select('size_bytes').eq('object_path', current).maybeSingle();
    await recordAttachment(userId, PROFILE_PHOTO_BUCKET, next, Number((att as Row | null)?.size_bytes) || 1, null);
    await supabase.from('media_attachments').delete().eq('object_path', current);
    await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([current]).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}
