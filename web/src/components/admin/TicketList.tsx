import Link from 'next/link';

import type { TicketRow } from '@/lib/admin/data';
import { formatDateTime, type AdminDictionary, type AdminLocale } from '@/lib/admin/i18n';
import { EmailStatusText, SourceBadge, StatusBadge } from './Badges';

export function TicketList({ rows, t, locale }: { rows: TicketRow[]; t: AdminDictionary; locale: AdminLocale }) {
  if (!rows.length) return <p className="py-10 text-center text-[var(--muted)]">{t.tickets.none}</p>;
  return (
    <ul className="divide-y divide-[var(--line)]" data-testid="ticket-list">
      {rows.map((r) => {
        const who = r.contact_name || r.app_user_name || (r.source === 'app' ? t.tickets.appUser : t.tickets.anonymous);
        return (
          <li key={r.id}>
            <Link
              href={`/admin/tickets/${r.id}`}
              className="block rounded-xl px-2 py-4 transition-colors hover:bg-[var(--surface-2)] sm:px-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-[var(--color-brand-700)] dark:text-[var(--color-gold-400)]" dir="ltr">
                  {r.reference}
                </span>
                <StatusBadge status={r.status} label={t.status[r.status]} />
                <SourceBadge source={r.source} label={t.source[r.source]} />
                <span className="text-xs text-[var(--muted)]">{t.category[r.category]}</span>
                <time className="ms-auto text-xs text-[var(--muted)]" dateTime={r.created_at}>
                  {formatDateTime(r.created_at, locale)}
                </time>
              </div>
              <p className="mt-1.5 font-semibold">{r.subject || r.message_preview.slice(0, 80)}</p>
              <p className="mt-0.5 line-clamp-1 text-sm text-[var(--muted)]">{r.message_preview}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                <span>{who}</span>
                {r.contact_email ? (
                  <span dir="ltr" className="break-all">
                    {r.contact_email}
                  </span>
                ) : null}
                {r.email_status ? <EmailStatusText status={r.email_status} label={t.email[r.email_status]} /> : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
