import { isServiceRoleRequest, runCleanup, type CleanupClient } from './cleanup.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Minimal fake of the database protocol: staged -> deleting -> gone. */
function fake(paths: string[], { storageFails = false, finishFails = false, silentlySkip = [] as string[] } = {}) {
  const records = new Map(paths.map((p) => [p, 'staged' as 'staged' | 'deleting']));
  const files = new Set(paths);
  const calls: string[] = [];
  const client: CleanupClient = {
    rpc(fn, args = {}) {
      calls.push(fn);
      if (fn === 'claim_abandoned_post_photos') {
        const n = args.max_rows as number;
        const due = [...records.entries()].filter(([, s]) => s === 'staged').slice(0, n).map(([p]) => p);
        due.forEach((p) => records.set(p, 'deleting'));
        return Promise.resolve({ data: due.map((object_path) => ({ object_path })), error: null });
      }
      if (fn === 'finish_post_photo_cleanup') {
        if (finishFails) return Promise.resolve({ data: null, error: { message: 'db down' } });
        for (const p of args.deleted_paths as string[]) records.delete(p);
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'count_abandoned_post_photos') return Promise.resolve({ data: { staged_abandoned: records.size, deleting: 0 }, error: null });
      return Promise.resolve({ data: null, error: { message: 'unknown' } });
    },
    storage: {
      from: () => ({
        remove(ps: string[]) {
          calls.push('remove');
          if (storageFails) return Promise.resolve({ data: null, error: { message: 'storage down' } });
          // Like Storage: returns the objects actually deleted (as { name }), no error for skips.
          const done = ps.filter((p) => !silentlySkip.includes(p));
          done.forEach((p) => files.delete(p));
          return Promise.resolve({ data: done.map((name) => ({ name })), error: null });
        },
      }),
    },
  };
  return { client, records, files, calls };
}

Deno.test('claims before deleting, deletes only claimed files, finishes, in batches', async () => {
  const f = fake(['posts/u/1.jpg', 'posts/u/2.jpg', 'posts/u/3.jpg']);
  const r = await runCleanup(f.client, { batchSize: 2 });
  assert(r.claimed === 3 && r.deleted === 3 && r.failed === 0 && r.batches === 2, JSON.stringify(r));
  assert(f.records.size === 0 && f.files.size === 0, 'everything cleaned');
  assert(f.calls.indexOf('claim_abandoned_post_photos') < f.calls.indexOf('remove'), 'claim before remove');
});

Deno.test('a failed Storage delete is reported as failed (kept for retry) and the run stops', async () => {
  const f = fake(['posts/u/1.jpg', 'posts/u/2.jpg'], { storageFails: true });
  const r = await runCleanup(f.client, { batchSize: 1 });
  assert(r.failed === 1 && r.deleted === 0 && r.batches === 1, JSON.stringify(r));
  assert(f.files.size === 2, 'no file lost');
  assert([...f.records.values()].includes('deleting'), 'claimed record kept');
});

Deno.test('a failed finish surfaces an error (claims become due again later)', async () => {
  const f = fake(['posts/u/1.jpg'], { finishFails: true });
  let threw = false;
  try {
    await runCleanup(f.client);
  } catch {
    threw = true;
  }
  assert(threw, 'error surfaced');
});

Deno.test('dry run only previews', async () => {
  const f = fake(['posts/u/1.jpg']);
  const r = await runCleanup(f.client, { dryRun: true });
  assert(r.dryRun && r.claimed === 0 && f.calls.length === 1 && f.calls[0] === 'count_abandoned_post_photos', JSON.stringify(f.calls));
});

Deno.test('ignores anything outside posts/', async () => {
  const f = fake(['nb-1/u/legacy.jpg']);
  const r = await runCleanup(f.client);
  assert(r.deleted === 0 && f.files.has('nb-1/u/legacy.jpg'), 'legacy media untouched');
});


const jwt = (payload: Record<string, unknown>) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;

Deno.test('authorization: the service role is accepted by role claim or exact key', () => {
  assert(isServiceRoleRequest(`Bearer ${jwt({ role: 'service_role' })}`, 'sb_secret_x'), 'service_role claim');
  assert(isServiceRoleRequest('Bearer sb_secret_x', 'sb_secret_x'), 'exact key');
});

Deno.test('authorization: residents, anon and malformed tokens are refused', () => {
  assert(!isServiceRoleRequest(`Bearer ${jwt({ role: 'authenticated', sub: 'u' })}`, 'k'), 'authenticated');
  assert(!isServiceRoleRequest(`Bearer ${jwt({ role: 'anon' })}`, 'k'), 'anon');
  assert(!isServiceRoleRequest('Bearer not-a-jwt', 'k'), 'malformed');
  assert(!isServiceRoleRequest(null, 'k'), 'missing');
  assert(!isServiceRoleRequest('Basic abc', 'k'), 'wrong scheme');
});

Deno.test('a file Storage silently skips is not counted as deleted (record kept for retry)', async () => {
  const f = fake(['posts/u/a.jpg', 'posts/u/b.jpg'], { silentlySkip: ['posts/u/b.jpg'] });
  const r = await runCleanup(f.client, {});
  assert(r.deleted === 1 && r.failed === 1, `deleted ${r.deleted} failed ${r.failed}`);
  assert(f.records.has('posts/u/b.jpg'), 'record of the skipped file must remain');
  assert(!f.records.has('posts/u/a.jpg'), 'record of the deleted file is dropped');
});
