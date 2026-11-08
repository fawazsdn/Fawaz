import assert from 'node:assert/strict';
import test from 'node:test';

import { ajyalSearchRequest, discoverAjyalPlaceIds } from './ajyal-places.ts';

test('rejects arbitrary search strings, sectors, and methods', () => {
  assert.equal(ajyalSearchRequest({ method: 'text', sector: 'center', category: 'arbitrary' }), null);
  assert.equal(ajyalSearchRequest({ method: 'text', sector: '__proto__', category: 'restaurant' }), null);
  assert.equal(ajyalSearchRequest({ method: 'details', sector: 'center', category: 'restaurant' }), null);
});

test('bounds searches, requests IDs only, and deduplicates provider results', async () => {
  const search = ajyalSearchRequest({ method: 'text', sector: 'northwest', category: 'pharmacy' });
  assert.ok(search);
  assert.ok('locationRestriction' in search.body);
  const result = await discoverAjyalPlaceIds(search, 'test-key', async (url, options) => {
    assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(new Headers(options?.headers).get('X-Goog-FieldMask'), 'places.id,nextPageToken');
    assert.equal(options?.cache, 'no-store');
    return Response.json({ places: [{ id: 'one' }, { id: 'one' }, { id: 'two' }], nextPageToken: 'unused' });
  });
  assert.deepEqual(result, { ids: ['one', 'two'], possiblyIncomplete: true });
});

test('does not retry quota failures', async () => {
  const search = ajyalSearchRequest({ method: 'nearby', sector: 'center', category: 'park' });
  assert.ok(search);
  let calls = 0;
  await assert.rejects(
    discoverAjyalPlaceIds(search, 'test-key', async () => {
      calls++;
      return new Response(null, { status: 429 });
    }),
    /quota_exhausted/,
  );
  assert.equal(calls, 1);
});
