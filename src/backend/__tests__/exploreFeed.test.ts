import { fetchExploreFeed, fetchExplorePhoto } from '../exploreFeed';
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
  rpc.mockResolvedValue({ data: [{ id: 'post-a', saved: true, image_paths: ['posts/test.jpg'] }], error: null } as never);
  await expect(fetchExploreFeed('friends', 16)).resolves.toEqual([
    { id: 'post-a', saved: true, viewer: 'viewer-one', images: [] },
  ]);
  expect(rpc).toHaveBeenCalledWith('explore_social_feed', { feed: 'friends', page_offset: 16, search_text: null });
  expect(bucket).not.toHaveBeenCalled();
});

test('drops a response if the active account switched while the request was pending', async () => {
  viewer.mockReturnValueOnce('viewer-one').mockReturnValueOnce('viewer-two');
  rpc.mockResolvedValue({ data: [{ id: 'post-a' }], error: null } as never);
  await expect(fetchExploreFeed('community', 0)).resolves.toEqual([]);
});

test('propagates API failures so the screen can show a retry action', async () => {
  const error = new Error('offline');
  rpc.mockResolvedValue({ data: null, error } as never);
  await expect(fetchExploreFeed('community', 0)).rejects.toBe(error);
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
