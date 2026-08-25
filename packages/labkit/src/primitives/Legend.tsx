import type { CSSProperties } from 'react';

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
    <ul className={className ? `lk-legend ${className}` : 'lk-legend'}>
      {entries.map((entry) => {
        const mark = entry.mark ?? 'line';
        return (
          <li className="lk-legend__row" key={entry.key}>
            <span
              aria-hidden="true"
              className={`lk-legend__swatch lk-legend__swatch--${mark}`}
              style={{ '--lk-legend-ink': entry.color } as CSSProperties}
            />
            <span className="lk-legend__label">{entry.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
