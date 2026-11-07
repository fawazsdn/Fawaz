import type { Metadata, Viewport } from 'next';

import '../globals.css';
import { jakarta, tajawal } from '@/lib/fonts';
import { adminDict } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';

/** Root layout for /admin (separate from the public site's layout). */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminDict(await adminLocale());
  return {
    title: { default: `${t.console} | ${t.brand}`, template: `%s | ${t.console} · ${t.brand}` },
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
  };
}

export const viewport: Viewport = { themeColor: '#07352A', width: 'device-width', initialScale: 1 };

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const locale = await adminLocale();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${tajawal.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh bg-[var(--bg)] antialiased">{children}</body>
    </html>
  );
}
