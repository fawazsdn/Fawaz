import Link from 'next/link';

import { Card, StatCard, VolumeChart } from '@/components/admin/Charts';
import { TicketList } from '@/components/admin/TicketList';
import { getOverview, listTickets } from '@/lib/admin/data';
import { adminDict, formatDateTime, formatDuration } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';

export const metadata = { title: 'Overview' };

export default async function OverviewPage() {
  await requireStaffPage();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const [o, recent] = await Promise.all([getOverview(30), listTickets({ page: 1 })]);
  const avg = formatDuration(o.avg_first_response_seconds, t);
  const median = formatDuration(o.median_first_response_seconds, t);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.overview.title}</h1>
        <p className="text-xs text-[var(--muted)]">
          {t.overview.updated}: {formatDateTime(new Date().toISOString(), locale)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="stats">
        <StatCard label={t.overview.total} value={o.total} />
        <StatCard label={t.overview.open} value={o.open} tone="accent" />
        <StatCard label={t.overview.answered} value={o.answered} />
        <StatCard label={t.overview.closed} value={o.closed} />
        <StatCard label={t.overview.today} value={o.today} />
        <StatCard label={t.overview.week} value={o.week} />
        <StatCard label={t.overview.month} value={o.month} />
        <StatCard
          label={t.overview.avgResponse}
          value={avg ?? '—'}
          hint={avg ? `${t.overview.medianResponse}: ${median}` : t.overview.notMeasurable}
        />
      </div>
      {o.emails_failed > 0 ? (
        <p
          role="status"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          {t.overview.emailsFailed}: {o.emails_failed} ·{' '}
          <Link href="/admin/tickets" className="underline">
            {t.overview.viewAll}
          </Link>
        </p>
      ) : null}
      <Card title={t.overview.volume}>
        <VolumeChart series={o.series} locale={locale} label={t.overview.volume} />
      </Card>
      <Card
        title={t.overview.recent}
        action={
          <Link href="/admin/tickets" className="text-sm font-bold text-[var(--link)] underline-offset-4 hover:underline">
            {t.overview.viewAll}
          </Link>
        }
      >
        <TicketList rows={recent.rows.slice(0, 5)} t={t} locale={locale} />
      </Card>
    </div>
  );
}
