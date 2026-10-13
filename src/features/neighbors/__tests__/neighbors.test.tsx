import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ar from '@/i18n/ar';
import en from '@/i18n/en';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';
import type { NeighborProfileInfo } from '@/models';
import { TEST_ME, TEST_NEIGHBOR, signInVerifiedForTests } from '@/testing/fixtures';
import { getOrCreateDirectConversation } from '@/backend/actions';
import { mapNeighborSettings } from '@/backend/sync';
import { NeighborButton } from '../NeighborButton';
import NeighborsScreen from '../../../../app/neighbors/index';
import NeighborPrivacyScreen from '../../../../app/settings/neighbors';
import ProfileScreen from '../../../../app/profile/[id]';

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: () => false }),
}));
jest.mock('@/backend/sync', () => ({ ...jest.requireActual('@/backend/sync'), requestSync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
  };
});

const rpc = supabase.rpc as jest.Mock;
const frame = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={frame}>{ui}</SafeAreaProvider>);

const info = (over: Partial<NeighborProfileInfo> = {}): NeighborProfileInfo => ({
  state: 'none',
  incomingRequestId: null,
  acceptsRequests: true,
  neighborCount: null,
  mutualCount: null,
  sharedInterests: [],
  sharedClubs: [],
  canMessage: false,
  ...over,
});

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  mockParams = {};
  mockPush.mockClear();
  signInVerifiedForTests();
  useStore.getState().setLocale('en');
});

describe('terminology', () => {
  it('uses the requested Neighbors wording in both languages', () => {
    expect(en.neighbors.title).toBe('Neighbors');
    expect(ar.neighbors.title).toBe('الجيران');
    expect(en.neighbors.addNeighbor).toBe('Add Neighbor');
    expect(ar.neighbors.addNeighbor).toBe('إضافة جار');
    expect(en.neighbors.requests).toBe('Neighbor Requests');
    expect(ar.neighbors.requests).toBe('طلبات الجيران');
    expect(en.neighbors.myNeighbors).toBe('My Neighbors');
    expect(ar.neighbors.myNeighbors).toBe('جيراني');
    expect(en.neighbors.privacy.discoverable).toBe('Allow neighbors to find me');
    expect(ar.neighbors.privacy.discoverable).toBe('السماح للجيران بالعثور عليّ');
    expect(en.neighbors.meet).toBe('Meet Your Neighbors');
    expect(ar.neighbors.meet).toBe('تعرّف على جيرانك');
    expect(en.neighbors.inviteNeighbors).toBe('Invite Neighbors');
    expect(ar.neighbors.inviteNeighbors).toBe('دعوة الجيران');
    for (const k of ['requestSent', 'cancelRequest', 'accept', 'decline', 'connected', 'removeNeighbor'] as const) {
      expect(en.neighbors[k]).toBeTruthy();
      expect(ar.neighbors[k]).toBeTruthy();
    }
  });

  it('is privacy-first by default: not discoverable until the resident opts in', () => {
    expect(mapNeighborSettings(null)).toEqual({
      discoverable: false,
      allowRequests: true,
      showNeighborCount: false,
      showInterests: true,
      showSharedClubs: false,
      allowNeighborMessages: true,
    });
  });
});

