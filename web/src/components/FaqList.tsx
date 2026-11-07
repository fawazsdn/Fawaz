import { ChevronDown } from 'lucide-react';

import type { FaqItem } from '@/content/faq';

/** Native <details> disclosure: keyboard and screen-reader friendly with no JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      {items.map((item) => (
        <details key={item.id} id={item.id} className="group scroll-mt-24">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold marker:hidden [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown className="size-5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 px-5 pb-5 text-[var(--muted)]">
            {item.a.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
