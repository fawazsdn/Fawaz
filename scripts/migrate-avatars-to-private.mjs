#!/usr/bin/env node
/**
 * Profile photo move for migration 20261109130000 (public `avatars` bucket ->
 * private `profile-photos` bucket), in owner-approved stages.
 *
 * Operator-only. Needs the service-role key, which must never ship in the app:
 *   export SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=...
 *
 *   node scripts/migrate-avatars-to-private.mjs                       # dry run: report only (default)
 *   node scripts/migrate-avatars-to-private.mjs --apply               # stage 1: copy originals, set avatar_path
 *   node scripts/migrate-avatars-to-private.mjs --verify              # integrity check, changes nothing
 *   node scripts/migrate-avatars-to-private.mjs --remove-public --apply --confirm-device-tests-passed
 *                                                                     # stage 2 (after device tests): delete originals
 *   node scripts/migrate-avatars-to-private.mjs --restore-public [--apply]
 *                                                                     # rollback aid: public copy for private-only photos
 *   node scripts/migrate-avatars-to-private.mjs --sweep-orphans [--apply]
 *                                                                     # files left by accounts that no longer exist
 *
 * Safety:
 *   - Dry run unless --apply. Stage 1 never deletes or rewrites avatar_url, so
 *     build 13 keeps showing every photo and a rollback loses nothing.
 *   - Stage 2 refuses to run without --confirm-device-tests-passed and runs the
 *     full integrity check first; any problem aborts before a file is touched.
 *   - Idempotent: private copies have a deterministic name (<uid>/legacy-<file>),
 *     the same rule the app uses.
 *   - Only files in an account's own folder are ever copied or deleted.
 *   - Prints counts and profile ids only - never names, emails or URLs.
 */
import { Buffer } from 'node:buffer';

export const PUBLIC_BUCKET = 'avatars';
export const PRIVATE_BUCKET = 'profile-photos';
const MARKER = '/storage/v1/object/public/avatars/';

export function publicAvatarPath(url) {
  if (!url || typeof url !== 'string') return null;
  const i = url.indexOf(MARKER);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + MARKER.length).split('?')[0]);
}

/** Same rule as src/backend/profilePhotos.ts privateCopyPath. */
export function privateCopyPath(userId, legacyPath) {
  const base = (legacyPath.split('/').pop() ?? 'photo.jpg').replace(/[^A-Za-z0-9._-]/g, '_');
  return `${userId}/legacy-${base}`;
}

function contentTypeFor(path) {
  if (/\.png$/i.test(path)) return 'image/png';
  if (/\.webp$/i.test(path)) return 'image/webp';
  if (/\.heic$/i.test(path)) return 'image/heic';
  return 'image/jpeg';
}

async function sizeOf(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) return null;
  return (await data.arrayBuffer()).byteLength;
}

/** Decides what stage 1 does for one profile (pure; used by the tests). */
export function planFor(row, archived = []) {
  const current = publicAvatarPath(row.avatar_url);
  // A photo taken off the profile when the account went private still needs a private copy.
  const pending = archived.find((a) => a.reason === 'went_private' && !a.file_removed_at);
  const legacyUrl = current ? row.avatar_url : !row.avatar_path && pending ? pending.url : null;
  const legacy = publicAvatarPath(legacyUrl);
  if (!legacy) {
    if (row.avatar_url && !current) return { action: 'external' };
    return { action: row.avatar_path ? 'private_only' : 'none' };
  }
  if (!legacy.startsWith(`${row.id}/`)) return { action: 'foreign_path', legacy };
  const target = privateCopyPath(row.id, legacy);
  if (row.avatar_path === target) return { action: 'copied', legacy, target };
  return { action: 'copy', legacy, target };
}

async function loadState(client) {
  const { data: rows, error } = await client.from('profiles').select('id, avatar_url, avatar_path').order('id');
  if (error) throw new Error(`could not read profiles: ${error.message}`);
  const inv = await client.rpc('legacy_avatar_inventory');
  if (inv.error) throw new Error(`could not read the legacy photo inventory: ${inv.error.message}`);
  const archive = (inv.data ?? []).filter((r) => r.reason !== 'current');
  return { rows: rows ?? [], archive };
}

