import { PRODUCTION_SUPABASE_URL, resolveBackend } from '../backendConfig';

const PROD_KEY = 'prod-publishable';

describe('resolveBackend', () => {
  it('production app: uses the production project by default', () => {
    expect(resolveBackend(undefined, {}, PROD_KEY)).toEqual({ url: PRODUCTION_SUPABASE_URL, key: PROD_KEY });
  });

  it('production app: EXPO_PUBLIC_* can still point a dev build elsewhere', () => {
    expect(resolveBackend({}, { url: 'http://127.0.0.1:54321', key: 'local' }, PROD_KEY)).toEqual({ url: 'http://127.0.0.1:54321', key: 'local' });
  });

  it('staging app: uses the backend embedded in its app config first', () => {
    const extra = { appVariant: 'staging', supabaseUrl: 'https://staging-ref.supabase.co', supabaseAnonKey: 'staging-key' };
    expect(resolveBackend(extra, { url: PRODUCTION_SUPABASE_URL, key: PROD_KEY }, PROD_KEY)).toEqual({ url: 'https://staging-ref.supabase.co', key: 'staging-key' });
  });

  it('staging app: refuses to start with no backend instead of falling back to production', () => {
    expect(() => resolveBackend({ appVariant: 'staging' }, {}, PROD_KEY)).toThrow(/must not use production/);
  });

  it('staging app: refuses the production project even when it is configured explicitly', () => {
    expect(() => resolveBackend({ appVariant: 'staging' }, { url: PRODUCTION_SUPABASE_URL, key: PROD_KEY }, PROD_KEY)).toThrow(/must not use production/);
    expect(() => resolveBackend({ appVariant: 'staging', supabaseUrl: PRODUCTION_SUPABASE_URL, supabaseAnonKey: 'k' }, {}, PROD_KEY)).toThrow();
  });
});
