import { stepsOf, SWEEP_CAP, type Sweep } from '@weasel-js/ui-input';
import type { ReactElement, ReactNode } from 'react';
import { repeatKeys } from '../../repeatKeys';
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
  /** Steps taken from a sweep that has not ended by then, or a grid's cells: it keeps as many rows and columns as
   *  make no more than `cap` cells between them. Default `SWEEP_CAP`. */
  cap?: number;
  /** The accessible name of the list or grid. */
  'aria-label': string;
  className?: string;
}

function Capped({ shown }: { shown: string | number }): ReactElement {
  return <p className={s.capped}>Showing the first {shown} steps.</p>;
}

/** A grid's rows and columns, as many of each as make at most `cap` cells: an axis shorter than the square root of
 *  `cap` keeps all its steps and the other takes what that leaves. */
function gridSteps<A, B>(sweep: Sweep<A>, across: Sweep<B>, cap: number): {
  rows: { steps: A[]; capped: boolean }; cols: { steps: B[]; capped: boolean };
} {
  const rows = stepsOf(sweep, cap);
  const cols = stepsOf(across, cap);
  const r = rows.steps.length;
  const c = cols.steps.length;
  if (r * c <= cap) return { rows, cols };
  const side = Math.floor(Math.sqrt(cap));
  const keepR = r <= side ? r : c <= side ? Math.floor(cap / c) : side;
  const keepC = r <= side ? Math.floor(cap / r) : c <= side ? c : side;
  return {
    rows: { steps: rows.steps.slice(0, keepR), capped: rows.capped || keepR < r },
    cols: { steps: cols.steps.slice(0, keepC), capped: cols.capped || keepC < c },
  };
}

/**
 * A component repeated over the steps of a parameter, every other held where it
 * is: the turn-based reading of what a scrubber shows one value at a time.
 * Each cell is live, keeping its own state and taking input.
 */
export function Sequence<A, B = undefined>(props: SequenceProps<A, B>): ReactElement {
  const { sweep, across, children, layout = 'wrap', cap = SWEEP_CAP, 'aria-label': label, className } = props;
  if (across) {
    const { rows, cols } = gridSteps(sweep, across, cap);
    const rowKeys = repeatKeys(rows.steps, (v) => sweep.label(v));
    const colKeys = repeatKeys(cols.steps, (v) => across.label(v));
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
        {(rows.capped || cols.capped) && <Capped shown={`${rows.steps.length} × ${cols.steps.length}`} />}
      </div>
    );
  }
  const rows = stepsOf(sweep, cap);
  const caption = props.caption ?? ((value: A) => sweep.label(value));
  const keys = repeatKeys(rows.steps, (v) => sweep.label(v));
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
      {rows.capped && <Capped shown={cap} />}
    </div>
  );
}
