// Deno resolves versioned npm specifiers at runtime.
// eslint-disable-next-line import/no-unresolved
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { revokeAppleAuthorization } from './apple.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: jsonHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration is incomplete' }), { status: 500, headers: jsonHeaders });
  }

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: jsonHeaders });
  }

  if (request.method === 'GET') {
    return Response.json({ appleRevocation: Boolean(Deno.env.get('HARATNA_APPLE_CLIENT_SECRET')) });
  }

  const appleIdentities = (userData.user.identities ?? []).filter((identity) => identity.provider === 'apple');
  if (appleIdentities.length || userData.user.app_metadata?.provider === 'apple' || userData.user.app_metadata?.providers?.includes('apple')) {
    const body = await request.json().catch(() => null);
    const code = body?.appleAuthorizationCode;
    if (typeof code !== 'string' || !code || code.length > 2048) {
      return new Response(JSON.stringify({ error: 'apple_reauthorization_required' }), { status: 409, headers: jsonHeaders });
    }
    const secret = Deno.env.get('HARATNA_APPLE_CLIENT_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'apple_revocation_unavailable' }), { status: 503, headers: jsonHeaders });
    }
    const subjects = appleIdentities.map((identity) => identity.identity_data?.sub ?? identity.id);
    try {
      await revokeAppleAuthorization(code, secret, subjects);
    } catch {
      return new Response(JSON.stringify({ error: 'apple_revocation_failed' }), { status: 409, headers: jsonHeaders });
    }
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const accessToken = authorization.replace(/^Bearer\s+/i, '');
  const { data: attachments, error: attachmentError } = await admin
    .from('media_attachments')
    .select('bucket_id,object_path')
    .eq('owner_id', userData.user.id);
  if (attachmentError) {
    return new Response(JSON.stringify({ error: attachmentError.message }), { status: 500, headers: jsonHeaders });
  }

  // Every file the account uploaded: what media_attachments recorded, plus a
  // sweep of the account's own folders in case a record was never written.
  const toRemove = new Map<string, Set<string>>();
  const add = (bucket: string, path: string) => {
    if (!toRemove.has(bucket)) toRemove.set(bucket, new Set());
    toRemove.get(bucket)!.add(path);
  };
  for (const item of attachments ?? []) {
    if (['avatars', 'community-media', 'profile-photos'].includes(item.bucket_id)) add(item.bucket_id, item.object_path);
  }
  const ownFolders: [string, string][] = [
    ['avatars', userData.user.id],
    ['profile-photos', userData.user.id],
    ['community-media', `posts/${userData.user.id}`],
  ];
  for (const [bucket, folder] of ownFolders) {
    for (let offset = 0; ; offset += 100) {
      const { data: listed, error: listError } = await admin.storage.from(bucket).list(folder, { limit: 100, offset });
      // A bucket that doesn't exist yet (before the private-photo migration) has nothing to sweep.
      if (listError || !listed || listed.length === 0) break;
      for (const entry of listed) if (entry.id) add(bucket, `${folder}/${entry.name}`);
      if (listed.length < 100) break;
    }
  }
  for (const [bucket, set] of toRemove) {
    const paths = [...set];
    for (let i = 0; i < paths.length; i += 100) {
      const { error: storageError } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (storageError) {
        return new Response(JSON.stringify({ error: storageError.message }), { status: 500, headers: jsonHeaders });
      }
    }
  }

  const { error: purgeError } = await admin.rpc('purge_account_data', { target_user_id: userData.user.id });
  if (purgeError) {
    return new Response(JSON.stringify({ error: purgeError.message }), { status: 500, headers: jsonHeaders });
  }

  // Revoke refresh tokens before deleting the identity. The currently issued
  // JWT remains cryptographically valid until its short expiry, but all of its
  // user-owned rows are gone and refresh is no longer possible.
  const { error: revokeError } = await admin.auth.admin.signOut(accessToken);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: jsonHeaders });
  }

  return new Response(
    JSON.stringify({ deleted: true, sessions_revoked: !revokeError }),
    { status: 200, headers: jsonHeaders },
  );
});
