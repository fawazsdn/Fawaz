import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs for /admin only. Refreshes the staff session cookies and sends
 * signed-out visitors to the sign-in page. This is a first gate only: every
 * admin page, server action and API route checks the staff role again on the
 * server before touching any data.
 */
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/auth/'];

const COOKIE_OPTIONS = {
  path: '/admin',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

function noStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'private, no-store, max-age=0');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(p));
  if (!url || !key) return noStore(isPublic ? NextResponse.next() : NextResponse.redirect(new URL('/admin/login', request.url)));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...COOKIE_OPTIONS });
      },
    },
    auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false },
  });

  // getUser() validates the token with Supabase Auth (and refreshes an expired session).
  const { data } = await supabase.auth.getUser();
  if (!data.user && !isPublic) {
    if (path.startsWith('/admin/api/')) {
      return noStore(NextResponse.json({ error: 'not_authorized' }, { status: 401 }));
    }
    const login = new URL('/admin/login', request.url);
    return noStore(NextResponse.redirect(login));
  }
  return noStore(response);
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
