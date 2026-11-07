'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartColumn, Inbox, LayoutDashboard, Settings, Users } from 'lucide-react';

const ICONS = { overview: LayoutDashboard, tickets: Inbox, customers: Users, analytics: ChartColumn, settings: Settings };

export function AdminNav({ items, openCount }: { items: { key: keyof typeof ICONS; href: string; label: string }[]; openCount: number }) {
  const path = usePathname();
  return (
    <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items.map((item) => {
        const active = item.href === '/admin' ? path === '/admin' : path?.startsWith(item.href);
        const Icon = ICONS[item.key];
        return (
          <li key={item.key} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'bg-white/10 text-[var(--color-gold-400)]' : 'text-[var(--color-sand-200)] hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
              {item.key === 'tickets' && openCount > 0 ? (
                <span className="ms-auto rounded-full bg-[var(--color-gold-400)] px-2 py-0.5 text-xs font-bold text-[var(--color-brand-900)]">
                  {openCount}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
