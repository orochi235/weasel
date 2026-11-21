import { stepsOf, SWEEP_CAP, type Sweep } from '@weasel-js/ui-input';
import type { ReactElement, ReactNode } from 'react';
import s from './Sequence.module.css';

/** Props for {@link Sequence}. */
export interface SequenceProps<A, B = undefined> {
  /** The parameter stepped through: one cell per step, or one row per step with `across`. */
  sweep: Sweep<A>;
  /** A second parameter, one column per step: every pairing of the two, as a grid. */
  across?: Sweep<B>;
  /** A cell's content for its step, and its column's step under `across`. */
  children: (value: A, across: B) => ReactNode;
  /** Captions under each cell. Default: the sweep's label for its step; `false`
   *  for none. A grid labels its rows and columns instead. */
  caption?: false | ((value: A) => ReactNode);
  /** `'wrap'`, the default, wraps cells onto rows; `'strip'` keeps them on one
   *  line that scrolls. Ignored by a grid. */
  layout?: 'wrap' | 'strip';
  /** Steps taken from a sweep that has not ended by then. Default `SWEEP_CAP`. */
  cap?: number;
  /** The accessible name of the list or grid. */
  'aria-label': string;
  className?: string;
}

/** A key per step, by its label, so a step's cell keeps its state as the sweep around it changes; a repeated label
 *  is told apart by how many times it came before. */
function stepKeys<T>(steps: readonly T[], label: (value: T) => string): string[] {
  const seen = new Map<string, number>();
  return steps.map((value) => {
    const name = label(value);
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return `${n}:${name}`;
  });
}

function Capped({ cap }: { cap: number }): ReactElement {
  return <p className={s.capped}>Showing the first {cap} steps.</p>;
}

/**
 * A component repeated over the steps of a parameter, every other held where it
 * is: the turn-based reading of what a scrubber shows one value at a time.
 * Each cell is live, keeping its own state and taking input.
 */
export function Sequence<A, B = undefined>(props: SequenceProps<A, B>): ReactElement {
  const { sweep, across, children, layout = 'wrap', cap = SWEEP_CAP, 'aria-label': label, className } = props;
  const rows = stepsOf(sweep, cap);
  if (across) {
    const cols = stepsOf(across, cap);
    const rowKeys = stepKeys(rows.steps, (v) => sweep.label(v));
    const colKeys = stepKeys(cols.steps, (v) => across.label(v));
    return (
      <div className={[s.sequence, className].filter(Boolean).join(' ')}>
        <table className={s.grid} aria-label={label}>
          <thead>
            <tr>
              <td />
              {cols.steps.map((col, j) => (
                <th key={colKeys[j]} scope="col" className={s.caption}>{across.label(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.steps.map((row, i) => (
              <tr key={rowKeys[i]}>
                <th scope="row" className={s.caption}>{sweep.label(row)}</th>
                {cols.steps.map((col, j) => (
                  <td key={colKeys[j]} className={s.gridCell}>{children(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {(rows.capped || cols.capped) && <Capped cap={cap} />}
      </div>
    );
  }
  const caption = props.caption ?? ((value: A) => sweep.label(value));
  const keys = stepKeys(rows.steps, (v) => sweep.label(v));
  return (
    <div className={[s.sequence, className].filter(Boolean).join(' ')}>
      <ol className={s.cells} data-layout={layout} aria-label={label}>
        {rows.steps.map((value, i) => (
          <li key={keys[i]} className={s.item}>
            <figure className={s.cell}>
              {children(value, undefined as B)}
              {caption !== false && <figcaption className={s.caption}>{caption(value)}</figcaption>}
            </figure>
          </li>
        ))}
      </ol>
      {rows.capped && <Capped cap={cap} />}
    </div>
  );
}
