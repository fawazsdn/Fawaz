import { supabase } from '@/lib/supabase';
import { signInVerifiedForTests, TEST_ME } from '@/testing/fixtures';
import { ensurePrivateAvatar, publicAvatarPath, withSignedAvatars } from '../profilePhotos';
import { changeAvatar, setAccountPrivate } from '../social';
import { useSocialStore } from '../socialState';

jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));

type Call = { bucket: string; op: string; args: unknown[] };
let calls: Call[] = [];
let updates: Record<string, unknown>[] = [];
let signed: string[][] = [];

function installStorage({ downloadOk = true } = {}) {
  (supabase.storage as { from: unknown }).from = (bucket: string) => ({
    upload: jest.fn((...args: unknown[]) => {
      calls.push({ bucket, op: 'upload', args });
      return Promise.resolve({ error: null });
    }),
    download: jest.fn((...args: unknown[]) => {
      calls.push({ bucket, op: 'download', args });
      return Promise.resolve(
        downloadOk ? { data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(512)) }, error: null } : { data: null, error: { message: 'x' } },
      );
    }),
    remove: jest.fn((...args: unknown[]) => {
      calls.push({ bucket, op: 'remove', args });
      return Promise.resolve({ error: null });
    }),
    createSignedUrls: jest.fn((paths: string[], ttl: number) => {
      signed.push(paths);
      calls.push({ bucket, op: 'sign', args: [paths, ttl] });
      return Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://signed/${bucket}/${p}` })), error: null });
    }),
    getPublicUrl: (p: string) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/avatars/${p}` } }),
  });
}

function installTables(profileRow: Record<string, unknown> | null = null) {
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
          if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: profileRow, error: null });
          if (prop === 'update')
            return (patch: Record<string, unknown>) => {
              updates.push(patch);
              return b;
            };
          return () => b;
        },
      },
    );
    return b;
  };
  (supabase.from as jest.Mock).mockImplementation(() => builder());
}

const legacy = (p: string) => `https://proj.supabase.co/storage/v1/object/public/avatars/${p}`;

beforeEach(() => {
  calls = [];
  updates = [];
  signed = [];
  signInVerifiedForTests();
  installStorage();
  installTables();
  (supabase.rpc as jest.Mock).mockReset();
  (supabase.rpc as jest.Mock).mockImplementation(() => Promise.resolve({ data: null, error: null }));
  useSocialStore.setState({ available: true, privatePhotos: true });
});

it('recognizes only this project\'s public avatar URLs', () => {
  expect(publicAvatarPath(legacy(`${TEST_ME}/a.jpg`))).toBe(`${TEST_ME}/a.jpg`);
  expect(publicAvatarPath('https://lh3.googleusercontent.com/a/x')).toBeNull();
  expect(publicAvatarPath(null)).toBeNull();
});

it('serves private photos through short-lived signed URLs, never the stored path', async () => {
  const rows = await withSignedAvatars([
    { id: 'a', avatar_path: 'a/1.jpg', avatar_url: legacy('a/old.jpg') },
    { id: 'b', avatar_path: null, avatar_url: null },
  ]);
  expect(rows[0].avatar_url).toBe('https://signed/profile-photos/a/1.jpg');
  expect(rows[1].avatar_url).toBeNull();
  const sign = calls.find((c) => c.op === 'sign');
  expect(sign?.bucket).toBe('profile-photos');
  expect(sign?.args[1]).toBe(3600);
});

it('moves the user\'s own public photo: private copy first, then the profile, then deletes the public file', async () => {
  const ok = await ensurePrivateAvatar(TEST_ME, { id: TEST_ME, avatar_url: legacy(`${TEST_ME}/old.jpg`), avatar_path: null });
  expect(ok).toBe(true);
  const order = calls.map((c) => `${c.bucket}:${c.op}`);
  expect(order.indexOf('avatars:download')).toBeLessThan(order.indexOf('profile-photos:upload'));
  expect(order.indexOf('profile-photos:upload')).toBeLessThan(order.indexOf('avatars:remove'));
  const upload = calls.find((c) => c.op === 'upload');
  expect(String(upload?.args[0])).toMatch(new RegExp(`^${TEST_ME}/`));
  expect(updates[0]).toMatchObject({ avatar_url: null });
  expect(String(updates[0].avatar_path)).toMatch(new RegExp(`^${TEST_ME}/`));
});

it('keeps the public photo when the copy cannot be made', async () => {
  installStorage({ downloadOk: false });
  const ok = await ensurePrivateAvatar(TEST_ME, { id: TEST_ME, avatar_url: legacy(`${TEST_ME}/old.jpg`) });
  expect(ok).toBe(false);
  expect(calls.some((c) => c.op === 'remove')).toBe(false);
  expect(updates).toHaveLength(0);
});

it('does nothing before the private-photo migration is deployed', async () => {
  useSocialStore.setState({ privatePhotos: false });
  await ensurePrivateAvatar(TEST_ME, { id: TEST_ME, avatar_url: legacy(`${TEST_ME}/old.jpg`) });
  expect(calls).toHaveLength(0);
});

it('never deletes another account\'s file', async () => {
  await ensurePrivateAvatar(TEST_ME, { id: TEST_ME, avatar_url: legacy('someone-else/old.jpg') });
  expect(calls).toHaveLength(0);
});

it('uploads a new profile photo to private storage once deployed', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)) })) as never;
  await changeAvatar('file:///new.jpg', { path: `${TEST_ME}/prev.jpg` });
  expect(calls.find((c) => c.op === 'upload')?.bucket).toBe('profile-photos');
  expect(updates[0]).toMatchObject({ avatar_url: null });
  expect(calls.some((c) => c.op === 'remove' && c.bucket === 'profile-photos')).toBe(true);
});

it('moves a public photo before switching the account to private', async () => {
  installTables({ id: TEST_ME, avatar_url: legacy(`${TEST_ME}/old.jpg`), avatar_path: null });
  await setAccountPrivate(true);
  const order = calls.map((c) => `${c.bucket}:${c.op}`);
  expect(order).toContain('profile-photos:upload');
  expect(order).toContain('avatars:remove');
  expect(supabase.rpc).toHaveBeenCalledWith('set_account_private', { make_private: true });
});
