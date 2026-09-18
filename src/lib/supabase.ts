import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

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
// pair secret. EXPO_PUBLIC_* env vars can override them for a different
// environment (e.g. a staging Supabase project) without a code change.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ckqwziutmqohihrenstz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcXd6aXV0bXFvaGlocmVuc3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTU1NDUsImV4cCI6MjEwMzA5MTU0NX0.EBr_g8UfZ0OVM3haGV_Stzfox20b1vZMdEz0861UkOg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: isServer ? noopStorage : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
});
