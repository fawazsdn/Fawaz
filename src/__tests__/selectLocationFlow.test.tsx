import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import SelectCityScreen from '../../app/(auth)/select-city';
import SelectNeighborhoodScreen from '../../app/(auth)/select-neighborhood';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

// react-native-gesture-handler isn't available in this test environment
// (see jest.setup.js), which BottomSheet depends on for its drag-to-close
// gesture — irrelevant to the location-picking flow under test here.
jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

const insetsFrame = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  useStore.getState().resetDemoData();
  mockPush.mockClear();
});

// Full Region -> City -> Neighborhood -> Continue onboarding flow, exercised
// against the real Saudi geography dataset (not a mocked/sample list). Split
// across focused cases (rather than one long one) so each test mounts a
// single screen — carrying the selected region/city across steps via the
// store, exactly as the real navigation between routes would.
describe('select location onboarding flow (UI)', () => {
  it('region step -> city step: drilling into a region and picking a city', async () => {
    await renderWithProvider(<SelectCityScreen />);

    // Region step: the Eastern Province is one of the 13 real regions.
    const easternProvinceRow = await screen.findByText('المنطقة الشرقية', { exact: false });
    fireEvent.press(easternProvinceRow);

    // City step: search within the region (it has ~230 cities, so the
    // target isn't guaranteed to be in the FlatList's initial render
    // window without narrowing it first) then pick Khobar.
    const regionSearch = await screen.findByPlaceholderText('ابحث عن مدينة أو حي...');
    fireEvent.changeText(regionSearch, 'الخبر');
    const khobarRow = await screen.findByText('الخبر');
    fireEvent.press(khobarRow);

    expect(useStore.getState().session.cityId).toBe('sa-city-31');
    expect(useStore.getState().session.regionId).toBe('sa-region-5');
    expect(mockPush).toHaveBeenCalledWith('/(auth)/select-neighborhood');
  });

  it('neighborhood step -> continue: picking a neighborhood in the selected city', async () => {
    // Arrives on this screen exactly as real navigation would: the city
    // step already set regionId/cityId in the store.
    useStore.getState().selectCity({ regionId: 'sa-region-5', cityId: 'sa-city-31' }); // Khobar

    await renderWithProvider(<SelectNeighborhoodScreen />);

    const neighborhoodRow = await screen.findByText('حي العقربية');
    fireEvent.press(neighborhoodRow);

    expect(useStore.getState().session.neighborhoodId).toBe('sa-district-10500031009');
    expect(mockPush).toHaveBeenCalledWith('/(auth)/verification');
  });

  it('surfaces national-scope search results directly from the city step', async () => {
    await renderWithProvider(<SelectCityScreen />);
    const search = await screen.findByPlaceholderText('ابحث عن مدينة أو حي...');

    await act(async () => {
      fireEvent.changeText(search, 'العقربية');
      await new Promise((r) => setTimeout(r, 250)); // debounce
    });

    const hit = await waitFor(() => screen.getByText('حي العقربية'));
    fireEvent.press(hit);

    // Selecting a neighborhood result directly sets city+region and the
    // neighborhood, skipping straight to verification.
    expect(useStore.getState().session.cityId).toBe('sa-city-31');
    expect(useStore.getState().session.neighborhoodId).toBe('sa-district-10500031009');
    expect(mockPush).toHaveBeenCalledWith('/(auth)/verification');
  });
});
