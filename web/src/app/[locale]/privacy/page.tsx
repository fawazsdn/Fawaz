import { LegalArticle } from '@/components/LegalArticle';
import { getDictionary } from '@/content/dictionary';
import type { Locale } from '@/lib/i18n';
import { legalDoc } from '@/lib/legal';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, 'privacy', `${legalDoc('privacy', locale).title} | ${t.brand}`, t.meta.privacy);
}

export default async function Page({ params }: PageProps<'/[locale]/privacy'>) {
  const locale = (await params).locale as Locale;
  return <LegalArticle doc="privacy" locale={locale} t={getDictionary(locale)} />;
}
