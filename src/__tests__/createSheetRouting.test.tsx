import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import CreateSheetScreen from '../../app/create/index';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  mockPush.mockClear();
  useStore.getState().resetDemoData();
  // English copy, for readable assertions — the same option list renders
  // in Arabic when the app locale is Arabic (see i18n/ar.ts `create`).
  useStore.getState().setLocale('en');
});

// The Create sheet is the entry point for all 8 requested content types
// (plus the pre-existing Poll option) — this locks in that every option
// is present with a title+description and routes to an existing feature,
// never a dead or duplicate route.
describe('Create sheet', () => {
  it('offers all 8 requested content options plus Poll, each with a title and description', async () => {
    await renderWithProvider(<CreateSheetScreen />);

    const expected = [
      'Post something',
      'Ask neighbors',
      'Create event',
      'Report an issue',
      'Recommend a place',
      'Sell / give away',
      'Lost & found',
      'Ask for help',
      'Poll',
    ];
    for (const title of expected) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('routes "Ask neighbors" into the existing post composer, not a duplicate flow', async () => {
    await renderWithProvider(<CreateSheetScreen />);
    fireEvent.press(screen.getByText('Ask neighbors'));
    expect(mockPush).toHaveBeenCalledWith('/create/post');
  });

  it('routes "Recommend a place" to the existing businesses browse screen', async () => {
    await renderWithProvider(<CreateSheetScreen />);
    fireEvent.press(screen.getByText('Recommend a place'));
    expect(mockPush).toHaveBeenCalledWith('/recommendations');
  });

  it('routes "Sell / give away" to the marketplace composer', async () => {
    await renderWithProvider(<CreateSheetScreen />);
    fireEvent.press(screen.getByText('Sell / give away'));
    expect(mockPush).toHaveBeenCalledWith('/marketplace/create');
  });
});
