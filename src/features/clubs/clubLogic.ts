import type { Club, ClubCategory, ClubMembership, CommunityEvent } from '@/models';
import { normalizeForSearch } from '@/utils/searchNormalize';

/** Stable ids (community_groups.category check constraint); labels live in t.clubs.categories. */
export const CLUB_CATEGORY_GROUPS = {
  sports: ['running', 'cycling', 'football', 'padel', 'basketball', 'volleyball', 'fitness', 'walking', 'hiking', 'swimming'],
  social: ['coffee', 'community', 'family', 'networking', 'food', 'travel'],
  hobbies: ['photography', 'gaming', 'books', 'chess', 'art', 'music', 'technology', 'cars'],
  community: ['volunteering', 'environment', 'education', 'workshops', 'neighborhood_improvement'],
  custom: ['other'],
} as const satisfies Record<string, readonly ClubCategory[]>;

export type ClubCategoryGroup = keyof typeof CLUB_CATEGORY_GROUPS;
export const ALL_CLUB_CATEGORIES: ClubCategory[] = Object.values(CLUB_CATEGORY_GROUPS).flat();

export const CLUB_ICON: Record<ClubCategory, string> = {
  running: '🏃',
  cycling: '🚴',
  football: '⚽️',
  padel: '🎾',
  basketball: '🏀',
  volleyball: '🏐',
  fitness: '💪',
  walking: '🚶',
  hiking: '🥾',
  swimming: '🏊',
  coffee: '☕️',
  community: '🤝',
  family: '👨‍👩‍👧',
  networking: '💼',
  food: '🍽️',
  travel: '✈️',
  photography: '📷',
  gaming: '🎮',
  books: '📚',
  chess: '♟️',
  art: '🎨',
  music: '🎵',
  technology: '💻',
  cars: '🚗',
  volunteering: '🙌',
  environment: '🌱',
  education: '🎓',
  workshops: '🛠️',
  neighborhood_improvement: '🏘️',
  other: '✨',
};

export function clubCategoryLabel(club: Pick<Club, 'category' | 'customCategory'>, labels: Record<string, string>): string {
  if (club.category === 'other' && club.customCategory) return club.customCategory;
  return labels[club.category] ?? club.category;
}

/**
 * What the signed-in resident is to this club. 'organizer' is the single
 * owner; 'left' and 'rejected' behave like not joined (they may ask again).
 */
export type ClubMemberState = 'not_joined' | 'pending' | 'member' | 'moderator' | 'organizer' | 'removed' | 'banned' | 'rejected';

export function myClubMembership(memberships: ClubMembership[], clubId: string, me: string): ClubMembership | undefined {
  return memberships.find((m) => m.clubId === clubId && m.userId === me);
}

export function clubMemberState(membership: ClubMembership | undefined): ClubMemberState {
  if (!membership) return 'not_joined';
  switch (membership.status) {
    case 'active':
      return membership.role === 'owner' ? 'organizer' : membership.role === 'moderator' ? 'moderator' : 'member';
    case 'pending':
      return 'pending';
    case 'banned':
      return 'banned';
    case 'removed':
      return 'removed';
    case 'rejected':
      return 'rejected';
    default:
      return 'not_joined';
  }
}

export const isActiveMemberState = (s: ClubMemberState) => s === 'member' || s === 'moderator' || s === 'organizer';
export const isManagerState = (s: ClubMemberState) => s === 'moderator' || s === 'organizer';

