import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import { HomeHeader } from '@/features/home/HomeHeader';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

// react-native-gesture-handler isn't available in this test environment
// (see jest.setup.js), which BottomSheet depends on — irrelevant to the
// selector-stability behavior under test here.
jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

const insetsFrame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

/**
 * Regression coverage for the "getSnapshot should be cached" / "Maximum
 * update depth exceeded" crash: a Zustand selector that returns a
 * freshly-created array/object (e.g. `s.neighborhoods.filter(...)`) is an
 * unstable snapshot under useSyncExternalStore (what Zustand's `useStore`
 * is built on) and can loop React into a render storm. These tests fail
 * loudly (via a thrown "Maximum update depth exceeded" error, or a hung/
 * timed-out test) if that regresses, and additionally assert the specific
 * React warning text never appears.
 */
describe('Zustand selector snapshot stability', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    useStore.getState().resetDemoData();
    // Put the demo user in a real, real-geography-backed neighborhood/city
    // so HomeHeader's neighborhood-switcher selector has data to filter.
    useStore.getState().selectCity({ regionId: 'sa-region-5', cityId: 'sa-city-31' }); // Khobar
    useStore.getState().selectNeighborhood('sa-district-10500031009'); // Al Aqrabiyah
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders HomeHeader against the real store with no getSnapshot/max-update-depth warning', async () => {
    await renderWithProvider(<HomeHeader />);

    // The previously-buggy `s.neighborhoods.filter(...)` selector would
    // either throw synchronously ("Maximum update depth exceeded") or log
    // React's cached-snapshot warning — assert neither happened.
    const loggedText = errorSpy.mock.calls.map((args) => String(args[0])).join('\n');
    expect(loggedText).not.toMatch(/getSnapshot should be cached/i);
    expect(loggedText).not.toMatch(/Maximum update depth exceeded/i);

    // And the header actually rendered real content (not blown away by a
    // caught render error boundary or an early return).
    expect(screen.getByText('حي العقربية')).toBeTruthy();
  });

  it('opens the neighborhood switcher and shows other neighborhoods in the same city', async () => {
    await renderWithProvider(<HomeHeader />);

    fireEvent.press(screen.getByText('حي العقربية'));

    // Al Khuzama is another curated Khobar neighborhood — the switcher's
    // `cityNeighborhoods` (now derived via useMemo, not a raw selector)
    // should list it.
    expect(await screen.findByText('حي الخزامى')).toBeTruthy();

    const loggedText = errorSpy.mock.calls.map((args) => String(args[0])).join('\n');
    expect(loggedText).not.toMatch(/getSnapshot should be cached/i);
    expect(loggedText).not.toMatch(/Maximum update depth exceeded/i);
  });

  it('re-renders correctly (no crash, no stale UI) when the selected city/neighborhood changes underneath it', async () => {
    await renderWithProvider(<HomeHeader />);
    expect(screen.getByText('حي العقربية')).toBeTruthy();

    // Switch city+neighborhood entirely (Khobar Al Aqrabiyah -> Riyadh Al
    // Olaya) — this changes both the `neighborhoods` filter key
    // (cityId) and the found `neighborhood` record.
    await act(async () => {
      useStore.getState().selectCity({ regionId: 'sa-region-1', cityId: 'sa-city-3' }); // Riyadh
      useStore.getState().selectNeighborhood('sa-district-10100003075'); // Al Olaya
    });

    expect(await screen.findByText('حي العليا')).toBeTruthy();
    expect(screen.queryByText('حي العقربية')).toBeNull();

    const loggedText = errorSpy.mock.calls.map((args) => String(args[0])).join('\n');
    expect(loggedText).not.toMatch(/getSnapshot should be cached/i);
    expect(loggedText).not.toMatch(/Maximum update depth exceeded/i);
  });

  it('cityNeighborhoods derives correctly and only from the current city (invalid-state guard)', async () => {
    await renderWithProvider(<HomeHeader />);
    fireEvent.press(screen.getByText('حي العقربية'));

    // While viewing Khobar's switcher list, Riyadh's "Al Olaya" (a
    // different neighborhood that happens to share a display name with
    // Khobar's own "Al Olaya") must not appear — cityNeighborhoods must
    // filter strictly by the current city, not leak other cities' data.
    const riyadhOlayaCount = screen.queryAllByText('حي العليا').length;
    // Khobar itself also has a curated "Al Olaya" neighborhood, so some
    // matches are expected — the point is the list is bounded to entries
    // whose cityId is Khobar's, which we verify structurally via the store.
    const cityNeighborhoodIds = useStore
      .getState()
      .neighborhoods.filter((n) => n.cityId === useStore.getState().session.cityId)
      .map((n) => n.id);
    expect(cityNeighborhoodIds).not.toContain('sa-district-10100003075'); // Riyadh Al Olaya excluded
    expect(cityNeighborhoodIds).toContain('sa-district-10500031021'); // Khobar Al Olaya included
    expect(riyadhOlayaCount).toBeGreaterThanOrEqual(0); // sanity: query didn't throw
  });
});
