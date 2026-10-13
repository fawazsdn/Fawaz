import type { CommunityEvent, EventCategory } from '@/models';

/**
 * Activity categories. IDs are stable and stored in Supabase
 * (events.category check constraint); labels come from i18n
 * (t.eventCreate.categories). 'other' carries a resident-typed label in
 * events.custom_category. Occasions (Ramadan, Eid…) are a separate field.
 */
export const EVENT_CATEGORY_GROUPS = {
  sports: [
    'football',
    'padel',
    'basketball',
    'volleyball',
    'running',
    'walking',
    'cycling',
    'fitness',
    'hiking',
    'swimming',
    'tournaments',
  ],
  social: ['coffee', 'family', 'kids', 'community', 'food', 'networking'],
  entertainment: ['gaming', 'movies', 'arts', 'entertainment', 'celebrations'],
  communityCauses: ['cleanup', 'volunteering', 'education', 'markets', 'religious', 'outdoors', 'pets', 'iftar'],
  custom: ['other'],
} as const satisfies Record<string, readonly EventCategory[]>;

export type EventCategoryGroup = keyof typeof EVENT_CATEGORY_GROUPS;

export const ALL_EVENT_CATEGORIES: EventCategory[] = Object.values(EVENT_CATEGORY_GROUPS).flat();

/** Shown before "Show more" — the categories residents pick most. */
export const POPULAR_EVENT_CATEGORIES: EventCategory[] = [
  'football',
  'padel',
  'walking',
  'running',
  'coffee',
  'family',
  'kids',
  'cleanup',
  'other',
];

export const CUSTOM_CATEGORY_MAX = 40;

export const CATEGORY_ICON: Record<EventCategory, string> = {
  football: '⚽️',
  padel: '🎾',
  basketball: '🏀',
  volleyball: '🏐',
  running: '🏃',
  walking: '🚶',
  cycling: '🚴',
  fitness: '💪',
  hiking: '🥾',
  swimming: '🏊',
  tournaments: '🏆',
  coffee: '☕️',
  family: '👨‍👩‍👧',
  kids: '🧒',
  community: '🤝',
  food: '🍽️',
  networking: '💼',
  gaming: '🎮',
  movies: '🎬',
  arts: '🎨',
  entertainment: '🎭',
  celebrations: '🎉',
  cleanup: '🧹',
  volunteering: '🙌',
  education: '📚',
  markets: '🛍️',
  religious: '🕌',
  outdoors: '🏕️',
  pets: '🐾',
  iftar: '🌙',
  other: '✨',
};

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && (ALL_EVENT_CATEGORIES as string[]).includes(value);
}

/** Trims and collapses whitespace. Returns null when empty or too long. */
export function normalizeCustomCategory(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!v || v.length > CUSTOM_CATEGORY_MAX) return null;
  return v;
}

/** The label to show for an event: the resident's own text for "other". */
export function eventCategoryLabel(event: Pick<CommunityEvent, 'category' | 'customCategory'>, labels: Record<string, string>): string {
  if (event.category === 'other' && event.customCategory) return event.customCategory;
  return labels[event.category] ?? event.category;
}

export function eventCategoryBadge(event: Pick<CommunityEvent, 'category' | 'customCategory'>, labels: Record<string, string>): string {
  return `${CATEGORY_ICON[event.category] ?? '📍'} ${eventCategoryLabel(event, labels)}`;
}
