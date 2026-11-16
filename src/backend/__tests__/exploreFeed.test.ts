import { EXPLORE_PAGE_SIZE, fetchExploreFeed, fetchExplorePhoto, mapExploreAuthor } from '../exploreFeed';
import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/store/useStore';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock('@/store/useStore', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('../sync', () => ({
  mapPost: (row: { id: string }, saved: Set<string>, viewer: string, photos: () => string[]) => ({
    id: row.id, saved: saved.has(row.id), viewer, images: photos(),
  }),
}));

const viewer = jest.mocked(getCurrentUserId);
const rpc = jest.mocked(supabase.rpc);
const bucket = jest.mocked(supabase.storage.from);

beforeEach(() => {
  jest.resetAllMocks();
  viewer.mockReturnValue('viewer-one');
});

test('uses the server feed and maps rows without resolving their media links', async () => {
  rpc.mockResolvedValue({ data: [{
    id: 'post-a', saved: true, image_paths: ['posts/test.jpg'],
    author: { id: 'u1', first_name: 'Reem', last_name: 'H', name_privacy: 'first_last_initial', avatar_path: 'u1/a.jpg' },
    area: { name_ar: 'حي', name_en: 'District' }, feed_cursor: { id: 'post-a' },
  }], error: null } as never);
  const cursor = { as_of: '2026-11-16T00:00:00Z', id: 'x' };
  await expect(fetchExploreFeed('friends', cursor)).resolves.toEqual({
    items: [{
      post: { id: 'post-a', saved: true, viewer: 'viewer-one', images: [] },
      author: { id: 'u1', firstName: 'Reem', lastName: 'H', namePrivacy: 'first_last_initial', avatarPath: 'u1/a.jpg' },
      area: { ar: 'حي', en: 'District' },
    }],
    next: null, // a short page is the last one
  });
  expect(rpc).toHaveBeenCalledWith('explore_social_feed', { feed: 'friends', cursor, search_text: null });
  expect(bucket).not.toHaveBeenCalled();
});

test('a full page hands back the last row cursor for the next request', async () => {
  const rows = Array.from({ length: EXPLORE_PAGE_SIZE }, (_, i) => ({ id: `p${i}`, feed_cursor: { id: `p${i}` } }));
  rpc.mockResolvedValue({ data: rows, error: null } as never);
  const page = await fetchExploreFeed('community', null);
  expect(page.next).toEqual({ id: `p${EXPLORE_PAGE_SIZE - 1}` });
  expect(rpc).toHaveBeenCalledWith('explore_social_feed', { feed: 'community', cursor: null, search_text: null });
});

test('author mapping keeps only display fields and defaults to the masked name setting', () => {
  expect(mapExploreAuthor({ id: 'u2', first_name: 'Huda', last_name: 'K', name_privacy: 'weird', email: 'x' } as never))
    .toEqual({ id: 'u2', firstName: 'Huda', lastName: 'K', namePrivacy: 'first_last_initial', avatarPath: undefined });
  expect(mapExploreAuthor(null)).toBeUndefined();
});

test('drops a response if the active account switched while the request was pending', async () => {
  viewer.mockReturnValueOnce('viewer-one').mockReturnValueOnce('viewer-two');
  rpc.mockResolvedValue({ data: [{ id: 'post-a' }], error: null } as never);
  await expect(fetchExploreFeed('community', null)).resolves.toEqual({ items: [], next: null });
});

test('propagates API failures so the screen can show a retry action', async () => {
  const error = new Error('offline');
  rpc.mockResolvedValue({ data: null, error } as never);
  await expect(fetchExploreFeed('community', null)).rejects.toBe(error);
});

test('never opens bearer URLs, and Storage rejection is handled without signing', async () => {
  const signal = new AbortController().signal;
  await expect(fetchExplorePhoto('https://example.invalid/object/sign/private?token=dummy', signal)).resolves.toBeNull();
  expect(bucket).not.toHaveBeenCalled();
  const download = jest.fn().mockResolvedValue({ data: null, error: new Error('forbidden') });
  bucket.mockReturnValue({ download } as never);
  await expect(fetchExplorePhoto('posts/fixture/photo.jpg', signal)).resolves.toBeNull();
  expect(download).toHaveBeenCalledWith('posts/fixture/photo.jpg', {}, { signal, cache: 'no-store' });
});
