import { Image } from 'expo-image';

import { supabase } from '@/lib/supabase';
import { signInVerifiedForTests, TEST_ME, TEST_NEIGHBOR } from '@/testing/fixtures';
import { signOutSupabase } from '@/features/auth/supabaseAuth';
import { toggleBlockUser } from '../actions';
import { clearMediaCache, resolveMediaUrls } from '../media';
import { imageCachePolicy, isSignedStorageUrl, POST_PHOTO_LINK_SECONDS, PROFILE_PHOTO_LINK_SECONDS } from '../mediaPrivacy';
import { rotateProfilePhoto, withSignedAvatars } from '../profilePhotos';
import { removeFollower, setAccountPrivate, unfollowUser } from '../social';
import { useSocialStore } from '../socialState';

jest.mock('expo-image', () => ({
  Image: { clearMemoryCache: jest.fn(() => Promise.resolve(true)), clearDiskCache: jest.fn(() => Promise.resolve(true)) },
}));
jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));

type Call = { bucket: string; op: string; args: unknown[] };
let calls: Call[] = [];
let tableOps: { table: string; op: string; arg?: unknown }[] = [];
let profileRow: Record<string, unknown> | null = null;

function installStorage({ copyError = false } = {}) {
  (supabase.storage as { from: unknown }).from = (bucket: string) => ({
    createSignedUrls: jest.fn((paths: string[], ttl: number) => {
      calls.push({ bucket, op: 'sign', args: [paths, ttl] });
      return Promise.resolve({ data: paths.map((p) => ({ path: p, signedUrl: `https://x.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=t` })), error: null });
    }),
    copy: jest.fn((from: string, to: string) => {
      calls.push({ bucket, op: 'copy', args: [from, to] });
      return Promise.resolve({ error: copyError ? { message: 'denied' } : null });
    }),
    remove: jest.fn((paths: string[]) => {
      calls.push({ bucket, op: 'remove', args: [paths] });
      return Promise.resolve({ error: null });
    }),
    upload: jest.fn(() => Promise.resolve({ error: null })),
  });
}

function installTables() {
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const b: Record<string, unknown> = new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
          if (prop === 'maybeSingle' || prop === 'single')
            return () => Promise.resolve({ data: table === 'profiles' ? profileRow : { size_bytes: 1234 }, error: null });
          return (arg?: unknown) => {
            if (['insert', 'update', 'delete'].includes(prop)) tableOps.push({ table, op: prop, arg });
            return b;
          };
        },
      },
    );
    return b;
  });
}

beforeEach(() => {
  calls = [];
  tableOps = [];
  profileRow = { avatar_path: `${TEST_ME}/current.jpg` };
  signInVerifiedForTests();
  clearMediaCache();
  installStorage();
  installTables();
  (supabase.rpc as jest.Mock).mockReset();
  (supabase.rpc as jest.Mock).mockImplementation(() => Promise.resolve({ data: null, error: null }));
  (Image.clearDiskCache as jest.Mock).mockClear();
  (Image.clearMemoryCache as jest.Mock).mockClear();
  useSocialStore.setState({ available: true, privatePhotos: true });
});

describe('cache policy', () => {
  it('keeps signed (private) media in memory only and public/local images on disk', () => {
    const signed = 'https://x.supabase.co/storage/v1/object/sign/profile-photos/a/b.jpg?token=t';
    expect(isSignedStorageUrl(signed)).toBe(true);
    expect(imageCachePolicy(signed)).toBe('memory');
    expect(imageCachePolicy('https://x.supabase.co/storage/v1/object/public/avatars/a/b.jpg')).toBe('disk');
    expect(imageCachePolicy('file:///local.jpg')).toBe('disk');
    expect(imageCachePolicy(undefined)).toBe('disk');
  });
});

