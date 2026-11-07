'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Languages } from 'lucide-react';

import { otherLocale, type Locale } from '@/lib/i18n';

/** Links to the same page in the other language. */
export function LanguageSwitch({ locale, label, ariaLabel }: { locale: Locale; label: string; ariaLabel: string }) {
  const pathname = usePathname() || `/${locale}`;
  const target = otherLocale(locale);
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${target}`);
  return (
    <Link
      href={href}
      hrefLang={target}
      lang={target}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-[var(--accent)]"
    >
      <Languages className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
