import type { ReactElement } from 'react';
import { Button } from '@weasel-js/ui/components/Button';
import s from './lab.stories.module.css';

/** A row of named presets; a press hands the preset to `onLoad`. */
export function Presets<P extends { name: string }>({ presets, onLoad }: { presets: readonly P[]; onLoad: (preset: P) => void }): ReactElement {
  return (
    <section className={s.section} aria-label="Presets">
      <h3 className={s.sectionTitle}>Presets</h3>
      <div className={s.presets}>
        {presets.map((p) => (
          <Button key={p.name} size="sm" onClick={() => onLoad(p)}>{p.name}</Button>
        ))}
      </div>
    </section>
  );
}

/** Writes every key of `patch` through a story's `setConfig`. */
export function loadInto(setConfig: (path: string, value: unknown) => void, patch: Readonly<Record<string, unknown>>): void {
  for (const [key, value] of Object.entries(patch)) setConfig(key, value);
}
