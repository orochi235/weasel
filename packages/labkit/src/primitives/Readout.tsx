import { DetailList, DetailRow, type DetailRowStatus } from '@weasel-js/ui';
import type { ReactNode } from 'react';

/** One measurement in a {@link Readout}. */
export interface ReadoutRow {
  /** React key. Defaults to `label` when that is a string, else the row's index. */
  key?: string;
  label: ReactNode;
  /** `null` or `undefined` keeps the row in place showing an en dash, so the
   *  readout holds its height while a measurement comes and goes. */
  value?: ReactNode;
  /** A dot in the status color before the value. Color is never the only
   *  signal: the value has to say the same thing in words. */
  status?: DetailRowStatus;
}

/** Props for {@link Readout}. */
export interface ReadoutProps {
  rows: readonly ReadoutRow[];
  /** Heading above the rows, which also names the list. */
  title?: ReactNode;
  /** Drawn below the rows — a small table, a note. */
  children?: ReactNode;
  className?: string;
}

/**
 * Values a lab only reads — measurements shown beside its picture, such as
 * "Lock margin +47.9°". A {@link DetailList} set as figures: labels take the
 * params label recipe and `--wzl-params-label-width` rail, so a readout lines
 * up with a `ControlPanel` beside it, and values sit right-aligned in the mono
 * face with spaces kept, so figure-space padding aligns a column on its
 * decimal point. Rows compose by hand as `DetailRow`s inside a `DetailList`
 * with `values="figures"`.
 */
export function Readout({ rows, title, children, className }: ReadoutProps) {
  return (
    <div className={className ? `lk-readout ${className}` : 'lk-readout'}>
      <DetailList title={title} values="figures">
        {rows.map((row, i) => (
          <DetailRow
            key={row.key ?? (typeof row.label === 'string' ? row.label : i)}
            label={row.label}
            status={row.status}
          >
            {row.value}
          </DetailRow>
        ))}
      </DetailList>
      {children != null && <div className="lk-readout__footer">{children}</div>}
    </div>
  );
}
