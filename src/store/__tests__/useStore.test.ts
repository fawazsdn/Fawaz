import { mergePersistedState, useStore } from '@/store/useStore';
import { resetStoreForTests, signInVerifiedForTests, TEST_ME } from '@/testing/fixtures';

beforeEach(() => resetStoreForTests());

describe('store contains no seeded content', () => {
  it('starts with every entity list empty (no demo posts, events, people or messages)', () => {
    const s = useStore.getState();
    for (const key of ['users', 'posts', 'events', 'polls', 'conversations', 'messages', 'notifications', 'marketplaceListings', 'businesses', 'alerts'] as const) {
      expect(s[key]).toEqual([]);
    }
    expect(s.referral.joinedCount).toBeNull();
  });
});

describe('session', () => {
  it('only becomes authenticated with a real Supabase user id', () => {
    useStore.getState().setSupabaseAuth(TEST_ME, 'email', 'a@example.test');
    const { session } = useStore.getState();
    expect(session.isAuthenticated).toBe(true);
    expect(session.supabaseUserId).toBe(TEST_ME);
    expect(session.authProvider).toBe('email');
  });

  it('clears all loaded content when a different account signs in', () => {
    signInVerifiedForTests();
    expect(useStore.getState().users.length).toBeGreaterThan(0);
    useStore.getState().setSupabaseAuth('00000000-0000-4000-8000-0000000000ff', 'email', 'b@example.test');
    expect(useStore.getState().users).toEqual([]);
    expect(useStore.getState().session.neighborhoodId).toBeNull();
  });

  it('sign out clears content and the session but remembers onboarding', () => {
    signInVerifiedForTests();
    useStore.getState().signOut();
    const s = useStore.getState();
    expect(s.session.isAuthenticated).toBe(false);
    expect(s.session.supabaseUserId).toBeNull();
    expect(s.session.onboardingCompleted).toBe(true);
    expect(s.users).toEqual([]);
  });

  it('tracks recently-selected cities, most recent first, deduplicated', () => {
    useStore.getState().addRecentCity('sa-city-31');
    useStore.getState().addRecentCity('sa-city-227');
    useStore.getState().addRecentCity('sa-city-31');
    expect(useStore.getState().recentCityIds).toEqual(['sa-city-31', 'sa-city-227']);
  });
});

describe('mergePersistedState', () => {
  const current = () => useStore.getState();

  it('ignores seeded demo entities persisted by older builds', () => {
    const merged = mergePersistedState({ posts: [{ id: 'p1' }], users: [{ id: 'u1' }], session: {}, settings: {} }, current());
    expect(merged.posts).toEqual([]);
    expect(merged.users).toEqual([]);
  });

  it('drops an old phone/OTP "authenticated" session that has no real Supabase user', () => {
    const merged = mergePersistedState({ session: { isAuthenticated: true, otpVerified: true, phone: '+966500000000', authProvider: 'phone' } }, current());
    expect(merged.session.isAuthenticated).toBe(false);
    expect(merged.session.authProvider).toBeNull();
    expect((merged.session as unknown as Record<string, unknown>).phone).toBeUndefined();
  });

  it('keeps preferences and a real session', () => {
    const merged = mergePersistedState(
      { settings: { locale: 'en', demoRole: 'moderator' }, session: { isAuthenticated: true, supabaseUserId: TEST_ME, authProvider: 'email' } },
      current(),
    );
    expect(merged.settings.locale).toBe('en');
    expect((merged.settings as unknown as Record<string, unknown>).demoRole).toBeUndefined();
    expect(merged.session.supabaseUserId).toBe(TEST_ME);
    expect(merged.session.isAuthenticated).toBe(true);
  });

  it('falls back to current state when nothing is persisted', () => {
    expect(mergePersistedState(undefined, current()).session).toEqual(current().session);
  });
});
