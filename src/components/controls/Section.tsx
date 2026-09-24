import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  /** Right-aligned element in the header, e.g. a reset button. */
  aside?: ReactNode;
  children: ReactNode;
}

export function Section({ title, aside, children }: SectionProps) {
  return (
    <section className="border-t border-line px-5 py-5 first:border-t-0">
      <header className="mb-3 flex h-4 items-center justify-between">
        <h3 className="eyebrow">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}
