/**
 * The row chrome behind a sidebar list — layers, history, anything that is a
 * flat column of selectable rows in a panel.
 *
 * It owns the container, the row box and the empty state, and nothing else:
 * what a row *means* stays with the consumer. History dims its redo entries
 * and rules a line under the current one; a layer list drags to reorder and
 * leads each row with a swatch. Both reach that through `className` and
 * `rowProps` rather than through options here, so this does not grow a flag
 * per consumer.
 *
 * Rows are one height and one inset for every list, which is the point: two
 * panels stacked in the same sidebar have to agree, and they did not while
 * each owned a private copy of the same CSS.
 */
import { forwardRef, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import s from './ItemList.module.css';

/** One row. `id` is the React key. */
export interface ItemListRow {
  id: string;
  label: ReactNode;
  /** Fixed-size content before the label — a color swatch, a checkbox. */
  leading?: ReactNode;
  /** The row the list considers current. */
  selected?: boolean;
  /** Present but not in effect — history's redo entries. */
  muted?: boolean;
  /** Consumer classes for states this component has no opinion about. */
  className?: string;
  /** Handlers and data attributes for this row's element. `data-*` is
   *  spelled out because `HTMLAttributes` does not admit it, and every
   *  consumer here marks its rows up with one. */
  rowProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
}

export interface ItemListProps {
  rows: readonly ItemListRow[];
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
  className?: string;
  /** Rendered inside the container above the rows — a drop indicator. */
  overlay?: ReactNode;
  /** Spread onto the container: pointer handlers for a drag, `aria-label`. */
  containerProps?: HTMLAttributes<HTMLDivElement>;
}

export const ItemList = forwardRef(function ItemList(
  { rows, empty, className, overlay, containerProps }: ItemListProps,
  ref: Ref<HTMLDivElement>,
) {
  const cls = [s.list, className].filter(Boolean).join(' ');
  if (rows.length === 0) {
    return (
      <div className={cls} ref={ref} {...containerProps}>
        <div className={s.empty}>{empty ?? '—'}</div>
      </div>
    );
  }
  return (
    <div className={cls} ref={ref} {...containerProps}>
      {overlay}
      {rows.map((row) => (
        <div
          key={row.id}
          className={[
            s.row,
            row.selected && s.selected,
            row.muted && s.muted,
            row.className,
          ].filter(Boolean).join(' ')}
          {...row.rowProps}
        >
          {row.leading}
          <span className={s.label}>{row.label}</span>
        </div>
      ))}
    </div>
  );
});
