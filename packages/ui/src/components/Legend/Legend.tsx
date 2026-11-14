import type { CSSProperties } from 'react';
import s from './Legend.module.css';

/** How a legend entry's swatch is drawn, matching how the thing looks on canvas. */
export type LegendMark = 'line' | 'dash' | 'dot' | 'band';

/** One row of a legend: a swatch and what it means. */
export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  /** Defaults to `'line'`. */
  mark?: LegendMark;
}

/** Props for `<Legend>`. */
export interface LegendProps {
  entries: readonly LegendEntry[];
  className?: string;
}

/** A color key. Presentational only — no handlers, no state, no hover behavior. */
export function Legend({ entries, className }: LegendProps) {
  return (
    <ul className={className ? `${s.legend} ${className}` : s.legend}>
      {entries.map((entry) => (
        <li className={s.row} key={entry.key}>
          <span
            aria-hidden="true"
            className={s.swatch}
            data-mark={entry.mark ?? 'line'}
            style={{ '--legend-ink': entry.color } as CSSProperties}
          />
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
