'use client';

import { Languages } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { setLanguageAction } from '@/app/admin/actions';

export function LanguageToggle({ label, target, className = '' }: { label: string; target: 'ar' | 'en'; className?: string }) {
  const path = usePathname() || '/admin';
  const qs = useSearchParams()?.toString();
  return (
    <form action={setLanguageAction}>
      <input type="hidden" name="lang" value={target} />
      <input type="hidden" name="back" value={qs ? `${path}?${qs}` : path} />
      <button
        type="submit"
        lang={target}
        className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold hover:border-[var(--accent)] ${className}`}
      >
        <Languages className="size-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
