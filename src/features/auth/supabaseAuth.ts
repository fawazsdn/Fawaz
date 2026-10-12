import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type SignInProvider = 'email' | 'apple' | 'google';

export type AuthErrorReason =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'user_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'rate_limited'
  | 'network'
  | 'link_expired'
  | 'unavailable'
  | 'cancelled'
  | 'unknown';

export type AuthOutcome =
  { ok: true; userId: string; email: string | null; provider: SignInProvider } | { ok: false; reason: AuthErrorReason; message?: string };

/** Kept for existing callers (Apple/Google buttons). */
export type SignInOutcome = AuthOutcome;

/** Where email links land. Must be in Supabase Auth → URL Configuration → Redirect URLs. */
export const AUTH_CALLBACK_URL = 'haratna://auth/callback';
export const PASSWORD_RESET_URL = 'haratna://auth/reset-password';

export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Client-side password rule (Supabase enforces its own server-side policy too). */
export function passwordProblem(password: string): 'too_short' | 'needs_letter_and_number' | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too_short';
  if (!/[A-Za-z؀-ۿ]/.test(password) || !/\d/.test(password)) return 'needs_letter_and_number';
  return null;
}

export function classifyAuthError(err: { message?: string; code?: string; status?: number } | null | undefined): AuthErrorReason {
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'invalid_credentials';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'email_not_confirmed';
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) return 'user_exists';
  if (code === 'weak_password' || msg.includes('password should')) return 'weak_password';
  if (
    code === 'email_address_invalid' ||
    code === 'validation_failed' ||
    msg.includes('invalid format') ||
    msg.includes('unable to validate email')
  )
    return 'invalid_email';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || err?.status === 429 || msg.includes('rate limit'))
    return 'rate_limited';
  if (
    code === 'otp_expired' ||
    code === 'flow_state_expired' ||
    code === 'flow_state_not_found' ||
    msg.includes('expired') ||
    msg.includes('code verifier')
  )
    return 'link_expired';
  if (msg.includes('network') || msg.includes('fetch')) return 'network';
  return 'unknown';
}

function providerOf(user: { app_metadata?: { provider?: string } }): SignInProvider {
  const p = user.app_metadata?.provider;
  return p === 'apple' || p === 'google' ? p : 'email';
}

// ------------------------------------------------------------------ email --

export async function signUpWithEmail(
  email: string,
  password: string,
  locale: 'ar' | 'en',
): Promise<AuthOutcome & { needsConfirmation?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { emailRedirectTo: AUTH_CALLBACK_URL, data: { locale } },
  });
  if (error) return { ok: false, reason: classifyAuthError(error), message: error.message };
  if (!data.user) return { ok: false, reason: 'unknown' };
  // With "Confirm email" on, Supabase returns a user with no identities when
  // the address is already registered (to avoid account enumeration).
  if (data.user.identities && data.user.identities.length === 0) return { ok: false, reason: 'user_exists' };
  if (!data.session) return { ok: true, userId: data.user.id, email: data.user.email ?? email, provider: 'email', needsConfirmation: true };
  return { ok: true, userId: data.user.id, email: data.user.email ?? email, provider: 'email', needsConfirmation: false };
}

export async function signInWithEmail(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) return { ok: false, reason: classifyAuthError(error), message: error?.message };
  return { ok: true, userId: data.user.id, email: data.user.email ?? null, provider: providerOf(data.user) };
}

export async function resendConfirmation(email: string): Promise<{ ok: boolean; reason?: AuthErrorReason }> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: AUTH_CALLBACK_URL },
  });
  return error ? { ok: false, reason: classifyAuthError(error) } : { ok: true };
}

export async function sendPasswordReset(email: string): Promise<{ ok: boolean; reason?: AuthErrorReason }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: PASSWORD_RESET_URL });
  return error ? { ok: false, reason: classifyAuthError(error) } : { ok: true };
}

export async function updatePassword(password: string): Promise<{ ok: boolean; reason?: AuthErrorReason }> {
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { ok: false, reason: classifyAuthError(error) } : { ok: true };
}

/** Pulls `code` / error params out of a deep link (query or fragment). */
export function parseAuthLink(params: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    code: one(params.code),
    error: one(params.error_code) ?? one(params.error),
    errorDescription: one(params.error_description),
  };
}

/** Exchanges a PKCE code from an email/OAuth link for a real session. */
export async function exchangeAuthCode(code: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return { ok: false, reason: classifyAuthError(error), message: error?.message };
  return { ok: true, userId: data.user.id, email: data.user.email ?? null, provider: providerOf(data.user) };
}

// ------------------------------------------------------------ apple/google --

function randomNonce(length = 32) {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Native "Sign in with Apple" (iOS only) -> Supabase signInWithIdToken.
 * Supabase verifies the Apple-issued identity token and mints a real session.
 */
export async function signInWithApple(): Promise<AuthOutcome> {
  if (Platform.OS !== 'ios') return { ok: false, reason: 'unavailable' };
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) return { ok: false, reason: 'unavailable' };

  const rawNonce = randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { ok: false, reason: 'unknown', message: 'Apple did not return an identity token' };

    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error || !data.user) return { ok: false, reason: classifyAuthError(error), message: error?.message };
    return { ok: true, userId: data.user.id, email: data.user.email ?? null, provider: 'apple' };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'unknown', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Google via Supabase OAuth (PKCE): open the consent page in an auth session,
 * then exchange the returned `code` for a real Supabase session.
 * (The previous build passed the whole redirect URL to exchangeCodeForSession,
 * which expects only the code, so Google sign-in could never complete.)
 */
export async function signInWithGoogle(): Promise<AuthOutcome> {
  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'haratna', path: 'auth/callback' });
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url)
    return { ok: false, reason: classifyAuthError(error), message: error?.message ?? 'Could not start Google sign-in' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') return { ok: false, reason: 'cancelled' };
  if (result.type !== 'success' || !result.url)
    return { ok: false, reason: 'unknown', message: `Unexpected auth session result: ${result.type}` };

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) {
    const desc = url.searchParams.get('error_description') ?? new URLSearchParams(url.hash.replace(/^#/, '')).get('error_description');
    return { ok: false, reason: 'unknown', message: desc ?? 'Google did not return an authorization code' };
  }
  return exchangeAuthCode(code);
}

export async function signOutSupabase(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSupabaseUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
