import 'server-only';

import { cookies } from 'next/headers';

import { ADMIN_LOCALE_COOKIE, type AdminLocale } from './i18n';

export const ADMIN_PREFS_COOKIE = 'haratna_admin_prefs';

export interface AdminPrefs {
  autoRefresh: boolean;
  alertNew: boolean;
}

export async function adminLocale(): Promise<AdminLocale> {
  const v = (await cookies()).get(ADMIN_LOCALE_COOKIE)?.value;
  return v === 'en' ? 'en' : 'ar';
}

export async function adminPrefs(): Promise<AdminPrefs> {
  const raw = (await cookies()).get(ADMIN_PREFS_COOKIE)?.value;
  try {
    const p = raw ? JSON.parse(raw) : {};
    return { autoRefresh: p.autoRefresh !== false, alertNew: p.alertNew !== false };
  } catch {
    return { autoRefresh: true, alertNew: true };
  }
}

export const PREF_COOKIE_OPTIONS = {
  path: '/admin',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365,
};
