// Dynamic config on top of app.json (Expo passes the static config in as `config`).
//
// Default: unchanged - the production app, sa.haratna.app, exactly as app.json says.
// APP_VARIANT=staging: "Haratna Staging", sa.haratna.app.staging, for private internal
// TestFlight testing against the hosted staging Supabase project. It installs side by
// side with the production app (build 13 stays on the phone) and can't be submitted as
// the real app by mistake.
const PRODUCTION_PROJECT_REF = 'ckqwziutmqohihrenstz';

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'staging') return config;

  // The app falls back to the production backend when no URL is set
  // (src/lib/supabase.ts), so a staging build must name its backend explicitly.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!url || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Staging build: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for the staging project.');
  }
  if (url.includes(PRODUCTION_PROJECT_REF)) {
    throw new Error('Staging build: EXPO_PUBLIC_SUPABASE_URL points at the production project.');
  }

  return {
    ...config,
    name: 'Haratna Staging',
    scheme: 'haratna-staging',
    ios: {
      ...config.ios,
      bundleIdentifier: 'sa.haratna.app.staging',
      // Its own App Store Connect record; numbered from STAGING_BUILD_NUMBER (eas.json).
      buildNumber: process.env.STAGING_BUILD_NUMBER ?? config.ios?.buildNumber,
      // Staging Auth has email and password only (no Apple or Google providers).
      usesAppleSignIn: false,
    },
    android: config.android ? { ...config.android, package: `${config.android.package}.staging` } : config.android,
  };
};
