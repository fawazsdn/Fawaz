import Link from 'next/link';

import { FaqList } from '@/components/FaqList';
import { PageHeader } from '@/components/PageHeader';
import { getDictionary } from '@/content/dictionary';
import { FAQ, FAQ_CATEGORY_LABELS, type FaqCategory } from '@/content/faq';
import { pathFor, type Locale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/faq'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, 'faq', t.faqPage.metaTitle, t.faqPage.metaDescription);
}

export default async function FaqPage({ params }: PageProps<'/[locale]/faq'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const items = FAQ[locale];
  const labels = FAQ_CATEGORY_LABELS[locale];
  const categories = [...new Set(items.map((i) => i.category))] as FaqCategory[];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale,
    mainEntity: items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a.join(' ') } })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader title={t.faqPage.title} lead={t.faqPage.lead}>
        <nav aria-label={t.faqPage.title} className="mt-6 flex flex-wrap gap-2">
          {categories.map((c) => (
            <a
              key={c}
              href={`#cat-${c}`}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)]"
            >
              {labels[c]}
            </a>
          ))}
        </nav>
      </PageHeader>
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-6">
        {categories.map((c) => (
          <section key={c} id={`cat-${c}`} aria-labelledby={`h-${c}`} className="scroll-mt-24">
            <h2 id={`h-${c}`} className="mb-4 text-2xl font-extrabold">
              {labels[c]}
            </h2>
            <FaqList items={items.filter((i) => i.category === c)} />
          </section>
        ))}
        <p className="text-center text-[var(--muted)]">
          {t.home.supportBody}{' '}
          <Link href={pathFor(locale, 'support')} className="font-bold text-[var(--link)] underline underline-offset-4">
            {t.nav.support}
          </Link>
        </p>
      </div>
    </>
  );
}
