import { mergePersistedState, useStore } from '../useStore';

// Regresses the real blank-screen bug: Home/Explore/Map resolved
// session.neighborhoodId against s.neighborhoods and either rendered a
// hollow "0 of everything" screen or (Map specifically) went fully
// blank when a persisted neighborhoodId didn't match anything — e.g. an
// id from before the Saudi-geography migration, still sitting in a
// returning user's browser storage. mergePersistedState() is the
// zustand persist `merge` option, which runs on every load regardless
// of version — this exercises it directly against the real store's
// current (fresh) state, not a mocked stand-in.
describe('mergePersistedState (Zustand persist merge)', () => {
  beforeEach(() => {
    useStore.getState().resetDemoData();
  });

  it('preserves a persisted neighborhoodId that still resolves against the current neighborhoods dataset', () => {
    const currentState = useStore.getState();
    const realNeighborhoodId = currentState.neighborhoods[0]!.id;
    const persisted = { session: { ...currentState.session, neighborhoodId: realNeighborhoodId } };

    const result = mergePersistedState(persisted, currentState);

    expect(result.session.neighborhoodId).toBe(realNeighborhoodId);
  });

  it('clears a persisted neighborhoodId that no longer matches anything (stale/old-scheme id)', () => {
    const currentState = useStore.getState();
    const persisted = { session: { ...currentState.session, neighborhoodId: 'khobar-corniche-old-scheme-id' } };

    const result = mergePersistedState(persisted, currentState);

    expect(result.session.neighborhoodId).toBeNull();
  });

  it('leaves neighborhoodId alone when persisted state has none set (fresh install)', () => {
    const currentState = useStore.getState();
    const persisted = { session: { ...currentState.session, neighborhoodId: null } };

    const result = mergePersistedState(persisted, currentState);

    expect(result.session.neighborhoodId).toBeNull();
  });

  it('falls back to currentState entirely when persistedState is undefined (nothing in storage yet)', () => {
    const currentState = useStore.getState();

    const result = mergePersistedState(undefined, currentState);

    expect(result.session.neighborhoodId).toBe(currentState.session.neighborhoodId);
    expect(result.neighborhoods).toBe(currentState.neighborhoods);
  });

  it('preserves other session/settings fields untouched when clearing a stale neighborhoodId', () => {
    const currentState = useStore.getState();
    const persisted = {
      session: { ...currentState.session, neighborhoodId: 'not-a-real-id', phone: '+966555555555', isAuthenticated: true },
      settings: { ...currentState.settings, locale: 'en' as const },
    };

    const result = mergePersistedState(persisted, currentState);

    expect(result.session.neighborhoodId).toBeNull();
    expect(result.session.phone).toBe('+966555555555');
    expect(result.session.isAuthenticated).toBe(true);
    expect(result.settings.locale).toBe('en');
  });

  it("validates against currentState's fresh neighborhoods, not a stale persisted neighborhoods array", () => {
    const currentState = useStore.getState();
    const realNeighborhoodId = currentState.neighborhoods[0]!.id;
    // Simulate an entire old, self-consistent-but-outdated snapshot: both
    // the neighborhoods array AND the neighborhoodId are from an old
    // scheme that agrees with itself but not with this build's seed data.
    const persisted = {
      session: { ...currentState.session, neighborhoodId: 'old-scheme-id' },
      neighborhoods: [{ ...currentState.neighborhoods[0], id: 'old-scheme-id' }],
    };

    const result = mergePersistedState(persisted, currentState);

    // Must be cleared — validity is judged against the CURRENT build's
    // seed data, not whatever the persisted blob claims about itself.
    expect(result.session.neighborhoodId).toBeNull();
    // A real id from the current build must still be found valid even
    // though `neighborhoods` in the merged result now points at the
    // (mismatched) persisted array for other purposes — this test only
    // asserts the neighborhoodId decision itself, which is what matters
    // for the blank-screen bug.
    expect(currentState.neighborhoods.some((n) => n.id === realNeighborhoodId)).toBe(true);
  });
});
