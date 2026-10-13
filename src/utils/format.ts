import type { Locale } from '@/models';

/**
 * Haratna is a Saudi neighborhood app: every event/activity time is shown in
 * the neighborhood's own time zone (Asia/Riyadh), never the phone's — a
 * resident travelling abroad still sees "the match is at 8:00 PM" in local
 * neighborhood time. Saudi Arabia observes no DST, so Asia/Riyadh is a fixed
 * UTC+3 and can be computed exactly without depending on the device's Intl
 * time-zone data (which varies across iOS/Hermes builds).
 *
 * Timestamps are always stored as UTC ISO strings in Supabase; these helpers
 * only change how they're displayed, never the instant they represent.
 */
export const SAUDI_UTC_OFFSET_MINUTES = 180;

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function localizeDigits(input: string | number, locale: Locale): string {
  const s = String(input);
  return locale === 'ar' ? s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]) : s;
}

/** Wall-clock parts of an instant in Asia/Riyadh. */
export function saudiParts(iso: string | Date) {
  const ms = (typeof iso === 'string' ? new Date(iso) : iso).getTime() + SAUDI_UTC_OFFSET_MINUTES * 60000;
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

/** Builds the UTC instant for a wall-clock time in Asia/Riyadh. */
export function saudiWallTimeToDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - SAUDI_UTC_OFFSET_MINUTES * 60000);
}

/** 12-hour clock: "4:00 PM" / "٤:٠٠ م". */
export function formatClockParts(hour24: number, minute: number, locale: Locale): string {
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const mm = String(minute).padStart(2, '0');
  if (locale === 'ar') return `${localizeDigits(`${h12}:${mm}`, 'ar')} ${hour24 < 12 ? 'ص' : 'م'}`;
  return `${h12}:${mm} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

export function formatClock(iso: string, locale: Locale): string {
  const p = saudiParts(iso);
  return formatClockParts(p.hour, p.minute, locale);
}

/** "4:00 – 5:30 PM" style range (both ends in Riyadh time). */
export function formatTimeRange(startIso: string, endIso: string, locale: Locale): string {
  return `${formatClock(startIso, locale)} – ${formatClock(endIso, locale)}`;
}

const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AR_WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function weekdayName(weekday: number, locale: Locale, short = false): string {
  const name = (locale === 'ar' ? AR_WEEKDAYS : EN_WEEKDAYS)[weekday] ?? '';
  return short && locale === 'en' ? name.slice(0, 3) : name;
}

/** "Thursday, 12 October" / "الخميس، ١٢ أكتوبر" (Gregorian, Riyadh date). */
export function formatDay(iso: string, locale: Locale): string {
  const p = saudiParts(iso);
  if (locale === 'ar') return `${AR_WEEKDAYS[p.weekday]}، ${localizeDigits(p.day, 'ar')} ${AR_MONTHS[p.month]}`;
  return `${EN_WEEKDAYS[p.weekday]}, ${p.day} ${EN_MONTHS[p.month]}`;
}

/** "12 October 1990" / "١٢ أكتوبر ١٩٩٠" (Riyadh date, with year). */
export function formatFullDate(iso: string, locale: Locale): string {
  const p = saudiParts(iso);
  if (locale === 'ar') return `${localizeDigits(p.day, 'ar')} ${AR_MONTHS[p.month]} ${localizeDigits(p.year, 'ar')}`;
  return `${p.day} ${EN_MONTHS[p.month]} ${p.year}`;
}

/** "1990-10-12" for the Riyadh calendar date of an instant. */
export function saudiIsoDate(d: Date): string {
  const p = saudiParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "12 Oct" / "١٢ أكتوبر". */
export function formatShortDate(iso: string, locale: Locale): string {
  const p = saudiParts(iso);
  if (locale === 'ar') return `${localizeDigits(p.day, 'ar')} ${AR_MONTHS[p.month]}`;
  return `${p.day} ${EN_MONTHS[p.month].slice(0, 3)}`;
}

/** Same Riyadh calendar day? */
export function isSameSaudiDay(a: string | Date, b: string | Date): boolean {
  const pa = saudiParts(a);
  const pb = saudiParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function formatSAR(amount: number, locale: Locale): string {
  const num = locale === 'ar' ? amount.toLocaleString('ar-SA') : amount.toLocaleString('en-US');
  return locale === 'ar' ? `${num} ر.س` : `SAR ${num}`;
}

export function formatDistance(meters: number, locale: Locale): string {
  if (meters < 1000) {
    return locale === 'ar' ? `${Math.round(meters)} م` : `${Math.round(meters)} m`;
  }
  const km = (meters / 1000).toFixed(1);
  return locale === 'ar' ? `${km} كم` : `${km} km`;
}

export function formatRelativeTime(iso: string, locale: Locale): string {
  const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (locale === 'en') {
    if (diffSec < 60) return 'now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
    if (diffSec < 31536000) return `${Math.floor(diffSec / 2592000)}mo ago`;
    return `${Math.floor(diffSec / 31536000)}y ago`;
  }
  if (diffSec < 60) return 'الآن';
  if (diffSec < 3600) return `قبل ${Math.floor(diffSec / 60)} د`;
  if (diffSec < 86400) return `قبل ${Math.floor(diffSec / 3600)} س`;
  if (diffSec < 2592000) return `قبل ${Math.floor(diffSec / 86400)} ي`;
  if (diffSec < 31536000) return `قبل ${Math.floor(diffSec / 2592000)} ش`;
  return `قبل ${Math.floor(diffSec / 31536000)} سنة`;
}

/** Time remaining until a future instant, e.g. poll close: "3h" / "٣ س". */
export function formatTimeUntil(iso: string, locale: Locale): string {
  const sec = Math.max(0, (new Date(iso).getTime() - Date.now()) / 1000);
  const [n, en, ar] =
    sec < 3600
      ? [Math.max(1, Math.floor(sec / 60)), 'm', 'د']
      : sec < 86400
        ? [Math.floor(sec / 3600), 'h', 'س']
        : [Math.floor(sec / 86400), 'd', 'ي'];
  return locale === 'ar' ? `${localizeDigits(n, 'ar')} ${ar}` : `${n}${en}`;
}

export function displayName(user: {
  firstName: string;
  lastName: string;
  namePrivacy: 'full' | 'first_last_initial' | 'first_only';
}): string {
  switch (user.namePrivacy) {
    case 'full':
      return `${user.firstName} ${user.lastName}`.trim();
    case 'first_last_initial':
      return `${user.firstName} ${user.lastName ? user.lastName[0] + '.' : ''}`.trim();
    case 'first_only':
    default:
      return user.firstName;
  }
}
