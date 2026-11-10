import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import { clearPrivateMediaCaches } from '@/backend/mediaPrivacy';

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
  | 'google_failed'
  | 'google_expired'
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

export async function verifySignupCode(email: string, token: string): Promise<AuthOutcome> {
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
  if (error || !data.session || !data.user) return { ok: false, reason: classifyAuthError(error) };
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
  if (error || !data.user || !data.session) return { ok: false, reason: classifyAuthError(error), message: error?.message };
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
function googleErrorReason(reason: AuthErrorReason): AuthErrorReason {
  if (reason === 'network' || reason === 'rate_limited') return reason;
  if (reason === 'link_expired') return 'google_expired';
  return 'google_failed';
}

export async function signInWithGoogle(): Promise<AuthOutcome> {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_CALLBACK_URL, skipBrowserRedirect: true, scopes: 'openid email profile' },
    });
    if (error || !data.url) return { ok: false, reason: googleErrorReason(classifyAuthError(error)) };

    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_CALLBACK_URL);
    if (result.type === 'cancel' || result.type === 'dismiss') return { ok: false, reason: 'cancelled' };
    if (result.type !== 'success') return { ok: false, reason: 'google_failed' };

    const callback = new URL(result.url);
    if (
      callback.protocol !== 'haratna:' ||
      callback.host !== 'auth' ||
      callback.pathname !== '/callback' ||
      callback.username ||
      callback.password
    )
      return { ok: false, reason: 'google_failed' };
    const errorCode = callback.searchParams.get('error') ?? new URLSearchParams(callback.hash.slice(1)).get('error');
    if (errorCode) return { ok: false, reason: 'google_failed' };
    const codes = callback.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0]) return { ok: false, reason: 'google_failed' };
    const outcome = await exchangeAuthCode(codes[0]);
    return outcome.ok ? outcome : { ok: false, reason: googleErrorReason(outcome.reason) };
  } catch (error) {
    return { ok: false, reason: googleErrorReason(classifyAuthError(error instanceof Error ? error : undefined)) };
  }
}

export const APPLE_ACCOUNT_DELETION_FUNCTION = 'delete-account-v2';

/** Request a fresh Apple code only for accounts with a linked Apple identity. */
export async function requestAppleDeletionCode(): Promise<string | undefined> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Could not verify the current account');
  const { identities, app_metadata } = data.user;
  const hasApple = identities?.some((identity) => identity.provider === 'apple') ||
    app_metadata.provider === 'apple' || app_metadata.providers?.includes('apple');
  if (!hasApple) return undefined;
  if (Platform.OS !== 'ios' || !(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Apple authorization unavailable');
  }
  const capability = await supabase.functions.invoke(APPLE_ACCOUNT_DELETION_FUNCTION, { method: 'GET' });
  if (capability.error || capability.data?.appleRevocation !== true) {
    throw new Error('Apple authorization unavailable');
  }
  const credential = await AppleAuthentication.signInAsync();
  if (!credential.authorizationCode) throw new Error('Apple authorization code missing');
  return credential.authorizationCode;
}

export async function signOutSupabase(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } finally {
    // Private photos and signed links must not survive a sign-out on a shared device.
    await clearPrivateMediaCaches();
  }
}

export async function getSupabaseUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
