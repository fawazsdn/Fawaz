import { signInWithGoogle } from './supabaseAuth';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn() } },
}));

const open = jest.mocked(WebBrowser.openAuthSessionAsync);
const start = jest.mocked(supabase.auth.signInWithOAuth);
const exchange = jest.mocked(supabase.auth.exchangeCodeForSession);

beforeEach(() => {
  jest.clearAllMocks();
  start.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.com/authorize' }, error: null });
});

test.each([
  'https://example.test/callback?code=test',
  'haratna://auth/elsewhere?code=test',
  'haratna://auth/callback?code=a&code=b',
  'not a URL',
])('rejects malformed or foreign callbacks without exchanging a code', async (url) => {
  open.mockResolvedValue({ type: 'success', url });
  expect(await signInWithGoogle()).toEqual({ ok: false, reason: 'unknown' });
  expect(exchange).not.toHaveBeenCalled();
});

test('handles cancellation and an offline auth session', async () => {
  open.mockResolvedValueOnce({ type: 'cancel' as WebBrowser.WebBrowserResultType.CANCEL }).mockRejectedValueOnce(new Error('Network unavailable'));
  expect(await signInWithGoogle()).toEqual({ ok: false, reason: 'cancelled' });
  expect(await signInWithGoogle()).toEqual({ ok: false, reason: 'network' });
  expect(exchange).not.toHaveBeenCalled();
});

test('exchanges only the code from the registered callback', async () => {
  open.mockResolvedValue({ type: 'success', url: 'haratna://auth/callback?code=example-code' });
  exchange.mockResolvedValue({
    data: { user: { id: 'test-user', email: 'test@example.test', app_metadata: { provider: 'google' } }, session: {} },
    error: null,
  } as Awaited<ReturnType<typeof exchange>>);
  expect(await signInWithGoogle()).toEqual({ ok: true, userId: 'test-user', email: 'test@example.test', provider: 'google' });
  expect(start).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: 'haratna://auth/callback', skipBrowserRedirect: true, scopes: 'openid email profile' },
  });
  expect(exchange).toHaveBeenCalledWith('example-code');
});
