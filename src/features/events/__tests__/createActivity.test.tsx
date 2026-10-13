import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import type { CommunityEvent } from '@/models';
import { TEST_ME, TEST_NEIGHBORHOOD_ID, signInVerifiedForTests, testClub, testMembership } from '@/testing/fixtures';
import CreateEventScreen from '../../../../app/event/create';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false }),
}));
jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/imageEditor/useImagePicker', () => ({ useImagePicker: () => ({ pickImage: jest.fn(), editor: null }) }));
jest.mock('@/components/HaratnaMap', () => ({ HaratnaMap: () => null }));
jest.mock('@/components/BottomSheet', () => ({ BottomSheet: () => null }));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
const insetsFrame = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = () =>
  render(
    <SafeAreaProvider initialMetrics={insetsFrame}>
      <CreateEventScreen />
    </SafeAreaProvider>,
  );

/** Records every insert() payload on the supabase query builder. */
function captureInserts() {
  const inserts: Record<string, unknown>[] = [];
  from.mockImplementation(() => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    Object.assign(b, {
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return b;
      },
      select: chain,
      eq: chain,
      single: () => Promise.resolve({ data: { id: 'new-event' }, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    });
    return b;
  });
  return inserts;
}

beforeEach(() => {
  mockReplace.mockClear();
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: 'new-id', error: null }));
  mockParams = {};
});

async function fillBasics() {
  await fireEvent.changeText(screen.getByTestId('event-title-input'), 'Saturday padel');
  await fireEvent.changeText(screen.getByTestId('event-location-input'), 'Community courts');
}

describe('Create activity: custom category', () => {
  it('requires the "Other" text and sends it trimmed', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    const inserts = captureInserts();
    await renderScreen();
    await fillBasics();
    await fireEvent.press(screen.getByLabelText('✨ Other'));
    await fireEvent.press(screen.getByText('Publish'));
    expect(screen.getByText('Enter your activity category (up to 40 characters).')).toBeTruthy();
    expect(inserts).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('custom-category-input'), '  Board   games ');
    await fireEvent.press(screen.getByText('Publish'));
    await waitFor(() => expect(inserts.length).toBe(1));
    expect(inserts[0]).toMatchObject({ category: 'other', custom_category: 'Board games' });
  });

  it('drops the custom text when another category is chosen', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    const inserts = captureInserts();
    await renderScreen();
    await fillBasics();
    await fireEvent.press(screen.getByLabelText('✨ Other'));
    await fireEvent.changeText(screen.getByTestId('custom-category-input'), 'Board games');
    await fireEvent.press(screen.getByLabelText('🎾 Padel'));
    await fireEvent.press(screen.getByText('Publish'));
    await waitFor(() => expect(inserts.length).toBe(1));
    expect(inserts[0]).toMatchObject({ category: 'padel', custom_category: null });
  });
});

describe('Create club activity', () => {
  it('is refused to residents who do not organize the club', async () => {
    signInVerifiedForTests({ clubs: [testClub('c1')], clubMemberships: [testMembership('c1', TEST_ME)] });
    useStore.getState().setLocale('en');
    mockParams = { clubId: 'c1' };
    await renderScreen();
    expect(screen.getByText(/Only club organizers can create club activities/)).toBeTruthy();
  });

  it('creates a weekly series through the server RPC', async () => {
    signInVerifiedForTests({
      clubs: [testClub('c1', { ownerId: TEST_ME, name: 'Morning Runners' })],
      clubMemberships: [testMembership('c1', TEST_ME, { role: 'owner' })],
    });
    useStore.getState().setLocale('en');
    mockParams = { clubId: 'c1' };
    await renderScreen();
    expect(screen.getByText('Activity for "Morning Runners"')).toBeTruthy();
    await fillBasics();
    await fireEvent.press(screen.getByText('Weekly'));
    await fireEvent.press(screen.getByText('Publish'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('create_club_activity', expect.anything()));
    const [, args] = rpc.mock.calls.find((c) => c[0] === 'create_club_activity')!;
    expect(args.target_club).toBe('c1');
    expect(args.p).toMatchObject({ recurrence: 'weekly', occurrences: 8, title: 'Saturday padel', custom_category: null });
    // The client never chooses the neighborhood for a club activity.
    expect(args.p).not.toHaveProperty('neighborhood_id');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/event/new-id'));
  });
});

describe('Edit activity', () => {
  const existing: CommunityEvent = {
    id: 'e1',
    kind: 'activity',
    title: 'Board night',
    category: 'other',
    customCategory: 'Board games',
    description: '',
    hostId: TEST_ME,
    neighborhoodId: TEST_NEIGHBORHOOD_ID,
    startsAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    endsAt: new Date(Date.now() + 3 * 86400000 + 7200000).toISOString(),
    locationLabel: 'Majlis',
    capacity: 8,
    audience: 'neighborhood',
    recurring: false,
    recurrence: 'weekly',
    membersOnly: false,
    seriesId: 's1',
    attendees: [],
  };

  it('preserves the custom category and can apply to future sessions', async () => {
    signInVerifiedForTests({ events: [existing] });
    useStore.getState().setLocale('en');
    mockParams = { edit: 'e1' };
    await renderScreen();
    expect(screen.getByTestId('custom-category-input').props.value).toBe('Board games');
    await fireEvent.press(screen.getByText('This and future sessions'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('update_club_activity', expect.anything()));
    const [, args] = rpc.mock.calls.find((c) => c[0] === 'update_club_activity')!;
    expect(args).toMatchObject({ target_event: 'e1', scope: 'future' });
    expect(args.p).toMatchObject({ category: 'other', custom_category: 'Board games', title: 'Board night' });
  });
});
