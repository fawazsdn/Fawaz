import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import en from '@/i18n/en';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import { signInVerifiedForTests } from '@/testing/fixtures';
import { fillLegal, legalDoc, LEGAL_DOCS } from '@/content/legal';
import { signUpWithEmail } from '@/features/auth/supabaseAuth';
import SignUpScreen from '../../../../app/(auth)/sign-up';
import SupportScreen from '../../../../app/settings/support';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ canGoBack: () => false }),
}));
jest.mock('@/features/auth/supabaseAuth', () => ({
  ...jest.requireActual('@/features/auth/supabaseAuth'),
  signUpWithEmail: jest.fn(() => Promise.resolve({ ok: true, needsConfirmation: true, email: 'new@example.com' })),
}));

const rpc = supabase.rpc as jest.Mock;
const frame = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={frame}>{ui}</SafeAreaProvider>);

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  (signUpWithEmail as jest.Mock).mockClear();
  useStore.getState().setLocale('en');
});

describe('legal content', () => {
  it('fills owner placeholders with honest in-app fallbacks, never a made-up address', () => {
    expect(fillLegal('Contact {{SUPPORT_EMAIL}} at {{OPERATOR}}', 'en')).toBe(
      'Contact the in-app Contact support form at the Haratna team',
    );
    expect(fillLegal('{{OPERATOR}}', 'ar')).toBe('فريق حارتنا');
    for (const locale of ['ar', 'en'] as const) {
      for (const doc of LEGAL_DOCS) {
        const d = legalDoc(doc, locale);
        expect(d.title).toBeTruthy();
        const text = JSON.stringify(d);
        expect(text).not.toMatch(/\{\{/);
        expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]/i);
      }
    }
  });
});

describe('sign-up consent (Guideline 1.2)', () => {
  const fill = async () => {
    await fireEvent.changeText(screen.getByLabelText(en.auth.email), 'new@example.com');
    await fireEvent.changeText(screen.getByLabelText(en.auth.password), 'abc12345');
    await fireEvent.changeText(screen.getByLabelText(en.auth.confirmPassword), 'abc12345');
  };

  it('does not create an account until the terms are accepted', async () => {
    await renderScreen(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByText(en.auth.createAccount));
    expect(await screen.findByText(en.consent.required)).toBeTruthy();
    expect(signUpWithEmail).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('consent-checkbox'));
    await fireEvent.press(screen.getByText(en.auth.createAccount));
    await waitFor(() => expect(signUpWithEmail).toHaveBeenCalledWith('new@example.com', 'abc12345', 'en'));
  });
});

describe('contact support', () => {
  it('files a real support request through the server', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === 'submit_support_request' ? 'req-1' : null, error: null }));
    await renderScreen(<SupportScreen />);
    await fireEvent.changeText(screen.getByLabelText(en.support.message), 'The map does not load on my phone.');
    await fireEvent.press(screen.getByText(en.support.send));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('submit_support_request', { category: 'bug', message: 'The map does not load on my phone.' }),
    );
    expect(await screen.findByText(en.support.sent)).toBeTruthy();
  });
});
