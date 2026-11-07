'use client';

import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import type { FaqCategory, FaqItem } from '@/content/faq';
import { FaqList } from './FaqList';

/** Normalizes Arabic letter variants and diacritics so searches match loosely. */
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

interface Props {
  items: FaqItem[];
  labels: Record<FaqCategory, string>;
  searchLabel: string;
  placeholder: string;
  noResults: string;
  /** Contains {n}. */
  resultsLabel: string;
}

export function SupportSearch({ items, labels, searchLabel, placeholder, noResults, resultsLabel }: Props) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const statusId = useId();

  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return items;
    return items.filter((item) => {
      const hay = normalize([item.q, ...item.a, labels[item.category]].join(' '));
      return terms.every((t) => hay.includes(t));
    });
  }, [items, labels, query]);

  const groups = useMemo(() => {
    const map = new Map<FaqCategory, FaqItem[]>();
    for (const item of results) map.set(item.category, [...(map.get(item.category) ?? []), item]);
    return [...map.entries()];
  }, [results]);

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-bold">
        {searchLabel}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          aria-describedby={statusId}
          autoComplete="off"
          className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-3.5 pe-4 ps-12 text-base shadow-sm placeholder:text-[var(--muted)]/70"
        />
      </div>
      <p id={statusId} role="status" aria-live="polite" className="mt-2 text-sm text-[var(--muted)]">
        {query.trim()
          ? results.length
            ? resultsLabel.replace('{n}', results.length.toLocaleString(document.documentElement.lang === 'ar' ? 'ar-SA' : 'en-US'))
            : noResults
          : ''}
      </p>
      <div className="mt-4 space-y-8">
        {groups.map(([cat, list]) => (
          <section key={cat} id={`topic-${cat}`} aria-labelledby={`h-${cat}`} className="scroll-mt-24">
            <h3 id={`h-${cat}`} className="mb-3 text-lg font-extrabold">
              {labels[cat]}
            </h3>
            <FaqList items={list} />
          </section>
        ))}
      </div>
    </div>
  );
}
