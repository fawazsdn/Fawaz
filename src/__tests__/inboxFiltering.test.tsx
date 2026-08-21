import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import MessagesScreen from '../../app/messages/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  useStore.getState().resetDemoData();
  useStore.getState().setLocale('en');
});

// Regresses a real bug fixed this session: the "Events" filter used to
// include every group conversation (isGroup), not just ones actually
// linked to an event (isGroup && eventId) — so a plain community group
// chat like conv5 would wrongly show up under "Events". FlatList applies
// data changes on the next tick in this test environment, hence waitFor.
describe('Inbox filtering', () => {
  it('"All" shows every conversation the current user is in', async () => {
    await renderWithProvider(<MessagesScreen />);
    // conv4 (event group) and conv5 (plain community group) both have titles.
    expect(screen.getByText('مباراة كرة قدم مسائية')).toBeTruthy();
    expect(screen.getByText('لجنة أهالي الحي')).toBeTruthy();
  });

  it('"Groups" shows plain community groups but not event-linked groups', async () => {
    await renderWithProvider(<MessagesScreen />);
    fireEvent.press(screen.getByText('Groups'));

    await waitFor(() => expect(screen.queryByText('مباراة كرة قدم مسائية')).toBeNull());
    expect(screen.getByText('لجنة أهالي الحي')).toBeTruthy();
  });

  it('"Events" shows only event-linked group conversations', async () => {
    await renderWithProvider(<MessagesScreen />);
    fireEvent.press(screen.getByText('Events'));

    await waitFor(() => expect(screen.queryByText('لجنة أهالي الحي')).toBeNull());
    expect(screen.getByText('مباراة كرة قدم مسائية')).toBeTruthy();
  });

  it('"Neighbors" excludes every group conversation', async () => {
    await renderWithProvider(<MessagesScreen />);
    fireEvent.press(screen.getByText('Neighbors'));

    await waitFor(() => expect(screen.queryByText('مباراة كرة قدم مسائية')).toBeNull());
    expect(screen.queryByText('لجنة أهالي الحي')).toBeNull();
  });
});
