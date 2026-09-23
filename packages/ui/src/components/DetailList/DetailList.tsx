import { type ReactNode, useId } from 'react';
import s from './DetailList.module.css';

/** Whether a row's label sits beside its value or above it. */
export type DetailListLayout = 'inline' | 'block';

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
  /** Class on the outermost element: the `<dl>`, or the `<section>` holding
   *  the heading and the list when there is a `title`. */
  className?: string;
}

/** Props for {@link DetailRow}. */
export interface DetailRowProps {
  label: ReactNode;
  /** The value: text, or any run of elements — code chips, badges, keycaps,
   *  links. Several children wrap as a line of items. */
  children: ReactNode;
  className?: string;
}

/**
 * A read-only list of labelled values — the `<dl>` a property panel would be
 * if its rows held facts instead of controls. Labels take the params label
 * recipe and rail: `--wzl-params-label-width` sets the rail, so a detail list
 * and a property panel beside it line their labels up from one declaration.
 */
export function DetailList({ children, title, layout = 'inline', className }: DetailListProps) {
  const titleId = useId();
  const list = (
    <dl
      className={className && title == null ? `${s.list} ${className}` : s.list}
      data-layout={layout}
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
export function DetailRow({ label, children, className }: DetailRowProps) {
  return (
    <div className={className ? `${s.row} ${className}` : s.row}>
      <dt className={s.label}>{label}</dt>
      <dd className={s.value}>{children}</dd>
    </div>
  );
}
