import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { EmailStatusText, SourceBadge, StatusBadge } from '@/components/admin/Badges';
import { Card } from '@/components/admin/Charts';
import { EmailButtons, ReplyForm, StatusButtons } from '@/components/admin/TicketActions';
import { getTicket } from '@/lib/admin/data';
import { emailConfig } from '@/lib/admin/email';
import { adminDict, formatDateTime, formatDuration } from '@/lib/admin/i18n';
import { adminLocale } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';

export const metadata = { title: 'Request' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function TicketPage({ params }: PageProps<'/admin/tickets/[id]'>) {
  await requireStaffPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const ticket = await getTicket(id);
  if (!ticket) notFound();
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;
  const isWebsite = ticket.source === 'website' && !!ticket.contact_email;
  const emailOn = !!emailConfig();
  const firstResponse =
    ticket.first_responded_at && formatDuration((Date.parse(ticket.first_responded_at) - Date.parse(ticket.created_at)) / 1000, t);
  const canSendEmail =
    isWebsite && emailOn && !!ticket.response && !['sent', 'delivered', 'delivery_delayed', 'sending'].includes(ticket.email_status ?? '');
  const statusButtons = [
    ...(ticket.status !== 'closed' ? [{ status: 'closed' as const, label: t.ticket.close }] : []),
    ...(ticket.status !== 'open' ? [{ status: 'open' as const, label: t.ticket.reopen }] : []),
    ...(ticket.status === 'open' && ticket.response ? [{ status: 'answered' as const, label: t.ticket.markAnswered }] : []),
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/admin/tickets"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
      >
        <Back className="size-4" aria-hidden="true" />
        {t.ticket.back}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-mono text-2xl font-extrabold tracking-tight" dir="ltr">
          {ticket.reference}
        </h1>
        <StatusBadge status={ticket.status} label={t.status[ticket.status]} />
        <SourceBadge source={ticket.source} label={t.source[ticket.source]} />
        <span className="text-sm text-[var(--muted)]">{t.category[ticket.category]}</span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card title={ticket.subject || t.ticket.message}>
            <p className="whitespace-pre-wrap break-words leading-relaxed" dir="auto" data-testid="ticket-message">
              {ticket.message}
            </p>
          </Card>

          <Card title={t.ticket.response}>
            {ticket.response ? (
              <div className="mb-5 rounded-xl border-s-4 border-[var(--color-gold-400)] bg-[var(--surface-2)] p-4">
                <p className="whitespace-pre-wrap break-words" dir="auto" data-testid="ticket-response">
                  {ticket.response}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {t.ticket.responder}: {ticket.responder_name ?? '—'} · {formatDateTime(ticket.responded_at, locale)}
                </p>
              </div>
            ) : (
              <p className="mb-5 text-sm text-[var(--muted)]">{t.ticket.noResponse}</p>
            )}
            <ReplyForm
              id={ticket.id}
              initial=""
              emailCapable={isWebsite && emailOn}
              copy={{
                label: t.ticket.writeResponse,
                hint: t.ticket.responseHint,
                save: t.ticket.save,
                saveSend: t.ticket.saveSend,
                saveClose: isWebsite ? t.ticket.sendClose : t.ticket.saveClose,
              }}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={t.ticket.contact}>
            <dl className="divide-y divide-[var(--line)]">
              <Row label={t.ticket.name}>{ticket.contact_name || ticket.app_user_name || '—'}</Row>
              {ticket.contact_email ? (
                <Row label={t.ticket.email}>
                  <a
                    href={`mailto:${ticket.contact_email}?subject=${encodeURIComponent(ticket.reference)}`}
                    dir="ltr"
                    className="font-semibold text-[var(--link)] underline"
                  >
                    {ticket.contact_email}
                  </a>
                </Row>
              ) : null}
              {ticket.user_id ? (
                <Row label={t.ticket.account}>
                  <Link href={`/admin/customers/${ticket.user_id}`} className="font-mono text-xs underline" dir="ltr">
                    {ticket.user_id}
                  </Link>
                </Row>
              ) : null}
              {ticket.locale ? <Row label={t.ticket.language}>{ticket.locale === 'ar' ? 'العربية' : 'English'}</Row> : null}
              <Row label={t.ticket.received}>{formatDateTime(ticket.created_at, locale)}</Row>
              <Row label={t.ticket.firstResponse}>
                {ticket.first_responded_at ? `${formatDateTime(ticket.first_responded_at, locale)} (${firstResponse})` : '—'}
              </Row>
              <Row label={t.ticket.responded}>{formatDateTime(ticket.responded_at, locale)}</Row>
              <Row label={t.ticket.responder}>{ticket.responder_name ?? '—'}</Row>
              {ticket.closed_at ? <Row label={t.ticket.closedAt}>{formatDateTime(ticket.closed_at, locale)}</Row> : null}
              {ticket.status_changed_by_name ? <Row label={t.ticket.statusBy}>{ticket.status_changed_by_name}</Row> : null}
            </dl>
          </Card>

          <Card title={t.tickets.status}>
            <StatusButtons id={ticket.id} buttons={statusButtons} />
          </Card>

          <Card title={t.ticket.emailTitle}>
            {!isWebsite ? (
              <p className="text-sm text-[var(--muted)]">{t.ticket.emailNotApplicable}</p>
            ) : (
              <div className="space-y-3" data-testid="email-panel">
                <EmailStatusText status={ticket.email_status ?? 'pending'} label={t.email[ticket.email_status ?? 'pending']} />
                {!ticket.response ? <p className="text-xs text-[var(--muted)]">{t.result.errors['email:no_response']}</p> : null}
                <dl className="text-xs text-[var(--muted)]">
                  {ticket.email_attempts ? <div>{t.ticket.attempts(ticket.email_attempts)}</div> : null}
                  {ticket.email_sent_at ? (
                    <div>
                      {t.ticket.sentAt}: {formatDateTime(ticket.email_sent_at, locale)}
                    </div>
                  ) : null}
                  {ticket.email_status_at ? (
                    <div>
                      {t.ticket.statusAt}: {formatDateTime(ticket.email_status_at, locale)}
                    </div>
                  ) : null}
                  {ticket.email_last_error && ticket.email_status === 'failed' ? (
                    <div className="mt-1 break-words text-red-700 dark:text-red-300" dir="ltr">
                      {t.ticket.lastError}: {ticket.email_last_error}
                    </div>
                  ) : null}
                </dl>
                {!emailOn ? <p className="text-sm text-amber-800 dark:text-amber-200">{t.ticket.emailNotConfigured}</p> : null}
                <EmailButtons
                  id={ticket.id}
                  sendLabel={canSendEmail ? (ticket.email_status === 'failed' ? t.ticket.retryEmail : t.ticket.sendEmail) : undefined}
                  checkLabel={emailOn && ticket.email_message_id ? t.ticket.checkDelivery : undefined}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
