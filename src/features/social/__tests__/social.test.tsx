import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import ar from '@/i18n/ar';
import en from '@/i18n/en';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { TEST_ME, TEST_NEIGHBOR, signInVerifiedForTests } from '@/testing/fixtures';
import { createPost } from '@/backend/actions';
import { fetchSocialProfile, followUser, listFollows, mapSocialProfile } from '@/backend/social';
import { useSocialStore } from '@/backend/socialState';
import { movePhoto } from '../photoOrder';
import { FollowButton } from '../FollowButton';
import ProfileScreen from '../../../../app/profile/[id]';
import CreatePostScreen from '../../../../app/create/post';
import FollowsScreen from '../../../../app/follows/[id]';

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false }),
}));
jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
  };
});
jest.mock('react-native-gesture-handler', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  const gesture = (): unknown =>
    new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : () => gesture()) });
  return {
    Gesture: new Proxy({}, { get: () => () => gesture() }),
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
  };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn((uri: string) => {
      const ctx: Record<string, jest.Mock> = {
        resize: jest.fn(() => ctx),
        crop: jest.fn(() => ctx),
        rotate: jest.fn(() => ctx),
        renderAsync: jest.fn(() =>
          Promise.resolve({ saveAsync: jest.fn(() => Promise.resolve({ uri: `${uri}#clean`, width: 1600, height: 1200 })) }),
        ),
      };
      return ctx;
    }),
  },
}));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
const frame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={frame}>{ui}</SafeAreaProvider>);

const card = (over: Record<string, unknown> = {}) => ({
  id: TEST_NEIGHBOR,
  first_name: 'Bader',
  last_name: 'H',
  name_privacy: 'first_last_initial',
  avatar_url: null,
  bio: null,
  is_private: false,
  verified: true,
  neighborhood_id: null,
  member_since: '2026-01-01T00:00:00Z',
  posts_count: 3,
  followers_count: 12,
  following_count: 4,
  follow_state: 'none',
  follows_you: false,
  requested_you: false,
  can_view_content: true,
  full_profile: true,
  blocked_by_you: false,
  ...over,
});

function mockRpc(handlers: Record<string, (args: Record<string, unknown>) => { data?: unknown; error?: unknown }>) {
  rpc.mockImplementation((name: string, args: Record<string, unknown>) =>
    Promise.resolve({ data: null, error: null, ...(handlers[name]?.(args) ?? {}) }),
  );
}

/** A chainable query builder that records calls and resolves to `result`. */
function recordingBuilder(result: { data: unknown; error: unknown }, calls: { method: string; args: unknown[] }[]) {
  const b: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result);
        if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(result);
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return b;
        };
      },
    },
  );
  return b;
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  mockParams = {};
  mockPush.mockClear();
  mockReplace.mockClear();
  signInVerifiedForTests();
  useStore.getState().setLocale('en');
  useSocialStore.setState({ available: true, exactlyOnce: true });
});

describe('copy', () => {
  it('has every social string in Arabic and English', () => {
    for (const key of Object.keys(en.social) as (keyof typeof en.social)[]) {
      expect(en.social[key]).toBeTruthy();
      expect(ar.social[key]).toBeTruthy();
    }
    expect(ar.social.audienceNeighbors).toBe('جيران موثّقون');
  });
});

