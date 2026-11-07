import Image from 'next/image';
import Link from 'next/link';
import { Apple, ArrowLeft, ArrowRight, LifeBuoy } from 'lucide-react';

import { FaqList } from '@/components/FaqList';
import { Icon } from '@/components/Icon';
import { Crenellation, NajdiPattern } from '@/components/Pattern';
import { getDictionary } from '@/content/dictionary';
import { FAQ, HOME_FAQ_IDS } from '@/content/faq';
import { pathFor, type Locale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/metadata';
import { siteUrl } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/[locale]'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, '', t.home.metaTitle, t.home.metaDescription);
}

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const h = t.home;
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;
  const faq = FAQ[locale].filter((q) => HOME_FAQ_IDS.includes(q.id));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: t.brand,
        alternateName: locale === 'ar' ? 'Haratna' : 'حارتنا',
        url: siteUrl(),
        logo: `${siteUrl()}/brand/icon-512.png`,
      },
      { '@type': 'WebSite', name: t.brand, url: `${siteUrl()}${pathFor(locale)}`, inLanguage: locale },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <NajdiPattern className="absolute inset-0 h-full w-full text-[var(--color-brand-700)] opacity-[0.05] dark:text-[var(--color-gold-400)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:py-24">
          <div className="fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-sm font-semibold text-[var(--muted)]">
              <span className="size-2 rounded-full bg-[var(--color-sage-500)]" aria-hidden="true" />
              {h.eyebrow}
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.15] tracking-tight text-[var(--color-brand-700)] sm:text-6xl dark:text-[var(--color-gold-400)]">
              {h.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-[var(--muted)] sm:text-xl">{h.lead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* Not a store badge or link: the app is not published yet. */}
              <span className="inline-flex items-center gap-2.5 rounded-2xl bg-[var(--color-brand-900)] px-5 py-3 font-bold text-[var(--color-sand-100)] ring-1 ring-[var(--color-gold-400)]/40">
                <Apple className="size-5" aria-hidden="true" />
                {h.soon}
              </span>
              <Link
                href={pathFor(locale, 'support')}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3 font-bold transition-colors hover:border-[var(--accent)]"
              >
                <LifeBuoy className="size-5" aria-hidden="true" />
                {h.ctaSupport}
              </Link>
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{h.soonNote}</p>
          </div>

          <div className="relative mx-auto w-full max-w-sm fade-up" aria-hidden="true">
            <div className="absolute -inset-6 rounded-[3rem] bg-[var(--color-gold-400)]/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.5rem] bg-[var(--color-brand-700)] p-8 text-[var(--color-sand-100)] shadow-2xl">
              <NajdiPattern className="absolute inset-0 h-full w-full text-[var(--color-sand-100)] opacity-[0.08]" />
              <div className="relative flex flex-col items-center text-center">
                <Image
                  src="/brand/icon-512.png"
                  alt=""
                  width={112}
                  height={112}
                  className="rounded-[1.75rem] shadow-lg ring-4 ring-white/10"
                  priority
                />
                <p className="mt-6 text-3xl font-extrabold">{t.brand}</p>
                <p className="mt-1 font-bold text-[var(--color-gold-400)]">{t.tagline}</p>
                <Crenellation className="mt-6 h-2.5 w-40 text-[var(--color-gold-400)]/70" />
                <ul className="mt-6 grid w-full grid-cols-2 gap-2 text-sm">
                  {h.features.slice(0, 6).map((f) => (
                    <li key={f.title} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-start">
                      <Icon name={f.icon} className="size-4 shrink-0 text-[var(--color-gold-400)]" />
                      <span className="truncate">{f.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 id="features-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {h.featuresTitle}
            </h2>
            <p className="mt-3 text-lg text-[var(--muted)]">{h.featuresLead}</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {h.features.map((f) => (
              <li
                key={f.title}
                className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 transition-shadow hover:shadow-md"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-white/10 dark:text-[var(--color-gold-400)]">
                  <Icon name={f.icon} />
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
                <p className="mt-2 text-[15px] text-[var(--muted)]">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-[var(--surface-2)] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="how-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {h.howTitle}
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {h.steps.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
                <span
                  className="flex size-10 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-extrabold text-[var(--accent-fg)]"
                  aria-hidden="true"
                >
                  {(i + 1).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                </span>
                <h3 className="mt-4 text-lg font-extrabold">{s.title}</h3>
                <p className="mt-2 text-[15px] text-[var(--muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety and privacy */}
      <section id="safety" aria-labelledby="safety-title" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-[2rem] bg-[var(--color-brand-700)] text-[var(--color-sand-100)]">
            <div className="relative p-8 sm:p-12">
              <NajdiPattern className="absolute inset-0 h-full w-full text-[var(--color-sand-100)] opacity-[0.06]" />
              <div className="relative">
                <h2 id="safety-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {h.safetyTitle}
                </h2>
                <p className="mt-3 max-w-2xl text-lg text-[var(--color-sand-200)]">{h.safetyLead}</p>
                <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  {h.safety.map((s) => (
                    <li key={s.title} className="flex gap-3">
                      <Icon name="shield" className="mt-1 size-5 shrink-0 text-[var(--color-gold-400)]" />
                      <div>
                        <h3 className="font-extrabold">{s.title}</h3>
                        <p className="mt-1 text-[15px] text-[var(--color-sand-200)]">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href={pathFor(locale, 'privacy')}
                  className="mt-10 inline-flex items-center gap-2 font-bold text-[var(--color-gold-400)] underline-offset-4 hover:underline"
                >
                  {t.footer.privacy}
                  <Arrow className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ preview */}
      <section aria-labelledby="faq-title" className="py-4">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="faq-title" className="text-3xl font-extrabold tracking-tight">
              {h.faqTitle}
            </h2>
            <Link
              href={pathFor(locale, 'faq')}
              className="inline-flex items-center gap-1 font-bold text-[var(--link)] underline-offset-4 hover:underline"
            >
              {h.faqAll}
              <Arrow className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-6">
            <FaqList items={faq} />
          </div>
        </div>
      </section>

      {/* Support CTA */}
      <section aria-labelledby="help-title" className="pt-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 id="help-title" className="text-3xl font-extrabold tracking-tight">
            {h.supportTitle}
          </h2>
          <p className="mt-3 text-lg text-[var(--muted)]">{h.supportBody}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={pathFor(locale, 'support')}
              className="rounded-full bg-[var(--accent)] px-6 py-3 font-bold text-[var(--accent-fg)] hover:opacity-90"
            >
              {t.nav.support}
            </Link>
            <Link
              href={pathFor(locale, 'contact')}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-6 py-3 font-bold hover:border-[var(--accent)]"
            >
              {t.nav.contact}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
