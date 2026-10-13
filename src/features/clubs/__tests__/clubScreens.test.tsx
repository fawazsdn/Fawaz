import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import type { CommunityEvent } from '@/models';
import {
  TEST_ME,
  TEST_NEIGHBOR,
  TEST_NEIGHBORHOOD_ID,
  signInVerifiedForTests,
  testClub,
  testMembership,
  testUser,
} from '@/testing/fixtures';
import ClubsScreen from '../../../../app/clubs/index';
import ClubDetailScreen from '../../../../app/clubs/[id]/index';
import ClubMembersScreen from '../../../../app/clubs/[id]/members';
import CreateClubScreen from '../../../../app/clubs/create';
import AdminClubsScreen from '../../../../app/admin/clubs/index';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false }),
}));

// Actions re-sync after every write; the sync itself is covered elsewhere.
jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));

jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
  };
});

// The photo editor needs native gesture handlers that Jest doesn't provide.
jest.mock('@/components/imageEditor/useImagePicker', () => ({ useImagePicker: () => ({ pickImage: jest.fn(), editor: null }) }));

const rpc = supabase.rpc as jest.Mock;
const insetsFrame = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);

function clubEvent(id: string, clubId: string, extra: Partial<CommunityEvent> = {}): CommunityEvent {
  const startsAt = new Date(Date.now() + 2 * 86400000).toISOString();
  return {
    id,
    kind: 'activity',
    title: `Run ${id}`,
    category: 'running',
    description: '',
    hostId: TEST_NEIGHBOR,
    neighborhoodId: TEST_NEIGHBORHOOD_ID,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
    locationLabel: 'Park gate',
    capacity: 10,
    audience: 'neighborhood',
    recurring: true,
    recurrence: 'weekly',
    membersOnly: false,
    clubId,
    seriesId: 'series-1',
    attendees: [],
    ...extra,
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  mockParams = {};
});

describe('Clubs discovery', () => {
  it('shows the requested empty state with a Create Club button when the neighborhood has no clubs', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    await renderScreen(<ClubsScreen />);
    expect(screen.getByText('No clubs in your neighborhood yet.\nBe the first to create one!')).toBeTruthy();
    expect(screen.getAllByText('Create Club').length).toBeGreaterThan(0);
  });

  it('lists only approved clubs of the neighborhood — never pending, rejected or other-neighborhood clubs', async () => {
    signInVerifiedForTests({
      clubs: [
        testClub('ok', { name: 'Morning Runners' }),
        testClub('pend', { name: 'Pending Club', reviewStatus: 'pending_review' }),
        testClub('rej', { name: 'Rejected Club', reviewStatus: 'rejected' }),
        testClub('far', { name: 'Far Club', neighborhoodId: 'sa-district-10500227005' }),
      ],
    });
    useStore.getState().setLocale('en');
    await renderScreen(<ClubsScreen />);
    expect(screen.getAllByText('Morning Runners').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pending Club')).toBeNull();
    expect(screen.queryByText('Rejected Club')).toBeNull();
    expect(screen.queryByText('Far Club')).toBeNull();
  });

  it('renders in Arabic', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('ar');
    await renderScreen(<ClubsScreen />);
    expect(screen.getAllByText('الأندية').length).toBeGreaterThan(0);
    expect(screen.getByText('لا توجد أندية في حيك حتى الآن.\nكن أول من ينشئ نادياً!')).toBeTruthy();
  });
});

