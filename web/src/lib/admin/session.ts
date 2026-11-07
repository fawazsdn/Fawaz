import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createAdminClient } from './supabase';

export type StaffRole = 'admin' | 'moderator';

export interface Staff {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: StaffRole;
}

export type StaffCheck = { kind: 'staff'; staff: Staff } | { kind: 'signed_out' } | { kind: 'forbidden'; email: string | null };

/**
 * Server-side authorization for the admin area, run on every page, action and
 * API route (never only in the browser or the proxy). getUser() validates the
 * session with Supabase Auth, then the role is read from the user's own
 * profile row: the same app_role that the database's is_admin_or_moderator()
 * uses, so the dashboard and the database agree on who is staff.
 */
export const checkStaff = cache(async (): Promise<StaffCheck> => {
  const supabase = await createAdminClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: 'signed_out' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, app_role, deleted_at')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || profile.deleted_at || (profile.app_role !== 'admin' && profile.app_role !== 'moderator')) {
    return { kind: 'forbidden', email: data.user.email ?? null };
  }
  return {
    kind: 'staff',
    staff: {
      id: data.user.id,
      email: data.user.email ?? null,
      firstName: profile.first_name,
      lastName: profile.last_name,
      role: profile.app_role,
    },
  };
});

/** For pages: signed-out visitors go to the sign-in page, non-staff to the refusal page. */
export async function requireStaffPage(): Promise<Staff> {
  const check = await checkStaff();
  if (check.kind === 'signed_out') redirect('/admin/login');
  if (check.kind === 'forbidden') redirect('/admin/login?error=not_authorized');
  return check.staff;
}

export class NotStaffError extends Error {
  constructor() {
    super('not_authorized');
  }
}

/** For actions and API routes: throws instead of redirecting. */
export async function requireStaff(): Promise<Staff> {
  const check = await checkStaff();
  if (check.kind !== 'staff') throw new NotStaffError();
  return check.staff;
}
