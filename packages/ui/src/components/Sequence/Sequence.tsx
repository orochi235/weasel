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
  label: string;
  className?: string;
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
  const { sweep, across, children, layout = 'wrap', cap = SWEEP_CAP, label, className } = props;
  const rows = stepsOf(sweep, cap);
  if (across) {
    const cols = stepsOf(across, cap);
    return (
      <div className={[s.sequence, className].filter(Boolean).join(' ')}>
        <table className={s.grid} aria-label={label}>
          <thead>
            <tr>
              <td />
              {cols.steps.map((col, j) => (
                <th key={j} scope="col" className={s.caption}>{across.label(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.steps.map((row, i) => (
              <tr key={i}>
                <th scope="row" className={s.caption}>{sweep.label(row)}</th>
                {cols.steps.map((col, j) => (
                  <td key={j} className={s.gridCell}>{children(row, col)}</td>
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
  return (
    <div className={[s.sequence, className].filter(Boolean).join(' ')}>
      <ol className={s.cells} data-layout={layout} aria-label={label}>
        {rows.steps.map((value, i) => (
          <li key={i} className={s.item}>
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
