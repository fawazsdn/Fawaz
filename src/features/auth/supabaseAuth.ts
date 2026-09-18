import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type SignInProvider = 'apple' | 'google';

export type SignInOutcome =
  | { ok: true; userId: string }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'error'; message: string };

function randomNonce(length = 32) {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Native "Sign in with Apple" (iOS only) -> Supabase signInWithIdToken.
 * Supabase gets a real Apple-issued identity token; it verifies it and
 * mints a real Supabase session with a real auth.uid(). Nothing here can
 * be spoofed by the client into an arbitrary user id.
 */
export async function signInWithApple(): Promise<SignInOutcome> {
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

    if (!credential.identityToken) {
      return { ok: false, reason: 'error', message: 'Apple did not return an identity token' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error || !data.user) {
      return { ok: false, reason: 'error', message: error?.message ?? 'Unknown Supabase auth error' };
    }
    return { ok: true, userId: data.user.id };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'ERR_REQUEST_CANCELED') return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Google sign-in via Supabase OAuth: open the provider's consent page in an
 * auth browser session, then exchange the returned authorization code for a
 * real Supabase session (PKCE). The client never sees or sets a user id
 * directly — Supabase issues it after verifying the OAuth code.
 */
export async function signInWithGoogle(): Promise<SignInOutcome> {
  const redirectTo = AuthSession.makeRedirectUri({ scheme: 'haratna', path: 'auth/callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return { ok: false, reason: 'error', message: error?.message ?? 'Could not start Google sign-in' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, reason: 'cancelled' };
  }
  if (result.type !== 'success' || !result.url) {
    return { ok: false, reason: 'error', message: `Unexpected auth session result: ${result.type}` };
  }

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
  if (exchangeError || !sessionData.user) {
    return { ok: false, reason: 'error', message: exchangeError?.message ?? 'Could not complete Google sign-in' };
  }
  return { ok: true, userId: sessionData.user.id };
}

export async function signOutSupabase(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSupabaseUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
