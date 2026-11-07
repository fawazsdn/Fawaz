import { NajdiPattern } from './Pattern';

export function PageHeader({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--surface-2)]">
      <NajdiPattern className="absolute inset-0 h-full w-full text-[var(--color-brand-700)] opacity-[0.05] dark:text-[var(--color-gold-400)]" />
      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-brand-700)] sm:text-5xl dark:text-[var(--color-gold-400)]">
          {title}
        </h1>
        {lead ? <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">{lead}</p> : null}
        {children}
      </div>
    </div>
  );
}
