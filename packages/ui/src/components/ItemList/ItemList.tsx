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
import { type CSSProperties, forwardRef, type HTMLAttributes, type ReactNode, type Ref, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { nearestPortalHost } from '../../overlays/portalHost';
import type { ReorderGhost } from '../../useReorderDragList';
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
  /** Rows to draw again under the pointer during a drag — `useReorderDragList`'s `state.ghost`. */
  ghost?: ReorderGhost | null;
}

/** Whether `el` is the containing block of its fixed-position descendants rather than the viewport. */
function containsFixed(el: Element): boolean {
  const cs = getComputedStyle(el);
  return (
    cs.transform !== 'none' ||
    cs.filter !== 'none' ||
    cs.backdropFilter !== 'none' ||
    cs.perspective !== 'none' ||
    /paint|layout|strict|content/.test(cs.contain)
  );
}

/** Copies of the dragged rows at the ghost's point, portaled to the list's themed host so no panel clips them. */
function Ghost({ ghost, rows, from }: { ghost: ReorderGhost; rows: readonly ItemListRow[]; from: Element }) {
  const host = nearestPortalHost(from) ?? document.body;
  const origin = host !== document.body && containsFixed(host) ? host.getBoundingClientRect() : { left: 0, top: 0 };
  const dragged = rows.filter((row) => ghost.ids.includes(row.id));
  // Pixel positioning: the point is the pointer's, known only at runtime.
  const at: CSSProperties = { left: ghost.left - origin.left, top: ghost.top - origin.top, width: ghost.width };
  return createPortal(
    <div className={s.ghost} style={at} aria-hidden="true">
      {dragged.map((row) => (
        <div key={row.id} className={[s.row, row.selected && s.selected].filter(Boolean).join(' ')}>
          {row.leading}
          <span className={s.label}>{row.label}</span>
        </div>
      ))}
    </div>,
    host,
  );
}

export const ItemList = forwardRef(function ItemList(
  { rows, empty, className, overlay, containerProps, ghost }: ItemListProps,
  ref: Ref<HTMLDivElement>,
) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setContainer(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );
  const cls = [s.list, className].filter(Boolean).join(' ');
  if (rows.length === 0) {
    return (
      <div className={cls} ref={setRefs} {...containerProps}>
        <div className={s.empty}>{empty ?? '—'}</div>
      </div>
    );
  }
  return (
    <div className={cls} ref={setRefs} {...containerProps}>
      {overlay}
      {ghost && container ? <Ghost ghost={ghost} rows={rows} from={container} /> : null}
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
