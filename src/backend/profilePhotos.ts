import { supabase } from '@/lib/supabase';
import { AVATAR_BUCKET, PROFILE_PHOTO_BUCKET, recordAttachment, resolveMediaUrls } from './media';
import { useSocialStore } from './socialState';

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

export const PROFILE_PHOTO_TTL_SECONDS = 60 * 60;
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
  const { error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  await recordAttachment(userId, PROFILE_PHOTO_BUCKET, path, body.byteLength, null);
  return path;
}

/** Deletes a photo file the user owns, in either bucket, plus its attachment row. */
export async function deleteOwnPhoto(userId: string, ref: { path?: string | null; url?: string | null }) {
  const targets: [string, string][] = [];
  if (ref.path && ref.path.startsWith(`${userId}/`)) targets.push([PROFILE_PHOTO_BUCKET, ref.path]);
  const legacy = publicAvatarPath(ref.url);
  if (legacy && legacy.startsWith(`${userId}/`)) targets.push([AVATAR_BUCKET, legacy]);
  for (const [bucket, path] of targets) {
    await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
    await supabase.from('media_attachments').delete().eq('object_path', path);
  }
}

let selfMigration: Promise<boolean> | null = null;

/**
 * Moves the signed-in user's own legacy public avatar into private storage
 * (copy -> point the profile at it -> delete the public file). Idempotent and
 * safe to call repeatedly; returns true when the photo is private (or absent).
 */
export function ensurePrivateAvatar(userId: string, row: Row | null | undefined): Promise<boolean> {
  if (!row || !useSocialStore.getState().privatePhotos) return Promise.resolve(false);
  const legacyPath = publicAvatarPath(row.avatar_url);
  if (!legacyPath) return Promise.resolve(true);
  // Only ever move a file from the user's own folder.
  if (!legacyPath.startsWith(`${userId}/`)) return Promise.resolve(false);
  if (selfMigration) return selfMigration;
  selfMigration = (async () => {
    try {
      // A legacy URL is always the newest photo (moving one clears it), e.g. one
      // uploaded later from build 13 on another device, so it replaces avatar_path.
      const { data: blob, error } = await supabase.storage.from(AVATAR_BUCKET).download(legacyPath);
      if (error || !blob) return false;
      const body = await blob.arrayBuffer();
      const path = `${userId}/${randomName()}`;
      const up = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
      if (up.error) return false;
      await recordAttachment(userId, PROFILE_PHOTO_BUCKET, path, body.byteLength, null);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path, avatar_url: null }).eq('id', userId);
      if (updateError) {
        await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]).catch(() => undefined);
        return false;
      }
      if (row.avatar_path && row.avatar_path !== path) await deleteOwnPhoto(userId, { path: row.avatar_path });
      // Only after the private copy is in place: remove the public file.
      await deleteOwnPhoto(userId, { url: row.avatar_url });
      return true;
    } catch {
      return false;
    } finally {
      selfMigration = null;
    }
  })();
  return selfMigration;
}
