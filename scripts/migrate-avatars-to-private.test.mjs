// node --test scripts/migrate-avatars-to-private.test.mjs
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

import { migrateOne, planFor, run } from './migrate-avatars-to-private.mjs';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const pub = (path) => `https://proj.supabase.co/storage/v1/object/public/avatars/${path}`;

/** In-memory stand-in for the parts of supabase-js the script uses. */
function fakeClient(profiles, files = {}, { failUpload = false } = {}) {
  const buckets = { avatars: new Map(Object.entries(files)), 'profile-photos': new Map() };
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
    }),
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
      update: (patch) => {
        q.patch = patch;
        return api;
      },
      delete: () => {
        q.delete = true;
        return api;
      },
      eq: (k, v) => {
        q.filters.push([k, v]);
        return api;
      },
      then: (resolve) => {
        if (q.patch) rows().filter(match).forEach((r) => Object.assign(r, q.patch));
        if (q.delete) {
          const keep = rows().filter((r) => !match(r));
          rows().length = 0;
          rows().push(...keep);
        }
        resolve({ error: null });
      },
    };
    return api;
  };
  return { storage, from: table, buckets, attachments, profiles };
}

test('plans each kind of profile', () => {
  assert.equal(planFor({ id: U1 }).action, 'none');
  assert.equal(planFor({ id: U1, avatar_url: 'https://lh3.googleusercontent.com/a/x' }).action, 'external');
  assert.equal(planFor({ id: U1, avatar_url: pub(`${U1}/a.jpg`) }).action, 'copy');
  assert.equal(planFor({ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: `${U1}/b.jpg` }).action, 'cleanup');
  assert.equal(planFor({ id: U1, avatar_url: pub(`${U2}/a.jpg`) }).action, 'foreign_path');
  assert.equal(planFor({ id: U1, avatar_path: `${U1}/b.jpg` }).action, 'done');
});

test('dry run changes nothing', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: Buffer.from('jpeg-bytes') });
  const lines = [];
  await run(c, { log: (l) => lines.push(l) });
  assert.equal(c.buckets['profile-photos'].size, 0);
  assert.equal(profiles[0].avatar_path, null);
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
  assert.match(lines.join('\n'), /DRY RUN: 1 profiles/);
  assert.doesNotMatch(lines.join('\n'), /https?:/);
});

test('apply copies, verifies and points the profile at the private copy, keeping the public file', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: Buffer.from('jpeg-bytes') });
  const r = await migrateOne(c, { ...profiles[0] }, { apply: true, removePublic: false });
  assert.equal(r.applied, true);
  const [path] = [...c.buckets['profile-photos'].keys()];
  assert.ok(path.startsWith(`${U1}/`));
  assert.equal(c.buckets['profile-photos'].get(path).toString(), 'jpeg-bytes');
  assert.equal(profiles[0].avatar_path, path);
  assert.ok(profiles[0].avatar_url, 'legacy URL kept until --remove-public');
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
  assert.equal(c.attachments[0].bucket_id, 'profile-photos');
});

test('apply + remove-public deletes the public file and URL only after the copy exists; re-running is a no-op', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: Buffer.from('jpeg-bytes') });
  await run(c, { apply: true, removePublic: true, log: () => {} });
  assert.equal(profiles[0].avatar_url, null);
  assert.equal(c.buckets.avatars.size, 0);
  assert.equal(c.buckets['profile-photos'].size, 1);
  await run(c, { apply: true, removePublic: true, log: () => {} });
  assert.equal(c.buckets['profile-photos'].size, 1, 'second run makes no new copies');
});

test('a failed upload leaves everything as it was', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/a.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, { [`${U1}/a.jpg`]: Buffer.from('x') }, { failUpload: true });
  const r = await migrateOne(c, { ...profiles[0] }, { apply: true, removePublic: true });
  assert.equal(r.action, 'error');
  assert.equal(profiles[0].avatar_url, pub(`${U1}/a.jpg`));
  assert.equal(profiles[0].avatar_path, null);
  assert.ok(c.buckets.avatars.has(`${U1}/a.jpg`));
});

test('a missing public file is reported, not guessed', async () => {
  const profiles = [{ id: U1, avatar_url: pub(`${U1}/gone.jpg`), avatar_path: null }];
  const c = fakeClient(profiles, {});
  const r = await migrateOne(c, { ...profiles[0] }, { apply: true, removePublic: true });
  assert.deepEqual([r.action, r.step], ['error', 'download']);
  assert.equal(profiles[0].avatar_url, pub(`${U1}/gone.jpg`));
});

test('never touches another account\'s file or external URLs', async () => {
  const profiles = [
    { id: U1, avatar_url: pub(`${U2}/a.jpg`), avatar_path: null },
    { id: U2, avatar_url: 'https://lh3.googleusercontent.com/a/x', avatar_path: null },
  ];
  const c = fakeClient(profiles, { [`${U2}/a.jpg`]: Buffer.from('x') });
  await run(c, { apply: true, removePublic: true, log: () => {} });
  assert.ok(c.buckets.avatars.has(`${U2}/a.jpg`));
  assert.equal(c.buckets['profile-photos'].size, 0);
  assert.equal(profiles[1].avatar_url, 'https://lh3.googleusercontent.com/a/x');
});
