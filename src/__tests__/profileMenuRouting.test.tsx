import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import SettingsScreen from '../../app/settings/index';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// react-native-gesture-handler isn't available in this test environment
// (see jest.setup.js), which BottomSheet depends on — irrelevant to the
// menu-routing behavior under test here. Same mock as
// src/__tests__/selectLocationFlow.test.tsx.
jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
  };
});

const insetsFrame = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  mockPush.mockClear();
  useStore.getState().resetDemoData();
  useStore.getState().setLocale('en');
});

describe('Profile & Settings menu', () => {
  it('renders the top profile card with the current user’s real stats, not follower/following counts', async () => {
    await renderWithProvider(<SettingsScreen />);
    const user = useStore.getState().getUser(CURRENT_USER_ID)!;

    expect(screen.getByText(`${user.stats.neighborsHelped}`)).toBeTruthy();
    expect(screen.getByText('neighbors helped')).toBeTruthy();
    expect(screen.queryByText(/followers/i)).toBeNull();
    expect(screen.queryByText(/following/i)).toBeNull();
  });

  it('routes "My Posts" to the profile screen with the activity tab', async () => {
    await renderWithProvider(<SettingsScreen />);
    fireEvent.press(screen.getByText('My Posts'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/profile/${CURRENT_USER_ID}?tab=activity`));
  });

  it('routes "My Events" to the profile screen with the events tab', async () => {
    await renderWithProvider(<SettingsScreen />);
    fireEvent.press(screen.getByText('My Events'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/profile/${CURRENT_USER_ID}?tab=events`));
  });

  it('routes "Saved" to the new saved-items screen', async () => {
    await renderWithProvider(<SettingsScreen />);
    fireEvent.press(screen.getByText('Saved'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/saved'));
  });

  it('routes "My Groups" to the existing community groups browse screen (no fabricated membership filter)', async () => {
    await renderWithProvider(<SettingsScreen />);
    fireEvent.press(screen.getByText('My Groups'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/community'));
  });

  it('still offers sign out and delete account', async () => {
    await renderWithProvider(<SettingsScreen />);
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.getByText('Delete account')).toBeTruthy();
  });
});
