import { act, render, waitFor } from '@testing-library/react-native';

import { ExplorePostCard } from '../ExploreSocialFeed';
import { fetchExplorePhoto } from '@/backend/exploreFeed';
import type { Post } from '@/models';

jest.mock('@/backend/exploreFeed', () => ({
  fetchExploreFeed: jest.fn(),
  fetchExplorePhoto: jest.fn((path: string) => Promise.resolve(`data:image/jpeg;base64,${path}`)),
}));

// Capture what the card hands to PostCard instead of rendering the full card.
const mockCard = jest.fn();
jest.mock('@/features/feed/PostCard', () => ({
  PostCard: (props: unknown) => {
    mockCard(props);
    return null;
  },
}));

type CardProps = { post: Post; discoveryAvatar?: string; discoveryAuthor?: unknown; onPhotoIndexChange: (i: number) => void };
const last = () => mockCard.mock.calls[mockCard.mock.calls.length - 1][0] as CardProps;
const download = jest.mocked(fetchExplorePhoto);

const post = { id: 'p1', authorId: 'u1', imagePaths: ['posts/u1/0.jpg', 'posts/u1/1.jpg', 'posts/u1/2.jpg', 'posts/u1/3.jpg'] } as Post;
const author = { id: 'u1', firstName: 'Reem', lastName: 'H', namePrivacy: 'first_last_initial' as const, avatarPath: 'u1/a.jpg' };

beforeEach(() => jest.clearAllMocks());

test('loads only the visible photo and its neighbor, keeping placeholders for the rest', async () => {
  await render(<ExplorePostCard item={{ post, author }} nearScreen />);
  await waitFor(() => expect(last().post.images).toEqual(['data:image/jpeg;base64,posts/u1/0.jpg', 'data:image/jpeg;base64,posts/u1/1.jpg', '', '']));
  await waitFor(() => expect(last().discoveryAvatar).toBe('data:image/jpeg;base64,u1/a.jpg'));
  expect(download).toHaveBeenCalledWith('u1/a.jpg', expect.anything(), 'profile-photos');
  expect(download).not.toHaveBeenCalledWith('posts/u1/2.jpg', expect.anything());
  expect(last().discoveryAuthor).toBe(author);
});

test('swiping the carousel loads ahead and releases photos left behind', async () => {
  await render(<ExplorePostCard item={{ post, author }} nearScreen />);
  await waitFor(() => expect(last().post.images[1]).not.toBe(''));
  await act(async () => last().onPhotoIndexChange(2));
  await waitFor(() => expect(last().post.images).toEqual(['', 'data:image/jpeg;base64,posts/u1/1.jpg', 'data:image/jpeg;base64,posts/u1/2.jpg', 'data:image/jpeg;base64,posts/u1/3.jpg']));
});

test('a card that leaves the screen drops its photos and author photo from memory', async () => {
  const view = await render(<ExplorePostCard item={{ post, author }} nearScreen />);
  await waitFor(() => expect(last().post.images[0]).not.toBe(''));
  await view.rerender(<ExplorePostCard item={{ post, author }} nearScreen={false} />);
  await waitFor(() => expect(last().post.images).toEqual(['', '', '', '']));
  expect(last().discoveryAvatar).toBeUndefined();
});

test('a card that never comes near the screen downloads nothing', async () => {
  await render(<ExplorePostCard item={{ post, author }} nearScreen={false} />);
  await act(async () => { await Promise.resolve(); });
  expect(download).not.toHaveBeenCalled();
  expect(last().post.images).toEqual(['', '', '', '']);
});
