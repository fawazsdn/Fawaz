import type { Viewport } from 'next';
import { notFound } from 'next/navigation';

import '../globals.css';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { getDictionary } from '@/content/dictionary';
import { jakarta, tajawal } from '@/lib/fonts';
import { dirOf, isLocale, LOCALES } from '@/lib/i18n';
import { isLaunchReady } from '@/lib/site';

export const dynamicParams = false;
export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4EFE3' },
    { media: '(prefers-color-scheme: dark)', color: '#061F19' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${tajawal.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-[var(--color-gold-400)] px-4 py-2 font-bold text-[var(--color-brand-900)] focus:not-sr-only focus:fixed focus:start-4 focus:top-3"
        >
          {t.skip}
        </a>
        {isLaunchReady() ? null : (
          <div role="note" className="bg-[var(--color-brand-900)] px-4 py-2 text-center text-xs font-medium text-[var(--color-sand-100)]">
            {t.preview.banner}
          </div>
        )}
        <SiteHeader locale={locale} t={t} />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <SiteFooter locale={locale} t={t} />
      </body>
    </html>
  );
}
