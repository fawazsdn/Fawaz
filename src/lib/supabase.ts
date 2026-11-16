import 'react-native-url-polyfill/auto';
import PRODUCTION_PUBLISHABLE_KEY from './productionPublishableKey';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { resolveBackend, type BackendExtra } from './backendConfig';

// expo-router's static web export pre-renders every route once in Node
// (no `window`/localStorage there) — AsyncStorage's web implementation
// touches `window.localStorage` as soon as GoTrue reads a session, which
// crashes that server-side pass. A no-op storage on the server is
// correct: there's no real user session to restore during a static build
// anyway, and the browser/native runtime always gets the real AsyncStorage.
const isServer = typeof window === 'undefined';
const noopStorage: SupportedStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

// These are Supabase's *publishable* URL/key for the Haratna project — safe to
// ship in the client bundle by design (equivalent to a Firebase web config).
// All real data access is enforced server-side by RLS, never by keeping this
// pair secret. A staging build names its own backend (see backendConfig.ts and
// app.config.js) and refuses to fall back to these.
const backend = resolveBackend(
  Constants.expoConfig?.extra as BackendExtra | undefined,
  { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY },
  PRODUCTION_PUBLISHABLE_KEY,
);
const SUPABASE_URL = backend.url;
const SUPABASE_PUBLISHABLE_KEY = backend.key;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isServer ? noopStorage : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
    // PKCE: email-confirmation, password-reset and OAuth links come back to
    // the app as haratna://...?code=..., which only the device that started
    // the flow can exchange (the code verifier never leaves this device).
    flowType: 'pkce',
  },
});
