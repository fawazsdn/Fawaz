import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resetStoreForTests } from '@/testing/fixtures';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import SignInScreen from '../../app/(auth)/sign-in';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn(), canGoBack: () => false }),
}));

const mockSignInWithGoogle = jest.fn();
jest.mock('@/features/auth/supabaseAuth', () => {
  const actual = jest.requireActual('@/features/auth/supabaseAuth');
  return { ...actual, signInWithApple: jest.fn(), signInWithGoogle: () => mockSignInWithGoogle() };
});
jest.mock('@/features/auth/routeAfterAuth', () => ({ routeAfterAuth: jest.fn(async () => '/(auth)/profile-setup') }));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 'continue' },
  AppleAuthenticationButtonStyle: { BLACK: 'black', WHITE: 'white' },
  isAvailableAsync: async () => false,
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'haratna://auth/callback' }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: () => new Uint8Array(32),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'sha256' },
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderWithProvider = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
const signInWithPassword = supabase.auth.signInWithPassword as jest.Mock;

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  mockSignInWithGoogle.mockReset();
  signInWithPassword.mockReset();
  resetStoreForTests();
  useStore.getState().setLocale('en');
});

describe('Sign-in screen (email + Apple/Google via real Supabase auth)', () => {
  it('shows the requested email-first layout with no phone number field', async () => {
    await renderWithProvider(<SignInScreen />);
    expect(screen.getByText('Welcome to Haratna')).toBeTruthy();
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
    expect(screen.getByText('Sign up')).toBeTruthy();
    expect(screen.getByText('Continue with Google')).toBeTruthy();
    expect(screen.queryByText(/phone/i)).toBeNull();
  });

  it('validates the email before calling Supabase', async () => {
    await renderWithProvider(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'not-an-email');
    await fireEvent.press(screen.getByText('Sign In'));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with real email/password and stores the real Supabase user id', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'real-user-1', email: 'a@example.test', app_metadata: { provider: 'email' } } },
      error: null,
    });
    await renderWithProvider(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), ' A@Example.test ');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret123');
    await fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup'));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.test', password: 'secret123' });
    expect(useStore.getState().session.supabaseUserId).toBe('real-user-1');
    expect(useStore.getState().session.authProvider).toBe('email');
  });

  it('wrong password: clear error, not authenticated', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    await renderWithProvider(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'a@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'wrong');
    await fireEvent.press(screen.getByText('Sign In'));
    expect(await screen.findByText('Incorrect email or password.')).toBeTruthy();
    expect(useStore.getState().session.isAuthenticated).toBe(false);
  });

  it('unconfirmed email: explains and offers to resend the confirmation link', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    await renderWithProvider(<SignInScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'a@example.test');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret123');
    await fireEvent.press(screen.getByText('Sign In'));
    expect(await screen.findByText(/isn't confirmed yet/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Resend link'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/check-email', params: { email: 'a@example.test' } });
  });

  it('a successful Google sign-in stores the real Supabase user id', async () => {
    mockSignInWithGoogle.mockResolvedValue({ ok: true, userId: 'real-supabase-user-id-123', email: null, provider: 'google' });
    await renderWithProvider(<SignInScreen />);
    await fireEvent.press(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup'));
    expect(useStore.getState().session.supabaseUserId).toBe('real-supabase-user-id-123');
    expect(useStore.getState().session.authProvider).toBe('google');
  });

  it('a cancelled Google sign-in does not authenticate and shows no error', async () => {
    mockSignInWithGoogle.mockResolvedValue({ ok: false, reason: 'cancelled' });
    await renderWithProvider(<SignInScreen />);
    await fireEvent.press(screen.getByText('Continue with Google'));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByText(/couldn.t sign in/i)).toBeNull();
  });
});
