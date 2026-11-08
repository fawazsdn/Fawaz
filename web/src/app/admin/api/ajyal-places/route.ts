import { NextResponse } from 'next/server';

import { requireStaff, NotStaffError } from '@/lib/admin/session';
import { ajyalSearchRequest, discoverAjyalPlaceIds } from '@/lib/ajyal-places';
import { rateLimit } from '@/lib/rate-limit';

function reply(body: object, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'invalid_origin' }, 403);
  try {
    const staff = await requireStaff();
    if (staff.role !== 'admin') return reply({ error: 'forbidden' }, 403);
    const key = process.env.GOOGLE_PLACES_SERVER_KEY?.trim();
    if (process.env.GOOGLE_PLACES_RESEARCH_ENABLED !== 'true' || !key) return reply({ error: 'research_disabled' }, 503);

    const allowed = rateLimit(`ajyal-places:${staff.id}`, 8, 60_000);
    if (!allowed.ok) return reply({ error: 'rate_limited' }, 429, { 'Retry-After': String(allowed.retryAfterS) });
    const search = ajyalSearchRequest(await request.json().catch(() => null));
    if (!search) return reply({ error: 'invalid_search' }, 400);
    const perDay = search.action === 'searchNearby' ? 20 : 50;
    const daily = rateLimit(`ajyal-places:${search.action}:instance-day`, perDay, 86_400_000);
    if (!daily.ok) return reply({ error: 'rate_limited' }, 429, { 'Retry-After': String(daily.retryAfterS) });
    return reply(await discoverAjyalPlaceIds(search, key), 200);
  } catch (error) {
    if (error instanceof NotStaffError) return reply({ error: 'forbidden' }, 403);
    if (error instanceof Error && error.message === 'quota_exhausted') return reply({ error: 'quota_exhausted' }, 429);
    return reply({ error: 'places_unavailable' }, 502);
  }
}
