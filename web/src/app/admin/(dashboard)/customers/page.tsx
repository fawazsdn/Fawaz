import Link from 'next/link';

import { SourceBadge } from '@/components/admin/Badges';
import { Card } from '@/components/admin/Charts';
import { listCustomers } from '@/lib/admin/data';
import { adminDict, formatDateTime } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';

export const metadata = { title: 'Customers' };

export default async function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  await requireStaffPage();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : undefined;
  const { rows, total } = await listCustomers(q);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t.customers.title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.customers.lead}</p>
      </div>
      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="cq" className="sr-only">
          {t.customers.search}
        </label>
        <input
          id="cq"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t.customers.search}
          maxLength={100}
          className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--color-brand-700)] px-5 text-sm font-bold text-white dark:bg-[var(--color-gold-400)] dark:text-[var(--color-brand-900)]"
        >
          {t.tickets.apply}
        </button>
      </form>
      <Card title={`${t.customers.title} (${total})`}>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-[var(--muted)]">{t.customers.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-start text-xs text-[var(--muted)]">
                  <th scope="col" className="py-2 text-start font-semibold">
                    {t.ticket.name}
                  </th>
                  <th scope="col" className="py-2 text-start font-semibold">
                    {t.tickets.source}
                  </th>
                  <th scope="col" className="py-2 text-start font-semibold">
                    {t.customers.tickets}
                  </th>
                  <th scope="col" className="py-2 text-start font-semibold">
                    {t.customers.open}
                  </th>
                  <th scope="col" className="py-2 text-start font-semibold">
                    {t.customers.last}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {rows.map((c) => (
                  <tr key={c.customer_key}>
                    <td className="py-3">
                      <Link
                        href={`/admin/customers/${encodeURIComponent(c.customer_key)}`}
                        className="font-semibold underline-offset-4 hover:underline"
                      >
                        {c.name || (c.source === 'app' ? t.tickets.appUser : t.tickets.anonymous)}
                      </Link>
                      {c.email ? (
                        <div className="text-xs text-[var(--muted)]" dir="ltr">
                          {c.email}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3">
                      <SourceBadge source={c.source} label={t.source[c.source]} />
                    </td>
                    <td className="py-3 tabular-nums">{c.tickets}</td>
                    <td className="py-3 tabular-nums">{c.open_tickets}</td>
                    <td className="py-3 text-xs">{formatDateTime(c.last_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
