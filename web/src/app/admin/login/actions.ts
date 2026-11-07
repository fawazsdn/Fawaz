'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { hashKey, rateLimit } from '@/lib/rate-limit';
import { checkStaff } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/admin/supabase';

export type LoginState = { kind: 'idle' | 'sent' | 'error'; code?: 'rate_limited' | 'invalid_email' | 'invalid_code' | 'unavailable' };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function clientKey() {
  const h = await headers();
  return hashKey((h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown');
}

/** Absolute callback URL. Prefer the configured public origin over request headers. */
async function callbackUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configured) return `${configured}/admin/auth/callback`;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/admin/auth/callback`;
}

/**
 * Emails a one-time sign-in link (and code). shouldCreateUser: false means this
 * can never create an account. The reply is the same whether or not the
 * address exists, so the form cannot be used to discover accounts. Being able
 * to sign in grants nothing: the staff role is checked after sign-in.
 */
export async function sendSignInLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { kind: 'error', code: 'invalid_email' };
  const ip = await clientKey();
  if (!rateLimit(`login-ip:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`login-email:${await hashKey(email)}`, 3, 15 * 60_000).ok) {
    return { kind: 'error', code: 'rate_limited' };
  }
  try {
    const supabase = await createAdminClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: await callbackUrl() },
    });
    if (error && error.status === 429) return { kind: 'error', code: 'rate_limited' };
    if (error && (error.status ?? 500) >= 500) {
      console.error('[admin] sign-in link failed', error.status);
      return { kind: 'error', code: 'unavailable' };
    }
  } catch (e) {
    console.error('[admin] sign-in link failed', (e as Error).name);
    return { kind: 'error', code: 'unavailable' };
  }
  return { kind: 'sent' };
}

/** Alternative to the link: the 6-digit code from the same email (if the email template includes it). */
export async function verifySignInCode(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const token = String(form.get('code') ?? '').replace(/\s/g, '');
  if (!EMAIL.test(email)) return { kind: 'error', code: 'invalid_email' };
  if (!/^\d{6,10}$/.test(token)) return { kind: 'error', code: 'invalid_code' };
  const ip = await clientKey();
  if (!rateLimit(`verify-ip:${ip}`, 10, 15 * 60_000).ok || !rateLimit(`verify-email:${await hashKey(email)}`, 5, 15 * 60_000).ok) {
    return { kind: 'error', code: 'rate_limited' };
  }
  const supabase = await createAdminClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return { kind: 'error', code: error.status === 429 ? 'rate_limited' : 'invalid_code' };
  const check = await checkStaff();
  if (check.kind !== 'staff') {
    await supabase.auth.signOut({ scope: 'local' });
    redirect('/admin/login?error=not_authorized');
  }
  redirect('/admin');
}