describe('link lifetimes', () => {
  it('signs profile photos for 5 minutes', async () => {
    await withSignedAvatars([{ id: 'u', avatar_path: 'u/p.jpg' }]);
    expect(calls.find((c) => c.op === 'sign')?.args[1]).toBe(PROFILE_PHOTO_LINK_SECONDS);
    expect(PROFILE_PHOTO_LINK_SECONDS).toBe(300);
  });

  it('signs social post photos for at most 15 minutes, legacy neighborhood media unchanged', async () => {
    await resolveMediaUrls(['posts/u/1.jpg', 'nb-1/u/2.jpg']);
    const signs = calls.filter((c) => c.op === 'sign').map((c) => [(c.args[0] as string[])[0], c.args[1]]);
    expect(signs).toContainEqual(['posts/u/1.jpg', POST_PHOTO_LINK_SECONDS]);
    expect(signs).toContainEqual(['nb-1/u/2.jpg', 6 * 60 * 60]);
  });

  it('re-signs a cached link before it is about to expire', async () => {
    await withSignedAvatars([{ id: 'u', avatar_path: 'u/p.jpg' }]);
    await withSignedAvatars([{ id: 'u', avatar_path: 'u/p.jpg' }]);
    expect(calls.filter((c) => c.op === 'sign')).toHaveLength(1);
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + 250_000);
    await withSignedAvatars([{ id: 'u', avatar_path: 'u/p.jpg' }]);
    expect(calls.filter((c) => c.op === 'sign')).toHaveLength(2);
    (Date.now as jest.Mock).mockRestore();
  });
});

describe('profile photo rotation (cuts off links already issued)', () => {
  it('copies to a new file, points the profile at it, then deletes the old file', async () => {
    expect(await rotateProfilePhoto(TEST_ME)).toBe(true);
    const order = calls.map((c) => c.op);
    expect(order.indexOf('copy')).toBeLessThan(order.indexOf('remove'));
    const copy = calls.find((c) => c.op === 'copy')!;
    expect(copy.args[0]).toBe(`${TEST_ME}/current.jpg`);
    expect(String(copy.args[1])).toMatch(new RegExp(`^${TEST_ME}/`));
    expect(tableOps).toContainEqual({ table: 'profiles', op: 'update', arg: { avatar_path: copy.args[1] } });
    expect(calls.find((c) => c.op === 'remove')?.args[0]).toEqual([`${TEST_ME}/current.jpg`]);
  });

  it('leaves the photo untouched when the copy fails', async () => {
    installStorage({ copyError: true });
    expect(await rotateProfilePhoto(TEST_ME)).toBe(false);
    expect(calls.some((c) => c.op === 'remove')).toBe(false);
    expect(tableOps.some((t) => t.table === 'profiles')).toBe(false);
  });

  it('does nothing without a private photo or for another account folder', async () => {
    profileRow = { avatar_path: null };
    expect(await rotateProfilePhoto(TEST_ME)).toBe(false);
    profileRow = { avatar_path: `${TEST_NEIGHBOR}/x.jpg` };
    expect(await rotateProfilePhoto(TEST_ME)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('rotates after blocking, removing a follower and going private', async () => {
    await toggleBlockUser(TEST_NEIGHBOR);
    expect(calls.filter((c) => c.op === 'copy')).toHaveLength(1);
    await removeFollower(TEST_NEIGHBOR);
    expect(calls.filter((c) => c.op === 'copy')).toHaveLength(2);
    profileRow = { avatar_path: `${TEST_ME}/current.jpg`, avatar_url: null };
    await setAccountPrivate(true);
    expect(calls.filter((c) => c.op === 'copy')).toHaveLength(3);
  });
});

describe('device caches', () => {
  it('blocking clears private media cached on this device', async () => {
    await toggleBlockUser(TEST_NEIGHBOR);
    expect(Image.clearDiskCache).toHaveBeenCalled();
    expect(Image.clearMemoryCache).toHaveBeenCalled();
  });

  it('unfollowing clears cached photos and links', async () => {
    await withSignedAvatars([{ id: 'u', avatar_path: 'u/p.jpg' }]);
    await unfollowUser(TEST_NEIGHBOR);
    expect(Image.clearMemoryCache).toHaveBeenCalled();
    await withSignedAvatars([{ id: 'u', avatar_path: 'u/p.jpg' }]);
    expect(calls.filter((c) => c.op === 'sign')).toHaveLength(2);
  });

  it('signing out clears private media even if the server call fails', async () => {
    (supabase.auth.signOut as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(signOutSupabase()).rejects.toThrow('offline');
    expect(Image.clearDiskCache).toHaveBeenCalled();
  });
});
