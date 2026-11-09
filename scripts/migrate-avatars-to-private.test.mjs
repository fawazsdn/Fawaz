// node --test scripts/migrate-avatars-to-private.test.mjs
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

import { planFor, privateCopyPath, removePublic, restorePublic, stage1, sweepOrphans, verify } from './migrate-avatars-to-private.mjs';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const GONE = '99999999-9999-9999-9999-999999999999';
const pub = (path) => `https://proj.supabase.co/storage/v1/object/public/avatars/${path}`;

/** In-memory stand-in for the parts of supabase-js the script uses (incl. the archive trigger). */
function fakeClient(profiles, files = {}, { failUpload = false, archive = [] } = {}) {
  const buckets = { avatars: new Map(), 'profile-photos': new Map(), 'community-media': new Map() };
  for (const [k, v] of Object.entries(files)) {
    const [bucket, ...rest] = k.split(':');
    buckets[rest.length ? bucket : 'avatars'].set(rest.length ? rest.join(':') : k, Buffer.from(v));
  }
  const attachments = [];
  const blob = (buf) => ({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
  const storage = {
    from: (bucket) => ({
      download: async (path) => (buckets[bucket].has(path) ? { data: blob(buckets[bucket].get(path)), error: null } : { data: null, error: { message: 'not found' } }),
      upload: async (path, body) => {
        if (failUpload) return { error: { message: 'boom' } };
        buckets[bucket].set(path, Buffer.from(body));
        return { error: null };
      },
      remove: async (paths) => {
        for (const p of paths) buckets[bucket].delete(p);
        return { error: null };
      },
      list: async (prefix) => {
        const seen = new Map();
        for (const key of buckets[bucket].keys()) {
          if (prefix && !key.startsWith(`${prefix}/`)) continue;
          const rest = prefix ? key.slice(prefix.length + 1) : key;
          const [head, ...tail] = rest.split('/');
          seen.set(head, tail.length ? { name: head, id: null } : { name: head, id: 'file' });
        }
        return { data: [...seen.values()], error: null };
      },
      getPublicUrl: (path) => ({ data: { publicUrl: pub(path) } }),
    }),
  };
  const rpc = async (name, args) => {
    if (name === 'legacy_avatar_inventory') {
      const current = profiles.filter((p) => p.avatar_url?.includes('/object/public/avatars/')).map((p) => ({ user_id: p.id, url: p.avatar_url, reason: 'current' }));
      return { data: [...current, ...archive], error: null };
    }
    if (name === 'mark_legacy_avatar_removed') {
      for (const a of archive) if (a.user_id === args.target_user && a.url === args.file_url) a.file_removed_at = 'now';
      return { error: null };
    }
    return { error: { message: 'unknown rpc' } };
  };
  const table = (name) => {
    const q = { filters: [] };
    const rows = () => (name === 'profiles' ? profiles : attachments);
    const match = (r) => q.filters.every(([k, v]) => r[k] === v);
    const api = {
      select: () => api,
      order: () => Promise.resolve({ data: profiles.map((p) => ({ ...p })), error: null }),
      insert: async (row) => {
        attachments.push(row);
        return { error: null };
      },
      update: (patch) => ((q.patch = patch), api),
      delete: () => ((q.delete = true), api),
      eq: (k, v) => (q.filters.push([k, v]), api),
      then: (resolve) => {
        if (q.patch) {
          for (const r of rows().filter(match)) {
            if (name === 'profiles' && 'avatar_url' in q.patch && r.avatar_url?.includes('/object/public/avatars/') && q.patch.avatar_url !== r.avatar_url) {
              archive.push({ user_id: r.id, url: r.avatar_url, reason: q.patch.avatar_url == null && r.avatar_path ? 'migrated' : 'replaced', file_removed_at: null });
            }
            Object.assign(r, q.patch);
          }
        }
        if (q.delete) {
          const keep = rows().filter((r) => !match(r));
          rows().length = 0;
          rows().push(...keep);
        }
        if (!q.patch && !q.delete && name === 'profiles') return resolve({ data: profiles.map((p) => ({ id: p.id })), error: null });
        resolve({ error: null });
      },
    };
    return api;
  };
  return { storage, rpc, from: table, buckets, attachments, archive };
}

test('plans each kind of profile', () => {
  assert.equal(planFor({ id: U1 }).action, 'none');
  assert.equal(planFor({ id: U1, avatar_url: 'https://lh3.googleusercontent.com/a/x' }).action, 'external');
  assert.equal(planFor({ id: U1, avatar_url: pub(`${U1}/a.jpg`) }).action, 'copy');
  assert.equal(planFor({ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: `${U1}/legacy-a.jpg` }).action, 'copied');
  assert.equal(planFor({ id: U1, avatar_url: pub(`${U2}/a.jpg`) }).action, 'foreign_path');
  assert.equal(planFor({ id: U1, avatar_path: `${U1}/b.jpg` }).action, 'private_only');
  // An account that went private before its photo was copied still gets a copy.
  assert.equal(planFor({ id: U1, avatar_url: null }, [{ reason: 'went_private', url: pub(`${U1}/a.jpg`) }]).action, 'copy');
  assert.equal(privateCopyPath(U1, `${U1}/a b.jpg`), `${U1}/legacy-a_b.jpg`);
});

test('dry run changes nothing', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: 'jpeg-bytes' });
  await stage1(c, { apply: false });
  assert.equal(c.buckets['profile-photos'].size, 0);
  assert.equal(profiles[0].avatar_path, null);
});

