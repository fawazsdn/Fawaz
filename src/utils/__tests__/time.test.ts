import { formatClock, formatDay, formatShortDate, formatTimeRange, isSameSaudiDay, saudiParts, saudiWallTimeToDate } from '@/utils/format';
import { combineEnd } from '../../../app/event/create';

describe('12-hour Saudi time formatting', () => {
  it.each([
    ['2026-10-12T13:00:00Z', '4:00 PM'],
    ['2026-10-12T15:00:00Z', '6:00 PM'],
    ['2026-10-12T16:00:00Z', '7:00 PM'],
    ['2026-10-12T17:00:00Z', '8:00 PM'],
    ['2026-10-12T18:00:00Z', '9:00 PM'],
    ['2026-10-12T21:00:00Z', '12:00 AM'],
    ['2026-10-12T09:00:00Z', '12:00 PM'],
    ['2026-10-12T05:05:00Z', '8:05 AM'],
  ])('%s → %s (never 24-hour)', (iso, expected) => {
    expect(formatClock(iso, 'en')).toBe(expected);
  });

  it('uses localized Arabic 12-hour format with ص/م', () => {
    expect(formatClock('2026-10-12T16:00:00Z', 'ar')).toBe('٧:٠٠ م');
    expect(formatClock('2026-10-12T05:30:00Z', 'ar')).toBe('٨:٣٠ ص');
  });

  it('shows Saudi time regardless of the device time zone, without changing the stored instant', () => {
    const iso = '2026-10-12T16:00:00.000Z';
    const p = saudiParts(iso);
    expect([p.hour, p.minute]).toEqual([19, 0]);
    expect(saudiWallTimeToDate(p.year, p.month, p.day, p.hour, p.minute).toISOString()).toBe(iso);
  });

  it('formats ranges and Gregorian dates', () => {
    expect(formatTimeRange('2026-10-12T16:00:00Z', '2026-10-12T17:30:00Z', 'en')).toBe('7:00 PM – 8:30 PM');
    expect(formatDay('2026-10-12T16:00:00Z', 'en')).toBe('Monday, 12 October');
    expect(formatShortDate('2026-10-12T16:00:00Z', 'ar')).toBe('١٢ أكتوبر');
  });

  it('treats Saudi calendar days correctly across UTC midnight', () => {
    // 22:30 UTC on the 12th is 1:30 AM on the 13th in Riyadh.
    expect(isSameSaudiDay('2026-10-12T22:30:00Z', '2026-10-13T09:00:00Z')).toBe(true);
    expect(isSameSaudiDay('2026-10-12T20:30:00Z', '2026-10-13T09:00:00Z')).toBe(false);
  });

  it('activity end time rolls past midnight instead of ending before it starts', () => {
    const start = saudiWallTimeToDate(2026, 9, 12, 23, 0);
    const endTime = saudiWallTimeToDate(2026, 9, 12, 1, 0);
    const end = combineEnd(start, endTime);
    expect(end.getTime() - start.getTime()).toBe(2 * 3600000);
  });
});
