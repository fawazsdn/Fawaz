import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { AppHeader } from '../AppHeader';

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

// AppHeader's back button is used on ~35 screens app-wide — this is the
// single place that must never dispatch a bare, unsafe GO_BACK.
describe('AppHeader back button', () => {
  it('goes back normally when there is navigation history', async () => {
    mockCanGoBack.mockReturnValue(true);
    await renderWithProvider(<AppHeader title="Event" fallbackRoute="/events" />);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to fallbackRoute when opened directly with no history (deep link / refresh)', async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderWithProvider(<AppHeader title="Event" fallbackRoute="/events" />);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(mockReplace).toHaveBeenCalledWith('/events');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('falls back to "/" when no fallbackRoute is given', async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderWithProvider(<AppHeader title="Untitled" />);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('lets a custom onBack override the safe-back default entirely', async () => {
    mockCanGoBack.mockReturnValue(false);
    const onBack = jest.fn();
    await renderWithProvider(<AppHeader title="Custom" onBack={onBack} fallbackRoute="/events" />);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders no back button at all when showBack is false', async () => {
    await renderWithProvider(<AppHeader title="Home" showBack={false} />);
    expect(screen.queryByLabelText('Back')).toBeNull();
  });
});
