import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { signInVerifiedForTests, TEST_ME, TEST_NEIGHBOR } from '@/testing/fixtures';
import { Composer } from '@/components/Composer';
import { addComment, createPost } from '../actions';
import { beginOp, commentScope, PENDING_OP_TTL_MS, POST_COMPOSER_SCOPE } from '../pendingOps';
import { useSocialStore } from '../socialState';

let mockUuidN = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuidN).padStart(12, '0')}` }));
jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
let uploads: string[] = [];
let removes: string[] = [];
let failUploadAt = -1;

function installStorage() {
  (supabase.storage as { from: unknown }).from = () => ({
    upload: jest.fn((path: string) => {
      if (uploads.length === failUploadAt) {
        failUploadAt = -1;
        return Promise.resolve({ error: { message: 'Network request failed' } });
      }
      uploads.push(path);
      return Promise.resolve({ error: null });
    }),
    remove: jest.fn((paths: string[]) => {
      removes.push(...paths);
      return Promise.resolve({ error: null });
    }),
    createSignedUrls: jest.fn(() => Promise.resolve({ data: [], error: null })),
  });
}

const publishCalls = () => rpc.mock.calls.filter((c) => c[0] === 'publish_post').map((c) => c[1]);

beforeEach(async () => {
  mockUuidN = 0;
  uploads = [];
  removes = [];
  failUploadAt = -1;
  await AsyncStorage.clear();
  signInVerifiedForTests();
  useSocialStore.setState({ available: true, privatePhotos: true, exactlyOnce: true });
  installStorage();
  rpc.mockReset();
  from.mockClear();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)) })) as never;
});

const post = (localImages: string[] = ['file:///1.jpg', 'file:///2.jpg']) =>
  createPost({ type: 'general', textAr: 'hello', localImages, audience: 'followers' });

describe('post publication is exactly-once', () => {
  it('a retry after a committed-but-lost response reuses the draft id and gets the same post', async () => {
    rpc
      .mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed'))) // committed, response lost
      .mockImplementationOnce(() => Promise.resolve({ data: { post_id: 'p-1', outcome: 'existing' }, error: null }));
    await expect(post()).rejects.toMatchObject({ code: 'offline' });
    await expect(post()).resolves.toBe('p-1');
    const [first, second] = publishCalls();
    expect(second.op_id).toBe(first.op_id);
    expect(second.photos).toEqual(first.photos);
    expect(uploads).toHaveLength(2); // photos uploaded once, reused on retry
    expect(removes).toHaveLength(0); // nothing deleted after the failure
  });

  it('the draft id survives an app restart (persisted before any network call)', async () => {
    rpc.mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')));
    await expect(post()).rejects.toBeTruthy();
    const stored = await AsyncStorage.getItem(`haratna.pendingOp.v1:${TEST_ME}:${POST_COMPOSER_SCOPE}`);
    expect(JSON.parse(stored!).opId).toBe(publishCalls()[0].op_id);
    // "relaunch": module state is irrelevant, the id comes from storage
    const op = await beginOp(TEST_ME, POST_COMPOSER_SCOPE);
    expect(op.opId).toBe(publishCalls()[0].op_id);
  });

  it('an interrupted photo batch resumes: finished uploads are reused, only the rest is uploaded', async () => {
    failUploadAt = 1; // second photo fails
    await expect(post(['file:///1.jpg', 'file:///2.jpg', 'file:///3.jpg'])).rejects.toBeTruthy();
    expect(uploads).toHaveLength(1);
    rpc.mockImplementationOnce(() => Promise.resolve({ data: { post_id: 'p-2', outcome: 'created' }, error: null }));
    await expect(post(['file:///1.jpg', 'file:///2.jpg', 'file:///3.jpg'])).resolves.toBe('p-2');
    expect(uploads).toHaveLength(3);
    expect(publishCalls()[0].photos).toEqual(uploads);
  });

  it('success clears the draft id, so the next post gets a new one', async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: { post_id: 'p', outcome: 'created' }, error: null }));
    await post([]);
    await post([]);
    const [a, b] = publishCalls();
    expect(a.op_id).not.toBe(b.op_id);
  });

  it('a conflict (old draft id already used for different content) publishes under a new id', async () => {
    rpc
      .mockImplementationOnce(() => Promise.resolve({ data: { post_id: 'old', outcome: 'conflict' }, error: null }))
      .mockImplementationOnce(() => Promise.resolve({ data: { post_id: 'new', outcome: 'created' }, error: null }));
    await expect(post([])).resolves.toBe('new');
    const [a, b] = publishCalls();
    expect(b.op_id).not.toBe(a.op_id);
  });

  it('a photo removed by cleanup in the meantime is uploaded again once', async () => {
    rpc
      .mockImplementationOnce(() => Promise.resolve({ data: null, error: { code: '22023', message: 'photo_unavailable' } }))
      .mockImplementationOnce(() => Promise.resolve({ data: { post_id: 'p-3', outcome: 'created' }, error: null }));
    await expect(post(['file:///1.jpg'])).resolves.toBe('p-3');
    expect(uploads).toHaveLength(2);
    expect(publishCalls()[1].photos).toEqual([uploads[1]]);
    expect(publishCalls()[1].op_id).toBe(publishCalls()[0].op_id);
  });

  it('account switching never reuses another account\'s draft id', async () => {
    rpc.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    await expect(post([])).rejects.toBeTruthy();
    useStore.setState((s) => ({ session: { ...s.session, supabaseUserId: TEST_NEIGHBOR } }));
    await expect(post([])).rejects.toBeTruthy();
    const [a, b] = publishCalls();
    expect(b.op_id).not.toBe(a.op_id);
  });

  it('expired drafts start over with a new id', async () => {
    rpc.mockImplementation(() => Promise.reject(new TypeError('Network request failed')));
    await expect(post([])).rejects.toBeTruthy();
    const key = `haratna.pendingOp.v1:${TEST_ME}:${POST_COMPOSER_SCOPE}`;
    const op = JSON.parse((await AsyncStorage.getItem(key))!);
    await AsyncStorage.setItem(key, JSON.stringify({ ...op, createdAt: Date.now() - PENDING_OP_TTL_MS - 1 }));
    await expect(post([])).rejects.toBeTruthy();
    expect(publishCalls()[1].op_id).not.toBe(publishCalls()[0].op_id);
  });

  it('fails closed - no upload, no plain insert - when the server lacks publish_post', async () => {
    useSocialStore.setState({ exactlyOnce: null });
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }));
    await expect(post()).rejects.toMatchObject({ reason: 'server_update_required' });
    expect(uploads).toHaveLength(0);
    expect(from).not.toHaveBeenCalledWith('posts');
    await expect(addComment('post-1', 'x')).rejects.toMatchObject({ reason: 'server_update_required' });
    expect(from).not.toHaveBeenCalledWith('post_comments');
  });

  it('probes once with a call the real function always rejects, then caches the result', async () => {
    useSocialStore.setState({ exactlyOnce: null });
    rpc
      .mockImplementationOnce(() => Promise.resolve({ data: null, error: { code: '22023', message: 'invalid:op_id' } }))
      .mockImplementation(() => Promise.resolve({ data: { post_id: 'p', outcome: 'created' }, error: null }));
    await post([]);
    await post([]);
    const probes = publishCalls().filter((c) => c.op_id === null);
    expect(probes).toHaveLength(1);
    expect(useSocialStore.getState().exactlyOnce).toBe(true);
  });

  it('an offline probe is not cached as "outdated server"', async () => {
    useSocialStore.setState({ exactlyOnce: null });
    rpc.mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')));
    await expect(post([])).rejects.toMatchObject({ code: 'offline' });
    expect(useSocialStore.getState().exactlyOnce).toBeNull();
  });
});

describe('comments are exactly-once', () => {
  it('a retry after a lost response reuses the same id; replies are separate drafts', async () => {
    rpc
      .mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')))
      .mockImplementationOnce(() => Promise.resolve({ data: { comment_id: 'c-1', outcome: 'existing' }, error: null }))
      .mockImplementationOnce(() => Promise.resolve({ data: { comment_id: 'c-2', outcome: 'created' }, error: null }));
    await expect(addComment('post-1', 'nice')).rejects.toBeTruthy();
    await addComment('post-1', 'nice');
    await addComment('post-1', 'reply', 'c-1');
    const calls = rpc.mock.calls.filter((c) => c[0] === 'add_post_comment').map((c) => c[1]);
    expect(calls[1].op_id).toBe(calls[0].op_id);
    expect(calls[2].op_id).not.toBe(calls[0].op_id);
    expect(commentScope('post-1')).not.toBe(commentScope('post-1', 'c-1'));
  });
});

describe('comment composer', () => {
  const frame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const renderComposer = (onSend: jest.Mock) =>
    render(
      <SafeAreaProvider initialMetrics={frame}>
        <Composer placeholder="Write" onSend={onSend} cancelLabel="Cancel" />
      </SafeAreaProvider>,
    );

  it('keeps the draft when sending fails, so it can be retried', async () => {
    const onSend = jest.fn(() => Promise.resolve(false));
    const r = await renderComposer(onSend);
    fireEvent.changeText(r.getByPlaceholderText('Write'), 'hello');
    await act(async () => fireEvent.press(r.getByTestId('composer-send')));
    expect(r.getByDisplayValue('hello')).toBeTruthy();
  });
});
