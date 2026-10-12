import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resetStoreForTests, signInVerifiedForTests, TEST_ME, TEST_NEIGHBOR } from '@/testing/fixtures';
import { useStore } from '@/store/useStore';
import type { Conversation, Message } from '@/models';
import MessagesScreen from '../../app/messages/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderWithProvider = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);

const now = new Date().toISOString();
const conversations: Conversation[] = [
  { id: 'c-direct', kind: 'direct', participantIds: [TEST_ME, TEST_NEIGHBOR], lastMessageAt: now, lastReadAt: now },
  {
    id: 'c-event',
    kind: 'event',
    participantIds: [TEST_ME, TEST_NEIGHBOR],
    eventId: 'e1',
    isGroup: true,
    title: 'Test Event Chat',
    lastMessageAt: now,
  },
  { id: 'c-group', kind: 'group', participantIds: [TEST_ME, TEST_NEIGHBOR], isGroup: true, title: 'Test Group Chat', lastMessageAt: now },
];
const messages: Message[] = [
  { id: 'm1', conversationId: 'c-event', senderId: TEST_NEIGHBOR, text: 'unread hello', createdAt: now, readBy: [TEST_NEIGHBOR] },
  { id: 'm2', conversationId: 'c-direct', senderId: TEST_ME, text: 'my message', createdAt: now, readBy: [TEST_ME] },
];

beforeEach(() => {
  signInVerifiedForTests({ conversations, messages });
  useStore.getState().setLocale('en');
});

describe('Inbox filtering', () => {
  it('"All" shows every real conversation the resident is in', async () => {
    await renderWithProvider(<MessagesScreen />);
    expect(screen.getByText('Test Event Chat')).toBeTruthy();
    expect(screen.getByText('Test Group Chat')).toBeTruthy();
  });

  it('"Groups" excludes event-linked chats; "Events" shows only them', async () => {
    await renderWithProvider(<MessagesScreen />);
    await fireEvent.press(screen.getByText('Groups'));
    await waitFor(() => expect(screen.queryByText('Test Event Chat')).toBeNull());
    expect(screen.getByText('Test Group Chat')).toBeTruthy();

    await fireEvent.press(screen.getByText('Events'));
    await waitFor(() => expect(screen.queryByText('Test Group Chat')).toBeNull());
    expect(screen.getByText('Test Event Chat')).toBeTruthy();
  });

  it('"Unread" shows only conversations with unread messages from others, with a real count', async () => {
    await renderWithProvider(<MessagesScreen />);
    await fireEvent.press(screen.getByText('Unread'));
    await waitFor(() => expect(screen.queryByText('Test Group Chat')).toBeNull());
    expect(screen.getByText('Test Event Chat')).toBeTruthy();
    expect(screen.getByLabelText('1 unread')).toBeTruthy();
  });

  it('search matches message text', async () => {
    await renderWithProvider(<MessagesScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText(/Search/i), 'unread hello');
    await waitFor(() => expect(screen.queryByText('Test Group Chat')).toBeNull());
    expect(screen.getByText('Test Event Chat')).toBeTruthy();
  });

  it('shows an honest empty state (no fictional conversations) for a new resident', async () => {
    resetStoreForTests();
    useStore.getState().setLocale('en');
    await renderWithProvider(<MessagesScreen />);
    expect(screen.getByText(/No conversations yet/)).toBeTruthy();
  });
});
