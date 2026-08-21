import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import MessagesScreen from '../../app/messages/index';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
  }),
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockCanGoBack.mockReset();
  useStore.getState().resetDemoData();
  useStore.getState().setLocale('en');
});

// Regresses the reported bug: Inbox had no visible back button at all
// (AppHeader was rendered with showBack={false}) — a resident who
// navigated into Inbox from anywhere else in the app had no way to get
// back except an OS/browser gesture.
describe('Inbox back button', () => {
  it('renders a visible back button', async () => {
    await renderWithProvider(<MessagesScreen />);
    expect(screen.getByLabelText('Back')).toBeTruthy();
  });

  it('goes back normally when there is navigation history (opened from another screen)', async () => {
    mockCanGoBack.mockReturnValue(true);
    await renderWithProvider(<MessagesScreen />);

    fireEvent.press(screen.getByLabelText('Back'));

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to "/" when there is no history (direct URL open or a refresh)', async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderWithProvider(<MessagesScreen />);

    fireEvent.press(screen.getByLabelText('Back'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockBack).not.toHaveBeenCalled();
  });
});
