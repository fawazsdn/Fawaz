import type { Locale } from '@/models';

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

const AR_UNITS: [number, string, string][] = [
  [60, 'الآن', 'الآن'],
  [3600, 'د', 'دقيقة'],
  [86400, 'س', 'ساعة'],
  [2592000, 'ي', 'يوم'],
  [31536000, 'ش', 'شهر'],
];

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

export function formatClock(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDay(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatShortDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' });
}

export function displayName(
  user: { firstName: string; lastName: string; namePrivacy: 'full' | 'first_last_initial' | 'first_only' },
): string {
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
