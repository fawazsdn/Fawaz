'use client';

import { CheckCircle2, LoaderCircle, Send, TriangleAlert } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';

import { checkDeliveryAction, respondAction, sendEmailAction, statusAction, type ActionResult } from '@/app/admin/actions';

function Notice({ state }: { state: ActionResult }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.kind !== 'idle') ref.current?.focus();
  }, [state]);
  if (state.kind === 'idle') return null;
  const tone =
    state.kind === 'ok'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
      : state.kind === 'warn'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'
        : 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100';
  const Icon = state.kind === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={state.kind === 'error' ? 'alert' : 'status'}
      className={`flex gap-2 rounded-xl border p-3 text-sm ${tone}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {state.message}
    </p>
  );
}

const btn = 'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60';
const primary = `${btn} bg-[var(--color-brand-700)] text-white hover:opacity-90 dark:bg-[var(--color-gold-400)] dark:text-[var(--color-brand-900)]`;
const secondary = `${btn} ring-1 ring-[var(--line)] bg-[var(--surface)] hover:ring-[var(--accent)]`;

export interface ReplyCopy {
  label: string;
  hint: string;
  save: string;
  saveSend: string;
  saveClose: string;
}

export function ReplyForm({ id, initial, emailCapable, copy }: { id: string; initial: string; emailCapable: boolean; copy: ReplyCopy }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(respondAction, { kind: 'idle' });
  const [text, setText] = useState(initial);
  const [mode, setMode] = useState('save');
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => setMode(((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement)?.value || 'save')}
    >
      <input type="hidden" name="id" value={id} />
      <label htmlFor="response" className="text-sm font-bold">
        {copy.label}
      </label>
      <textarea
        id="response"
        name="response"
        required
        maxLength={3000}
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-describedby="response-hint"
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-base leading-relaxed"
      />
      <p id="response-hint" className="flex justify-between gap-3 text-xs text-[var(--muted)]">
        <span>{copy.hint}</span>
        <span dir="ltr">{text.length}/3000</span>
      </p>
      <Notice state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="mode" value={emailCapable ? 'send' : 'save'} disabled={pending || !text.trim()} className={primary}>
          {pending && mode !== 'close' && mode !== 'save-only' ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {emailCapable ? copy.saveSend : copy.save}
        </button>
        {emailCapable ? (
          <button type="submit" name="mode" value="save-only" disabled={pending || !text.trim()} className={secondary}>
            {copy.save}
          </button>
        ) : null}
        <button type="submit" name="mode" value="close" disabled={pending || !text.trim()} className={secondary}>
          {copy.saveClose}
        </button>
      </div>
    </form>
  );
}

export function StatusButtons({ id, buttons }: { id: string; buttons: { status: 'open' | 'answered' | 'closed'; label: string }[] }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(statusAction, { kind: 'idle' });
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="id" value={id} />
        {buttons.map((b) => (
          <button key={b.status} type="submit" name="status" value={b.status} disabled={pending} className={secondary}>
            {b.label}
          </button>
        ))}
      </form>
      <Notice state={state} />
    </div>
  );
}

export function EmailButtons({ id, sendLabel, checkLabel }: { id: string; sendLabel?: string; checkLabel?: string }) {
  const [sendState, send, sending] = useActionState<ActionResult, FormData>(sendEmailAction, { kind: 'idle' });
  const [checkState, check, checking] = useActionState<ActionResult, FormData>(checkDeliveryAction, { kind: 'idle' });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sendLabel ? (
          <form action={send}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={sending} className={primary}>
              {sending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {sendLabel}
            </button>
          </form>
        ) : null}
        {checkLabel ? (
          <form action={check}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={checking} className={secondary}>
              {checkLabel}
            </button>
          </form>
        ) : null}
      </div>
      <Notice state={sendState.kind !== 'idle' ? sendState : checkState} />
    </div>
  );
}
