import Image from 'next/image';
import Link from 'next/link';

import type { Dictionary } from '@/content/dictionary';
import { pathFor, type Locale } from '@/lib/i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { MobileMenu } from './MobileMenu';

export function SiteHeader({ locale, t }: { locale: Locale; t: Dictionary }) {
  const links = [
    { href: `${pathFor(locale)}#features`, label: t.nav.features },
    { href: pathFor(locale, 'faq'), label: t.nav.faq },
    { href: pathFor(locale, 'support'), label: t.nav.support },
    { href: pathFor(locale, 'contact'), label: t.nav.contact },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={pathFor(locale)} className="flex items-center gap-2.5 rounded-lg font-extrabold" aria-label={t.brand}>
          <Image src="/brand/icon-96.png" alt="" width={36} height={36} className="rounded-[10px]" priority />
          <span className="text-lg tracking-tight">{t.brand}</span>
        </Link>
        <nav aria-label={t.menu} className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[15px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--fg)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitch locale={locale} label={t.switchTo} ariaLabel={t.switchLabel} />
          <MobileMenu links={links} menuLabel={t.menu} />
        </div>
      </div>
    </header>
  );
}
