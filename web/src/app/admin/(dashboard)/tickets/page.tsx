import Link from 'next/link';
import { Search } from 'lucide-react';

import { Card } from '@/components/admin/Charts';
import { TicketList } from '@/components/admin/TicketList';
import { listTickets } from '@/lib/admin/data';
import { filtersToQuery, parseTicketFilters } from '@/lib/admin/filters';
import { adminDict } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';
import { CATEGORIES } from '@/lib/validation';

export const metadata = { title: 'Support Requests' };

const field = 'mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm';

export default async function TicketsPage({ searchParams }: PageProps<'/admin/tickets'>) {
  await requireStaffPage();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const f = parseTicketFilters(await searchParams);
  const result = await listTickets(f);
  const quick = [
    { label: t.tickets.all, href: '/admin/tickets', active: !f.status && !f.source },
    { label: t.status.open, href: '/admin/tickets?status=open', active: f.status === 'open' && !f.source },
    { label: t.status.answered, href: '/admin/tickets?status=answered', active: f.status === 'answered' && !f.source },
    { label: t.status.closed, href: '/admin/tickets?status=closed', active: f.status === 'closed' && !f.source },
    { label: t.source.website, href: '/admin/tickets?source=website', active: f.source === 'website' && !f.status },
    { label: t.source.app, href: '/admin/tickets?source=app', active: f.source === 'app' && !f.status },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold tracking-tight">{t.tickets.title}</h1>
      <nav aria-label={t.tickets.status} className="flex flex-wrap gap-2">
        {quick.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            aria-current={q.active ? 'page' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ${
              q.active
                ? 'bg-[var(--color-brand-700)] text-white ring-[var(--color-brand-700)] dark:bg-[var(--color-gold-400)] dark:text-[var(--color-brand-900)]'
                : 'bg-[var(--surface)] ring-[var(--line)]'
            }`}
          >
            {q.label}
          </Link>
        ))}
      </nav>

      <form
        method="get"
        className="grid gap-3 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--line)] sm:grid-cols-2 lg:grid-cols-6"
        role="search"
      >
        <div className="sm:col-span-2">
          <label htmlFor="q" className="text-xs font-bold">
            {t.tickets.search}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 mt-0.5 size-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden="true"
            />
            <input id="q" name="q" type="search" defaultValue={f.q} maxLength={100} className={`${field} ps-9`} />
          </div>
        </div>
        <div>
          <label htmlFor="status" className="text-xs font-bold">
            {t.tickets.status}
          </label>
          <select id="status" name="status" defaultValue={f.status ?? ''} className={field}>
            <option value="">{t.tickets.all}</option>
            {(['open', 'answered', 'closed'] as const).map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="source" className="text-xs font-bold">
            {t.tickets.source}
          </label>
          <select id="source" name="source" defaultValue={f.source ?? ''} className={field}>
            <option value="">{t.tickets.all}</option>
            <option value="website">{t.source.website}</option>
            <option value="app">{t.source.app}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="category" className="text-xs font-bold">
            {t.tickets.category}
          </label>
          <select id="category" name="category" defaultValue={f.category ?? ''} className={field}>
            <option value="">{t.tickets.all}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t.category[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="text-xs font-bold">
            {t.tickets.from}
          </label>
          <input id="from" name="from" type="date" defaultValue={f.from} className={field} />
        </div>
        <div>
          <label htmlFor="to" className="text-xs font-bold">
            {t.tickets.to}
          </label>
          <input id="to" name="to" type="date" defaultValue={f.to} className={field} />
        </div>
        {f.customer ? <input type="hidden" name="customer" value={f.customer} /> : null}
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded-full bg-[var(--color-brand-700)] px-5 py-2.5 text-sm font-bold text-white dark:bg-[var(--color-gold-400)] dark:text-[var(--color-brand-900)]"
          >
            {t.tickets.apply}
          </button>
          <Link href="/admin/tickets" className="rounded-full px-4 py-2.5 text-sm font-semibold ring-1 ring-[var(--line)]">
            {t.tickets.reset}
          </Link>
        </div>
      </form>

      <Card title={t.tickets.count(result.total)}>
        <TicketList rows={result.rows} t={t} locale={locale} />
        {result.pages > 1 ? (
          <nav
            className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-sm"
            aria-label={t.tickets.page(result.page, result.pages)}
          >
            {result.page > 1 ? (
              <Link href={`/admin/tickets${filtersToQuery(f, result.page - 1)}`} className="font-semibold underline">
                {t.tickets.prev}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[var(--muted)]">{t.tickets.page(result.page, result.pages)}</span>
            {result.page < result.pages ? (
              <Link href={`/admin/tickets${filtersToQuery(f, result.page + 1)}`} className="font-semibold underline">
                {t.tickets.next}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </Card>
    </div>
  );
}
