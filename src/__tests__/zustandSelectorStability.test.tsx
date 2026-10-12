import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { signInVerifiedForTests, TEST_ME, TEST_NEIGHBOR } from '@/testing/fixtures';
import { useStore } from '@/store/useStore';
import { HomeHeader } from '@/features/home/HomeHeader';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderWithProvider = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);

/**
 * Regression coverage for "getSnapshot should be cached" / "Maximum update
 * depth exceeded": selectors returning freshly-built arrays are unstable
 * snapshots under useSyncExternalStore. HomeHeader derives unread state from
 * the store; these tests fail loudly if that regresses.
 */
describe('Zustand selector snapshot stability', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    mockPush.mockClear();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    const messages = errorSpy.mock.calls.map((c) => String(c[0]));
    errorSpy.mockRestore();
    expect(messages.some((m) => /getSnapshot|Maximum update depth/.test(m))).toBe(false);
  });

  it('renders HomeHeader against the real store without a render loop', async () => {
    await renderWithProvider(<HomeHeader />);
    expect(screen.getByText('Ajyal')).toBeTruthy();
  });

  it('neighborhood name opens the real selection flow (membership changes go through the server)', async () => {
    await renderWithProvider(<HomeHeader />);
    await fireEvent.press(screen.getByText('Ajyal'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/select-city');
  });

  it('re-renders when realtime data (an unread message) arrives', async () => {
    await renderWithProvider(<HomeHeader />);
    act(() => {
      useStore.setState({
        conversations: [{ id: 'c1', kind: 'direct', participantIds: [TEST_ME, TEST_NEIGHBOR], lastMessageAt: new Date().toISOString() }],
        messages: [
          {
            id: 'm1',
            conversationId: 'c1',
            senderId: TEST_NEIGHBOR,
            text: 'hi',
            createdAt: new Date().toISOString(),
            readBy: [TEST_NEIGHBOR],
          },
        ],
      });
    });
    expect(screen.getByText('Ajyal')).toBeTruthy();
  });
});
