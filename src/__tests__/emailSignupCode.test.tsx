import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { resetStoreForTests } from '@/testing/fixtures';
import CheckEmailScreen from '../../app/(auth)/check-email';

const mockReplace = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResend = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ email: ' Resident@Example.test ' }),
  useRouter: () => ({ replace: mockReplace, canGoBack: () => false }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args), resend: (...args: unknown[]) => mockResend(...args) } },
}));
jest.mock('@/features/auth/routeAfterAuth', () => ({
  routeAfterAuth: async () => '/(auth)/profile-setup',
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
function renderCodeScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CheckEmailScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  resetStoreForTests();
  useStore.getState().setLocale('en');
  jest.clearAllMocks();
});

it.each([
  ['١٢٣٤٥٦', '123456'],
  ['۱۲۳۴۵۶۷۸', '12345678'],
])('confirms %s using Supabase and resumes onboarding', async (input, token) => {
  const user = { id: 'resident-id', email: 'resident@example.test' };
  mockVerifyOtp.mockResolvedValue({ data: { user, session: { user } }, error: null });
  await renderCodeScreen();
  await fireEvent.changeText(screen.getByLabelText('Verification code'), input);
  await fireEvent.press(screen.getByText('Verify email'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup'));
  expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'resident@example.test', token, type: 'email' });
});

it('shows an expired code error and throttles repeat resends', async () => {
  mockVerifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: 'otp_expired' } });
  mockResend.mockResolvedValue({ error: null });
  await renderCodeScreen();
  await fireEvent.changeText(screen.getByLabelText('Verification code'), '12345678');
  await fireEvent.press(screen.getByText('Verify email'));
  await waitFor(() => expect(screen.getByText(/code is invalid or has expired/)).toBeTruthy());
  await fireEvent.press(screen.getByText('Resend email'));
  await waitFor(() => expect(screen.getByText(/Resend email \(60\)/)).toBeTruthy());
  await fireEvent.press(screen.getByText(/Resend email \(60\)/));
  expect(mockResend).toHaveBeenCalledTimes(1);
  expect(mockReplace).not.toHaveBeenCalled();
});
