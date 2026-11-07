import Image from 'next/image';
import { redirect } from 'next/navigation';
import { ShieldCheck, TriangleAlert } from 'lucide-react';

import { LanguageToggle } from '@/components/admin/LanguageToggle';
import { LoginForm } from '@/components/admin/LoginForm';
import { NajdiPattern } from '@/components/Pattern';
import { adminDict } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { checkStaff } from '@/lib/admin/session';

export const metadata = { title: 'Sign in' };

export default async function AdminLogin({ searchParams }: PageProps<'/admin/login'>) {
  const locale = await adminLocale();
  const t = adminDict(locale);
  const check = await checkStaff();
  if (check.kind === 'staff') redirect('/admin');
  const sp = await searchParams;
  const notice =
    sp.error === 'not_authorized' || check.kind === 'forbidden' ? t.login.notAuthorized : sp.error === 'link' ? t.login.linkFailed : null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[var(--color-brand-900)] text-[var(--color-sand-100)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <NajdiPattern className="absolute inset-0 h-full w-full text-[var(--color-gold-400)] opacity-[0.07]" />
        <div className="relative flex items-center gap-3">
          <Image src="/brand/icon-96.png" alt="" width={44} height={44} className="rounded-xl" />
          <span className="text-2xl font-extrabold">{t.brand}</span>
        </div>
        <div className="relative">
          <p className="text-4xl font-extrabold leading-tight">{t.console}</p>
          <p className="mt-3 max-w-md text-[var(--color-sand-200)]">{t.login.note}</p>
        </div>
        <p className="relative flex items-center gap-2 text-sm text-[var(--color-gold-400)]">
          <ShieldCheck className="size-4" aria-hidden="true" />
          haratna.live/admin
        </p>
      </div>
      <main className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex justify-end">
          <LanguageToggle label={t.language} target={locale === 'ar' ? 'en' : 'ar'} />
        </div>
        <div className="m-auto w-full max-w-sm py-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/brand/icon-96.png" alt="" width={40} height={40} className="rounded-xl" />
            <span className="text-xl font-extrabold">{t.brand}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.login.title}</h1>
          <p className="mt-2 text-[var(--muted)]">{t.login.lead}</p>
          {notice ? (
            <p
              role="alert"
              className="mt-6 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {notice}
            </p>
          ) : null}
          <div className="mt-8">
            <LoginForm
              copy={{
                email: t.login.email,
                send: t.login.send,
                sent: t.login.sent,
                codeTitle: t.login.codeTitle,
                code: t.login.code,
                verify: t.login.verify,
                errors: {
                  rate_limited: t.login.rateLimited,
                  invalid_email: t.login.invalidEmail,
                  invalid_code: t.login.invalidCode,
                  unavailable: t.login.unavailable,
                },
              }}
            />
          </div>
          <p className="mt-8 text-xs text-[var(--muted)]">{t.login.note}</p>
        </div>
      </main>
    </div>
  );
}
