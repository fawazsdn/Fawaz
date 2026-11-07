import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emailConfig, fetchEmailEvent, renderReplyEmail, sendEmail, type EmailConfig } from './email.ts';
import { filtersToQuery, parseTicketFilters } from './filters.ts';

const cfg: EmailConfig = { apiKey: 're_test', from: 'Haratna <support@example.com>', apiBase: 'https://resend.test' };
const msg = { to: 'a@example.com', subject: 's', html: '<p>h</p>', text: 't' };

function fakeFetch(responses: Array<{ status: number; body?: unknown } | 'network'>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next || next === 'network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('emailConfig requires an API key and a from address; never invents defaults', () => {
  assert.equal(emailConfig({}), null);
  assert.equal(emailConfig({ RESEND_API_KEY: 'k' }), null);
  const c = emailConfig({ RESEND_API_KEY: 'k', SUPPORT_REPLY_FROM: 'Haratna <s@x.io>', SUPPORT_REPLY_TO: 'r@x.io' });
  assert.deepEqual(c, { apiKey: 'k', from: 'Haratna <s@x.io>', replyTo: 'r@x.io', apiBase: 'https://api.resend.com' });
});

test('reply email escapes HTML, includes the reference and blocks header injection', () => {
  const e = renderReplyEmail({
    reference: 'HR-ABCDEF12',
    customerName: 'Sara\r\nBcc: evil@x.io',
    subject: 'Help\nBcc: evil@x.io',
    response: '<script>alert(1)</script>\n\nSecond paragraph & more',
    locale: 'en',
  });
  assert.ok(!e.subject.includes('\n') && !e.subject.includes('\r'));
  assert.match(e.subject, /\[HR-ABCDEF12\]/);
  assert.ok(!e.html.includes('<script>'));
  assert.match(e.html, /&lt;script&gt;/);
  assert.match(e.html, /HR-ABCDEF12/);
  assert.match(e.html, /Second paragraph &amp; more/);
  assert.match(e.text, /HR-ABCDEF12/);
  assert.ok(!/Sara\r?\nBcc/.test(e.html));
  const ar = renderReplyEmail({ reference: 'HR-1', customerName: null, subject: null, response: 'مرحبا', locale: 'ar' });
  assert.match(ar.html, /dir="rtl"/);
  assert.match(ar.subject, /رد على طلبك/);
});

test('sendEmail succeeds and sends the idempotency key', async () => {
  const f = fakeFetch([{ status: 200, body: { id: 'msg_1' } }]);
  const r = await sendEmail(cfg, msg, 'key-1', { fetchImpl: f.impl, backoffMs: 1 });
  assert.deepEqual(r, { ok: true, id: 'msg_1', attempts: 1 });
  assert.equal((f.calls[0].init.headers as Record<string, string>)['Idempotency-Key'], 'key-1');
  assert.equal(f.calls[0].url, 'https://resend.test/emails');
  assert.deepEqual(JSON.parse(String(f.calls[0].init.body)).to, ['a@example.com']);
});

test('sendEmail retries 5xx/429/network failures with the same key, then succeeds', async () => {
  const f = fakeFetch([{ status: 500 }, 'network', { status: 200, body: { id: 'msg_2' } }]);
  const r = await sendEmail(cfg, msg, 'key-2', { fetchImpl: f.impl, backoffMs: 1 });
  assert.deepEqual(r, { ok: true, id: 'msg_2', attempts: 3 });
  assert.ok(f.calls.every((c) => (c.init.headers as Record<string, string>)['Idempotency-Key'] === 'key-2'));
});

test('sendEmail does not retry 4xx and reports the provider error', async () => {
  const f = fakeFetch([{ status: 422, body: { name: 'validation_error', message: 'Invalid `to` field' } }]);
  const r = await sendEmail(cfg, msg, 'key-3', { fetchImpl: f.impl, backoffMs: 1 });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.retryable, false);
    assert.match(r.error, /422 validation_error/);
  }
  assert.equal(f.calls.length, 1);
});

test('sendEmail gives up after max attempts and never claims success', async () => {
  const f = fakeFetch([{ status: 503 }, { status: 503 }, { status: 503 }]);
  const r = await sendEmail(cfg, msg, 'key-4', { fetchImpl: f.impl, backoffMs: 1 });
  assert.equal(r.ok, false);
  assert.equal(f.calls.length, 3);
  const noId = fakeFetch([{ status: 200, body: {} }]);
  assert.equal((await sendEmail(cfg, msg, 'key-5', { fetchImpl: noId.impl, maxAttempts: 1 })).ok, false);
});

test('fetchEmailEvent reads last_event and rejects unsafe ids', async () => {
  const f = fakeFetch([{ status: 200, body: { last_event: 'delivered' } }]);
  assert.equal(await fetchEmailEvent(cfg, 'msg_1', f.impl), 'delivered');
  assert.equal(await fetchEmailEvent(cfg, '../secrets', f.impl), null);
});

test('ticket filters drop unknown or malformed values', () => {
  const f = parseTicketFilters({
    status: 'open',
    source: 'evil',
    category: 'billing',
    from: '2026-11-01',
    to: 'yesterday',
    page: '-3',
    q: 'x'.repeat(500),
  });
  assert.equal(f.status, 'open');
  assert.equal(f.source, undefined);
  assert.equal(f.category, undefined);
  assert.equal(f.from, '2026-11-01');
  assert.equal(f.to, undefined);
  assert.equal(f.page, 1);
  assert.equal(f.q?.length, 100);
  assert.equal(filtersToQuery({ status: 'open', q: 'a b' }, 2), '?status=open&q=a+b&page=2');
});
