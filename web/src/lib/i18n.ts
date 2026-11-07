export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const dirOf = (locale: Locale) => (locale === 'ar' ? 'rtl' : 'ltr');
export const otherLocale = (locale: Locale): Locale => (locale === 'ar' ? 'en' : 'ar');

/** Public pages, in the order they appear in the sitemap. '' is the home page. */
export const PAGES = ['', 'support', 'faq', 'contact', 'privacy', 'terms', 'guidelines', 'delete-account'] as const;
export type Page = (typeof PAGES)[number];

export const pathFor = (locale: Locale, page: Page | string = '') => (page ? `/${locale}/${page}` : `/${locale}`);
