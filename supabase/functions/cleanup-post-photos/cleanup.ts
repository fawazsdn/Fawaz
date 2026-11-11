/**
 * Abandoned post-photo cleanup (see migration 20261110090000).
 *
 * Protocol, safe against concurrent publication and against failures:
 *   1. claim_abandoned_post_photos  -> the database marks uploads 'deleting'
 *      (never publishable again) before any file is touched; uploads a live
 *      post uses, or a publication in progress has locked, are never claimed.
 *   2. Storage remove of exactly the claimed paths.
 *   3. finish_post_photo_cleanup(deleted, failed) -> records of deleted files
 *      are dropped; failed ones stay claimed and are retried by the next run.
 * If the job dies between 1 and 3, the claims become due again after
 * `staleAfter` and the next run finishes them (removing a missing file is a no-op).
 */

export interface CleanupClient {
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  storage: { from(bucket: string): { remove(paths: string[]): Promise<{ data: unknown; error: { message: string } | null }> } };
}

export interface CleanupOptions {
  olderThanHours?: number;
  batchSize?: number;
  maxBatches?: number;
  staleAfterMinutes?: number;
  dryRun?: boolean;
}

export interface CleanupResult {
  dryRun: boolean;
  preview?: unknown;
  claimed: number;
  deleted: number;
  failed: number;
  batches: number;
}

const BUCKET = 'community-media';

export async function runCleanup(client: CleanupClient, opts: CleanupOptions = {}): Promise<CleanupResult> {
  const olderThan = `${Math.max(1, Math.floor(opts.olderThanHours ?? 24))} hours`;
  const staleAfter = `${Math.max(5, Math.floor(opts.staleAfterMinutes ?? 60))} minutes`;
  const batchSize = Math.min(Math.max(1, Math.floor(opts.batchSize ?? 100)), 1000);
  const maxBatches = Math.min(Math.max(1, Math.floor(opts.maxBatches ?? 10)), 100);
  const result: CleanupResult = { dryRun: !!opts.dryRun, claimed: 0, deleted: 0, failed: 0, batches: 0 };

  if (opts.dryRun) {
    const { data, error } = await client.rpc('count_abandoned_post_photos', { older_than: olderThan });
    if (error) throw new Error(`preview failed: ${error.message}`);
    result.preview = data;
    return result;
  }

  for (let i = 0; i < maxBatches; i += 1) {
    const { data, error } = await client.rpc('claim_abandoned_post_photos', {
      older_than: olderThan,
      max_rows: batchSize,
      stale_after: staleAfter,
    });
    if (error) throw new Error(`claim failed: ${error.message}`);
    const paths = ((data ?? []) as { object_path: string }[]).map((r) => r.object_path).filter((p) => p.startsWith('posts/'));
    if (paths.length === 0) break;
    result.batches += 1;
    result.claimed += paths.length;

    let deleted: string[] = [];
    let failed: string[] = [];
    const removal = await client.storage.from(BUCKET).remove(paths);
    if (removal.error) failed = paths;
    else deleted = paths;

    const fin = await client.rpc('finish_post_photo_cleanup', { deleted_paths: deleted, failed_paths: failed });
    // If finishing fails the claims simply become due again after staleAfter.
    if (fin.error) throw new Error(`finish failed: ${fin.error.message}`);
    result.deleted += deleted.length;
    result.failed += failed.length;
    if (failed.length > 0) break; // Storage is unhappy: stop, retry next run
  }
  return result;
}