describe('photo order', () => {
  it('reorders and ignores out-of-range moves', () => {
    expect(movePhoto(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(movePhoto(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(movePhoto(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

describe('social backend client', () => {
  it('maps the profile card and never trusts a missing count', () => {
    const p = mapSocialProfile(card({ followers_count: undefined }));
    expect(p.followersCount).toBe(0);
    expect(p.verified).toBe(true);
  });

  it('follows through the follow_user function (no direct table writes)', async () => {
    mockRpc({ follow_user: () => ({ data: 'requested' }) });
    await expect(followUser(TEST_NEIGHBOR)).resolves.toBe('requested');
    expect(rpc).toHaveBeenCalledWith('follow_user', { target: TEST_NEIGHBOR });
    expect(from).not.toHaveBeenCalledWith('follows');
  });

  it('surfaces a block as a refusal', async () => {
    mockRpc({ follow_user: () => ({ error: { code: '42501', message: 'blocked' } }) });
    await expect(followUser(TEST_NEIGHBOR)).rejects.toMatchObject({ code: 'forbidden', reason: 'blocked' });
  });

  it('switches social features off when the backend migration is not deployed', async () => {
    mockRpc({ social_profile: () => ({ error: { code: 'PGRST202', message: 'Could not find the function public.social_profile' } }) });
    await expect(fetchSocialProfile(TEST_NEIGHBOR)).rejects.toBeTruthy();
    expect(useSocialStore.getState().available).toBe(false);
  });

  it('passes the search text to list_follows', async () => {
    mockRpc({ list_follows: () => ({ data: [{ user_id: 'u1', first_name: 'Sara', last_name: 'A', name_privacy: 'full', follow_state: 'none', created_at: '2026-01-01' }] }) });
    const rows = await listFollows(TEST_NEIGHBOR, 'followers', '  sa ');
    expect(rpc).toHaveBeenCalledWith('list_follows', { target: TEST_NEIGHBOR, kind: 'followers', search: 'sa', lim: 100, off: 0 });
    expect(rows[0]).toMatchObject({ userId: 'u1', firstName: 'Sara' });
  });
});

describe('createPost photo storage', () => {
  const storageCalls: string[] = [];
  beforeEach(() => {
    storageCalls.length = 0;
    (supabase.storage as { from: unknown }).from = () => ({
      upload: jest.fn((path: string) => {
        storageCalls.push(path);
        return Promise.resolve({ error: null });
      }),
      remove: jest.fn((paths: string[]) => {
        storageCalls.push(`removed:${paths.join(',')}`);
        return Promise.resolve({ error: null });
      }),
      createSignedUrls: jest.fn(() => Promise.resolve({ data: [], error: null })),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    });
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)) })) as never;
  });

  it('uploads to the private post-photo folder and publishes exactly once through publish_post', async () => {
    const calls: { method: string; args: unknown[] }[] = [];
    from.mockImplementation(() => recordingBuilder({ data: null, error: null }, calls));
    mockRpc({ publish_post: () => ({ data: { post_id: 'post-1', outcome: 'created' } }) });
    await expect(
      createPost({ type: 'general', textAr: 'hello', localImages: ['file:///a.jpg', 'file:///b.jpg'], audience: 'followers' }),
    ).resolves.toBe('post-1');
    expect(storageCalls).toHaveLength(2);
    for (const p of storageCalls) expect(p).toMatch(new RegExp(`^posts/${TEST_ME}/`));
    const publish = rpc.mock.calls.find((c) => c[0] === 'publish_post')![1];
    expect(publish).toMatchObject({ post_audience: 'followers', photos: storageCalls });
    expect(publish.op_id).toMatch(/^[0-9a-f-]{36}$/);
    // every upload is recorded (staged) before publishing
    expect(calls.filter((c) => c.method === 'insert')).toHaveLength(2);
  });

  it('before the resilience migration the release candidate refuses to post and uploads nothing', async () => {
    useSocialStore.setState({ available: false, exactlyOnce: null });
    mockRpc({ publish_post: () => ({ error: { code: 'PGRST202', message: 'Could not find the function public.publish_post' } }) });
    from.mockImplementation(() => recordingBuilder({ data: null, error: null }, []));
    await expect(createPost({ type: 'general', textAr: 'x', localImages: ['file:///a.jpg'], audience: 'neighborhood' })).rejects.toMatchObject({
      reason: 'server_update_required',
    });
    expect(storageCalls).toHaveLength(0);
  });

  it('never deletes uploaded photos after a failure (the post may have been committed)', async () => {
    from.mockImplementation(() => recordingBuilder({ data: null, error: null }, []));
    mockRpc({ publish_post: () => ({ error: { code: '22023', message: 'invalid:images' } }) });
    await expect(createPost({ type: 'general', textAr: 'x', localImages: ['file:///a.jpg'], audience: 'public' })).rejects.toBeTruthy();
    expect(storageCalls.some((c) => c.startsWith('removed:'))).toBe(false);
  });
});

describe('FollowButton', () => {
  it('shows Follow, then Requested for a private account', async () => {
    mockRpc({ follow_user: () => ({ data: 'requested' }) });
    const onChanged = jest.fn();
    await renderScreen(<FollowButton userId={TEST_NEIGHBOR} name="Bader H." state="none" onChanged={onChanged} />);
    await act(async () => fireEvent.press(screen.getByText('Follow')));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('requested'));
  });

  it('asks before unfollowing', async () => {
    const onChanged = jest.fn();
    await renderScreen(<FollowButton userId={TEST_NEIGHBOR} name="Bader H." state="following" onChanged={onChanged} />);
    await act(async () => fireEvent.press(screen.getByText('Following')));
    expect(rpc).not.toHaveBeenCalledWith('unfollow_user', expect.anything());
    await act(async () => fireEvent.press(screen.getAllByText('Unfollow').pop()!));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('unfollow_user', { target: TEST_NEIGHBOR }));
    expect(onChanged).toHaveBeenCalledWith('none');
  });

  it('offers Follow back when they follow you, and nothing on your own profile', async () => {
    const { rerender } = await renderScreen(<FollowButton userId={TEST_NEIGHBOR} name="B" state="none" followsYou />);
    expect(screen.getByText('Follow back')).toBeTruthy();
    await rerender(
      <SafeAreaProvider initialMetrics={frame}>
        <FollowButton userId={TEST_ME} name="Me" state="self" />
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('follow-button')).toBeNull();
  });
});

describe('Profile', () => {
  it('shows real counts, a 3-column photo grid entry point and Follow/Message actions', async () => {
    mockParams = { id: TEST_NEIGHBOR };
    mockRpc({ social_profile: () => ({ data: card() }) });
    await renderScreen(<ProfileScreen />);
    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('Followers')).toBeTruthy();
    expect(screen.getByText('Following')).toBeTruthy();
    expect(screen.getByTestId('follow-button')).toBeTruthy();
    for (const tab of ['posts', 'activities', 'events', 'recommendations']) expect(screen.getByTestId(`profile-tab-${tab}`)).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('followers-count')));
    expect(mockPush).toHaveBeenCalledWith(`/follows/${TEST_NEIGHBOR}?tab=followers`);
  });

  it('hides content of a private account you do not follow', async () => {
    mockParams = { id: TEST_NEIGHBOR };
    mockRpc({ social_profile: () => ({ data: card({ is_private: true, can_view_content: false }) }) });
    await renderScreen(<ProfileScreen />);
    expect(await screen.findByTestId('private-profile')).toBeTruthy();
    expect(screen.getByText('This account is private')).toBeTruthy();
    expect(screen.queryByTestId('profile-tab-posts')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('followers-count')));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('lets someone who asked to follow you be accepted from their profile', async () => {
    mockParams = { id: TEST_NEIGHBOR };
    mockRpc({ social_profile: () => ({ data: card({ requested_you: true }) }) });
    await renderScreen(<ProfileScreen />);
    await act(async () => fireEvent.press(await screen.findByText('Accept')));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_follow_request', { requester: TEST_NEIGHBOR, accept: true }));
  });

  it('opens the profile photo full screen with change/remove only for the owner', async () => {
    mockParams = { id: TEST_ME };
    mockRpc({ social_profile: () => ({ data: card({ id: TEST_ME, follow_state: 'self' }) }) });
    await renderScreen(<ProfileScreen />);
    await act(async () => fireEvent.press(await screen.findByTestId('profile-avatar')));
    expect(screen.getByTestId('photo-viewer-close')).toBeTruthy();
    expect(screen.getByTestId('photo-change')).toBeTruthy();
  });

  it("doesn't show change/remove on someone else's photo", async () => {
    mockParams = { id: TEST_NEIGHBOR };
    mockRpc({ social_profile: () => ({ data: card() }) });
    await renderScreen(<ProfileScreen />);
    await act(async () => fireEvent.press(await screen.findByTestId('profile-avatar')));
    expect(screen.getByTestId('photo-viewer-close')).toBeTruthy();
    expect(screen.queryByTestId('photo-change')).toBeNull();
    expect(screen.queryByTestId('photo-remove')).toBeNull();
  });

  it('falls back to the existing profile when the social backend is not deployed', async () => {
    mockParams = { id: TEST_NEIGHBOR };
    useSocialStore.setState({ available: false });
    mockRpc({ social_profile: () => ({ error: { code: 'PGRST202', message: 'Could not find the function' } }) });
    await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(screen.queryByTestId('follow-button')).toBeNull());
    expect(screen.queryByTestId('followers-count')).toBeNull();
  });
});

