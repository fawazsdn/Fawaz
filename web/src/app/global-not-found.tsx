import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = { title: 'الصفحة غير موجودة · Page not found | حارتنا', robots: { index: false } };

/** 404 for paths outside /ar and /en. */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-dvh items-center justify-center p-6 text-center">
        <main>
          <p className="text-6xl font-extrabold text-[var(--color-gold-600)]">404</p>
          <h1 className="mt-4 text-3xl font-extrabold">الصفحة غير موجودة</h1>
          <p className="mt-1 text-xl font-bold" lang="en" dir="ltr">
            Page not found
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/ar" className="rounded-full bg-[var(--accent)] px-5 py-2.5 font-bold text-[var(--accent-fg)]">
              الرئيسية
            </Link>
            <Link href="/en" lang="en" className="rounded-full border border-[var(--line)] px-5 py-2.5 font-bold">
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
