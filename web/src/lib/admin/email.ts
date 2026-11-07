/**
 * Support reply emails through Resend (https://resend.com/docs/api-reference).
 * Server-only: the API key never reaches the browser. Kept free of Next.js
 * imports so it can be unit-tested with an injected fetch.
 *
 * Honesty about delivery: a 200 from POST /emails means Resend *accepted* the
 * message, not that it was delivered. "Delivered" is shown only after Resend's
 * GET /emails/{id} reports last_event = delivered.
 */

export interface ReplyEmailInput {
  reference: string;
  customerName: string | null;
  subject: string | null;
  response: string;
  locale: 'ar' | 'en';
}

export interface EmailConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
  apiBase: string;
}

export function emailConfig(env: Record<string, string | undefined> = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.SUPPORT_REPLY_FROM?.trim() || env.SUPPORT_NOTIFY_FROM?.trim();
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: env.SUPPORT_REPLY_TO?.trim() || undefined,
    apiBase: (env.RESEND_API_URL?.trim() || 'https://api.resend.com').replace(/\/$/, ''),
  };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Strips CR/LF so user-supplied text can never inject extra email headers. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export function renderReplyEmail(input: ReplyEmailInput): { subject: string; html: string; text: string } {
  const ar = input.locale === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const greeting = input.customerName
    ? ar
      ? `مرحباً ${oneLine(input.customerName)}،`
      : `Hello ${oneLine(input.customerName)},`
    : ar
      ? 'مرحباً،'
      : 'Hello,';
  const intro = ar ? 'رد فريق دعم حارتنا على طلبك:' : 'The Haratna support team replied to your request:';
  const refLabel = ar ? 'رقم الطلب' : 'Reference';
  const footer = ar
    ? 'للرد، أجب على هذه الرسالة واذكر رقم الطلب. حارتنا تجمعنا.'
    : 'To reply, answer this email and keep the reference number. Bringing Neighbors Together.';
  const subjectText = oneLine(
    `${ar ? 'رد على طلبك' : 'Reply to your request'} [${input.reference}]${input.subject ? ` · ${input.subject}` : ''}`,
  ).slice(0, 200);
  const paragraphs = input.response
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const html = `<!doctype html><html lang="${input.locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subjectText)}</title></head>
<body style="margin:0;background:#F4EFE3;font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#12231D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EFE3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border-radius:16px;overflow:hidden;border:1px solid #E2D9C5">
<tr><td style="background:#0D4939;padding:22px 28px;color:#F4EFE3;text-align:${ar ? 'right' : 'left'}" dir="${dir}">
<div style="font-size:22px;font-weight:bold">${ar ? 'حارتنا' : 'Haratna'}</div>
<div style="font-size:13px;color:#D2B078;margin-top:4px">${ar ? 'حارتنا تجمعنا' : 'Bringing Neighbors Together'}</div></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.8;text-align:${ar ? 'right' : 'left'}" dir="${dir}">
<p style="margin:0 0 12px">${esc(greeting)}</p>
<p style="margin:0 0 18px;color:#55665E">${esc(intro)}</p>
<div style="border-${ar ? 'right' : 'left'}:4px solid #D2B078;padding:4px 16px;margin:0 0 20px">${paragraphs}</div>
<p style="margin:0;font-size:13px;color:#55665E">${esc(refLabel)}: <strong dir="ltr" style="font-family:monospace;color:#0D4939">${esc(input.reference)}</strong></p>
</td></tr>
<tr><td style="background:#FBF8F1;padding:16px 28px;font-size:12px;color:#55665E;border-top:1px solid #E2D9C5;text-align:${ar ? 'right' : 'left'}" dir="${dir}">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = `${greeting}\n\n${intro}\n\n${input.response}\n\n${refLabel}: ${input.reference}\n\n${footer}`;
  return { subject: subjectText, html, text };
}

export type SendResult = { ok: true; id: string; attempts: number } | { ok: false; error: string; retryable: boolean; attempts: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends one email. The Idempotency-Key makes Resend return the original result
 * instead of sending twice if the same request is retried (network timeouts,
 * double submits). Retries only on 429/5xx/network errors, with backoff.
 */
export async function sendEmail(
  cfg: EmailConfig,
  msg: { to: string; subject: string; html: string; text: string },
  idempotencyKey: string,
  opts: { fetchImpl?: typeof fetch; maxAttempts?: number; backoffMs?: number } = {},
): Promise<SendResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const max = opts.maxAttempts ?? 3;
  let last: SendResult = { ok: false, error: 'not attempted', retryable: true, attempts: 0 };
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const res = await doFetch(`${cfg.apiBase}/emails`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({
          from: cfg.from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
      if (res.ok && data?.id) return { ok: true, id: data.id, attempts: attempt };
      const retryable = res.status === 429 || res.status >= 500;
      last = {
        ok: false,
        error: `${res.status} ${data?.name ?? ''} ${data?.message ?? ''}`.trim().slice(0, 300),
        retryable,
        attempts: attempt,
      };
      if (!retryable) return last;
    } catch (e) {
      last = { ok: false, error: `network: ${(e as Error).name}`, retryable: true, attempts: attempt };
    }
    if (attempt < max) await sleep((opts.backoffMs ?? 500) * 2 ** (attempt - 1));
  }
  return last;
}

/** Provider-reported state of a sent email (e.g. delivered, bounced). */
export async function fetchEmailEvent(cfg: EmailConfig, id: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return null;
  const res = await fetchImpl(`${cfg.apiBase}/emails/${id}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { last_event?: string } | null;
  return typeof data?.last_event === 'string' ? data.last_event : null;
}