describe('Followers list', () => {
  it('lets the owner remove a follower after confirming', async () => {
    mockParams = { id: TEST_ME, tab: 'followers' };
    mockRpc({
      list_follows: () => ({
        data: [{ user_id: TEST_NEIGHBOR, first_name: 'Bader', last_name: 'H', name_privacy: 'first_last_initial', follow_state: 'none', created_at: '2026-01-01' }],
      }),
    });
    await renderScreen(<FollowsScreen />);
    await waitFor(() => expect(screen.getAllByTestId('follow-row')).toHaveLength(1));
    await act(async () => fireEvent.press(await screen.findByText('Remove')));
    await act(async () => fireEvent.press(screen.getAllByText('Remove').pop()!));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('remove_follower', { follower: TEST_NEIGHBOR }));
  });
});

describe('Photo post composer', () => {
  it('selects several photos, strips metadata, and only publishes after confirming the audience', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///1.heic', width: 4032, height: 3024, mimeType: 'image/heic', fileSize: 3_000_000 },
        { uri: 'file:///2.jpg', width: 1200, height: 1600, mimeType: 'image/jpeg', fileSize: 900_000 },
        { uri: 'file:///3.gif', width: 100, height: 100, mimeType: 'image/gif', fileSize: 1000 },
      ],
    });
    from.mockImplementation(() => recordingBuilder({ data: null, error: null }, []));
    mockRpc({ publish_post: () => ({ data: { post_id: 'p-9', outcome: 'created' } }) });
    const uploads: string[] = [];
    (supabase.storage as { from: unknown }).from = () => ({
      upload: jest.fn((path: string) => {
        uploads.push(path);
        return Promise.resolve({ error: null });
      }),
      remove: jest.fn(() => Promise.resolve({ error: null })),
      createSignedUrls: jest.fn(() => Promise.resolve({ data: [], error: null })),
    });
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4096)) })) as never;
    const storageUploads = () => uploads.length;
    await renderScreen(<CreatePostScreen />);
    await act(async () => fireEvent.press(screen.getByTestId('add-photos')));
    await waitFor(() => expect(screen.getAllByTestId('draft-photo')).toHaveLength(2));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 10, exif: false }),
    );
    expect(screen.getByText(en.social.imageRejected)).toBeTruthy();

    await act(async () => fireEvent.press(screen.getAllByTestId('remove-photo')[1]));
    expect(screen.getAllByTestId('draft-photo')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('caption-input'), 'Sunset at the park');
    await act(async () => fireEvent.press(screen.getByTestId('audience-followers')));
    await act(async () => fireEvent.press(screen.getByText('Publish')));
    expect(await screen.findByText('Review before publishing')).toBeTruthy();
    expect(screen.getByText('This post will be visible to: Followers. Publish now?')).toBeTruthy();
    expect(storageUploads()).toBe(0);
    expect(mockReplace).not.toHaveBeenCalled();
    fireEvent.press(screen.getAllByText('Publish').pop()!);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/post/p-9'));
    // Only the cleaned (re-encoded, metadata-free) file is uploaded, into the private post folder.
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatch(new RegExp(`^posts/${TEST_ME}/`));
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('file:///1.heic#clean');
  });
});
