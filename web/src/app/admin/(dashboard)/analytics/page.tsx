import Link from 'next/link';

import { BreakdownBars, Card, StatCard, VolumeChart } from '@/components/admin/Charts';
import { getOverview } from '@/lib/admin/data';
import { adminDict, formatDuration } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';
import { CATEGORIES } from '@/lib/validation';

export const metadata = { title: 'Analytics' };

const RANGES = [7, 30, 90, 365];

export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  await requireStaffPage();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const requested = Number((await searchParams).days);
  const days = RANGES.includes(requested) ? requested : 30;
  const o = await getOverview(days);
  const rangeTotal = o.series.reduce((a, s) => a + s.count, 0);
  const rate = o.total ? Math.round((o.responded / o.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t.analytics.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t.analytics.lead} {t.analytics.timeZone}: {o.time_zone}
          </p>
        </div>
        <nav aria-label={t.analytics.range} className="flex gap-1 rounded-full bg-[var(--surface)] p-1 ring-1 ring-[var(--line)]">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/analytics?days=${d}`}
              aria-current={d === days ? 'page' : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${d === days ? 'bg-[var(--color-brand-700)] text-white dark:bg-[var(--color-gold-400)] dark:text-[var(--color-brand-900)]' : ''}`}
            >
              {t.analytics.days(d)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t.analytics.days(days)} value={rangeTotal} />
        <StatCard label={t.analytics.responseRate} value={`${rate}%`} hint={`${o.responded} / ${o.total}`} />
        <StatCard label={t.overview.avgResponse} value={formatDuration(o.avg_first_response_seconds, t) ?? '—'} />
        <StatCard label={t.overview.medianResponse} value={formatDuration(o.median_first_response_seconds, t) ?? '—'} />
      </div>
      <Card title={`${t.analytics.volume} (${t.analytics.days(days)})`}>
        <VolumeChart series={o.series} locale={locale} label={t.analytics.volume} />
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={t.analytics.byStatus}>
          <BreakdownBars
            rows={[
              { label: t.status.open, value: o.open },
              { label: t.status.answered, value: o.answered },
              { label: t.status.closed, value: o.closed },
            ]}
          />
        </Card>
        <Card title={t.analytics.bySource}>
          <BreakdownBars
            rows={[
              { label: t.source.website, value: o.website },
              { label: t.source.app, value: o.app },
            ]}
          />
        </Card>
        <Card title={t.analytics.byCategory}>
          <BreakdownBars
            rows={CATEGORIES.map((c) => ({ label: t.category[c], value: o.by_category[c] ?? 0 })).filter((r) => r.value > 0)}
          />
        </Card>
      </div>
    </div>
  );
}
