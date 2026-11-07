'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { rateLimit } from '@/lib/rate-limit';
import {
  AdminDataError,
  claimReplyEmail,
  getTicket,
  recordReplyEmail,
  respondToTicket,
  setTicketStatus,
  updateReplyEmailStatus,
  type TicketStatus,
} from '@/lib/admin/data';
import { emailConfig, fetchEmailEvent, renderReplyEmail, sendEmail } from '@/lib/admin/email';
import { ADMIN_LOCALE_COOKIE, adminDict } from '@/lib/admin/i18n';
import { ADMIN_PREFS_COOKIE, adminLocale, PREF_COOKIE_OPTIONS } from '@/lib/admin/prefs';
import { NotStaffError, requireStaff } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/admin/supabase';

/**
 * Every action re-checks the staff role on the server (requireStaff), then
 * calls database functions that check it again. Next.js server actions also
 * reject cross-origin POSTs (Origin must match Host), and session cookies are
 * SameSite=Lax, which together protect against CSRF.
 */

export type ActionResult = { kind: 'idle' } | { kind: 'ok' | 'warn' | 'error'; message: string; at: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function messages() {
  return adminDict(await adminLocale()).result;
}

async function guard(id: unknown, bucket: string, limit: number, windowMs: number) {
  const staff = await requireStaff();
  if (typeof id !== 'string' || !UUID.test(id)) throw new AdminDataError('not found');
  if (!rateLimit(`${bucket}:${staff.id}`, limit, windowMs).ok) throw new AdminDataError('rate_limited');
  return staff;
}

async function errorResult(e: unknown): Promise<ActionResult> {
  const m = await messages();
  if (e instanceof NotStaffError) return { kind: 'error', message: m.errors.not_authorized, at: Date.now() };
  const code = e instanceof AdminDataError ? e.code : 'unavailable';
  if (!(e instanceof AdminDataError)) console.error('[admin] action failed', (e as Error)?.name);
  return { kind: 'error', message: m.errors[code] ?? m.errors.unavailable, at: Date.now() };
}

/**
 * Emails the saved response of a website ticket. The database claim makes
 * the send exclusive and refuses re-sending a reply the provider already
 * accepted; the Idempotency-Key stops Resend sending twice if a request is
 * retried. The outcome the provider reported is stored either way.
 */
async function sendReplyEmail(id: string): Promise<'accepted' | 'failed' | 'skipped'> {
  const cfg = emailConfig();
  if (!cfg) return 'skipped';
  const claim = await claimReplyEmail(id);
  const email = renderReplyEmail({
    reference: claim.reference,
    customerName: claim.contact_name,
    subject: claim.subject,
    response: claim.response,
    locale: claim.locale === 'en' ? 'en' : 'ar',
  });
  const result = await sendEmail(cfg, { to: claim.contact_email, ...email }, `haratna-support-reply/${id}/${claim.response_hash}`);
  await recordReplyEmail(id, claim.response_hash, result.ok, result.ok ? result.id : null, result.ok ? null : result.error);
  console.info('[admin] reply email', claim.reference, result.ok ? 'accepted' : 'failed', `attempts=${result.attempts}`);
  return result.ok ? 'accepted' : 'failed';
}

export async function respondAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = form.get('id');
  const response = String(form.get('response') ?? '').trim();
  const mode = String(form.get('mode') ?? 'save');
  try {
    await guard(id, 'respond', 20, 60_000);
    const m = await messages();
    if (!response || response.length > 3000) return { kind: 'error', message: m.errors['invalid:response'], at: Date.now() };
    const ticketId = id as string;
    await respondToTicket(ticketId, response, mode === 'close');
    const ticket = await getTicket(ticketId);
    revalidatePath('/admin', 'layout');
    if (!ticket) return { kind: 'ok', message: m.saved, at: Date.now() };
    if (ticket.source === 'app') return { kind: 'ok', message: m.savedNotified, at: Date.now() };
    if (ticket.source === 'website' && ticket.contact_email && mode !== 'save-only') {
      const outcome = await sendReplyEmail(ticketId).catch(async (e) => {
        if (e instanceof AdminDataError && e.code === 'email:already_sent') return 'accepted' as const;
        throw e;
      });
      revalidatePath('/admin', 'layout');
      if (outcome === 'accepted') return { kind: 'ok', message: m.emailAccepted, at: Date.now() };
      if (outcome === 'skipped') return { kind: 'warn', message: m.emailSkipped, at: Date.now() };
      return { kind: 'warn', message: m.emailFailed, at: Date.now() };
    }
    return { kind: 'ok', message: m.saved, at: Date.now() };
  } catch (e) {
    return errorResult(e);
  }
}

