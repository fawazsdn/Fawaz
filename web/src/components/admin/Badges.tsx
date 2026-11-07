import type { EmailStatus, TicketSource, TicketStatus } from '@/lib/admin/data';

const STATUS: Record<TicketStatus, string> = {
  open: 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800',
  answered: 'bg-sky-100 text-sky-900 ring-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-800',
  closed: 'bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800',
};

export function StatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${STATUS[status]}`}>{label}</span>;
}

export function SourceBadge({ source, label }: { source: TicketSource; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-[var(--line)] ${
        source === 'website'
          ? 'bg-[var(--surface-2)]'
          : 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-white/10 dark:text-[var(--color-gold-400)]'
      }`}
    >
      {label}
    </span>
  );
}

const EMAIL_TONE: Record<EmailStatus, string> = {
  pending: 'text-[var(--muted)]',
  sending: 'text-sky-700 dark:text-sky-300',
  sent: 'text-sky-700 dark:text-sky-300',
  delivered: 'text-emerald-700 dark:text-emerald-300',
  delivery_delayed: 'text-amber-700 dark:text-amber-300',
  bounced: 'text-red-700 dark:text-red-300',
  complained: 'text-red-700 dark:text-red-300',
  failed: 'text-red-700 dark:text-red-300',
};

export function EmailStatusText({ status, label }: { status: EmailStatus; label: string }) {
  return <span className={`text-xs font-semibold ${EMAIL_TONE[status]}`}>✉ {label}</span>;
}
