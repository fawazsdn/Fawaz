import ar from '@/i18n/ar';
import en from '@/i18n/en';
import type { CommunityEvent } from '@/models';
import { TEST_ME, TEST_NEIGHBOR, TEST_NEIGHBORHOOD_ID, testClub, testMembership } from '@/testing/fixtures';
import {
  ALL_CLUB_CATEGORIES,
  CLUB_ICON,
  clubCategoryLabel,
  clubMemberState,
  clubUpcomingEvents,
  containsContactInfo,
  discoverableClubs,
  discoverySections,
  isActiveMemberState,
  isManagerState,
  searchClubs,
  sortClubs,
  validateClubApplication,
} from '../clubLogic';

// Mirrors community_groups_category_check in supabase/migrations/20261013100000_clubs.sql.
const DB_CLUB_CATEGORIES = [
  'running',
  'cycling',
  'football',
  'padel',
  'basketball',
  'volleyball',
  'fitness',
  'walking',
  'hiking',
  'swimming',
  'coffee',
  'community',
  'family',
  'networking',
  'food',
  'travel',
  'photography',
  'gaming',
  'books',
  'chess',
  'art',
  'music',
  'technology',
  'cars',
  'volunteering',
  'environment',
  'education',
  'workshops',
  'neighborhood_improvement',
  'other',
];

const NOW = new Date('2026-10-13T09:00:00Z').getTime();

function ev(id: string, clubId: string | undefined, startsAt: string, extra: Partial<CommunityEvent> = {}): CommunityEvent {
  return {
    id,
    kind: 'activity',
    title: id,
    category: 'running',
    description: '',
    hostId: TEST_NEIGHBOR,
    neighborhoodId: TEST_NEIGHBORHOOD_ID,
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString(),
    locationLabel: 'Park',
    capacity: 10,
    audience: 'neighborhood',
    recurring: false,
    recurrence: 'none',
    membersOnly: false,
    clubId,
    attendees: [],
    ...extra,
  };
}

describe('club categories & translations', () => {
  it('match the database constraint exactly', () => {
    expect([...ALL_CLUB_CATEGORIES].sort()).toEqual([...DB_CLUB_CATEGORIES].sort());
  });

  it('every category has an icon and a label in both languages', () => {
    for (const c of ALL_CLUB_CATEGORIES) {
      expect(CLUB_ICON[c]).toBeTruthy();
      expect((en.clubs.categories as Record<string, string>)[c]).toBeTruthy();
      expect((ar.clubs.categories as Record<string, string>)[c]).toBeTruthy();
    }
  });

  it('uses the exact requested wording', () => {
    expect(en.clubs.title).toBe('Clubs');
    expect(ar.clubs.title).toBe('الأندية');
    expect(en.clubs.createClub).toBe('Create Club');
    expect(ar.clubs.createClub).toBe('إنشاء نادٍ');
    expect(en.clubs.joinClub).toBe('Join Club');
    expect(ar.clubs.joinClub).toBe('انضم للنادي');
    expect(en.clubs.myClubs).toBe('My Clubs');
    expect(ar.clubs.myClubs).toBe('أنديتي');
    expect(en.clubs.members).toBe('Club Members');
    expect(ar.clubs.members).toBe('أعضاء النادي');
    expect(en.clubs.upcomingActivities).toBe('Upcoming Activities');
    expect(ar.clubs.upcomingActivities).toBe('الفعاليات القادمة');
    expect(en.clubs.emptyTitle).toBe('No clubs in your neighborhood yet.\nBe the first to create one!');
    expect(ar.clubs.emptyTitle).toBe('لا توجد أندية في حيك حتى الآن.\nكن أول من ينشئ نادياً!');
    expect(en.clubs.fields.benefit).toBe('How will this club benefit your neighborhood?');
    expect(ar.clubs.fields.benefit).toBe('كيف سيفيد هذا النادي سكان الحي؟');
    expect(en.clubs.submittedBody).toBe(
      'Your club application has been submitted!\nOur team will review it before it becomes available to your neighborhood.',
    );
    expect(ar.clubs.submittedBody).toBe('تم إرسال طلب إنشاء النادي بنجاح!\nسيقوم فريق حارتنا بمراجعته قبل ظهوره لسكان الحي.');
  });

  it('has an eight-item review checklist in both languages', () => {
    expect(en.clubs.admin.checklist).toHaveLength(8);
    expect(ar.clubs.admin.checklist).toHaveLength(8);
  });

  it('labels "other" clubs with their custom category', () => {
    const labels = en.clubs.categories as Record<string, string>;
    expect(clubCategoryLabel({ category: 'other', customCategory: 'Falconry' }, labels)).toBe('Falconry');
    expect(clubCategoryLabel({ category: 'chess' }, labels)).toBe('Chess');
  });
});

