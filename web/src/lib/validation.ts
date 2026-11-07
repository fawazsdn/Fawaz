/**
 * Support-form validation, shared by the browser (instant feedback) and the
 * /api/support route (authoritative). The database function applies the same
 * limits again, so a request that skips the website is checked as well.
 */
export const CATEGORIES = ['account', 'verification', 'bug', 'safety', 'privacy', 'deletion', 'general', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const LIMITS = {
  name: 100,
  email: 254,
  subjectMin: 3,
  subject: 150,
  messageMin: 20,
  message: 3000,
} as const;

export type Field = 'name' | 'email' | 'category' | 'subject' | 'message';
export type FieldError = 'required' | 'invalid' | 'tooShort' | 'tooLong';

export interface SupportInput {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
}

export interface CleanSupportInput {
  name: string | null;
  email: string;
  category: Category;
  subject: string;
  message: string;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Collapses control characters (except newlines/tabs) that have no place in a ticket. */
const clean = (v: unknown) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/\r\n?/g, '\n')
        .trim()
    : '';

export function validateSupport(
  raw: Partial<Record<keyof SupportInput, unknown>>,
): { ok: true; value: CleanSupportInput } | { ok: false; errors: Partial<Record<Field, FieldError>> } {
  const name = clean(raw.name);
  const email = clean(raw.email).toLowerCase();
  const category = clean(raw.category);
  const subject = clean(raw.subject).replace(/\s+/g, ' ');
  const message = clean(raw.message);
  const errors: Partial<Record<Field, FieldError>> = {};

  if (name.length > LIMITS.name) errors.name = 'tooLong';
  if (!email) errors.email = 'required';
  else if (email.length > LIMITS.email || !EMAIL.test(email)) errors.email = 'invalid';
  if (!category) errors.category = 'required';
  else if (!(CATEGORIES as readonly string[]).includes(category)) errors.category = 'invalid';
  if (!subject) errors.subject = 'required';
  else if (subject.length < LIMITS.subjectMin) errors.subject = 'tooShort';
  else if (subject.length > LIMITS.subject) errors.subject = 'tooLong';
  if (!message) errors.message = 'required';
  else if (message.length < LIMITS.messageMin) errors.message = 'tooShort';
  else if (message.length > LIMITS.message) errors.message = 'tooLong';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name: name || null, email, category: category as Category, subject, message } };
}
