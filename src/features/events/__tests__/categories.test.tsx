import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import ar from '@/i18n/ar';
import en from '@/i18n/en';
import type { EventCategory } from '@/models';
import { useStore } from '@/store/useStore';
import { CategoryPicker } from '../CategoryPicker';
import {
  ALL_EVENT_CATEGORIES,
  CATEGORY_ICON,
  EVENT_CATEGORY_GROUPS,
  POPULAR_EVENT_CATEGORIES,
  eventCategoryLabel,
  normalizeCustomCategory,
} from '../categories';

// Mirrors the events_category_check constraint in
// supabase/migrations/20261013100000_clubs.sql — the app must never offer an
// id the database would reject.
const DB_CATEGORIES = [
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
  'coffee',
  'family',
  'kids',
  'community',
  'food',
  'networking',
  'gaming',
  'movies',
  'arts',
  'entertainment',
  'celebrations',
  'cleanup',
  'volunteering',
  'education',
  'markets',
  'religious',
  'outdoors',
  'pets',
  'iftar',
  'other',
];

describe('activity categories', () => {
  it('match the database constraint exactly, with no duplicates', () => {
    expect([...ALL_EVENT_CATEGORIES].sort()).toEqual([...DB_CATEGORIES].sort());
    expect(new Set(ALL_EVENT_CATEGORIES).size).toBe(ALL_EVENT_CATEGORIES.length);
  });

  it('keeps every category from before the expansion', () => {
    for (const c of ['football', 'padel', 'walking', 'cleanup', 'coffee', 'iftar', 'kids', 'family', 'community']) {
      expect(ALL_EVENT_CATEGORIES).toContain(c);
    }
  });

  it('has an icon and both translations for every id', () => {
    for (const c of ALL_EVENT_CATEGORIES) {
      expect(CATEGORY_ICON[c]).toBeTruthy();
      expect((en.eventCreate.categories as Record<string, string>)[c]).toBeTruthy();
      expect((ar.eventCreate.categories as Record<string, string>)[c]).toBeTruthy();
    }
    for (const g of Object.keys(EVENT_CATEGORY_GROUPS)) {
      expect((en.eventCreate.categoryGroups as Record<string, string>)[g]).toBeTruthy();
      expect((ar.eventCreate.categoryGroups as Record<string, string>)[g]).toBeTruthy();
    }
  });

  it('shows about nine popular categories including Other', () => {
    expect(POPULAR_EVENT_CATEGORIES.length).toBe(9);
    expect(POPULAR_EVENT_CATEGORIES).toContain('other');
  });

  it('uses the exact placeholders requested for the Other field', () => {
    expect(en.eventCreate.customCategoryPlaceholder).toBe('Enter your activity category...');
    expect(ar.eventCreate.customCategoryPlaceholder).toBe('اكتب نوع الفعالية...');
  });

  it('normalizes custom categories: trims, collapses spaces, rejects empty and over 40 chars', () => {
    expect(normalizeCustomCategory('  Board   games  ')).toBe('Board games');
    expect(normalizeCustomCategory('   ')).toBeNull();
    expect(normalizeCustomCategory('')).toBeNull();
    expect(normalizeCustomCategory(undefined)).toBeNull();
    expect(normalizeCustomCategory('x'.repeat(40))).toBe('x'.repeat(40));
    expect(normalizeCustomCategory('x'.repeat(41))).toBeNull();
  });

  it('labels "other" with the resident’s own text and others with the translation', () => {
    const labels = en.eventCreate.categories as Record<string, string>;
    expect(eventCategoryLabel({ category: 'other', customCategory: 'Board games' }, labels)).toBe('Board games');
    expect(eventCategoryLabel({ category: 'other' }, labels)).toBe('Other');
    expect(eventCategoryLabel({ category: 'padel', customCategory: 'ignored' }, labels)).toBe('Padel');
  });
});

function Harness({ initial = 'football' as EventCategory, initialCustom = '' }) {
  const [value, setValue] = useState<EventCategory>(initial);
  const [custom, setCustom] = useState(initialCustom);
  return <CategoryPicker value={value} onChange={setValue} customValue={custom} onCustomChange={setCustom} />;
}

describe('CategoryPicker', () => {
  beforeEach(() => useStore.getState().setLocale('en'));

  it('shows popular chips first and every group after "Show more"', async () => {
    await render(<Harness />);
    expect(screen.getByLabelText('⚽️ Football')).toBeTruthy();
    expect(screen.queryByLabelText('🏊 Swimming')).toBeNull();
    await fireEvent.press(screen.getByText('Show more'));
    expect(screen.getByLabelText('🏊 Swimming')).toBeTruthy();
    expect(screen.getByText('Sports')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show less'));
    expect(screen.queryByLabelText('🏊 Swimming')).toBeNull();
  });

  it('reveals the Other text field only while Other is selected, and caps it at 40 characters', async () => {
    await render(<Harness />);
    expect(screen.queryByTestId('custom-category-input')).toBeNull();
    await fireEvent.press(screen.getByLabelText('✨ Other'));
    const input = screen.getByTestId('custom-category-input');
    expect(input.props.placeholder).toBe('Enter your activity category...');
    await fireEvent.changeText(input, 'y'.repeat(60));
    expect(screen.getByTestId('custom-category-input').props.value).toHaveLength(40);
    await fireEvent.press(screen.getByLabelText('⚽️ Football'));
    expect(screen.queryByTestId('custom-category-input')).toBeNull();
  });

  it('opens expanded and keeps the custom text when editing an "other" activity', async () => {
    await render(<Harness initial="other" initialCustom="Board games" />);
    expect(screen.getByTestId('custom-category-input').props.value).toBe('Board games');
  });

  it('opens expanded when editing a non-popular category', async () => {
    await render(<Harness initial="swimming" />);
    expect(screen.getByLabelText('🏊 Swimming').props.accessibilityState.selected).toBe(true);
  });
});
