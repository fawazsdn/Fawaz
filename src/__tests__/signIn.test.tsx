import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import SignInScreen from '../../app/(auth)/sign-in';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

const mockSignInWithGoogle = jest.fn();
jest.mock('@/features/auth/supabaseAuth', () => ({
  signInWithApple: jest.fn(),
  signInWithGoogle: () => mockSignInWithGoogle(),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { CONTINUE: 'continue' },
  AppleAuthenticationButtonStyle: { BLACK: 'black', WHITE: 'white' },
  isAvailableAsync: async () => false,
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSignInWithGoogle.mockReset();
  useStore.getState().resetDemoData();
  useStore.getState().setLocale('en');
});

// Regresses against ever shipping a fake/mocked sign-in: this screen must
// only ever mark the local session authenticated after supabaseAuth returns
// a real ok:true + a real Supabase user id, never on its own initiative.
describe('Sign-in screen (Apple/Google via real Supabase auth)', () => {
  it('a successful Google sign-in stores the real Supabase user id and navigates to profile setup', async () => {
    mockSignInWithGoogle.mockResolvedValue({ ok: true, userId: 'real-supabase-user-id-123' });
    await renderWithProvider(<SignInScreen />);

    fireEvent.press(screen.getByText('Continue with Google'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup'));
    expect(useStore.getState().session.supabaseUserId).toBe('real-supabase-user-id-123');
    expect(useStore.getState().session.authProvider).toBe('google');
    expect(useStore.getState().session.isAuthenticated).toBe(true);
  });

  it('a cancelled sign-in does not authenticate and shows no error', async () => {
    mockSignInWithGoogle.mockResolvedValue({ ok: false, reason: 'cancelled' });
    await renderWithProvider(<SignInScreen />);

    fireEvent.press(screen.getByText('Continue with Google'));

    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useStore.getState().session.isAuthenticated).toBe(false);
    expect(screen.queryByText(/couldn.t sign in/i)).toBeNull();
  });

  it('a failed sign-in shows an error and does not authenticate', async () => {
    mockSignInWithGoogle.mockResolvedValue({ ok: false, reason: 'error', message: 'network down' });
    await renderWithProvider(<SignInScreen />);

    fireEvent.press(screen.getByText('Continue with Google'));

    await waitFor(() => expect(screen.getByText(/couldn.t sign in/i)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useStore.getState().session.isAuthenticated).toBe(false);
  });
});
