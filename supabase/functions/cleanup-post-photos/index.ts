// Deno resolves versioned npm specifiers at runtime.
// eslint-disable-next-line import/no-unresolved
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { runCleanup, type CleanupClient } from './cleanup.ts';

/**
 * Scheduled job: removes abandoned post-photo uploads. Only the service role
 * may call it (e.g. pg_cron + pg_net with the service key). Not deployed; see
 * docs/HARATNA-SOCIAL-RESILIENCE-HANDOFF.claude.md before scheduling it.
 */
const jsonHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: jsonHeaders });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return new Response(JSON.stringify({ error: 'Server configuration is incomplete' }), { status: 500, headers: jsonHeaders });
  // Only the service role, never a resident's session.
  if (request.headers.get('Authorization') !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: jsonHeaders });
  }
  const body = await request.json().catch(() => ({}));
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const result = await runCleanup(admin as unknown as CleanupClient, {
      olderThanHours: Number(body?.olderThanHours) || undefined,
      batchSize: Number(body?.batchSize) || undefined,
      maxBatches: Number(body?.maxBatches) || undefined,
      dryRun: body?.dryRun === true,
    });
    return Response.json(result);
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: jsonHeaders });
  }
});
