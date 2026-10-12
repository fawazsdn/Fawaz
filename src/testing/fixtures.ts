/**
 * TEST-ONLY fixtures. Imported exclusively by *.test.ts(x) files — never by
 * app code — so none of this can reach a production bundle (verified by the
 * productionBundleHasNoFixtures test). Names are deliberately obviously
 * synthetic ("Test Resident A") so they can't be mistaken for real people.
 */
import { emptyEntities, useStore } from '@/store/useStore';
import type { CommunityEvent, Conversation, Message, Neighborhood, Poll, Post, User } from '@/models';

export const TEST_ME = '00000000-0000-4000-8000-000000000001';
export const TEST_NEIGHBOR = '00000000-0000-4000-8000-000000000002';
export const TEST_NEIGHBORHOOD_ID = 'sa-district-10500227013'; // Ajyal, Dhahran (real dataset id)

export function testUser(id: string, firstName: string, extra: Partial<User> = {}): User {
  return {
    id,
    firstName,
    lastName: 'Test',
    namePrivacy: 'first_last_initial',
    neighborhoodId: TEST_NEIGHBORHOOD_ID,
    verification: 'verified',
    role: 'resident',
    memberSince: '2026-01-01T00:00:00Z',
    reputationPoints: 0,
    reputationTier: 'new_neighbor',
    stats: { neighborsHelped: 0, eventsHosted: 0, thanksReceived: 0 },
    ...extra,
  };
}

export const testNeighborhood: Neighborhood = {
  id: TEST_NEIGHBORHOOD_ID,
  cityId: 'sa-city-227',
  regionId: 'sa-region-5',
  nameAr: 'أجيال',
  nameEn: 'Ajyal',
  centerLat: 26.2504,
  centerLng: 50.0595,
  hasBoundary: true,
  residentsCount: 2,
  eventsThisWeek: 0,
  openIssues: 0,
  helpfulActions: 0,
};

/** Resets the store to a clean signed-out state (what a fresh install looks like). */
export function resetStoreForTests() {
  useStore.setState({
    ...emptyEntities(),
    settings: {
      locale: 'ar',
      themeMode: 'system',
      ramadanMode: false,
      notificationsEnabled: true,
      whoCanMessage: 'neighbors',
      activityVisible: true,
    },
    session: {
      onboardingCompleted: false,
      profileCreated: false,
      regionId: null,
      cityId: null,
      neighborhoodId: null,
      verification: 'not_started',
      isAuthenticated: false,
      supabaseUserId: null,
      authProvider: null,
      email: null,
    },
    sync: { status: 'idle', lastSyncedAt: null, error: null },
    searchHistory: [],
    recentCityIds: [],
    referral: { invitesSent: 0, joinedCount: null },
  });
}

/** A signed-in, verified resident of Ajyal with optional entities. */
export function signInVerifiedForTests(
  extra: {
    posts?: Post[];
    events?: CommunityEvent[];
    polls?: Poll[];
    conversations?: Conversation[];
    messages?: Message[];
    users?: User[];
  } = {},
) {
  resetStoreForTests();
  useStore.setState((s) => ({
    session: {
      ...s.session,
      onboardingCompleted: true,
      profileCreated: true,
      isAuthenticated: true,
      supabaseUserId: TEST_ME,
      authProvider: 'email',
      email: 'resident.a@example.test',
      regionId: 'sa-region-5',
      cityId: 'sa-city-227',
      neighborhoodId: TEST_NEIGHBORHOOD_ID,
      verification: 'verified',
    },
    sync: { status: 'ready', lastSyncedAt: new Date().toISOString(), error: null },
    neighborhoods: [testNeighborhood],
    users: extra.users ?? [testUser(TEST_ME, 'Test Resident A', { isSelf: true }), testUser(TEST_NEIGHBOR, 'Test Resident B')],
    posts: extra.posts ?? [],
    events: extra.events ?? [],
    polls: extra.polls ?? [],
    conversations: extra.conversations ?? [],
    messages: extra.messages ?? [],
  }));
}
