'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export function MobileMenu({ links, menuLabel }: { links: { href: string; label: string }[]; menuLabel: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={menuLabel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)]"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>
      <nav
        id={id}
        aria-label={menuLabel}
        hidden={!open}
        className="absolute inset-x-0 top-16 border-b border-[var(--line)] bg-[var(--bg)] px-4 pb-4 shadow-lg"
      >
        <ul className="flex flex-col">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-base font-semibold">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
