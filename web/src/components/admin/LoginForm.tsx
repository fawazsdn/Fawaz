'use client';

import { CheckCircle2, LoaderCircle, Mail, TriangleAlert } from 'lucide-react';
import { useActionState, useState } from 'react';

import { sendSignInLink, verifySignInCode, type LoginState } from '@/app/admin/login/actions';

export interface LoginCopy {
  email: string;
  send: string;
  sent: string;
  codeTitle: string;
  code: string;
  verify: string;
  errors: Record<'rate_limited' | 'invalid_email' | 'invalid_code' | 'unavailable', string>;
}

const input =
  'mt-1.5 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-base shadow-sm focus:border-[var(--accent)]';

export function LoginForm({ copy }: { copy: LoginCopy }) {
  const [email, setEmail] = useState('');
  const [linkState, sendLink, sending] = useActionState<LoginState, FormData>(sendSignInLink, { kind: 'idle' });
  const [codeState, verify, verifying] = useActionState<LoginState, FormData>(verifySignInCode, { kind: 'idle' });
  const error = (codeState.kind === 'error' && codeState.code) || (linkState.kind === 'error' && linkState.code) || null;

  return (
    <div className="space-y-6">
      {error ? (
        <p
          role="alert"
          className="flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {copy.errors[error]}
        </p>
      ) : null}
      <form action={sendLink} className="space-y-4">
        <div>
          <label htmlFor="admin-email" className="text-sm font-bold">
            {copy.email}
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </div>
        <button
          type="submit"
          disabled={sending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-700)] px-5 py-3 font-bold text-white hover:opacity-90 disabled:opacity-60 dark:bg-[var(--color-gold-400)] dark:text-[var(--color-brand-900)]"
        >
          {sending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Mail className="size-5" aria-hidden="true" />}
          {copy.send}
        </button>
      </form>
      {linkState.kind === 'sent' ? (
        <div role="status" className="flex gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          {copy.sent}
        </div>
      ) : null}
      {linkState.kind === 'sent' ? (
        <form action={verify} className="space-y-3 border-t border-[var(--line)] pt-5">
          <p className="text-sm font-bold">{copy.codeTitle}</p>
          <input type="hidden" name="email" value={email} />
          <label htmlFor="admin-code" className="sr-only">
            {copy.code}
          </label>
          <input
            id="admin-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={10}
            placeholder="123456"
            className={`${input} text-center font-mono tracking-[0.4em]`}
          />
          <button
            type="submit"
            disabled={verifying}
            className="w-full rounded-full border border-[var(--line)] px-5 py-2.5 font-bold hover:border-[var(--accent)]"
          >
            {copy.verify}
          </button>
        </form>
      ) : null}
    </div>
  );
}
