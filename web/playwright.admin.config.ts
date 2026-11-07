import { defineConfig, devices } from '@playwright/test';

/**
 * Admin dashboard end-to-end tests: the real production build, pointed at a
 * local stub of Supabase Auth/PostgREST and Resend (e2e/admin/stub-server.mjs).
 * Run `npm run build` first.
 */
const PORT = 3300;
const STUB = 54329;
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (process.env.PLAYWRIGHT_BROWSERS_PATH ? '/opt/pw-browsers/chromium' : undefined);

export default defineConfig({
  testDir: './e2e/admin',
  timeout: 45_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, launchOptions: executablePath ? { executablePath } : {}, ...devices['Desktop Chrome'] },
  webServer: [
    { command: `node e2e/admin/stub-server.mjs`, port: STUB, reuseExistingServer: false, env: { STUB_PORT: String(STUB) } },
    {
      command: `npx next start -p ${PORT}`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        SUPABASE_URL: `http://127.0.0.1:${STUB}`,
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_stub',
        RESEND_API_KEY: 're_stub_key_never_shown',
        RESEND_API_URL: `http://127.0.0.1:${STUB}`,
        SUPPORT_REPLY_FROM: 'Haratna Support <support@haratna.test>',
        NODE_USE_ENV_PROXY: '',
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
      },
    },
  ],
});
