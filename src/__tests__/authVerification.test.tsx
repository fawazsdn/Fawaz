import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import VerificationScreen from '../../app/(auth)/verification';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

const mockRequestPermissions = jest.fn();
const mockGetCurrentPosition = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: () => mockRequestPermissions(),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPosition(...args),
  Accuracy: { Balanced: 3 },
}));

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  mockReplace.mockClear();
  mockRequestPermissions.mockReset();
  mockGetCurrentPosition.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: null, error: null });
  useStore.getState().resetDemoData();
  useStore.getState().setLocale('en');
  const realId = useStore.getState().neighborhoods[0]!.id;
  useStore.getState().selectNeighborhood(realId);
});

// This is the real, server-authoritative verification flow: the screen must
// never mark itself verified on its own — only in direct response to
// { status: 'verified' } coming back from the verify_neighborhood_location
// RPC, which is the one place a real point-in-polygon check happens.
describe('Verification screen (real location verification)', () => {
  it('permission is never requested before the button is pressed', async () => {
    await renderWithProvider(<VerificationScreen />);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('success: permission granted, real location fetched, RPC verifies -> shows Verified Resident', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetCurrentPosition.mockResolvedValue({ coords: { latitude: 24.65, longitude: 46.72 } });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'verify_neighborhood_location'
        ? Promise.resolve({ data: { status: 'verified' }, error: null })
        : Promise.resolve({ data: null, error: null }),
    );

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() => expect(screen.getByText('✓ Verified Resident')).toBeTruthy());
    expect(useStore.getState().session.verification).toBe('verified');
  });

  it('outside boundary: RPC says outside_boundary -> shows the exact required copy, not verified', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetCurrentPosition.mockResolvedValue({ coords: { latitude: 10, longitude: 10 } });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'verify_neighborhood_location'
        ? Promise.resolve({ data: { status: 'outside_boundary' }, error: null })
        : Promise.resolve({ data: null, error: null }),
    );

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() =>
      expect(
        screen.getByText("It looks like you're currently outside this neighborhood. Try again when you're in the neighborhood."),
      ).toBeTruthy(),
    );
    expect(useStore.getState().session.verification).not.toBe('verified');
  });

  it('permission denied (can ask again): shows explanation with a Try Again action, never crashes', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied', canAskAgain: true });

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() => expect(screen.getByText('Location permission needed')).toBeTruthy());
    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('permission permanently denied: shows Open Settings instead of Try Again', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied', canAskAgain: false });

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() => expect(screen.getByText('Open Settings')).toBeTruthy());
  });

  it('GPS/location unavailable: getCurrentPositionAsync rejects -> shows retry state, never silently verifies', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetCurrentPosition.mockRejectedValue(new Error('timeout'));

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() => expect(screen.getByText("Couldn't get your location")).toBeTruthy());
    expect(useStore.getState().session.verification).not.toBe('verified');
  });

  it('boundary unavailable: RPC says boundary_unavailable -> neighborhood stays selectable, user can continue', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetCurrentPosition.mockResolvedValue({ coords: { latitude: 24.65, longitude: 46.72 } });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'verify_neighborhood_location'
        ? Promise.resolve({ data: { status: 'boundary_unavailable' }, error: null })
        : Promise.resolve({ data: null, error: null }),
    );

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() => expect(screen.getByText('Location verification is not yet available for this neighborhood')).toBeTruthy());
    expect(screen.getByText('Continue to the app')).toBeTruthy();
  });

  it('never sends a client-side verified flag: the RPC call carries only the neighborhood id and coordinates', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'granted', canAskAgain: true });
    mockGetCurrentPosition.mockResolvedValue({ coords: { latitude: 24.65, longitude: 46.72 } });
    mockRpc.mockImplementation((fn: string) =>
      fn === 'verify_neighborhood_location'
        ? Promise.resolve({ data: { status: 'verified' }, error: null })
        : Promise.resolve({ data: null, error: null }),
    );

    await renderWithProvider(<VerificationScreen />);
    fireEvent.press(screen.getByText('Verify with Location'));

    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('verify_neighborhood_location', expect.any(Object)));
    const call = mockRpc.mock.calls.find((c) => c[0] === 'verify_neighborhood_location')!;
    const args = call[1] as Record<string, unknown>;
    expect(Object.keys(args).sort()).toEqual(['p_lat', 'p_lng', 'p_neighborhood_id']);
  });
});
