import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { requestAppleDeletionCode } from './supabaseAuth';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() }, functions: { invoke: jest.fn() } },
}));

const getUser = jest.mocked(supabase.auth.getUser);
const invoke = jest.mocked(supabase.functions.invoke);
const signIn = jest.mocked(AppleAuthentication.signInAsync);

beforeEach(() => {
  jest.resetAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(AppleAuthentication.isAvailableAsync).mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

function useIdentity(provider: string) {
  getUser.mockResolvedValue({
    data: { user: { identities: [{ provider }], app_metadata: { provider: 'email' } } },
    error: null,
  } as Awaited<ReturnType<typeof getUser>>);
}

test('a linked Apple identity requires the new server capability before prompting', async () => {
  useIdentity('apple');
  invoke.mockResolvedValue({ data: { appleRevocation: false }, error: null });

  await expect(requestAppleDeletionCode()).rejects.toThrow('Apple authorization unavailable');
  expect(invoke).toHaveBeenCalledWith('delete-account-v2', { method: 'GET' });
  expect(signIn).not.toHaveBeenCalled();
});

test('a confirmed capability allows a fresh native Apple authorization code', async () => {
  useIdentity('apple');
  invoke.mockResolvedValue({ data: { appleRevocation: true }, error: null });
  signIn.mockResolvedValue({
    user: 'apple-subject',
    authorizationCode: 'fresh-code',
    identityToken: null,
    email: null,
    fullName: null,
    realUserStatus: 0,
    state: null,
  });

  await expect(requestAppleDeletionCode()).resolves.toBe('fresh-code');
  expect(signIn).toHaveBeenCalledTimes(1);
});

test('an email-only account does not require the Apple endpoint', async () => {
  useIdentity('email');

  await expect(requestAppleDeletionCode()).resolves.toBeUndefined();
  expect(invoke).not.toHaveBeenCalled();
  expect(signIn).not.toHaveBeenCalled();
});
