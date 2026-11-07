'use client';

import { BellRing, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Open-request indicator. It polls /admin/api/open-count (staff-only, counts
 * only) every 30 seconds and when the tab regains focus. Polling is used
 * instead of Supabase Realtime on purpose: the session lives in httpOnly
 * cookies that page scripts cannot read, so no access token ever reaches the
 * browser and no ticket data travels over a client-side channel.
 */
export function OpenCountBadge({
  initial,
  autoRefresh,
  alertNew,
  labelTemplate,
  newLabel,
  refreshLabel,
}: {
  initial: number;
  autoRefresh: boolean;
  alertNew: boolean;
  /** Contains {n}. */
  labelTemplate: string;
  newLabel: string;
  refreshLabel: string;
}) {
  const [count, setCount] = useState(initial);
  const [fresh, setFresh] = useState(false);
  const last = useRef(initial);
  const router = useRouter();

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/admin/api/open-count', { cache: 'no-store' });
      if (res.status === 401) return router.replace('/admin/login');
      if (!res.ok) return;
      const data = (await res.json()) as { open?: number; total?: number };
      if (typeof data.open !== 'number') return;
      if (alertNew && data.open > last.current) setFresh(true);
      last.current = data.open;
      setCount(data.open);
    } catch {
      // Offline: keep the last known value.
    }
  }, [alertNew, router]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(poll, 30_000);
    const onFocus = () => document.visibilityState === 'visible' && poll();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [autoRefresh, poll]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        data-testid="open-count"
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-gold-400)] px-3 py-1 text-sm font-bold text-[var(--color-brand-900)]"
      >
        <span className="size-2 rounded-full bg-[var(--color-brand-900)]" aria-hidden="true" />
        {labelTemplate.replace('{n}', count.toLocaleString())}
      </span>
      {fresh ? (
        <button
          type="button"
          role="status"
          onClick={() => {
            setFresh(false);
            router.refresh();
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-gold-400)] px-3 py-1 text-sm font-semibold"
        >
          <BellRing className="size-4" aria-hidden="true" />
          {newLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setFresh(false);
          void poll();
          router.refresh();
        }}
        aria-label={refreshLabel}
        title={refreshLabel}
        className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--line)] hover:border-[var(--accent)]"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
