import { addComment, loadComments } from '@/backend/actions';
import { useSocialStore } from '@/backend/socialState';
import { syncAll } from '@/backend/sync';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { signInVerifiedForTests, TEST_ME, TEST_NEIGHBOR } from '@/testing/fixtures';

it('keeps existing and submitted comments through the full feed refresh', async () => {
  signInVerifiedForTests();
  const postId = 'synthetic-post';
  const rows = [
    { id: 'existing', post_id: postId, author_id: TEST_NEIGHBOR, body: 'Existing comment', created_at: '2026-01-01' },
  ];
  const original = jest.mocked(supabase.from).getMockImplementation()!;
  const originalRpc = jest.mocked(supabase.rpc).getMockImplementation()!;
  // Comments go through the exactly-once add_post_comment RPC; there is no plain insert.
  useSocialStore.setState({ exactlyOnce: true });
  jest.mocked(supabase.rpc).mockImplementation(((name: string, args: { target_post: string; body: string }) => {
    if (name !== 'add_post_comment') return originalRpc(name, args);
    rows.push({ id: 'new', post_id: args.target_post, author_id: TEST_ME, body: args.body, created_at: '2026-01-02' });
    return Promise.resolve({ data: { comment_id: 'new', outcome: 'created' }, error: null });
  }) as unknown as typeof supabase.rpc);
  jest.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table !== 'post_comments') return original(table);
    return {
      select: () => ({
        eq: (column: string, value: string) => {
          expect([column, value]).toEqual(['post_id', postId]);
          return { order: async () => ({ data: [...rows], error: null }) };
        },
      }),
    };
  }) as typeof supabase.from);
  try {
    await loadComments(postId);
    await syncAll();
    expect(useStore.getState().sync.status).toBe('ready');
    expect(useStore.getState().comments.map((row) => row.textAr)).toEqual(['Existing comment']);

    await addComment(postId, 'New comment');
    expect(useStore.getState().sync.status).toBe('ready');
    expect(useStore.getState().comments.map((row) => [row.authorId, row.textAr])).toEqual([
      [TEST_NEIGHBOR, 'Existing comment'],
      [TEST_ME, 'New comment'],
    ]);
  } finally {
    jest.mocked(supabase.from).mockImplementation(original);
    jest.mocked(supabase.rpc).mockImplementation(originalRpc);
  }
});
