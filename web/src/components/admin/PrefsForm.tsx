'use client';

import { useActionState } from 'react';

import { savePrefsAction, type ActionResult } from '@/app/admin/actions';

export function PrefsForm({
  prefs,
  copy,
}: {
  prefs: { autoRefresh: boolean; alertNew: boolean };
  copy: { autoRefresh: string; alertNew: string; save: string };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(savePrefsAction, { kind: 'idle' });
  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="autoRefresh"
          defaultChecked={prefs.autoRefresh}
          className="mt-1 size-4 accent-[var(--color-brand-700)]"
        />
        {copy.autoRefresh}
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="alertNew" defaultChecked={prefs.alertNew} className="mt-1 size-4 accent-[var(--color-brand-700)]" />
        {copy.alertNew}
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full px-4 py-2 text-sm font-bold ring-1 ring-[var(--line)] hover:ring-[var(--accent)]"
        >
          {copy.save}
        </button>
        {state.kind !== 'idle' ? (
          <span role="status" className="text-sm text-[var(--muted)]">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