describe('Club details & membership', () => {
  it('lets a neighbor request to join an approval club through the server RPC', async () => {
    signInVerifiedForTests({ clubs: [testClub('c1', { name: 'Chess Corner' })] });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === 'join_club' ? 'pending' : null, error: null }));
    await renderScreen(<ClubDetailScreen />);
    await fireEvent.press(screen.getByText('Request to Join'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('join_club', { target_club: 'c1' }));
    // Non-members never see the members-only areas.
    expect(screen.queryByText('Announcements')).toBeNull();
    expect(screen.queryByText('Open club chat')).toBeNull();
  });

  it('offers "Join Club" for open clubs', async () => {
    signInVerifiedForTests({ clubs: [testClub('c1', { membershipType: 'open' })] });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubDetailScreen />);
    expect(screen.getByText('Join Club')).toBeTruthy();
  });

  it('shows a pending request with a cancel option', async () => {
    signInVerifiedForTests({ clubs: [testClub('c1')], clubMemberships: [testMembership('c1', TEST_ME, { status: 'pending' })] });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubDetailScreen />);
    await fireEvent.press(screen.getByText('Cancel request'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('cancel_join_request', { target_club: 'c1' }));
  });

  it('blocks banned residents from joining again', async () => {
    signInVerifiedForTests({ clubs: [testClub('c1')], clubMemberships: [testMembership('c1', TEST_ME, { status: 'banned' })] });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubDetailScreen />);
    expect(screen.getByText('You can no longer join this club.')).toBeTruthy();
    expect(screen.queryByText('Request to Join')).toBeNull();
  });

  it('gives members the chat, announcements and upcoming activities, and lets them leave', async () => {
    signInVerifiedForTests({
      clubs: [testClub('c1')],
      clubMemberships: [testMembership('c1', TEST_ME), testMembership('c1', TEST_NEIGHBOR, { role: 'owner' })],
      conversations: [
        {
          id: 'conv1',
          kind: 'group',
          groupId: 'c1',
          isGroup: true,
          participantIds: [TEST_ME, TEST_NEIGHBOR],
          lastMessageAt: new Date().toISOString(),
        },
      ],
      events: [clubEvent('e1', 'c1')],
    });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubDetailScreen />);
    expect(screen.getByText('Open club chat')).toBeTruthy();
    expect(screen.getByText('Announcements')).toBeTruthy();
    expect(screen.getByText('Run e1')).toBeTruthy();
    // Regular members don't get organizer tools.
    expect(screen.queryByText('New activity')).toBeNull();
    expect(screen.queryByText('Post announcement')).toBeNull();
    await fireEvent.press(screen.getByText('Leave club'));
    await fireEvent.press(screen.getAllByText('Leave club').slice(-1)[0]);
  });

  it('gives organizers activity, member and announcement tools but no "leave" (ownership must be transferred)', async () => {
    signInVerifiedForTests({
      clubs: [testClub('c1', { ownerId: TEST_ME })],
      clubMemberships: [testMembership('c1', TEST_ME, { role: 'owner' }), testMembership('c1', TEST_NEIGHBOR, { status: 'pending' })],
    });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubDetailScreen />);
    expect(screen.getByText('New activity')).toBeTruthy();
    expect(screen.getByText('Post announcement')).toBeTruthy();
    expect(screen.queryByText('Leave club')).toBeNull();
    expect(screen.getByText('Transfer ownership to another member before leaving.')).toBeTruthy();
    await fireEvent.press(screen.getByText('New activity'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/event/create', params: { clubId: 'c1' } });
  });

  it('shows the applicant the review status and the reviewer’s note while pending', async () => {
    signInVerifiedForTests({
      clubs: [testClub('c1', { ownerId: TEST_ME, reviewStatus: 'needs_changes', reviewNote: 'Please add where you meet' })],
      clubMemberships: [testMembership('c1', TEST_ME, { role: 'owner' })],
    });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubDetailScreen />);
    expect(screen.getByText('Changes requested')).toBeTruthy();
    expect(screen.getByText('Please add where you meet')).toBeTruthy();
    expect(screen.getByText('Edit & resubmit')).toBeTruthy();
    // Not approved yet: no joining, no chat, no activities.
    expect(screen.queryByText('New activity')).toBeNull();
  });
});

describe('Club members (organizer tools)', () => {
  it('lets the organizer approve a pending join request', async () => {
    signInVerifiedForTests({
      clubs: [testClub('c1', { ownerId: TEST_ME })],
      clubMemberships: [testMembership('c1', TEST_ME, { role: 'owner' }), testMembership('c1', TEST_NEIGHBOR, { status: 'pending' })],
      users: [testUser(TEST_ME, 'Test Resident A', { isSelf: true }), testUser(TEST_NEIGHBOR, 'Test Resident B')],
    });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubMembersScreen />);
    await fireEvent.press(screen.getByText('Approve'));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith('respond_join_request', { target_club: 'c1', target_user: TEST_NEIGHBOR, approve: true }),
    );
  });

  it('hides pending requests from regular members', async () => {
    signInVerifiedForTests({
      clubs: [testClub('c1')],
      clubMemberships: [testMembership('c1', TEST_ME), testMembership('c1', TEST_NEIGHBOR, { role: 'owner' })],
    });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubMembersScreen />);
    expect(screen.queryByText('Join requests')).toBeNull();
    expect(screen.queryByText('Approve')).toBeNull();
  });

  it('refuses non-members', async () => {
    signInVerifiedForTests({ clubs: [testClub('c1')] });
    useStore.getState().setLocale('en');
    mockParams = { id: 'c1' };
    await renderScreen(<ClubMembersScreen />);
    expect(screen.getByText('Join the club to see members, chat and announcements.')).toBeTruthy();
  });
});

