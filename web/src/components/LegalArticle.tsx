import Link from 'next/link';

import type { Dictionary } from '@/content/dictionary';
import { pathFor, type Locale } from '@/lib/i18n';
import { LEGAL_UPDATED, legalDoc, type LegalDocKey } from '@/lib/legal';
import { PageHeader } from './PageHeader';

const slug = (i: number) => `section-${i + 1}`;

/** Renders one of the shared legal documents, with a table of contents for long ones. */
export function LegalArticle({
  doc,
  locale,
  t,
  children,
}: {
  doc: LegalDocKey;
  locale: Locale;
  t: Dictionary;
  children?: React.ReactNode;
}) {
  const { title, sections } = legalDoc(doc, locale);
  const headed = sections.map((s, i) => ({ ...s, i })).filter((s) => s.h);
  const date = new Date(`${LEGAL_UPDATED}T00:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <>
      <PageHeader title={title}>
        <p className="mt-4 text-sm text-[var(--muted)]">
          {t.legal.updated}: <time dateTime={LEGAL_UPDATED}>{date}</time>
        </p>
      </PageHeader>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[16rem_1fr]">
        {headed.length > 3 ? (
          <nav aria-label={t.legal.contents} className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-bold text-[var(--muted)]">{t.legal.contents}</p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {headed.map((s) => (
                <li key={s.i}>
                  <a href={`#${slug(s.i)}`} className="text-[var(--muted)] underline-offset-4 hover:text-[var(--fg)] hover:underline">
                    {s.h}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <div className="hidden lg:block" />
        )}
        <article className="prose-legal max-w-3xl">
          {sections.map((s, i) => (
            <section key={i} aria-labelledby={s.h ? slug(i) : undefined}>
              {s.h ? <h2 id={slug(i)}>{s.h}</h2> : null}
              {s.p?.map((p, j) => (
                <p key={j}>{p}</p>
              ))}
              {s.li ? (
                <ul>
                  {s.li.map((x, j) => (
                    <li key={j}>{x}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          {children}
          <div className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
            <p className="font-bold">{t.legal.questions}</p>
            <Link
              href={pathFor(locale, 'contact')}
              className="mt-2 inline-block font-semibold text-[var(--link)] underline underline-offset-4"
            >
              {t.legal.contact}
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
