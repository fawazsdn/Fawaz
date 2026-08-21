import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import HomeScreen from '../../app/(tabs)/index';
import DiscoverScreen from '../../app/(tabs)/discover';
import MapScreen from '../../app/(tabs)/map';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

// react-native-gesture-handler isn't available in this test environment
// (see jest.setup.js), which BottomSheet depends on for its drag-to-close
// gesture — HomeHeader's neighborhood switcher and Map's pin-detail sheet
// both use it, irrelevant to the blank-screen regression under test here.
// Same mock as src/__tests__/selectLocationFlow.test.tsx.
jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
  };
});

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  useStore.getState().resetDemoData();
  useStore.getState().setLocale('en');
});

// Regresses the reported bug: Home, Explore, and Map each rendered a
// permanently blank content area (tab bar still visible) whenever they
// mounted with no resolvable neighborhood — a direct URL open or a web
// refresh on one of these tabs skips app/index.tsx's splash-redirect
// guard entirely (that only runs when the app boots through "/"), and a
// stale persisted neighborhoodId from an older build hits the same case.
// These screens used a bare `return null`; they now show
// <NoNeighborhoodState /> instead.
describe('Home / Explore / Map do not render blank when a neighborhood is selected', () => {
  beforeEach(() => {
    const realId = useStore.getState().neighborhoods[0]!.id;
    useStore.getState().selectNeighborhood(realId);
  });

  it('Home renders real, visible primary content (greeting, Quick Actions)', async () => {
    await renderWithProvider(<HomeScreen />);
    await waitFor(() => expect(screen.getByText('Ask neighbors')).toBeTruthy());
    expect(screen.getByText('Create event')).toBeTruthy();
    expect(screen.getByText('Report issue')).toBeTruthy();
    expect(screen.queryByText(/couldn.t load your neighborhood/i)).toBeNull();
  });

  it('Explore renders real, visible primary content (search + category grid)', async () => {
    await renderWithProvider(<DiscoverScreen />);
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
    expect(screen.getAllByText('Events').length).toBeGreaterThan(0);
    expect(screen.getByText('Marketplace')).toBeTruthy();
    expect(screen.queryByText(/couldn.t load your neighborhood/i)).toBeNull();
  });

  it('Map renders real, visible primary content (search, filters, placeholder)', async () => {
    await renderWithProvider(<MapScreen />);
    expect(screen.getByPlaceholderText(/search the map/i)).toBeTruthy();
    expect(screen.queryByText(/couldn.t load your neighborhood/i)).toBeNull();
  });
});

describe('Home / Explore / Map show a recovery screen (not blank) when no neighborhood resolves', () => {
  beforeEach(() => {
    useStore.setState((s) => ({ session: { ...s.session, neighborhoodId: null } }));
  });

  it('Home shows the recovery screen, not a blank content area', async () => {
    await renderWithProvider(<HomeScreen />);
    expect(screen.getByText(/couldn.t load your neighborhood/i)).toBeTruthy();
    expect(screen.getByText('Choose your neighborhood')).toBeTruthy();
    expect(screen.queryByText('Ask neighbors')).toBeNull();
  });

  it('Explore shows the recovery screen, not a blank content area', async () => {
    await renderWithProvider(<DiscoverScreen />);
    expect(screen.getByText(/couldn.t load your neighborhood/i)).toBeTruthy();
    expect(screen.getByText('Choose your neighborhood')).toBeTruthy();
  });

  it('Map shows the recovery screen, not a blank content area', async () => {
    await renderWithProvider(<MapScreen />);
    expect(screen.getByText(/couldn.t load your neighborhood/i)).toBeTruthy();
    expect(screen.getByText('Choose your neighborhood')).toBeTruthy();
  });

  it('Home also recovers from a stale neighborhoodId that no longer resolves (not just a missing one)', async () => {
    useStore.setState((s) => ({ session: { ...s.session, neighborhoodId: 'old-scheme-id-that-does-not-exist' } }));
    await renderWithProvider(<HomeScreen />);
    expect(screen.getByText(/couldn.t load your neighborhood/i)).toBeTruthy();
  });
});
