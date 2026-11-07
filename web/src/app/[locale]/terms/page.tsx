import { LegalArticle } from '@/components/LegalArticle';
import { getDictionary } from '@/content/dictionary';
import type { Locale } from '@/lib/i18n';
import { legalDoc } from '@/lib/legal';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/terms'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, 'terms', `${legalDoc('terms', locale).title} | ${t.brand}`, t.meta.terms);
}

export default async function Page({ params }: PageProps<'/[locale]/terms'>) {
  const locale = (await params).locale as Locale;
  return <LegalArticle doc="terms" locale={locale} t={getDictionary(locale)} />;
}