describe('Create Club (application)', () => {
  const eligibility = (over: Record<string, unknown> = {}) => ({
    signed_in: true,
    verified_neighborhood_id: TEST_NEIGHBORHOOD_ID,
    age_declared: true,
    is_adult: true,
    suspended: false,
    pending_applications: 0,
    ...over,
  });

  it('blocks residents who declared they are under 18', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'my_club_eligibility' ? eligibility({ is_adult: false }) : null, error: null }),
    );
    await renderScreen(<CreateClubScreen />);
    expect(await screen.findByText('Creating and running clubs is for people 18 and older. You can still join clubs.')).toBeTruthy();
    expect(screen.queryByText('Submit for review')).toBeNull();
  });

  it('asks for a private, set-once date of birth before the form', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'my_club_eligibility' ? eligibility({ age_declared: false, is_adult: false }) : null, error: null }),
    );
    await renderScreen(<CreateClubScreen />);
    expect(await screen.findByText('Club organizers must be 18 or older. Enter your date of birth to continue.')).toBeTruthy();
    expect(screen.getByText(/never shown to other residents/)).toBeTruthy();
  });

  it('blocks suspended accounts', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === 'my_club_eligibility' ? eligibility({ suspended: true }) : null, error: null }),
    );
    await renderScreen(<CreateClubScreen />);
    expect(await screen.findByText('Club creation is currently unavailable for your account.')).toBeTruthy();
  });

  it('validates required fields locally and never submits a half-filled application', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === 'my_club_eligibility' ? eligibility() : null, error: null }));
    await renderScreen(<CreateClubScreen />);
    await fireEvent.press(await screen.findByText('Submit for review'));
    expect(screen.getAllByText('Please complete the highlighted fields.').length).toBeGreaterThan(0);
    expect(rpc).not.toHaveBeenCalledWith('submit_club_application', expect.anything());
  });

  it('asks the required neighborhood-benefit question', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('ar');
    rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === 'my_club_eligibility' ? eligibility() : null, error: null }));
    await renderScreen(<CreateClubScreen />);
    expect(await screen.findByText('كيف سيفيد هذا النادي سكان الحي؟')).toBeTruthy();
  });
});

describe('Admin review dashboard', () => {
  it('is closed to non-admins and never calls the admin RPC', async () => {
    signInVerifiedForTests();
    useStore.getState().setLocale('en');
    await renderScreen(<AdminClubsScreen />);
    expect(screen.getByText('This area is for Haratna administrators only.')).toBeTruthy();
    expect(rpc).not.toHaveBeenCalledWith('admin_club_applications', expect.anything());
  });

  it('loads the pending queue for admins', async () => {
    signInVerifiedForTests({ users: [testUser(TEST_ME, 'Admin', { isSelf: true, role: 'admin' })] });
    useStore.getState().setLocale('en');
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data:
          fn === 'admin_club_applications'
            ? [
                {
                  club_id: 'c9',
                  name: 'Book Club',
                  review_status: 'pending_review',
                  submitted_at: new Date().toISOString(),
                  owner_id: TEST_NEIGHBOR,
                  owner_name: 'Test Resident B',
                  owner_is_adult: true,
                  owner_verified_neighborhood: TEST_NEIGHBORHOOD_ID,
                  neighborhood_id: TEST_NEIGHBORHOOD_ID,
                  neighborhood_name_en: 'Ajyal',
                },
              ]
            : null,
        error: null,
      }),
    );
    await renderScreen(<AdminClubsScreen />);
    expect(await screen.findByText('Book Club')).toBeTruthy();
    expect(rpc).toHaveBeenCalledWith('admin_club_applications', { status_filter: 'pending_review' });
    expect(screen.getByText('Declared 18+')).toBeTruthy();
  });
});