describe('membership state', () => {
  it('maps every server status/role', () => {
    expect(clubMemberState(undefined)).toBe('not_joined');
    expect(clubMemberState(testMembership('c', TEST_ME, { status: 'pending' }))).toBe('pending');
    expect(clubMemberState(testMembership('c', TEST_ME))).toBe('member');
    expect(clubMemberState(testMembership('c', TEST_ME, { role: 'moderator' }))).toBe('moderator');
    expect(clubMemberState(testMembership('c', TEST_ME, { role: 'owner' }))).toBe('organizer');
    expect(clubMemberState(testMembership('c', TEST_ME, { status: 'removed' }))).toBe('removed');
    expect(clubMemberState(testMembership('c', TEST_ME, { status: 'banned' }))).toBe('banned');
    expect(clubMemberState(testMembership('c', TEST_ME, { status: 'rejected' }))).toBe('rejected');
    expect(clubMemberState(testMembership('c', TEST_ME, { status: 'left' }))).toBe('not_joined');
  });

  it('only active members count as members, only organizers/moderators as managers', () => {
    expect(isActiveMemberState('member')).toBe(true);
    expect(isActiveMemberState('pending')).toBe(false);
    expect(isActiveMemberState('banned')).toBe(false);
    expect(isManagerState('moderator')).toBe(true);
    expect(isManagerState('organizer')).toBe(true);
    expect(isManagerState('member')).toBe(false);
  });
});

