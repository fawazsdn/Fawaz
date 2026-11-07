import type { MetadataRoute } from 'next';

import { LOCALES, PAGES, pathFor } from '@/lib/i18n';
import { LEGAL_UPDATED } from '@/lib/legal';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${base}${pathFor(locale, page)}`,
      lastModified: new Date(`${LEGAL_UPDATED}T00:00:00Z`),
      changeFrequency: 'monthly' as const,
      priority: page === '' ? 1 : page === 'support' ? 0.9 : 0.6,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}${pathFor(l, page)}`])) },
    })),
  );
}
