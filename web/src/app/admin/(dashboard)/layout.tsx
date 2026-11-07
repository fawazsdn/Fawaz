import Image from 'next/image';
import { LogOut } from 'lucide-react';

import { logoutAction } from '@/app/admin/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { LanguageToggle } from '@/components/admin/LanguageToggle';
import { OpenCountBadge } from '@/components/admin/OpenCountBadge';
import { getOverview } from '@/lib/admin/data';
import { adminDict } from '@/lib/admin/i18n';
import { adminLocale, adminPrefs } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaffPage();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const prefs = await adminPrefs();
  const open = await getOverview(7)
    .then((o) => o.open)
    .catch(() => 0);
  const name = [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staff.email || '';

  const items = [
    { key: 'overview' as const, href: '/admin', label: t.nav.overview },
    { key: 'tickets' as const, href: '/admin/tickets', label: t.nav.tickets },
    { key: 'customers' as const, href: '/admin/customers', label: t.nav.customers },
    { key: 'analytics' as const, href: '/admin/analytics', label: t.nav.analytics },
    { key: 'settings' as const, href: '/admin/settings', label: t.nav.settings },
  ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="bg-[var(--color-brand-900)] text-[var(--color-sand-100)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="flex items-center gap-3 px-5 py-4 lg:py-6">
          <Image src="/brand/icon-96.png" alt="" width={36} height={36} className="rounded-[10px]" />
          <div>
            <p className="font-extrabold leading-tight">{t.brand}</p>
            <p className="text-xs text-[var(--color-gold-400)]">{t.console}</p>
          </div>
        </div>
        <nav aria-label={t.menu} className="px-3 pb-3 lg:flex-1 lg:pb-0">
          <AdminNav items={items} openCount={open} />
        </nav>
        <div className="hidden border-t border-white/10 p-4 lg:block">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-xs text-[var(--color-sand-200)]">{t.role[staff.role]}</p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--color-sand-200)] hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t.nav.logout}
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur sm:px-8">
          <OpenCountBadge
            initial={open}
            autoRefresh={prefs.autoRefresh}
            alertNew={prefs.alertNew}
            labelTemplate={locale === 'ar' ? '{n} طلب مفتوح' : '{n} open'}
            newLabel={t.newTickets}
            refreshLabel={t.refresh}
          />
          <div className="flex items-center gap-2">
            <LanguageToggle label={t.language} target={locale === 'ar' ? 'en' : 'ar'} />
            <form action={logoutAction} className="lg:hidden">
              <button
                type="submit"
                aria-label={t.nav.logout}
                className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--line)]"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
