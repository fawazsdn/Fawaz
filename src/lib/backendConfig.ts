/**
 * Which Supabase project the app talks to.
 *
 * Order: the backend validated by app.config.js and embedded in the native app
 * config (`extra.supabaseUrl/supabaseAnonKey`, staging builds), then EXPO_PUBLIC_*
 * build-time variables, then the production project.
 *
 * The staging app ("Haratna Staging") must never reach production: if it would,
 * this throws at startup instead. A Release build on the Mac once embedded a stale
 * JS bundle without the staging URL (Metro cache), which would otherwise have fallen
 * back to production silently.
 */
export const PRODUCTION_PROJECT_REF = 'ckqwziutmqohihrenstz';
export const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

export interface BackendExtra {
  appVariant?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export function resolveBackend(
  extra: BackendExtra | undefined,
  env: { url?: string; key?: string },
  productionKey: string,
): { url: string; key: string } {
  const staging = extra?.appVariant === 'staging';
  const url = extra?.supabaseUrl || env.url || (staging ? '' : PRODUCTION_SUPABASE_URL);
  const key = extra?.supabaseAnonKey || env.key || (staging ? '' : productionKey);
  if (staging && (!url || !key || url.includes(PRODUCTION_PROJECT_REF))) {
    throw new Error('Haratna Staging has no staging backend configured and must not use production.');
  }
  return { url, key };
}