describe('NeighborButton', () => {
  const renderButton = (i: NeighborProfileInfo, onChanged = jest.fn()) =>
    renderScreen(<NeighborButton userId={TEST_NEIGHBOR} name="Test Resident B" info={i} onChanged={onChanged} />);

  it('sends a request from "Add Neighbor" — the server decides, nothing is assumed', async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: 'request_sent', error: null }));
    const onChanged = jest.fn();
    await renderButton(info(), onChanged);
    await fireEvent.press(screen.getByText('Add Neighbor'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('send_neighbor_request', { target: TEST_NEIGHBOR }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows Request Sent with Cancel Request', async () => {
    await renderButton(info({ state: 'request_sent' }));
    expect(screen.getByText('Request Sent')).toBeTruthy();
    await fireEvent.press(screen.getByText('Cancel Request'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('cancel_neighbor_request', { target: TEST_NEIGHBOR }));
  });

  it('accepts only the incoming request by id', async () => {
    await renderButton(info({ state: 'request_received', incomingRequestId: 'req-1' }));
    await fireEvent.press(screen.getByText('Accept'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_neighbor_request', { request: 'req-1', accept: true }));
  });

  it('declines', async () => {
    await renderButton(info({ state: 'request_received', incomingRequestId: 'req-1' }));
    await fireEvent.press(screen.getByText('Decline'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_neighbor_request', { request: 'req-1', accept: false }));
  });

  it('removes a connection only after confirmation', async () => {
    await renderButton(info({ state: 'connected' }));
    await fireEvent.press(screen.getByText('Neighbors ✓'));
    expect(rpc).not.toHaveBeenCalledWith('remove_neighbor', expect.anything());
    await fireEvent.press(screen.getAllByText('Remove Neighbor').slice(-1)[0]);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('remove_neighbor', { target: TEST_NEIGHBOR }));
  });

  it('cannot send to residents who turned requests off', async () => {
    await renderButton(info({ acceptsRequests: false }));
    await fireEvent.press(screen.getByText('Not accepting neighbor requests'));
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('Neighbors page', () => {
  it('lists only what discover_neighbors returns, and invites opt-in when hidden', async () => {
    useStore.setState({ neighborSettings: mapNeighborSettings(null) });
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data:
          fn === 'discover_neighbors'
            ? [{ user_id: TEST_NEIGHBOR, first_name: 'Sara', last_name: 'A', shared_interests: ['padel'], mutual_count: 2, state: 'none' }]
            : null,
        error: null,
      }),
    );
    await renderScreen(<NeighborsScreen />);
    expect(await screen.findByText('Sara A.')).toBeTruthy();
    expect(screen.getByText(/Shared interests: Padel/)).toBeTruthy();
    expect(screen.getByText("You're hidden from discovery")).toBeTruthy();
    await fireEvent.press(screen.getByText('Add Neighbor'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('send_neighbor_request', { target: TEST_NEIGHBOR }));
  });

  it('shows an honest empty state when nobody has opted in', async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: [], error: null }));
    await renderScreen(<NeighborsScreen />);
    expect(await screen.findByText('No discoverable neighbors yet')).toBeTruthy();
  });

  it('accepts an incoming request from the Requests tab', async () => {
    useStore.setState({
      neighborRequests: [
        { id: 'req-9', requesterId: TEST_NEIGHBOR, recipientId: TEST_ME, status: 'pending', createdAt: new Date().toISOString() },
      ],
    });
    mockParams = { tab: 'requests' };
    await renderScreen(<NeighborsScreen />);
    await fireEvent.press(screen.getByText('Accept'));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('respond_neighbor_request', { request: 'req-9', accept: true }));
  });

  it('keeps My Neighbors private to the resident (from their own synced connections)', async () => {
    useStore.setState({ neighborConnections: [{ userId: TEST_NEIGHBOR, since: new Date().toISOString() }] });
    mockParams = { tab: 'mine' };
    await renderScreen(<NeighborsScreen />);
    expect(screen.getByText(/Test Resident B/)).toBeTruthy();
  });
});

describe('Privacy settings', () => {
  it('starts with discovery off and saves the opt-in on the server', async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: { discoverable: true }, error: null }));
    await renderScreen(<NeighborPrivacyScreen />);
    const toggle = screen.getByLabelText('Allow neighbors to find me');
    expect(toggle.props.value).toBe(false);
    await fireEvent(toggle, 'valueChange', true);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('update_neighbor_settings', { p: { discoverable: true } }));
  });
});

describe('Messaging gate on profiles', () => {
  it('hides Message until the neighbors are connected', async () => {
    mockParams = { id: TEST_NEIGHBOR };
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data: fn === 'neighbor_profile' ? { state: 'request_sent', can_message: false, accepts_requests: true } : null,
        error: null,
      }),
    );
    await renderScreen(<ProfileScreen />);
    expect(await screen.findByText('Request Sent')).toBeTruthy();
    expect(screen.queryByText('Message')).toBeNull();
    expect(screen.getByText("You can message this neighbor once you're connected.")).toBeTruthy();
  });

  it('offers Message once connected', async () => {
    mockParams = { id: TEST_NEIGHBOR };
    rpc.mockImplementation((fn: string) =>
      Promise.resolve({
        data: fn === 'neighbor_profile' ? { state: 'connected', can_message: true, accepts_requests: true } : null,
        error: null,
      }),
    );
    await renderScreen(<ProfileScreen />);
    expect(await screen.findByText('Message')).toBeTruthy();
  });

  it('passes the activity/listing context to the server when messaging outside a connection', async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: { id: 'conv-1' }, error: null }));
    await expect(getOrCreateDirectConversation(TEST_NEIGHBOR, { type: 'listing', id: 'listing-1' })).resolves.toBe('conv-1');
    expect(rpc).toHaveBeenCalledWith('start_direct_conversation', {
      other_user_id: TEST_NEIGHBOR,
      context_type: 'listing',
      context_id: 'listing-1',
    });
  });
});
