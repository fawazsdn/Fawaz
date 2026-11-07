import { Phone, Smartphone } from 'lucide-react';

import { Icon } from '@/components/Icon';
import { PageHeader } from '@/components/PageHeader';
import { SupportForm } from '@/components/SupportForm';
import { SupportSearch } from '@/components/SupportSearch';
import { getDictionary } from '@/content/dictionary';
import { FAQ, FAQ_CATEGORY_LABELS, type FaqCategory } from '@/content/faq';
import type { Locale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/support'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, 'support', t.supportPage.metaTitle, t.supportPage.metaDescription);
}

export default async function SupportPage({ params }: PageProps<'/[locale]/support'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const s = t.supportPage;
  const items = FAQ[locale];
  const present = new Set(items.map((i) => i.category));

  return (
    <>
      <PageHeader title={s.title} lead={s.lead} />

      <section aria-labelledby="topics-title" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <h2 id="topics-title" className="text-2xl font-extrabold">
          {s.topicsTitle}
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.topics.map((topic) => {
            const anchor = present.has(topic.id as FaqCategory) ? `#topic-${topic.id}` : '#contact-form';
            return (
              <li key={topic.id}>
                <a
                  href={anchor}
                  className="flex h-full gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-md"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-white/10 dark:text-[var(--color-gold-400)]">
                    <Icon name={topic.icon} />
                  </span>
                  <span>
                    <span className="block font-extrabold">{topic.title}</span>
                    <span className="mt-1 block text-sm text-[var(--muted)]">{topic.body}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-4 pt-14 sm:px-6">
        <SupportSearch
          items={items}
          labels={FAQ_CATEGORY_LABELS[locale]}
          searchLabel={s.searchLabel}
          placeholder={s.searchPlaceholder}
          noResults={s.noResults}
          resultsLabel={s.results}
        />
      </section>

      <section id="contact-form" aria-labelledby="form-title" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-16 sm:px-6">
        <h2 id="form-title" className="text-2xl font-extrabold">
          {s.formTitle}
        </h2>
        <p className="mt-2 text-[var(--muted)]">{s.formLead}</p>
        <div className="mt-6">
          <SupportForm locale={locale} t={t} />
        </div>
        <div className="mt-6 space-y-3 text-sm text-[var(--muted)]">
          <p className="flex gap-2">
            <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {s.inApp}
          </p>
          <p className="flex gap-2">
            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {s.emergency}
          </p>
        </div>
      </section>
    </>
  );
}
