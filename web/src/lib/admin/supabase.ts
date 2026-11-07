import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client for the admin area, bound to the signed-in staff member's
 * session. It uses only the publishable key: every query runs as that user,
 * so database authorization (role checks inside each function, row level
 * security on tables) applies. No service-role key is used anywhere.
 *
 * Session cookies are httpOnly (never readable by page scripts), Secure in
 * production, SameSite=Lax and scoped to /admin, so they are not sent with
 * requests to the public website.
 */
export const ADMIN_COOKIE_OPTIONS = {
  path: '/admin',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set');
  return { url: url.replace(/\/$/, ''), key };
}

export async function createAdminClient() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: ADMIN_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, { ...options, ...ADMIN_COOKIE_OPTIONS });
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
    auth: { flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false },
  });
}
