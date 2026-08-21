import { useStore } from '@/store/useStore';

beforeEach(() => {
  useStore.getState().resetDemoData();
});

describe('onboarding location session state', () => {
  it('clears a previously-selected neighborhood when the city changes (invalid-state guard)', () => {
    useStore.getState().selectCity({ regionId: 'sa-region-5', cityId: 'sa-city-31' }); // Khobar
    useStore.getState().selectNeighborhood('sa-district-10500031009'); // Al Aqrabiyah, in Khobar
    expect(useStore.getState().session.neighborhoodId).toBe('sa-district-10500031009');

    // Switching city must drop the stale neighborhood selection — a
    // neighborhood from the old city must never remain selected once the
    // city changes underneath it.
    useStore.getState().selectCity({ regionId: 'sa-region-1', cityId: 'sa-city-3' }); // Riyadh
    expect(useStore.getState().session.cityId).toBe('sa-city-3');
    expect(useStore.getState().session.regionId).toBe('sa-region-1');
    expect(useStore.getState().session.neighborhoodId).toBeNull();
  });

  it('tracks recently-selected cities, most recent first, deduplicated, capped', () => {
    useStore.getState().addRecentCity('sa-city-31');
    useStore.getState().addRecentCity('sa-city-3');
    useStore.getState().addRecentCity('sa-city-31'); // re-selecting moves it back to front
    expect(useStore.getState().recentCityIds).toEqual(['sa-city-31', 'sa-city-3']);
  });

  it('stores a neighborhood suggestion locally without promoting it to an official location', () => {
    const before = useStore.getState().neighborhoodSuggestions.length;
    const suggestion = useStore.getState().submitNeighborhoodSuggestion({
      regionId: 'sa-region-5',
      cityId: 'sa-city-31',
      neighborhoodNameAr: 'حي تجريبي',
      submittedByUserId: 'u1',
    });
    const state = useStore.getState();
    expect(state.neighborhoodSuggestions.length).toBe(before + 1);
    expect(suggestion.status).toBe('pending');
    // Never auto-appears as a real, selectable neighborhood.
    expect(state.neighborhoods.some((n) => n.nameAr === 'حي تجريبي')).toBe(false);
  });
});
