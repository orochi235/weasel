import type { ReactElement, ReactNode } from 'react';
import s from './lab.stories.module.css';

/** One measured line: what it is, and its value as text already padded for a column. */
export interface Readout {
  label: ReactNode;
  value: ReactNode;
  /** Marks a value that disagrees with what it should be. */
  bad?: boolean;
  /** Read by the lab's browser test. */
  id?: string;
}

/** A titled section of readouts, one row each, the values in a column read down. */
export function Readouts({ title, rows, children }: { title: string; rows: readonly Readout[]; children?: ReactNode }): ReactElement {
  return (
    <section className={s.section} aria-label={title}>
      <h3 className={s.sectionTitle}>{title}</h3>
      <table className={s.readouts}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i} data-readout={r.id} className={r.bad ? s.mismatch : undefined}>
              <th scope="row">{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {children}
    </section>
  );
}

/** `n` with `places` decimals, padded on the left to `width` with figure spaces, so a column lines up. */
export function num(n: number, width = 7, places = 1): string {
  const text = Number.isFinite(n) ? (Math.abs(n) < 0.5 * 10 ** -places ? 0 : n).toFixed(places) : n > 0 ? '∞' : n < 0 ? '-∞' : '—';
  return text.padStart(width, ' ');
}
