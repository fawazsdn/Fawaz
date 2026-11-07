'use client';

import Link from 'next/link';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import type { Dictionary } from '@/content/dictionary';
import { pathFor, type Locale } from '@/lib/i18n';
import { CATEGORIES, LIMITS, validateSupport, type Field, type FieldError } from '@/lib/validation';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; reference: string } | { kind: 'error'; message: string };

const ERROR_KEYS = ['invalid', 'rate_limited', 'too_fast', 'unavailable', 'forbidden'] as const;

export function SupportForm({ locale, t }: { locale: Locale; t: Dictionary }) {
  const f = t.form;
  const uid = useId();
  const [values, setValues] = useState({ name: '', email: '', category: '', subject: '', message: '', website: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, FieldError>>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const startedAt = useRef(0);
  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  /** Field errors move focus to the first invalid field; other errors focus the alert. */
  const focusField = useRef<Field | null>(null);

  useEffect(() => {
    startedAt.current = Date.now();
    // Links such as /support?topic=deletion preselect the topic (the page itself stays static).
    const topic = new URLSearchParams(window.location.search).get('topic');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL after hydration
    if (topic && (CATEGORIES as readonly string[]).includes(topic)) setValues((v) => ({ ...v, category: topic }));
  }, []);
  useEffect(() => {
    if (status.kind === 'error') {
      const field = focusField.current;
      focusField.current = null;
      if (field) document.getElementById(`${uid}-${field}`)?.focus();
      else alertRef.current?.focus();
    }
    if (status.kind === 'sent') successRef.current?.focus();
  }, [status, uid]);

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    if (errors[k as Field]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const fieldMessage = (k: Field) => {
    const e = errors[k];
    if (!e) return null;
    if (k === 'email' && e === 'invalid') return f.emailInvalid;
    return f.field[e];
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const checked = validateSupport(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusField.current = (['name', 'email', 'category', 'subject', 'message'] as Field[]).find((k) => checked.errors[k]) ?? null;
      setStatus({ kind: 'error', message: f.fixErrors });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, locale, startedAt: startedAt.current }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && typeof data.reference === 'string') {
        setStatus({ kind: 'sent', reference: data.reference });
        return;
      }
      if (data?.fields) {
        setErrors(data.fields);
        focusField.current = (['name', 'email', 'category', 'subject', 'message'] as Field[]).find((k) => data.fields[k]) ?? null;
      }
      const key = ERROR_KEYS.find((k) => k === data?.error) ?? 'unavailable';
      setStatus({ kind: 'error', message: f.errors[key] });
    } catch {
      setStatus({ kind: 'error', message: f.errors.network });
    }
  };

  if (status.kind === 'sent') {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center sm:p-10"
      >
        <CheckCircle2 className="mx-auto size-12 text-[var(--accent)]" aria-hidden="true" />
        <h3 className="mt-4 text-xl font-extrabold">{f.successTitle}</h3>
        <p className="mt-2 text-[var(--muted)]">{f.successBody}</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-widest" dir="ltr">
          {status.reference}
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">{f.successNext}</p>
        <button
          type="button"
          onClick={() => {
            setValues({ name: '', email: values.email, category: '', subject: '', message: '', website: '' });
            startedAt.current = Date.now();
            setStatus({ kind: 'idle' });
          }}
          className="mt-6 rounded-full border border-[var(--line)] px-5 py-2.5 font-semibold"
        >
          {f.another}
        </button>
      </div>
    );
  }

  const input =
    'mt-1.5 w-full rounded-xl border bg-[var(--surface)] px-4 py-3 text-base shadow-sm transition-colors placeholder:text-[var(--muted)]/70 aria-[invalid=true]:border-red-600';
  const border = (k: Field) => (errors[k] ? 'border-red-600' : 'border-[var(--line)]');
  const describe = (k: Field, hint?: boolean) =>
    [hint ? `${uid}-${k}-hint` : '', errors[k] ? `${uid}-${k}-err` : ''].filter(Boolean).join(' ') || undefined;
  const err = (k: Field) =>
    errors[k] ? (
      <p id={`${uid}-${k}-err`} className="mt-1.5 text-sm font-medium text-red-700 dark:text-red-400">
        {fieldMessage(k)}
      </p>
    ) : null;

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-8"
      aria-describedby={`${uid}-lead`}
    >
      {status.kind === 'error' ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{status.message}</p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-name`} className="text-sm font-bold">
            {f.name} <span className="font-normal text-[var(--muted)]">{f.optional}</span>
          </label>
          <input
            id={`${uid}-name`}
            name="name"
            autoComplete="name"
            maxLength={LIMITS.name}
            value={values.name}
            onChange={set('name')}
            aria-invalid={!!errors.name}
            aria-describedby={describe('name')}
            className={`${input} ${border('name')}`}
          />
          {err('name')}
        </div>
        <div>
          <label htmlFor={`${uid}-email`} className="text-sm font-bold">
            {f.email}
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={LIMITS.email}
            value={values.email}
            onChange={set('email')}
            aria-invalid={!!errors.email}
            aria-describedby={describe('email', true)}
            className={`${input} ${border('email')} ${locale === 'ar' ? 'text-right' : ''}`}
          />
          <p id={`${uid}-email-hint`} className="mt-1.5 text-xs text-[var(--muted)]">
            {f.emailHint}
          </p>
          {err('email')}
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-category`} className="text-sm font-bold">
          {f.category}
        </label>
        <select
          id={`${uid}-category`}
          name="category"
          required
          value={values.category}
          onChange={set('category')}
          aria-invalid={!!errors.category}
          aria-describedby={describe('category')}
          className={`${input} ${border('category')} appearance-none`}
        >
          <option value="" disabled>
            {f.choose}
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.categories[c]}
            </option>
          ))}
        </select>
        {err('category')}
      </div>

      <div>
        <label htmlFor={`${uid}-subject`} className="text-sm font-bold">
          {f.subject}
        </label>
        <input
          id={`${uid}-subject`}
          name="subject"
          required
          maxLength={LIMITS.subject}
          value={values.subject}
          onChange={set('subject')}
          aria-invalid={!!errors.subject}
          aria-describedby={describe('subject')}
          className={`${input} ${border('subject')}`}
        />
        {err('subject')}
      </div>

      <div>
        <label htmlFor={`${uid}-message`} className="text-sm font-bold">
          {f.message}
        </label>
        <textarea
          id={`${uid}-message`}
          name="message"
          required
          rows={6}
          maxLength={LIMITS.message}
          value={values.message}
          onChange={set('message')}
          aria-invalid={!!errors.message}
          aria-describedby={describe('message', true)}
          className={`${input} ${border('message')} min-h-36 resize-y`}
        />
        <p id={`${uid}-message-hint`} className="mt-1.5 flex justify-between gap-3 text-xs text-[var(--muted)]">
          <span>{f.messageHint.replace('{min}', String(LIMITS.messageMin)).replace('{max}', String(LIMITS.message))}</span>
          <span aria-hidden="true" dir="ltr">
            {values.message.length}/{LIMITS.message}
          </span>
        </p>
        {err('message')}
      </div>

      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
      </div>

      <p id={`${uid}-lead`} className="text-sm text-[var(--muted)]">
        {f.consent}{' '}
        <Link href={pathFor(locale, 'privacy')} className="font-semibold text-[var(--link)] underline underline-offset-4">
          {f.privacyLink}
        </Link>
        .
      </p>

      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-base font-bold text-[var(--accent-fg)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {status.kind === 'sending' ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : null}
        {status.kind === 'sending' ? f.sending : f.submit}
      </button>
    </form>
  );
}
