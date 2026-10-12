import { supabase } from '@/lib/supabase';

/**
 * Storage layout (enforced by storage RLS policies on the server):
 *   community-media (private): <neighborhood_id>/<auth.uid()>/<file>
 *     — only verified members of that neighborhood can read; only the
 *       uploader can write into their own folder.
 *   avatars (public):          <auth.uid()>/<file>
 *
 * Private media is displayed through short-lived signed URLs. Rows store
 * the object *path*, never a URL, so links can't outlive their access.
 */
export const COMMUNITY_BUCKET = 'community-media';
export const AVATAR_BUCKET = 'avatars';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function randomName() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/**
 * Every uploaded object is recorded in media_attachments (RLS: owner only),
 * which is what the delete-account Edge Function uses to remove a resident's
 * files when they delete their account.
 */
async function recordAttachment(ownerId: string, bucket: string, path: string, size: number, neighborhoodId: string | null) {
  await supabase.from('media_attachments').insert({
    owner_id: ownerId,
    neighborhood_id: neighborhoodId,
    bucket_id: bucket,
    object_path: path,
    mime_type: 'image/jpeg',
    size_bytes: size,
  });
}

async function readFileAsArrayBuffer(localUri: string): Promise<ArrayBuffer> {
  const res = await fetch(localUri);
  if (!res.ok && res.status !== 0) throw new Error(`Could not read image (${res.status})`);
  return res.arrayBuffer();
}

/** Uploads an already-edited local JPEG into the neighborhood's private media folder. Returns the storage path. */
export async function uploadCommunityImage(localUri: string, neighborhoodId: string, userId: string): Promise<string> {
  const path = `${neighborhoodId}/${userId}/${randomName()}`;
  const body = await readFileAsArrayBuffer(localUri);
  const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  await recordAttachment(userId, COMMUNITY_BUCKET, path, body.byteLength, neighborhoodId);
  return path;
}

export async function uploadCommunityImages(localUris: string[], neighborhoodId: string, userId: string): Promise<string[]> {
  const paths: string[] = [];
  for (const uri of localUris) paths.push(await uploadCommunityImage(uri, neighborhoodId, userId));
  return paths;
}

/** Uploads a profile photo to the public avatars bucket and returns its public URL. */
export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  const path = `${userId}/${randomName()}`;
  const body = await readFileAsArrayBuffer(localUri);
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  await recordAttachment(userId, AVATAR_BUCKET, path, body.byteLength, null);
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** True for values that are already displayable URLs (e.g. public avatar URLs). */
function isUrl(value: string) {
  return /^(https?:|file:|data:)/.test(value);
}

/**
 * Resolves private storage paths to signed URLs in one batch request.
 * Unknown/failed paths are simply absent from the result — callers show no
 * image rather than a placeholder.
 */
export async function resolveMediaUrls(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of new Set(paths.filter((x): x is string => !!x))) {
    if (isUrl(p)) {
      out[p] = p;
      continue;
    }
    const cached = signedUrlCache.get(p);
    if (cached && cached.expiresAt > now + 60_000) out[p] = cached.url;
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from(COMMUNITY_BUCKET).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (!error && data) {
      for (const item of data) {
        if (item.path && item.signedUrl) {
          out[item.path] = item.signedUrl;
          signedUrlCache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000 });
        }
      }
    }
  }
  return out;
}

export function clearMediaCache() {
  signedUrlCache.clear();
}
