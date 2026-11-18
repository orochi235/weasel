import { type ReactNode, useId } from 'react';

/** The specimen's sections, in page order. */
export const SPECIMEN_SECTIONS = [
  'Buttons & toggles',
  'Fields & pickers',
  'Panels & property rows',
  'Overlays & feedback',
  'Lists & data',
  'Tool chrome',
  'Editors & plots',
  'Lab chrome',
] as const;

type SectionTitle = (typeof SPECIMEN_SECTIONS)[number];

export function Section({ title, children }: { title: SectionTitle; children: ReactNode }) {
  const id = useId();
  return (
    <section className="lk-specimen__section" aria-labelledby={id}>
      <h2 id={id} className="lk-specimen__heading">
        {title}
      </h2>
      <div className="lk-specimen__grid">{children}</div>
    </section>
  );
}
