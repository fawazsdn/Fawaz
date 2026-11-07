import { NextResponse, type NextRequest } from 'next/server';

import { hashKey, rateLimit } from '@/lib/rate-limit';
import { validateSupport } from '@/lib/validation';

/**
 * POST /api/support — files a support ticket.
 *
 * Layers: same-origin check, body size cap, honeypot + minimum fill time,
 * per-network rate limit (hashed, in memory), shared validation, then the
 * Supabase function submit_public_support_request(), which validates again,
 * enforces per-email and global limits, stores the ticket and notifies
 * Haratna staff in the app. Only the publishable key is used, server-side.
 * The visitor gets a reference number; nothing is silently dropped: any
 * failure returns an error the form shows, with another way to reach us.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 16_000;
const MIN_FILL_MS = 3_000;

type Fail = 'invalid' | 'rate_limited' | 'too_fast' | 'unavailable' | 'forbidden';
const fail = (error: Fail, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('forbidden', 403);
  if (!req.headers.get('content-type')?.includes('application/json')) return fail('invalid', 415);
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return fail('invalid', 413);

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return fail('invalid', 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    return fail('invalid', 400);
  }

  // Bots fill every field; people never see this one.
  if (typeof body.website === 'string' && body.website.trim() !== '') return fail('invalid', 400);
  const startedAt = Number(body.startedAt);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) return fail('too_fast', 400);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const limited = rateLimit(await hashKey(ip), 5, 10 * 60_000);
  if (!limited.ok) return fail('rate_limited', 429, { retryAfter: limited.retryAfterS });

  const checked = validateSupport(body);
  if (!checked.ok) return fail('invalid', 400, { fields: checked.errors });
  const v = checked.value;
  const locale = body.locale === 'en' ? 'en' : 'ar';

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('[support] SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not configured');
    return fail('unavailable', 503);
  }

  let reference: string;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/submit_public_support_request`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_name: v.name,
        contact_email: v.email,
        category: v.category,
        subject: v.subject,
        message: v.message,
        locale,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = typeof data?.message === 'string' ? data.message : '';
      if (msg === 'rate_limited') return fail('rate_limited', 429);
      if (msg.startsWith('invalid:')) return fail('invalid', 400, { fields: { [msg.slice(8)]: 'invalid' } });
      console.error('[support] database rejected ticket', res.status, msg.slice(0, 120));
      return fail('unavailable', 502);
    }
    if (typeof data !== 'string') throw new Error('unexpected response');
    reference = data;
  } catch (e) {
    console.error('[support] could not reach the database', (e as Error).name);
    return fail('unavailable', 502);
  }

  // Privacy-conscious log: reference and topic only, never the message or email.
  console.info('[support] ticket filed', reference, v.category);
  await notifyInbox(reference, v).catch((e) => console.error('[support] email notification failed', (e as Error).name));
  return NextResponse.json({ ok: true, reference }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}

/** Optional staff email via Resend. The ticket is already stored, so a failure here is only logged. */
async function notifyInbox(
  reference: string,
  v: { name: string | null; email: string; category: string; subject: string; message: string },
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_NOTIFY_FROM;
  const to = process.env.SUPPORT_NOTIFY_TO;
  if (!apiKey || !from || !to) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: v.email,
      subject: `[${reference}] ${v.subject}`,
      text: `Reference: ${reference}\nTopic: ${v.category}\nFrom: ${v.name ?? '-'} <${v.email}>\n\n${v.message}`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}`);
}

export function GET() {
  return fail('invalid', 405);
}