export async function sendEmailAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = form.get('id');
  try {
    await guard(id, 'email', 10, 10 * 60_000);
    const m = await messages();
    const outcome = await sendReplyEmail(id as string);
    revalidatePath('/admin', 'layout');
    if (outcome === 'accepted') return { kind: 'ok', message: m.emailAccepted, at: Date.now() };
    if (outcome === 'skipped') return { kind: 'warn', message: m.emailSkipped, at: Date.now() };
    return { kind: 'warn', message: m.emailFailed, at: Date.now() };
  } catch (e) {
    return errorResult(e);
  }
}

export async function checkDeliveryAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = form.get('id');
  try {
    await guard(id, 'delivery', 30, 10 * 60_000);
    const m = await messages();
    const cfg = emailConfig();
    const ticket = await getTicket(id as string);
    if (!cfg || !ticket?.email_message_id) return { kind: 'warn', message: m.emailSkipped, at: Date.now() };
    const event = await fetchEmailEvent(cfg, ticket.email_message_id);
    if (event) await updateReplyEmailStatus(ticket.id, ticket.email_message_id, event);
    revalidatePath('/admin', 'layout');
    return { kind: 'ok', message: m.deliveryChecked, at: Date.now() };
  } catch (e) {
    return errorResult(e);
  }
}

export async function statusAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = form.get('id');
  const status = String(form.get('status') ?? '') as TicketStatus;
  try {
    await guard(id, 'status', 30, 60_000);
    const m = await messages();
    if (!['open', 'answered', 'closed'].includes(status)) return { kind: 'error', message: m.errors['invalid:status'], at: Date.now() };
    await setTicketStatus(id as string, status);
    revalidatePath('/admin', 'layout');
    return { kind: 'ok', message: m.statusChanged, at: Date.now() };
  } catch (e) {
    return errorResult(e);
  }
}

/** Language is a harmless display preference, so it is allowed on the sign-in page too. */
export async function setLanguageAction(form: FormData) {
  const lang = form.get('lang') === 'en' ? 'en' : 'ar';
  (await cookies()).set(ADMIN_LOCALE_COOKIE, lang, PREF_COOKIE_OPTIONS);
  const back = String(form.get('back') ?? '/admin');
  redirect(back.startsWith('/admin') && !back.startsWith('//') ? back : '/admin');
}

export async function savePrefsAction(_: ActionResult, form: FormData): Promise<ActionResult> {
  try {
    await requireStaff();
    const prefs = { autoRefresh: form.get('autoRefresh') === 'on', alertNew: form.get('alertNew') === 'on' };
    (await cookies()).set(ADMIN_PREFS_COOKIE, JSON.stringify(prefs), PREF_COOKIE_OPTIONS);
    revalidatePath('/admin', 'layout');
    return { kind: 'ok', message: adminDict(await adminLocale()).settings.saved, at: Date.now() };
  } catch (e) {
    return errorResult(e);
  }
}

/** Signs out this browser, or every session of the account ("global"). */
export async function logoutAction(form: FormData) {
  const supabase = await createAdminClient();
  await supabase.auth.signOut({ scope: form.get('scope') === 'global' ? 'global' : 'local' }).catch(() => undefined);
  redirect('/admin/login');
}
