// Deno resolves versioned npm specifiers at runtime.
// eslint-disable-next-line import/no-unresolved
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.1.3';

const issuer = 'https://appleid.apple.com';
const clientId = 'sa.haratna.app';
const appleKeys = createRemoteJWKSet(new URL(issuer + '/auth/keys'));

async function verifyAppleSubject(token: string): Promise<string | undefined> {
  const { payload } = await jwtVerify(token, appleKeys, { issuer, audience: clientId, algorithms: ['RS256'] });
  return payload.sub;
}

/** Exchange the fresh code and revoke only a token for an Apple identity linked to the caller. */
export async function revokeAppleAuthorization(
  code: string,
  clientSecret: string,
  subjects: readonly string[],
  request = fetch,
  verifiedSubject = verifyAppleSubject,
): Promise<void> {
  const credentials = { client_id: clientId, client_secret: clientSecret };
  const tokenResponse = await request(issuer + '/auth/token', {
    method: 'POST',
    body: new URLSearchParams({ ...credentials, grant_type: 'authorization_code', code }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) throw new Error('Apple code exchange failed');

  const { id_token, refresh_token, access_token } = await tokenResponse.json();
  const subject = typeof id_token === 'string' ? await verifiedSubject(id_token) : undefined;
  if (!subject || !subjects.includes(subject)) throw new Error('Apple identity does not match');
  const refresh = typeof refresh_token === 'string' && refresh_token;
  const token = refresh || access_token;
  if (typeof token !== 'string' || !token) throw new Error('Apple did not issue a revocable token');

  const revoke = await request(issuer + '/auth/revoke', {
    method: 'POST',
    body: new URLSearchParams({ ...credentials, token, token_type_hint: refresh ? 'refresh_token' : 'access_token' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!revoke.ok) throw new Error('Apple token revocation failed');
}
