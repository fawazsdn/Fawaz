import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

import { checkStaff } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/admin/supabase';

export const dynamic = 'force-dynamic';

/**
 * Landing point of the emailed sign-in link. Supports both Supabase link
 * styles: ?code= (PKCE; the verifier cookie was set when the link was
 * requested on this device) and ?token_hash=&type=. After sign-in the staff
 * role is checked; non-staff sessions are signed out immediately.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), { headers: { 'Cache-Control': 'no-store' } });
  const supabase = await createAdminClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  let ok = false;
  if (code && /^[\w-]{6,200}$/.test(code)) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && ['magiclink', 'email'].includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  if (!ok) return to('/admin/login?error=link');

  const check = await checkStaff();
  if (check.kind !== 'staff') {
    await supabase.auth.signOut({ scope: 'local' });
    return to('/admin/login?error=not_authorized');
  }
  return to('/admin');
}
