import { addComment, loadComments } from '@/backend/actions';
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
  jest.mocked(supabase.from).mockImplementation(((table: string) => {
    if (table !== 'post_comments') return original(table);
    return {
      insert: async (row: { post_id: string; author_id: string; body: string }) => {
        rows.push({ ...row, id: 'new', created_at: '2026-01-02' });
        return { error: null };
      },
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
  }
});
