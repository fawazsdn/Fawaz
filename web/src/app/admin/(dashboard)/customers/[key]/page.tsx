import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Card, StatCard } from '@/components/admin/Charts';
import { TicketList } from '@/components/admin/TicketList';
import { listTickets } from '@/lib/admin/data';
import { adminDict, formatDateTime } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';

export const metadata = { title: 'Customer' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A customer's support history only: tickets they filed and their contact details on those tickets. */
export default async function CustomerPage({ params }: PageProps<'/admin/customers/[key]'>) {
  await requireStaffPage();
  const key = decodeURIComponent((await params).key);
  if (!UUID.test(key) && !(EMAIL.test(key) && key.length <= 254)) notFound();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const res = await listTickets({ customer: key, page: 1 });
  if (res.total === 0) notFound();
  const first = res.rows[res.rows.length - 1];
  const latest = res.rows[0];
  const name = res.rows.find((r) => r.contact_name || r.app_user_name);
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-5">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
      >
        <Back className="size-4" aria-hidden="true" />
        {t.customers.title}
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{name?.contact_name || name?.app_user_name || t.tickets.anonymous}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]" dir="ltr">
          {EMAIL.test(key) ? key : `${t.ticket.account}: ${key}`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t.customers.tickets} value={res.total} />
        <StatCard label={t.customers.open} value={res.rows.filter((r) => r.status === 'open').length} tone="accent" />
        <StatCard label={t.customers.first} value={formatDateTime(first.created_at, locale)} />
        <StatCard label={t.customers.last} value={formatDateTime(latest.created_at, locale)} />
      </div>
      <Card title={t.customers.history}>
        <TicketList rows={res.rows} t={t} locale={locale} />
      </Card>
    </div>
  );
}
