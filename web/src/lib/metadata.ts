import type { Metadata } from 'next';

import { LOCALES, pathFor, type Locale } from './i18n';
import { isLaunchReady, siteUrl } from './site';

/** Title, description, canonical URL, hreflang alternates and Open Graph for one page. */
export function pageMetadata(locale: Locale, page: string, title: string, description: string): Metadata {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = pathFor(l, page);
  languages['x-default'] = pathFor('ar', page);
  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    alternates: { canonical: pathFor(locale, page), languages },
    openGraph: {
      type: 'website',
      siteName: locale === 'ar' ? 'حارتنا' : 'Haratna',
      title,
      description,
      url: pathFor(locale, page),
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? ['en_US'] : ['ar_SA'],
      images: [{ url: `/og/${locale}.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [`/og/${locale}.png`] },
    robots: isLaunchReady() ? { index: true, follow: true } : { index: false, follow: false },
  };
}
