import 'server-only';

import { createAdminClient } from './supabase';
import type { Category } from '../validation';

export type TicketStatus = 'open' | 'answered' | 'closed';
export type TicketSource = 'website' | 'app';
export type EmailStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'delivery_delayed' | 'bounced' | 'complained' | 'failed';

export interface TicketRow {
  id: string;
  reference: string;
  source: TicketSource;
  category: Category;
  status: TicketStatus;
  subject: string | null;
  message_preview: string;
  contact_name: string | null;
  contact_email: string | null;
  user_id: string | null;
  app_user_name: string | null;
  created_at: string;
  responded_at: string | null;
  email_status: EmailStatus | null;
}

export interface Ticket {
  id: string;
  reference: string;
  source: TicketSource;
  category: Category;
  status: TicketStatus;
  subject: string | null;
  message: string;
  locale: 'ar' | 'en' | null;
  contact_name: string | null;
  contact_email: string | null;
  user_id: string | null;
  app_user_name: string | null;
  response: string | null;
  responded_at: string | null;
  first_responded_at: string | null;
  responder_name: string | null;
  closed_at: string | null;
  status_changed_by_name: string | null;
  created_at: string;
  email_status: EmailStatus | null;
  email_message_id: string | null;
  email_attempts: number;
  email_last_error: string | null;
  email_last_attempt_at: string | null;
  email_sent_at: string | null;
  email_status_at: string | null;
}

export interface Overview {
  total: number;
  open: number;
  answered: number;
  closed: number;
  today: number;
  week: number;
  month: number;
  website: number;
  app: number;
  responded: number;
  avg_first_response_seconds: number | null;
  median_first_response_seconds: number | null;
  by_category: Partial<Record<Category, number>>;
  emails_failed: number;
  series: { day: string; count: number }[];
  time_zone: string;
  days: number;
}

export interface CustomerRow {
  customer_key: string;
  source: TicketSource;
  email: string | null;
  name: string | null;
  tickets: number;
  open_tickets: number;
  first_at: string;
  last_at: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  source?: TicketSource;
  category?: Category;
  from?: string;
  to?: string;
  q?: string;
  customer?: string;
  page?: number;
}

export const PAGE_SIZE = 25;
export const TIME_ZONE = 'Asia/Riyadh';

/** Database errors that are safe to show (codes we raise ourselves). Anything else is generic. */
export class AdminDataError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function fail(error: { message?: string } | null): never {
  const msg = error?.message ?? '';
  if (/^(not_authorized|invalid:[a-z_]+|email:[a-z_]+|not found)$/.test(msg)) throw new AdminDataError(msg);
  console.error('[admin] database error', msg.slice(0, 160));
  throw new AdminDataError('unavailable');
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) fail(error);
  return data as T;
}

/** Riyadh calendar day (YYYY-MM-DD) → ISO instant at local midnight (UTC+3, no DST). */
export const riyadhDayStart = (day: string) => new Date(`${day}T00:00:00+03:00`).toISOString();

export async function listTickets(f: TicketFilters) {
  const page = Math.max(1, f.page ?? 1);
  const to = f.to ? new Date(new Date(riyadhDayStart(f.to)).getTime() + 86_400_000).toISOString() : null;
  const res = await rpc<{ total: number; rows: TicketRow[] }>('admin_list_support_requests', {
    p_status: f.status ?? null,
    p_source: f.source ?? null,
    p_category: f.category ?? null,
    p_from: f.from ? riyadhDayStart(f.from) : null,
    p_to: to,
    p_query: f.q ?? null,
    p_customer: f.customer ?? null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  return { ...res, page, pages: Math.max(1, Math.ceil(res.total / PAGE_SIZE)) };
}

export const getTicket = (id: string) => rpc<Ticket | null>('admin_get_support_request', { request: id });
export const getOverview = (days = 30) => rpc<Overview>('admin_support_overview', { p_tz: TIME_ZONE, p_days: days });
export const listCustomers = (q?: string, page = 1) =>
  rpc<{ total: number; rows: CustomerRow[] }>('admin_support_customers', { p_query: q ?? null, p_limit: 50, p_offset: (page - 1) * 50 });

export const respondToTicket = (id: string, response: string, close: boolean) =>
  rpc<void>('respond_support_request', { request: id, response, close });
export const setTicketStatus = (id: string, status: TicketStatus) =>
  rpc<void>('set_support_request_status', { request: id, new_status: status });

export interface EmailClaim {
  contact_email: string;
  contact_name: string | null;
  reference: string;
  subject: string | null;
  locale: 'ar' | 'en' | null;
  response: string;
  response_hash: string;
  attempt: number;
}
export async function claimReplyEmail(id: string): Promise<EmailClaim> {
  const rows = await rpc<EmailClaim[]>('claim_support_reply_email', { request: id });
  if (!rows?.[0]) throw new AdminDataError('unavailable');
  return rows[0];
}
export const recordReplyEmail = (id: string, hash: string, accepted: boolean, messageId: string | null, error: string | null) =>
  rpc<void>('record_support_reply_email', { request: id, response_hash: hash, accepted, message_id: messageId, error });
export const updateReplyEmailStatus = (id: string, messageId: string, providerStatus: string) =>
  rpc<void>('update_support_reply_email_status', { request: id, message_id: messageId, provider_status: providerStatus });
