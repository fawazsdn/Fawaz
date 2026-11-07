/** Small, dependency-free charts rendered on the server as SVG/HTML. */

export function VolumeChart({ series, locale, label }: { series: { day: string; count: number }[]; locale: 'ar' | 'en'; label: string }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const w = 720;
  const h = 200;
  const pad = 24;
  const bw = (w - pad * 2) / Math.max(series.length, 1);
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h + 28}`} role="img" aria-label={label} className="h-auto w-full" style={{ direction: 'ltr' }}>
        {ticks.map((v) => {
          const y = h - (v / max) * (h - pad);
          return (
            <g key={v}>
              <line x1={pad} x2={w - pad} y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 4" />
              <text x={4} y={y + 4} fontSize="11" fill="var(--muted)">
                {v}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const bh = (s.count / max) * (h - pad);
          const x = pad + i * bw + bw * 0.15;
          return (
            <g key={s.day}>
              <rect
                x={x}
                y={h - bh}
                width={bw * 0.7}
                height={Math.max(bh, s.count ? 2 : 0)}
                rx={3}
                fill="var(--color-brand-700)"
                className="dark:fill-[var(--color-gold-400)]"
              >
                <title>{`${fmt.format(new Date(s.day))}: ${s.count}`}</title>
              </rect>
              {i % Math.ceil(series.length / 6) === 0 || i === series.length - 1 ? (
                <text x={x + bw * 0.35} y={h + 18} fontSize="11" textAnchor="middle" fill="var(--muted)">
                  {fmt.format(new Date(s.day))}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {label}: {series.map((s) => `${s.day} ${s.count}`).join(', ')}
      </figcaption>
    </figure>
  );
}

export function BreakdownBars({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-3 text-sm">
            <span>{r.label}</span>
            <span className="font-bold tabular-nums">
              {r.value} <span className="font-normal text-[var(--muted)]">({Math.round((r.value / total) * 100)}%)</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--color-brand-700)] dark:bg-[var(--color-gold-400)]"
              style={{ width: `${(r.value / total) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'accent' | 'warn';
}) {
  const ring = tone === 'accent' ? 'ring-[var(--color-gold-400)]' : tone === 'warn' ? 'ring-red-400' : 'ring-[var(--line)]';
  return (
    <div className={`rounded-2xl bg-[var(--surface)] p-5 ring-1 ${ring}`}>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-[var(--surface)] p-5 ring-1 ring-[var(--line)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
