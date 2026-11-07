import { LogOut } from 'lucide-react';

import { logoutAction } from '@/app/admin/actions';
import { Card } from '@/components/admin/Charts';
import { LanguageToggle } from '@/components/admin/LanguageToggle';
import { PrefsForm } from '@/components/admin/PrefsForm';
import { emailConfig } from '@/lib/admin/email';
import { adminDict } from '@/lib/admin/i18n';
import { adminLocale, adminPrefs } from '@/lib/admin/prefs';
import { requireStaffPage } from '@/lib/admin/session';

export const metadata = { title: 'Settings' };

function Status({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-100' : 'bg-amber-50 text-amber-900 ring-amber-300 dark:bg-amber-950 dark:text-amber-100'}`}
    >
      {ok ? yes : no}
    </span>
  );
}

/** Shows whether email is configured; secret values are never rendered. */
export default async function SettingsPage() {
  const staff = await requireStaffPage();
  const locale = await adminLocale();
  const t = adminDict(locale);
  const prefs = await adminPrefs();
  const cfg = emailConfig();
  const s = t.settings;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-extrabold tracking-tight">{s.title}</h1>
      <Card title={s.profile}>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-[var(--muted)]">{s.name}</dt>
          <dd>{[staff.firstName, staff.lastName].filter(Boolean).join(' ') || '—'}</dd>
          <dt className="text-[var(--muted)]">{s.email}</dt>
          <dd dir="ltr" className="text-start">
            {staff.email ?? '—'}
          </dd>
          <dt className="text-[var(--muted)]">{s.role}</dt>
          <dd>
            {t.role[staff.role]}
            <p className="mt-1 text-xs text-[var(--muted)]">{s.roleHelp}</p>
          </dd>
        </dl>
      </Card>
      <Card title={s.language}>
        <LanguageToggle label={t.language} target={locale === 'ar' ? 'en' : 'ar'} />
      </Card>
      <Card title={s.emailConfig}>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]" data-testid="email-config">
          <dt className="text-[var(--muted)]">{s.apiKey}</dt>
          <dd>
            <Status ok={!!cfg} yes={s.configured} no={s.notConfigured} />
          </dd>
          <dt className="text-[var(--muted)]">{s.fromAddress}</dt>
          <dd dir="ltr" className="text-start">
            {cfg?.from ?? <Status ok={false} yes="" no={s.notConfigured} />}
          </dd>
          <dt className="text-[var(--muted)]">{s.replyTo}</dt>
          <dd dir="ltr" className="text-start">
            {cfg?.replyTo ?? '—'}
          </dd>
        </dl>
        <p className="mt-3 text-xs text-[var(--muted)]">{s.secretHidden}</p>
      </Card>
      <Card title={s.notifications}>
        <PrefsForm prefs={prefs} copy={{ autoRefresh: s.autoRefresh, alertNew: s.alertNew, save: s.save }} />
      </Card>
      <Card title={s.security}>
        <p className="text-sm">
          <strong>{s.mfa}:</strong> <span className="text-[var(--muted)]">{s.mfaHelp}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ring-[var(--line)] hover:ring-[var(--accent)]"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {s.logoutHere}
            </button>
          </form>
          <form action={logoutAction}>
            <input type="hidden" name="scope" value="global" />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-red-700 ring-1 ring-red-300 dark:text-red-300"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {s.logoutAll}
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
