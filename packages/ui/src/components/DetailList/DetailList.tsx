import { type ReactNode, useId } from 'react';
import s from './DetailList.module.css';

/** Whether a row's label sits beside its value or above it. */
export type DetailListLayout = 'inline' | 'block';

/**
 * How a list sets its values. `text` starts each value at the column's edge
 * and wraps it; `figures` right-aligns it in a column at least
 * `--wzl-detail-figure-min-width` (default `8ch`) wide, in the mono face,
 * with spaces kept, so figure-space padding lines a column up on its decimal
 * point.
 */
export type DetailListValues = 'text' | 'figures';

/** The state a row's status dot reports, painted from `--wzl-success`,
 *  `--wzl-warning` or `--wzl-danger`. */
export type DetailRowStatus = 'success' | 'warn' | 'danger';

/** Props for {@link DetailList}. */
export interface DetailListProps {
  /** {@link DetailRow}s. */
  children: ReactNode;
  /** Heading drawn above the list, which also names it. */
  title?: ReactNode;
  /**
   * `inline` puts every label in one rail beside the values; `block` stacks
   * each label over its value, for a column too narrow to hold both.
   */
  layout?: DetailListLayout;
  /** `text` by default. See {@link DetailListValues}. */
  values?: DetailListValues;
  /** Class on the outermost element: the `<dl>`, or the `<section>` holding
   *  the heading and the list when there is a `title`. */
  className?: string;
}

/** Props for {@link DetailRow}. */
export interface DetailRowProps {
  label: ReactNode;
  /** The value: text, or any run of elements — code chips, badges, keycaps,
   *  links. Several children wrap as a line of items. `null` or `undefined`
   *  keeps the row in place showing `placeholder`, so a list whose values
   *  come and go holds its height. */
  children?: ReactNode;
  /** Shown while there is no value. An en dash by default. */
  placeholder?: ReactNode;
  /**
   * Draws a dot in the status color before the value. The dot is hidden from
   * assistive technology and color is never the only signal, so the value
   * itself has to say the same thing — "locked", not just a green dot.
   */
  status?: DetailRowStatus;
  className?: string;
}

/**
 * A read-only list of labeled values — the `<dl>` a property panel would be
 * if its rows held facts instead of controls. Labels take the params label
 * recipe and rail: `--wzl-params-label-width` sets the rail, so a detail list
 * and a property panel beside it line their labels up from one declaration.
 */
export function DetailList({ children, title, layout = 'inline', values = 'text', className }: DetailListProps) {
  const titleId = useId();
  const list = (
    <dl
      className={className && title == null ? `${s.list} ${className}` : s.list}
      data-layout={layout}
      data-values={values}
      aria-labelledby={title != null ? titleId : undefined}
    >
      {children}
    </dl>
  );
  if (title == null) return list;
  return (
    <section className={className}>
      <h3 id={titleId} className={s.title}>{title}</h3>
      {list}
    </section>
  );
}

/** One label and its value in a {@link DetailList}. */
export function DetailRow({ label, children, placeholder = '–', status, className }: DetailRowProps) {
  const empty = children == null;
  return (
    <div className={className ? `${s.row} ${className}` : s.row} data-status={status}>
      <dt className={s.label}>{label}</dt>
      <dd className={s.value} data-empty={empty || undefined}>
        {status && <span className={s.dot} aria-hidden="true" />}
        {empty ? placeholder : children}
      </dd>
    </div>
  );
}