/** Stage 1 for one profile: copy the original, verify, point avatar_path at it. */
export async function copyOne(client, row, plan, { apply }) {
  if (plan.action !== 'copy') return { id: row.id, action: plan.action };
  if (!apply) return { id: row.id, action: 'copy', applied: false };
  const { data: blob, error } = await client.storage.from(PUBLIC_BUCKET).download(plan.legacy);
  if (error || !blob) return { id: row.id, action: 'error', step: 'download' };
  const body = Buffer.from(await blob.arrayBuffer());
  const up = await client.storage.from(PRIVATE_BUCKET).upload(plan.target, body, { contentType: contentTypeFor(plan.legacy), upsert: true });
  if (up.error) return { id: row.id, action: 'error', step: 'upload' };
  if ((await sizeOf(client, PRIVATE_BUCKET, plan.target)) !== body.byteLength) return { id: row.id, action: 'error', step: 'verify' };
  await client.from('media_attachments').delete().eq('object_path', plan.target);
  const att = await client.from('media_attachments').insert({
    owner_id: row.id,
    neighborhood_id: null,
    bucket_id: PRIVATE_BUCKET,
    object_path: plan.target,
    mime_type: contentTypeFor(plan.legacy),
    size_bytes: body.byteLength,
  });
  if (att.error) return { id: row.id, action: 'error', step: 'attachment' };
  const upd = await client.from('profiles').update({ avatar_path: plan.target }).eq('id', row.id);
  if (upd.error) return { id: row.id, action: 'error', step: 'profile' };
  return { id: row.id, action: 'copy', applied: true };
}

/** Integrity check: every private photo exists, every copy matches its original, every kept original exists. */
export async function verify(client, state = null) {
  const { rows, archive } = state ?? (await loadState(client));
  const problems = [];
  for (const row of rows) {
    if (row.avatar_path) {
      const privateSize = await sizeOf(client, PRIVATE_BUCKET, row.avatar_path);
      if (privateSize == null) {
        problems.push({ id: row.id, problem: 'private_missing' });
        continue;
      }
      const legacy = publicAvatarPath(row.avatar_url);
      if (legacy && privateCopyPath(row.id, legacy) === row.avatar_path) {
        const publicSize = await sizeOf(client, PUBLIC_BUCKET, legacy);
        if (publicSize == null) problems.push({ id: row.id, problem: 'original_missing' });
        else if (publicSize !== privateSize) problems.push({ id: row.id, problem: 'size_mismatch' });
      }
    }
    const plan = planFor(row, archive.filter((a) => a.user_id === row.id));
    if (plan.action === 'copy') problems.push({ id: row.id, problem: 'not_copied' });
  }
  for (const a of archive.filter((x) => !x.file_removed_at)) {
    const path = publicAvatarPath(a.url);
    if (path && (await sizeOf(client, PUBLIC_BUCKET, path)) == null) problems.push({ id: a.user_id, problem: 'archived_original_missing' });
  }
  return problems;
}

/** Stage 2: delete public originals that have a verified private copy or were replaced/removed by their owner. */
export async function removePublic(client, { apply, confirmed }) {
  if (!apply || !confirmed) throw new Error('--remove-public needs --apply and --confirm-device-tests-passed');
  const state = await loadState(client);
  const problems = await verify(client, state);
  if (problems.length > 0) return { aborted: true, problems, removed: [] };
  const removed = [];
  for (const row of state.rows) {
    const legacy = publicAvatarPath(row.avatar_url);
    if (!legacy || !row.avatar_path || !legacy.startsWith(`${row.id}/`)) continue;
    // Clearing the link archives it on the server (reason 'migrated').
    const clear = await client.from('profiles').update({ avatar_url: null }).eq('id', row.id);
    if (clear.error) return { aborted: true, problems: [{ id: row.id, problem: 'clear_url' }], removed };
    const rm = await client.storage.from(PUBLIC_BUCKET).remove([legacy]);
    if (rm.error) return { aborted: true, problems: [{ id: row.id, problem: 'remove' }], removed };
    await client.from('media_attachments').delete().eq('bucket_id', PUBLIC_BUCKET).eq('object_path', legacy);
    await client.rpc('mark_legacy_avatar_removed', { target_user: row.id, file_url: row.avatar_url });
    removed.push(row.id);
  }
  for (const a of state.archive.filter((x) => !x.file_removed_at)) {
    const path = publicAvatarPath(a.url);
    if (!path || !path.startsWith(`${a.user_id}/`)) continue;
    const owner = state.rows.find((r) => r.id === a.user_id);
    // A private-account original needs a private copy first; replaced/removed ones are no longer wanted.
    if (a.reason === 'went_private' && !owner?.avatar_path) continue;
    const rm = await client.storage.from(PUBLIC_BUCKET).remove([path]);
    if (rm.error) return { aborted: true, problems: [{ id: a.user_id, problem: 'remove_archived' }], removed };
    await client.from('media_attachments').delete().eq('bucket_id', PUBLIC_BUCKET).eq('object_path', path);
    await client.rpc('mark_legacy_avatar_removed', { target_user: a.user_id, file_url: a.url });
    removed.push(a.user_id);
  }
  return { aborted: false, problems: [], removed };
}

