import { CATEGORIES, type Category } from '../validation.ts';
import type { TicketFilters, TicketSource, TicketStatus } from './data.ts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** Turns untrusted query-string values into validated filters (unknown values are dropped). */
export function parseTicketFilters(sp: Record<string, string | string[] | undefined>): TicketFilters {
  const status = one(sp.status);
  const source = one(sp.source);
  const category = one(sp.category);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = Number(one(sp.page) ?? 1);
  const q = one(sp.q);
  const customer = one(sp.customer);
  return {
    status: ['open', 'answered', 'closed'].includes(status ?? '') ? (status as TicketStatus) : undefined,
    source: ['website', 'app'].includes(source ?? '') ? (source as TicketSource) : undefined,
    category: (CATEGORIES as readonly string[]).includes(category ?? '') ? (category as Category) : undefined,
    from: from && DAY.test(from) && !Number.isNaN(Date.parse(from)) ? from : undefined,
    to: to && DAY.test(to) && !Number.isNaN(Date.parse(to)) ? to : undefined,
    q: q ? q.slice(0, 100) : undefined,
    customer: customer ? customer.slice(0, 254) : undefined,
    page: Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

/** Builds a query string from filters (for paging links). */
export function filtersToQuery(f: TicketFilters, page?: number): string {
  const p = new URLSearchParams();
  for (const k of ['status', 'source', 'category', 'from', 'to', 'q', 'customer'] as const) if (f[k]) p.set(k, String(f[k]));
  if (page && page > 1) p.set('page', String(page));
  const s = p.toString();
  return s ? `?${s}` : '';
}
