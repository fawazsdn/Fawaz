import Link from 'next/link';

import { getDictionary } from '@/content/dictionary';
import { DEFAULT_LOCALE } from '@/lib/i18n';

/** 404 inside a language (e.g. /en/unknown). Not-found pages do not receive params, so both languages are shown. */
export default function NotFound() {
  const ar = getDictionary(DEFAULT_LOCALE);
  const en = getDictionary('en');
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="text-6xl font-extrabold text-[var(--color-gold-600)]">404</p>
      <h1 className="mt-4 text-3xl font-extrabold">{ar.notFound.title}</h1>
      <p className="mt-1 text-xl font-bold" lang="en" dir="ltr">
        {en.notFound.title}
      </p>
      <p className="mt-4 text-[var(--muted)]">{ar.notFound.body}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/ar" className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-[var(--accent-fg)]">
          {ar.notFound.home}
        </Link>
        <Link href="/en" lang="en" className="rounded-full border border-[var(--line)] px-5 py-2.5 font-bold">
          {en.notFound.home}
        </Link>
      </div>
    </div>
  );
}
