#!/usr/bin/env node
/**
 * Moves existing profile photos from the public `avatars` bucket into the
 * private `profile-photos` bucket (migration 20261109130000).
 *
 * Operator-only. Needs the service-role key, which must never ship in the app:
 *   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/migrate-avatars-to-private.mjs                 # dry run (default): report only
 *     node scripts/migrate-avatars-to-private.mjs --apply         # copy + point profiles at the copy
 *     node scripts/migrate-avatars-to-private.mjs --apply --remove-public
 *                                                                 # ...and delete the public files
 *
 * Safety:
 *   - Dry run by default; nothing is written without --apply.
 *   - Idempotent: profiles already pointing at a private copy are skipped
 *     (or only cleaned up with --remove-public).
 *   - A public file is deleted only after the private copy is read back and
 *     its size matches, and only with --remove-public.
 *   - Photos stored elsewhere (e.g. a sign-in provider URL) are reported, never touched.
 *   - Prints counts and profile ids only - never names, emails or URLs.
 */
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';

export const PUBLIC_BUCKET = 'avatars';
export const PRIVATE_BUCKET = 'profile-photos';
const MARKER = '/storage/v1/object/public/avatars/';

export function publicAvatarPath(url) {
  if (!url || typeof url !== 'string') return null;
  const i = url.indexOf(MARKER);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + MARKER.length).split('?')[0]);
}

/** Decides what to do with one profile row. Pure; used by the tests. */
export function planFor(row) {
  const legacy = publicAvatarPath(row.avatar_url);
  if (!row.avatar_url && !row.avatar_path) return { action: 'none' };
  if (row.avatar_url && !legacy) return { action: 'external' };
  if (legacy && !legacy.startsWith(`${row.id}/`)) return { action: 'foreign_path', legacy };
  if (legacy && row.avatar_path) return { action: 'cleanup', legacy };
  if (legacy) return { action: 'copy', legacy };
  return { action: 'done' };
}

function newPath(userId, legacy) {
  const ext = (legacy.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  return `${userId}/${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`;
}

function contentTypeFor(path) {
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.webp$/i.test(path)) return 'image/webp';
  if (/\.heic$/i.test(path)) return 'image/heic';
  return 'image/jpeg';
}

/** Migrates one profile. `client` is a supabase-js client with the service role. */
export async function migrateOne(client, row, { apply, removePublic }) {
  const plan = planFor(row);
  if (!apply || !['copy', 'cleanup'].includes(plan.action)) return { id: row.id, ...plan, applied: false };

  let privatePath = row.avatar_path;
  if (plan.action === 'copy') {
    const { data: blob, error } = await client.storage.from(PUBLIC_BUCKET).download(plan.legacy);
    if (error || !blob) return { id: row.id, action: 'error', step: 'download' };
    const body = Buffer.from(await blob.arrayBuffer());
    privatePath = newPath(row.id, plan.legacy);
    const up = await client.storage.from(PRIVATE_BUCKET).upload(privatePath, body, { contentType: contentTypeFor(plan.legacy), upsert: false });
    if (up.error) return { id: row.id, action: 'error', step: 'upload' };
    const { data: check, error: checkError } = await client.storage.from(PRIVATE_BUCKET).download(privatePath);
    if (checkError || !check || (await check.arrayBuffer()).byteLength !== body.byteLength) {
      await client.storage.from(PRIVATE_BUCKET).remove([privatePath]);
      return { id: row.id, action: 'error', step: 'verify' };
    }
    const att = await client.from('media_attachments').insert({
      owner_id: row.id,
      neighborhood_id: null,
      bucket_id: PRIVATE_BUCKET,
      object_path: privatePath,
      mime_type: contentTypeFor(plan.legacy),
      size_bytes: body.byteLength,
    });
    if (att.error) {
      await client.storage.from(PRIVATE_BUCKET).remove([privatePath]);
      return { id: row.id, action: 'error', step: 'attachment' };
    }
    // Keep avatar_url until --remove-public so build 13 keeps showing the photo meanwhile.
    const upd = await client.from('profiles').update({ avatar_path: privatePath }).eq('id', row.id);
    if (upd.error) {
      await client.storage.from(PRIVATE_BUCKET).remove([privatePath]);
      await client.from('media_attachments').delete().eq('object_path', privatePath);
      return { id: row.id, action: 'error', step: 'profile' };
    }
  }

  if (!removePublic) return { id: row.id, action: plan.action, applied: true, publicRemoved: false };

  const { data: check, error: checkError } = await client.storage.from(PRIVATE_BUCKET).download(privatePath);
  if (checkError || !check) return { id: row.id, action: 'error', step: 'verify_before_remove' };
  const clear = await client.from('profiles').update({ avatar_url: null }).eq('id', row.id);
  if (clear.error) return { id: row.id, action: 'error', step: 'clear_url' };
  const rm = await client.storage.from(PUBLIC_BUCKET).remove([plan.legacy]);
  if (rm.error) return { id: row.id, action: 'error', step: 'remove_public' };
  await client.from('media_attachments').delete().eq('bucket_id', PUBLIC_BUCKET).eq('object_path', plan.legacy);
  return { id: row.id, action: plan.action, applied: true, publicRemoved: true };
}

export async function run(client, { apply = false, removePublic = false, log = console.log } = {}) {
  const { data: rows, error } = await client.from('profiles').select('id, avatar_url, avatar_path').order('id');
  if (error) throw new Error(`could not read profiles: ${error.message}`);
  const results = [];
  for (const row of rows ?? []) results.push(await migrateOne(client, row, { apply, removePublic }));
  const tally = {};
  for (const r of results) {
    const key = r.action === 'error' ? `error:${r.step}` : r.applied ? `${r.action}:applied${r.publicRemoved ? '+public_removed' : ''}` : r.action;
    tally[key] = (tally[key] ?? 0) + 1;
  }
  log(`${apply ? 'APPLY' : 'DRY RUN'}${removePublic ? ' (remove public copies)' : ''}: ${rows?.length ?? 0} profiles`);
  for (const [k, n] of Object.entries(tally).sort()) log(`  ${k}: ${n}`);
  for (const r of results.filter((x) => x.action === 'error' || x.action === 'foreign_path')) log(`  ! ${r.id} ${r.action} ${r.step ?? ''}`);
  return results;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (never commit the key).');
    process.exit(2);
  }
  if (args.has('--remove-public') && !args.has('--apply')) {
    console.error('--remove-public requires --apply.');
    process.exit(2);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const results = await run(client, { apply: args.has('--apply'), removePublic: args.has('--remove-public') });
  process.exit(results.some((r) => r.action === 'error') ? 1 : 0);
}
