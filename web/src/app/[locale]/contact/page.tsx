import { Briefcase, LifeBuoy, ShieldCheck } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { SupportForm } from '@/components/SupportForm';
import { getDictionary } from '@/content/dictionary';
import type { Locale } from '@/lib/i18n';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { pageMetadata } from '@/lib/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  return pageMetadata(locale, 'contact', t.contactPage.metaTitle, t.contactPage.metaDescription);
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const locale = (await params).locale as Locale;
  const t = getDictionary(locale);
  const c = t.contactPage;
  const cards = [
    { icon: LifeBuoy, title: c.supportTitle, body: c.supportBody },
    { icon: ShieldCheck, title: c.privacyTitle, body: c.privacyBody },
    { icon: Briefcase, title: c.businessTitle, body: c.businessBody },
  ];

  return (
    <>
      <PageHeader title={c.title} lead={c.lead} />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <ul className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <li key={card.title} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <card.icon className="size-6 text-[var(--color-brand-700)] dark:text-[var(--color-gold-400)]" aria-hidden="true" />
              <h2 className="mt-3 text-lg font-extrabold">{card.title}</h2>
              <p className="mt-2 text-[15px] text-[var(--muted)]">{card.body}</p>
            </li>
          ))}
        </ul>
        {/* Shown only once the owner has configured a real address; never a made-up one. */}
        {SUPPORT_EMAIL ? (
          <p className="mt-6 text-center">
            {c.emailLabel}{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="font-bold text-[var(--link)] underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
          </p>
        ) : null}
        <section id="contact-form" aria-labelledby="form-title" className="mx-auto mt-12 max-w-3xl scroll-mt-20">
          <h2 id="form-title" className="text-2xl font-extrabold">
            {t.supportPage.formTitle}
          </h2>
          <p className="mt-2 text-[var(--muted)]">{t.supportPage.formLead}</p>
          <div className="mt-6">
            <SupportForm locale={locale} t={t} />
          </div>
        </section>
      </div>
    </>
  );
}
