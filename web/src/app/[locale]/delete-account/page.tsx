import Link from 'next/link';

import { LegalArticle } from '@/components/LegalArticle';
import { getDictionary } from '@/content/dictionary';
import { pathFor, type Locale } from '@/lib/i18n';
import { legalDoc } from '@/lib/legal';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/delete-account'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, 'delete-account', `${legalDoc('deletion', locale).title} | ${t.brand}`, t.deletion.metaDescription);
}

/** Supplements, and does not replace, the in-app deletion that App Review requires. */
export default async function Page({ params }: PageProps<'/[locale]/delete-account'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return (
    <LegalArticle doc="deletion" locale={locale} t={t}>
      <div className="mt-10 rounded-2xl border border-[var(--color-gold-400)] bg-[var(--surface)] p-6">
        <p>{t.deletion.help}</p>
        <Link
          href={`${pathFor(locale, 'support')}?topic=deletion#contact-form`}
          className="mt-4 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-[var(--accent-fg)] no-underline hover:opacity-90"
        >
          {t.deletion.request}
        </Link>
      </div>
    </LegalArticle>
  );
}
