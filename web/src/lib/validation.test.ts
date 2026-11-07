import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rateLimit, resetRateLimitForTests } from './rate-limit.ts';
import { validateSupport } from './validation.ts';

const good = {
  name: '  Sara ',
  email: ' Sara@Example.COM ',
  category: 'verification',
  subject: 'Cannot   verify',
  message: 'The verify button says I am outside my neighborhood.',
};

test('accepts a valid request and normalizes it', () => {
  const r = validateSupport(good);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.name, 'Sara');
    assert.equal(r.value.email, 'sara@example.com');
    assert.equal(r.value.subject, 'Cannot verify');
  }
});

test('name is optional', () => {
  const r = validateSupport({ ...good, name: '' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.name, null);
});

test('rejects missing and malformed fields', () => {
  const r = validateSupport({ email: 'nope', category: 'billing', subject: 'a', message: 'short' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.errors, { email: 'invalid', category: 'invalid', subject: 'tooShort', message: 'tooShort' });
  const empty = validateSupport({});
  if (!empty.ok) assert.deepEqual(empty.errors, { email: 'required', category: 'required', subject: 'required', message: 'required' });
});

test('rejects oversized input and non-string values', () => {
  const r = validateSupport({ ...good, message: 'x'.repeat(3001), name: 'n'.repeat(101) });
  if (!r.ok) assert.deepEqual(r.errors, { message: 'tooLong', name: 'tooLong' });
  const weird = validateSupport({ ...good, email: { $gt: '' } as unknown as string });
  assert.equal(weird.ok, false);
});

test('strips control characters', () => {
  const r = validateSupport({ ...good, message: 'Hello\u0000 there, the app crashes when I open the map.' });
  assert.equal(r.ok, true);
  if (r.ok) assert.ok(!r.value.message.includes('\u0000'));
});

test('rate limiter blocks after the limit within the window', () => {
  resetRateLimitForTests();
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(rateLimit('k', 5, 60_000, t0 + i).ok, true);
  const blocked = rateLimit('k', 5, 60_000, t0 + 10);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterS > 0);
  assert.equal(rateLimit('k', 5, 60_000, t0 + 60_001).ok, true);
});
