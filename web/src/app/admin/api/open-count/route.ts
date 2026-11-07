import { NextResponse } from 'next/server';

import { getOverview } from '@/lib/admin/data';
import { checkStaff } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };

/** Staff-only: counts for the open-request badge. Never returns ticket content. */
export async function GET() {
  const check = await checkStaff();
  if (check.kind === 'signed_out') return NextResponse.json({ error: 'not_authorized' }, { status: 401, headers });
  if (check.kind === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  try {
    const o = await getOverview(7);
    return NextResponse.json({ open: o.open, total: o.total }, { headers });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers });
  }
}