describe('discovery', () => {
  const approved = testClub('a', { memberCount: 5 });
  const pending = testClub('p', { reviewStatus: 'pending_review', ownerId: TEST_ME });
  const rejected = testClub('r', { reviewStatus: 'rejected' });
  const suspended = testClub('s', { reviewStatus: 'suspended' });
  const otherNeighborhood = testClub('o', { neighborhoodId: 'sa-district-10500227005' });

  it('shows only approved clubs of the resident’s own neighborhood', () => {
    const list = discoverableClubs([approved, pending, rejected, suspended, otherNeighborhood], TEST_NEIGHBORHOOD_ID);
    expect(list.map((c) => c.id)).toEqual(['a']);
    expect(discoverableClubs([approved], null)).toEqual([]);
  });

  it('builds sections from real data only and leaves the rest empty', () => {
    const empty = discoverySections([], [], [], TEST_ME, NOW);
    expect(Object.values(empty).every((s) => s.length === 0)).toBe(true);

    const solo = testClub('solo', { memberCount: 1, approvedAt: '2026-01-01T00:00:00Z' });
    const s = discoverySections([solo], [], [], TEST_ME, NOW);
    expect(s.featured).toEqual([]); // no upcoming activities
    expect(s.popular).toEqual([]); // only the organizer is a member
    expect(s.newest).toEqual([]); // approved long ago
  });

  it('features clubs with real upcoming activities and lists my clubs', () => {
    const club = testClub('x', { memberCount: 3, category: 'chess' });
    const sections = discoverySections([club], [ev('e1', 'x', '2026-10-20T16:00:00Z')], [testMembership('x', TEST_ME)], TEST_ME, NOW);
    expect(sections.featured.map((c) => c.id)).toEqual(['x']);
    expect(sections.mine.map((c) => c.id)).toEqual(['x']);
    expect(sections.social.map((c) => c.id)).toEqual(['x']);
    expect(sections.sports).toEqual([]);
  });

  it('sorts by popularity, newest and activity', () => {
    const a = testClub('a', { memberCount: 2, approvedAt: '2026-10-01T00:00:00Z' });
    const b = testClub('b', { memberCount: 9, approvedAt: '2026-09-01T00:00:00Z' });
    const events = [ev('1', 'a', '2026-10-20T16:00:00Z'), ev('2', 'a', '2026-10-27T16:00:00Z')];
    expect(sortClubs([a, b], 'popular', events, NOW).map((c) => c.id)).toEqual(['b', 'a']);
    expect(sortClubs([a, b], 'newest', events, NOW).map((c) => c.id)).toEqual(['a', 'b']);
    expect(sortClubs([a, b], 'active', events, NOW).map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('searches names, descriptions and category labels (Arabic spelling variants too)', () => {
    const labels = ar.clubs.categories as Record<string, string>;
    const chess = testClub('c', { name: 'نادي الشطرنج', category: 'chess', description: 'لعب أسبوعي في مركز الحي' });
    const runners = testClub('r', { name: 'Morning Runners' });
    expect(searchClubs([chess, runners], 'شطرنج', labels).map((c) => c.id)).toEqual(['c']);
    expect(searchClubs([chess, runners], 'نادى', labels).map((c) => c.id)).toEqual(['c']);
    expect(searchClubs([chess, runners], 'runners', labels).map((c) => c.id)).toEqual(['r']);
    expect(searchClubs([chess, runners], '  ', labels)).toHaveLength(2);
  });

  it('lists upcoming club activities only, without cancelled ones', () => {
    const events = [
      ev('past', 'x', '2026-10-01T16:00:00Z'),
      ev('soon', 'x', '2026-10-14T16:00:00Z'),
      ev('cancelled', 'x', '2026-10-15T16:00:00Z', { cancelled: true }),
      ev('other', 'y', '2026-10-14T16:00:00Z'),
    ];
    expect(clubUpcomingEvents(events, 'x', NOW).map((e) => e.id)).toEqual(['soon']);
  });
});

describe('application validation (mirrors the server)', () => {
  const valid = {
    name: 'Morning Runners',
    description: 'Easy group runs around the park for all levels.',
    category: 'running' as const,
    purpose: 'Help neighbors stay active and meet each other.',
    plannedActivities: 'Weekly 5km runs',
    meetingFrequency: 'weekly',
    neighborhoodBenefit: 'Neighbors meet regularly, exercise together and make the park livelier.',
    rules: 'Be kind and punctual.',
  };

  it('accepts a complete application', () => {
    expect(Object.values(validateClubApplication(valid)).some(Boolean)).toBe(false);
  });

  it('requires a meaningful neighborhood-benefit answer', () => {
    expect(validateClubApplication({ ...valid, neighborhoodBenefit: 'good' }).neighborhoodBenefit).toBe(true);
    expect(
      validateClubApplication({ ...valid, neighborhoodBenefit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }).neighborhoodBenefit,
    ).toBe(true);
  });

  it('requires a custom category of 1–40 characters for "other"', () => {
    expect(validateClubApplication({ ...valid, category: 'other', customCategory: '   ' }).customCategory).toBe(true);
    expect(validateClubApplication({ ...valid, category: 'other', customCategory: 'x'.repeat(41) }).customCategory).toBe(true);
    expect(validateClubApplication({ ...valid, category: 'other', customCategory: 'Falconry' }).customCategory).toBe(false);
  });

  it('flags phone numbers and e-mails in public fields', () => {
    expect(containsContactInfo('Call 0551234567')).toBe(true);
    expect(containsContactInfo('+966 55 123 4567')).toBe(true);
    expect(containsContactInfo('mail me: a.b@example.com')).toBe(true);
    expect(containsContactInfo('We meet at 7 PM near gate 3')).toBe(false);
  });
});