/** Upcoming, not-cancelled club activities, soonest first. */
export function clubUpcomingEvents(events: CommunityEvent[], clubId: string, now = Date.now()): CommunityEvent[] {
  return events
    .filter((e) => e.clubId === clubId && !e.cancelled && new Date(e.endsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function clubPastEvents(events: CommunityEvent[], clubId: string, now = Date.now()): CommunityEvent[] {
  return events
    .filter((e) => e.clubId === clubId && !e.cancelled && new Date(e.endsAt).getTime() <= now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export type ClubSort = 'popular' | 'newest' | 'active';

function upcomingCount(events: CommunityEvent[], clubId: string, now: number) {
  return clubUpcomingEvents(events, clubId, now).length;
}

export function sortClubs(clubs: Club[], sort: ClubSort, events: CommunityEvent[], now = Date.now()): Club[] {
  const list = [...clubs];
  if (sort === 'newest') return list.sort((a, b) => (b.approvedAt ?? b.createdAt).localeCompare(a.approvedAt ?? a.createdAt));
  if (sort === 'active') {
    return list.sort((a, b) => upcomingCount(events, b.id, now) - upcomingCount(events, a.id, now) || b.memberCount - a.memberCount);
  }
  return list.sort((a, b) => b.memberCount - a.memberCount || upcomingCount(events, b.id, now) - upcomingCount(events, a.id, now));
}

export function searchClubs(clubs: Club[], query: string, labels: Record<string, string>): Club[] {
  const q = normalizeForSearch(query.trim());
  if (!q) return clubs;
  return clubs.filter((c) => [c.name, c.description, clubCategoryLabel(c, labels)].some((v) => normalizeForSearch(v).includes(q)));
}

/** Approved clubs of the resident's neighborhood: the only ones discovery may show. */
export function discoverableClubs(clubs: Club[], neighborhoodId: string | null): Club[] {
  if (!neighborhoodId) return [];
  return clubs.filter((c) => c.neighborhoodId === neighborhoodId && c.reviewStatus === 'approved');
}

const SPORTS = new Set<ClubCategory>(CLUB_CATEGORY_GROUPS.sports);

export interface DiscoverySections {
  featured: Club[];
  popular: Club[];
  newest: Club[];
  sports: Club[];
  social: Club[];
  mine: Club[];
}

/**
 * Discovery sections, built only from real data. "Featured" means clubs that
 * actually have upcoming activities; "Popular" needs real members; "New" is
 * approved in the last 30 days. Empty sections are simply not rendered.
 */
export function discoverySections(
  clubs: Club[],
  events: CommunityEvent[],
  memberships: ClubMembership[],
  me: string,
  now = Date.now(),
): DiscoverySections {
  const mineIds = new Set(memberships.filter((m) => m.userId === me && m.status === 'active').map((m) => m.clubId));
  const featured = sortClubs(
    clubs.filter((c) => upcomingCount(events, c.id, now) > 0),
    'active',
    events,
    now,
  ).slice(0, 5);
  const popular = sortClubs(
    clubs.filter((c) => c.memberCount > 1),
    'popular',
    events,
    now,
  ).slice(0, 10);
  const newest = sortClubs(
    clubs.filter((c) => now - new Date(c.approvedAt ?? c.createdAt).getTime() < 30 * 86400000),
    'newest',
    events,
    now,
  ).slice(0, 10);
  return {
    featured,
    popular,
    newest,
    sports: clubs.filter((c) => SPORTS.has(c.category)),
    social: clubs.filter((c) => !SPORTS.has(c.category)),
    mine: clubs.filter((c) => mineIds.has(c.id)),
  };
}

/** Allowed only in public fields: we nudge organizers away from phone numbers and e-mails. */
export function containsContactInfo(text: string): boolean {
  const t = text.replace(/[\s-]/g, '');
  return /(\+?9665\d{8}|05\d{8}|\d{9,})/.test(t) || /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text);
}

/** Mirrors the server's validate_club_application so residents see problems before submitting. */
export function validateClubApplication(input: {
  name: string;
  description: string;
  category: ClubCategory;
  customCategory?: string;
  purpose: string;
  plannedActivities: string;
  meetingFrequency: string;
  neighborhoodBenefit: string;
  rules: string;
}) {
  const clean = (v?: string) => (v ?? '').replace(/\s+/g, ' ').trim();
  const words = clean(input.neighborhoodBenefit).split(' ').filter(Boolean).length;
  const custom = clean(input.customCategory);
  return {
    name: clean(input.name).length < 3 || clean(input.name).length > 80,
    description: clean(input.description).length < 20,
    customCategory: input.category === 'other' && (custom.length < 1 || custom.length > 40),
    purpose: clean(input.purpose).length < 20,
    plannedActivities: clean(input.plannedActivities).length < 10,
    meetingFrequency: clean(input.meetingFrequency).length === 0,
    neighborhoodBenefit: clean(input.neighborhoodBenefit).length < 40 || words < 6,
    rules: clean(input.rules).length < 10,
  };
}