test('stage 1 copies and keeps the original and avatar_url (build 13 still shows it); re-running is a no-op', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: 'jpeg-bytes' });
  await stage1(c, { apply: true });
  assert.equal(profiles[0].avatar_path, `${U1}/legacy-a.jpg`);
  assert.equal(profiles[0].avatar_url, pub(`${U1}/a.jpg`));
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
  assert.equal(c.buckets['profile-photos'].get(`${U1}/legacy-a.jpg`).toString(), 'jpeg-bytes');
  await stage1(c, { apply: true });
  assert.equal(c.buckets['profile-photos'].size, 1);
  assert.equal(c.attachments.length, 1);
  assert.deepEqual(await verify(c), []);
});

test('remove-public refuses without the device-test confirmation', async () => {
  const c = fakeClient([], {});
  await assert.rejects(() => removePublic(c, { apply: true, confirmed: false }), /confirm-device-tests-passed/);
  await assert.rejects(() => removePublic(c, { apply: false, confirmed: true }), /--apply/);
});

test('remove-public aborts before touching anything when integrity fails', async () => {
  const profiles = [
    { id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: `${U1}/legacy-a.jpg` },
    { id: U2, avatar_url: pub(`${U2}/b.jpg`), avatar_path: null },
  ];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: 'aaaa', [`${U2}/b.jpg`]: 'bb', [`profile-photos:${U1}/legacy-a.jpg`]: 'aaa' });
  const r = await removePublic(c, { apply: true, confirmed: true });
  assert.equal(r.aborted, true);
  assert.deepEqual(r.problems.map((p) => p.problem).sort(), ['not_copied', 'size_mismatch']);
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
  assert.ok(profiles[0].avatar_url);
});

test('after verification, remove-public deletes originals, archives the link and marks it removed', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: 'jpeg-bytes' });
  await stage1(c, { apply: true });
  const r = await removePublic(c, { apply: true, confirmed: true });
  assert.equal(r.aborted, false);
  assert.equal(profiles[0].avatar_url, null);
  assert.equal(c.buckets.avatars.size, 0);
  assert.ok(c.buckets['profile-photos'].has(`${U1}/legacy-a.jpg`));
  assert.ok(c.archive.every((a) => a.file_removed_at));
});

test('an account that went private keeps its original until it has a private copy', async () => {
  const archive = [{ user_id: U1, url: pub(`${U1}/a.jpg`), reason: 'went_private', file_removed_at: null }];
  const profiles = [{ id: U1, avatar_url: null, avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: 'x' }, { archive });
  const r1 = await removePublic(c, { apply: true, confirmed: true });
  assert.equal(r1.aborted, true, 'not copied yet -> abort');
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
  await stage1(c, { apply: true });
  assert.equal(profiles[0].avatar_path, `${U1}/legacy-a.jpg`);
  const r2 = await removePublic(c, { apply: true, confirmed: true });
  assert.equal(r2.aborted, false);
  assert.equal(c.buckets.avatars.size, 0);
});

test('a failed copy leaves everything as it was', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: 'x' }, { failUpload: true });
  const [r] = await stage1(c, { apply: true });
  assert.deepEqual([r.action, r.step], ['error', 'upload']);
  assert.equal(profiles[0].avatar_path, null);
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
});

test('restore-public gives private-only photos a public copy for a rollback', async () => {
  const profiles = [{ id: U1, avatar_url: null, avatar_path: `${U1}/new.jpg` }];
  const c = fakeClient(profiles, { [`profile-photos:${U1}/new.jpg`]: 'img' });
  const dry = await restorePublic(c, { apply: false });
  assert.equal(dry[0].applied, false);
  assert.equal(profiles[0].avatar_url, null);
  await restorePublic(c, { apply: true });
  assert.equal(profiles[0].avatar_url, pub(`${U1}/restored-new.jpg`));
  assert.equal(c.buckets.avatars.get(`${U1}/restored-new.jpg`).toString(), 'img');
});

test('sweep finds files of accounts that no longer exist and leaves live accounts alone', async () => {
  const profiles = [{ id: U1, avatar_url: null, avatar_path: `${U1}/p.jpg` }];
  const c = fakeClient(profiles, {
    [`profile-photos:${U1}/p.jpg`]: 'a',
    [`profile-photos:${GONE}/p.jpg`]: 'b',
    [`community-media:posts/${GONE}/1.jpg`]: 'c',
    [`community-media:posts/${U1}/1.jpg`]: 'd',
  });
  const found = await sweepOrphans(c, { apply: false });
  assert.equal(found.length, 2);
  assert.equal(c.buckets['profile-photos'].size, 2, 'dry run deletes nothing');
  await sweepOrphans(c, { apply: true });
  assert.ok(c.buckets['profile-photos'].has(`${U1}/p.jpg`));
  assert.ok(!c.buckets['profile-photos'].has(`${GONE}/p.jpg`));
  assert.ok(c.buckets['community-media'].has(`posts/${U1}/1.jpg`));
  assert.ok(!c.buckets['community-media'].has(`posts/${GONE}/1.jpg`));
});

test("never copies another account's file or touches external URLs", async () => {
  const profiles = [
    { id: U1, avatar_url: pub(`${U2}/a.jpg`), avatar_path: null },
    { id: U2, avatar_url: 'https://lh3.googleusercontent.com/a/x', avatar_path: null },
  ];
  const c = fakeClient(profiles, { [`${U2}/a.jpg`]: 'x' });
  await stage1(c, { apply: true });
  assert.equal(c.buckets['profile-photos'].size, 0);
  assert.equal(profiles[1].avatar_url, 'https://lh3.googleusercontent.com/a/x');
});
