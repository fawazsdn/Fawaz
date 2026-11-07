import Link from 'next/link';

import type { Dictionary } from '@/content/dictionary';
import { pathFor, type Locale } from '@/lib/i18n';
import { OPERATOR } from '@/lib/legal';
import { Crenellation } from './Pattern';

export function SiteFooter({ locale, t }: { locale: Locale; t: Dictionary }) {
  const cols = [
    {
      title: t.footer.product,
      links: [
        { href: `${pathFor(locale)}#features`, label: t.nav.features },
        { href: `${pathFor(locale)}#how`, label: t.home.ctaHow },
        { href: `${pathFor(locale)}#safety`, label: t.home.safetyTitle },
      ],
    },
    {
      title: t.footer.help,
      links: [
        { href: pathFor(locale, 'support'), label: t.nav.support },
        { href: pathFor(locale, 'faq'), label: t.nav.faq },
        { href: pathFor(locale, 'contact'), label: t.nav.contact },
      ],
    },
    {
      title: t.footer.legal,
      links: [
        { href: pathFor(locale, 'privacy'), label: t.footer.privacy },
        { href: pathFor(locale, 'terms'), label: t.footer.terms },
        { href: pathFor(locale, 'guidelines'), label: t.footer.guidelines },
        { href: pathFor(locale, 'delete-account'), label: t.footer.deletion },
      ],
    },
  ];
  const year = new Date().getFullYear();
  const owner = OPERATOR[locale] ?? t.brand;
  return (
    <footer className="mt-24 bg-[var(--color-brand-900)] text-[var(--color-sand-100)]">
      <Crenellation className="h-3 w-full -translate-y-full text-[var(--color-brand-900)]" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-6 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="text-xl font-extrabold">{t.brand}</p>
          <p className="mt-1 font-bold text-[var(--color-gold-400)]">{t.tagline}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--color-sand-200)]">{t.footer.about}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-sm font-bold text-[var(--color-gold-400)]">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[var(--color-sand-100)] underline-offset-4 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-[var(--color-sand-200)] sm:px-6">
          © {year} {owner}. {t.footer.rights}
        </p>
      </div>
    </footer>
  );
}