/** Rollback aid: give private-only photos a public copy again (run before rolling back 20261109130000). */
export async function restorePublic(client, { apply }) {
  const { rows, archive } = await loadState(client);
  const out = [];
  for (const row of rows) {
    if (!row.avatar_path || row.avatar_url) continue;
    const kept = archive.some((a) => a.user_id === row.id && ['went_private', 'migrated'].includes(a.reason) && !a.file_removed_at);
    if (kept) continue; // the rollback restores the archived original itself
    if (!apply) {
      out.push({ id: row.id, action: 'restore', applied: false });
      continue;
    }
    const { data: blob, error } = await client.storage.from(PRIVATE_BUCKET).download(row.avatar_path);
    if (error || !blob) {
      out.push({ id: row.id, action: 'error', step: 'download' });
      continue;
    }
    const path = `${row.id}/restored-${row.avatar_path.split('/').pop()}`;
    const up = await client.storage.from(PUBLIC_BUCKET).upload(path, Buffer.from(await blob.arrayBuffer()), { contentType: contentTypeFor(path), upsert: true });
    if (up.error) {
      out.push({ id: row.id, action: 'error', step: 'upload' });
      continue;
    }
    const url = client.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
    const upd = await client.from('profiles').update({ avatar_url: url }).eq('id', row.id);
    out.push(upd.error ? { id: row.id, action: 'error', step: 'profile' } : { id: row.id, action: 'restore', applied: true });
  }
  return out;
}

/** Files whose top-level owner folder belongs to no profile (e.g. deleted through the legacy endpoint). */
export async function sweepOrphans(client, { apply }) {
  const { data: rows, error } = await client.from('profiles').select('id');
  if (error) throw new Error(`could not read profiles: ${error.message}`);
  const ids = new Set((rows ?? []).map((r) => r.id));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const found = [];
  for (const [bucket, root] of [
    [PRIVATE_BUCKET, ''],
    [PUBLIC_BUCKET, ''],
    ['community-media', 'posts'],
  ]) {
    const { data: folders } = await client.storage.from(bucket).list(root, { limit: 1000 });
    for (const f of folders ?? []) {
      if (f.id || !uuid.test(f.name) || ids.has(f.name)) continue; // files, non-account folders, live accounts
      const prefix = root ? `${root}/${f.name}` : f.name;
      const { data: files } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
      const paths = (files ?? []).filter((x) => x.id).map((x) => `${prefix}/${x.name}`);
      if (paths.length === 0) continue;
      found.push({ bucket, owner: f.name, files: paths.length });
      if (apply) await client.storage.from(bucket).remove(paths);
    }
  }
  return found;
}

export async function stage1(client, { apply }) {
  const { rows, archive } = await loadState(client);
  const results = [];
  for (const row of rows) results.push(await copyOne(client, row, planFor(row, archive.filter((a) => a.user_id === row.id)), { apply }));
  return results;
}

function tally(results) {
  const t = {};
  for (const r of results) {
    const k = r.action === 'error' ? `error:${r.step}` : r.applied === false ? `${r.action} (dry run)` : r.applied ? `${r.action}:applied` : r.action;
    t[k] = (t[k] ?? 0) + 1;
  }
  return t;
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
  const apply = args.has('--apply');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let failed = false;
  if (args.has('--remove-public')) {
    if (!apply || !args.has('--confirm-device-tests-passed')) {
      console.error('Refusing: --remove-public needs --apply and --confirm-device-tests-passed (owner approval after device tests).');
      process.exit(2);
    }
    const r = await removePublic(client, { apply, confirmed: true });
    console.log(r.aborted ? `ABORTED: ${r.problems.length} problem(s)` : `REMOVED public originals for ${r.removed.length} profile(s)`);
    for (const p of r.problems) console.log(`  ! ${p.id} ${p.problem}`);
    failed = r.aborted;
  } else if (args.has('--verify')) {
    const problems = await verify(client);
    console.log(problems.length ? `VERIFY FAILED: ${problems.length} problem(s)` : 'VERIFY OK');
    for (const p of problems) console.log(`  ! ${p.id} ${p.problem}`);
    failed = problems.length > 0;
  } else if (args.has('--restore-public')) {
    const r = await restorePublic(client, { apply });
    console.log(`${apply ? 'RESTORE' : 'RESTORE (dry run)'}:`, tally(r));
    failed = r.some((x) => x.action === 'error');
  } else if (args.has('--sweep-orphans')) {
    const r = await sweepOrphans(client, { apply });
    console.log(`${apply ? 'SWEPT' : 'ORPHANS (dry run)'}: ${r.length} folder(s), ${r.reduce((n, x) => n + x.files, 0)} file(s)`);
  } else {
    const r = await stage1(client, { apply });
    console.log(`${apply ? 'STAGE 1 APPLY' : 'DRY RUN'}: ${r.length} profiles`, tally(r));
    for (const x of r.filter((y) => y.action === 'error' || y.action === 'foreign_path')) console.log(`  ! ${x.id} ${x.action} ${x.step ?? ''}`);
    failed = r.some((x) => x.action === 'error');
  }
  process.exit(failed ? 1 : 0);
}
