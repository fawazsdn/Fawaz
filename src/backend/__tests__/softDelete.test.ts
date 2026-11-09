import { supabase } from '@/lib/supabase';
import { signInVerifiedForTests } from '@/testing/fixtures';
import { deleteComment, deletePost, removeContent } from '../actions';
import { useSocialStore } from '../socialState';

jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;

beforeEach(() => {
  signInVerifiedForTests();
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  from.mockClear();
});

// A direct UPDATE of deleted_at is refused by RLS on the production schema;
// once the social backend is deployed the app deletes through server functions.
describe('deleting posts and comments', () => {
  beforeEach(() => useSocialStore.setState({ available: true }));

  it('deletes a post through delete_post', async () => {
    await deletePost('post-1');
    expect(rpc).toHaveBeenCalledWith('delete_post', { target_post: 'post-1' });
    expect(from).not.toHaveBeenCalledWith('posts');
  });

  it('deletes a comment through delete_post_comment', async () => {
    await deleteComment('c-1', 'post-1');
    expect(rpc).toHaveBeenCalledWith('delete_post_comment', { target_comment: 'c-1' });
  });

  it('moderator removal of posts and comments uses the same functions', async () => {
    await removeContent('post', 'post-2');
    await removeContent('comment', 'c-2');
    expect(rpc).toHaveBeenCalledWith('delete_post', { target_post: 'post-2' });
    expect(rpc).toHaveBeenCalledWith('delete_post_comment', { target_comment: 'c-2' });
  });

  it('surfaces a refusal instead of pretending the post was deleted', async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: { code: '42501', message: 'forbidden' } }));
    await expect(deletePost('post-3')).rejects.toMatchObject({ code: 'forbidden' });
  });
});
