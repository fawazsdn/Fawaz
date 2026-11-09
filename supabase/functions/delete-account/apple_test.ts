import { revokeAppleAuthorization } from './apple.ts';

Deno.test('revokes only the verified linked identity using the refresh token', async () => {
  const requests: { url: string; body: URLSearchParams }[] = [];
  const request: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), body: init?.body as URLSearchParams });
    return requests.length === 1
      ? Response.json({ id_token: 'signed', refresh_token: 'refresh', access_token: 'access' })
      : new Response(null, { status: 200 });
  };
  await revokeAppleAuthorization('fresh-code', 'server-secret', ['owner'], request, async () => 'owner');
  if (!requests[0]?.url.endsWith('/auth/token') || requests[0].body.get('code') !== 'fresh-code' ||
      !requests[1]?.url.endsWith('/auth/revoke') || requests[1].body.get('token') !== 'refresh' ||
      requests[1].body.get('token_type_hint') !== 'refresh_token') throw new Error('Unexpected Apple requests');
});

Deno.test('never revokes a token for a different Apple identity', async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    return Response.json({ id_token: 'signed', refresh_token: 'refresh' });
  };
  await revokeAppleAuthorization('code', 'secret', ['owner'], request, async () => 'other').then(
    () => { throw new Error('Unexpected success'); },
    () => { if (calls !== 1) throw new Error('Revocation was attempted for a different identity'); },
  );
});

Deno.test('treats provider rejection as failure', async () => {
  let calls = 0;
  const request: typeof fetch = async () => ++calls === 1
    ? Response.json({ id_token: 'signed', access_token: 'access' })
    : new Response(null, { status: 503 });
  await revokeAppleAuthorization('code', 'secret', ['owner'], request, async () => 'owner').then(
    () => { throw new Error('Unexpected success'); },
    () => { if (calls !== 2) throw new Error('Revocation was not attempted'); },
  );
});
