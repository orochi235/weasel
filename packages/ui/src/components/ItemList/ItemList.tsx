/**
 * The row chrome behind a sidebar list — layers, history, anything that is a
 * flat column of selectable rows in a panel.
 *
 * It owns the container, the row box, the empty state, the list's semantics
 * and its keyboard; what a row *means* stays with the consumer. History dims
 * its redo entries and rules a line under the current one; a layer list drags
 * to reorder and leads each row with a swatch. Both reach that through
 * `className` and `rowProps` rather than through options here, so this does
 * not grow a flag per consumer.
 *
 * Rows are one height and one inset for every list, which is the point: two
 * panels stacked in the same sidebar have to agree, and they did not while
 * each owned a private copy of the same CSS.
 *
 * **Semantics.** The role follows what the list can do:
 * - nothing to select or activate → `list` / `listitem`, and no row is focusable;
 * - `selection` with no row controls → `listbox` / `option`, `aria-selected`;
 * - any row with `trailing` controls, or `onActivate` without `selection` →
 *   `grid` / `row`, with the leading content and label in one `gridcell` and
 *   the controls in a second. An option may not contain interactive content,
 *   so a list whose rows host toggles cannot be a listbox.
 *
 * **Keyboard.** One row is in the tab order: the one last focused, else the
 * first selected, else the first. Up/Down and Home/End move between rows,
 * Enter/Space activate, carrying modifiers so Shift+Space is Shift+click, and
 * Alt+Up/Down call `onNudge`. In a multi-select list with `onSelectRange`,
 * Shift+Up/Down and Shift+Home/End move focus and report the rows from the
 * anchor — the row last focused or activated other than by a range — to it. In a grid, Right steps from the row into its
 * controls, Left and Escape step back; the controls leave the tab order.
 */
import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { CONTROL_SELECTOR, isInControlWithin } from '../../interactiveTarget';
import type { PressModifiers, ReorderGhost } from '../../useReorderDragList';
import { DragGhost } from '../DragGhost';
import s from './ItemList.module.css';

/** One row. `id` is the React key. */
export interface ItemListRow {
  id: string;
  label: ReactNode;
  /** Fixed-size decoration before the label — a color swatch. Not a control:
   *  those go in `trailing`. */
  leading?: ReactNode;
  /** Buttons and toggles after the label — visibility, lock. They keep their
   *  own clicks and keys, and turn the list into a grid. A control that edits
   *  with the arrow keys does not belong here. */
  trailing?: ReactNode;
  /** The row the list considers current. With `selection` set this is also
   *  `aria-selected`. */
  selected?: boolean;
  /** Present but not in effect — history's redo entries. */
  muted?: boolean;
  /** Part of a drag in progress — `useReorderDragList`'s `state.draggedIds`. */
  dragging?: boolean;
  /** Consumer classes for states this component has no opinion about. */
  className?: string;
  /** Handlers and data attributes for this row's element. `data-*` is
   *  spelled out because `HTMLAttributes` does not admit it, and every
   *  consumer here marks its rows up with one. A handler here runs before the
   *  list's own, and `preventDefault()` in it keeps the list out. */
  rowProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
}

export interface ItemListProps {
  rows: readonly ItemListRow[];
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode;
  className?: string;
  /**
   * Whether rows are selectable, and how many at once. The list reports
   * `selected` to assistive tech; choosing what is selected stays with
   * `onActivate`.
   */
  selection?: 'single' | 'multi';
  /**
   * A row was clicked, or Enter/Space was pressed on it, with the modifiers
   * held. Clicks and keys on a row's `trailing` controls do not reach this.
   */
  onActivate?(id: string, index: number, mods: PressModifiers): void;
  /**
   * Alt+Up (`-1`) or Alt+Down (`1`) on a row: move it. Focus stays on the
   * row wherever it lands. `useReorderDragList`'s `nudge` fits as-is.
   */
  onNudge?(id: string, index: number, delta: -1 | 1): void;
  /**
   * With `selection="multi"`: Shift+Up/Down or Shift+Home/End moved focus,
   * and `ids` is every row from the anchor to the newly focused one, in list
   * order. The anchor is the row last focused or activated other than by a
   * range move, so a click or a plain arrow move re-anchors. What the range does to
   * the selection stays with the consumer, as with `onActivate`. Without it,
   * Shift+Arrow only moves focus.
   */
  onSelectRange?(ids: string[]): void;
  /**
   * Where a drop would land, as an insertion index: `0` is above the first
   * row, `rows.length` below the last. The list draws the seam itself, from
   * the rows' own boxes, so it follows whatever height the density gives
   * them. `useReorderDragList`'s `state.targetIndex` goes here as-is.
   */
  dropIndex?: number | null;
  /** Rendered inside the container ahead of the rows. */
  overlay?: ReactNode;
  /** Spread onto the container: pointer handlers for a drag, `aria-label`. */
  containerProps?: HTMLAttributes<HTMLDivElement>;
  /** Rows to draw again under the pointer during a drag — `useReorderDragList`'s `state.ghost`. */
  ghost?: ReorderGhost | null;
}

type Mode = 'list' | 'listbox' | 'grid';

const ROLES: Record<Mode, { container: string; row: string }> = {
  list: { container: 'list', row: 'listitem' },
  listbox: { container: 'listbox', row: 'option' },
  grid: { container: 'grid', row: 'row' },
};

export const ItemList = forwardRef(function ItemList(
  {
    rows, empty, className, selection, onActivate, onNudge, onSelectRange, dropIndex, overlay,
    containerProps, ghost,
  }: ItemListProps,
  ref: Ref<HTMLDivElement>,
) {
  const hasTrailing = rows.some((r) => r.trailing != null);
  const mode: Mode = hasTrailing || (onActivate && !selection)
    ? 'grid'
    : selection ? 'listbox' : 'list';
  const interactive = mode !== 'list';

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setContainer(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  /** The element of each row that takes focus: the row itself, or in a grid its label cell. */
  const targets = useRef(new Map<string, HTMLElement>());
  const [focusId, setFocusId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const anchor = useRef<string | null>(null);
  /** The row a range move is focusing, whose focus must not re-anchor. */
  const extending = useRef<string | null>(null);

  const stopId = rows.some((r) => r.id === focusId)
    ? focusId
    : (rows.find((r) => r.selected) ?? rows[0])?.id;

  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (id == null) return;
    pendingFocus.current = null;
    const el = targets.current.get(id);
    if (el && document.activeElement !== el) el.focus();
  });

  useLayoutEffect(() => {
    if (mode !== 'grid') return;
    for (const target of targets.current.values()) {
      const cell = target.parentElement?.querySelector(`.${s.trailing}`);
      cell?.querySelectorAll(CONTROL_SELECTOR).forEach((c) => c.setAttribute('tabindex', '-1'));
    }
  });

  const cls = [s.list, className].filter(Boolean).join(' ');
  if (rows.length === 0) {
    return (
      <div className={cls} ref={setRefs} {...containerProps}>
        <div className={s.empty}>{empty ?? '—'}</div>
      </div>
    );
  }

  const focusRow = (index: number) => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (row) targets.current.get(row.id)?.focus();
  };

  const ranges = selection === 'multi' && onSelectRange !== undefined;

  /** Moves focus to `index`: a range from the anchor when `extend`, else a plain move. */
  const moveTo = (from: ItemListRow, index: number, extend: boolean) => {
    const to = Math.max(0, Math.min(rows.length - 1, index));
    if (!extend || !ranges) {
      focusRow(to);
      return;
    }
    let at = rows.findIndex((r) => r.id === anchor.current);
    if (at < 0) {
      anchor.current = from.id;
      at = rows.indexOf(from);
    }
    extending.current = rows[to]!.id;
    focusRow(to);
    extending.current = null;
    onSelectRange(rows.slice(Math.min(at, to), Math.max(at, to) + 1).map((r) => r.id));
  };

  const onKeyDown = (row: ItemListRow, i: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    row.rowProps?.onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const target = targets.current.get(row.id);
    if (!target) return;
    const onTarget = e.target === target;
    const controlCell = mode === 'grid'
      ? e.currentTarget.querySelector<HTMLElement>(`.${s.trailing}`)
      : null;
    if (!onTarget && !controlCell?.contains(e.target as Node)) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        if (e.altKey && onNudge && onTarget) {
          pendingFocus.current = row.id;
          onNudge(row.id, i, delta);
        } else {
          moveTo(row, i + delta, e.shiftKey);
        }
        return;
      }
      case 'Home':
      case 'End':
        if (!onTarget) return;
        e.preventDefault();
        moveTo(row, e.key === 'Home' ? 0 : rows.length - 1, e.shiftKey);
        return;
      case 'Enter':
      case ' ':
        if (!onTarget) return;
        e.preventDefault();
        anchor.current = row.id;
        onActivate?.(row.id, i, modsOf(e));
        return;
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'Escape': {
        if (!controlCell) return;
        const controls = Array.from(controlCell.querySelectorAll<HTMLElement>(CONTROL_SELECTOR))
          .filter((c) => !c.matches(':disabled'));
        if (onTarget) {
          if (e.key !== 'ArrowRight' || !controls[0]) return;
          e.preventDefault();
          controls[0].focus();
          return;
        }
        e.preventDefault();
        const at = controls.findIndex((c) => c.contains(e.target as Node));
        if (e.key === 'ArrowRight') controls[at + 1]?.focus();
        else if (e.key === 'ArrowLeft' && at > 0) controls[at - 1]?.focus();
        else target.focus();
        return;
      }
      default:
    }
  };

  const onClick = (row: ItemListRow, i: number) => (e: MouseEvent<HTMLDivElement>) => {
    row.rowProps?.onClick?.(e);
    if (e.defaultPrevented || isInControlWithin(e.target, e.currentTarget)) return;
    anchor.current = row.id;
    onActivate?.(row.id, i, modsOf(e));
  };

  const onFocus = (row: ItemListRow) => (e: FocusEvent<HTMLDivElement>) => {
    row.rowProps?.onFocus?.(e);
    if (e.target !== targets.current.get(row.id)) return;
    setFocusId(row.id);
    if (extending.current !== row.id) anchor.current = row.id;
  };

  const targetRef = (id: string) => (el: HTMLElement | null) => {
    if (el) targets.current.set(id, el);
    else targets.current.delete(id);
  };

  const roles = ROLES[mode];
  return (
    <div
      className={cls}
      ref={setRefs}
      {...containerProps}
      role={roles.container}
      aria-multiselectable={selection === 'multi' && mode !== 'list' ? true : undefined}
    >
      {overlay}
      {ghost && container ? (
        <DragGhost at={ghost} from={container}>
          {rows
            .filter((row) => ghost.ids.includes(row.id))
            .map((row) => (
              <div key={row.id} className={[s.row, row.selected && s.selected].filter(Boolean).join(' ')}>
                {row.leading}
                <span className={s.label}>{row.label}</span>
              </div>
            ))}
        </DragGhost>
      ) : null}
      {rows.map((row, i) => {
        const tabIndex = interactive ? (row.id === stopId ? 0 : -1) : undefined;
        const content = (
          <>
            {row.leading}
            <span className={s.label}>{row.label}</span>
          </>
        );
        return (
          <div
            key={row.id}
            className={[
              s.row,
              row.selected && s.selected,
              row.muted && s.muted,
              row.className,
            ].filter(Boolean).join(' ')}
            {...row.rowProps}
            role={roles.row}
            aria-selected={selection && mode !== 'list' ? !!row.selected : undefined}
            ref={mode === 'listbox' ? targetRef(row.id) : undefined}
            tabIndex={mode === 'listbox' ? tabIndex : row.rowProps?.tabIndex}
            onKeyDown={interactive ? onKeyDown(row, i) : row.rowProps?.onKeyDown}
            onClick={interactive ? onClick(row, i) : row.rowProps?.onClick}
            onFocus={interactive ? onFocus(row) : row.rowProps?.onFocus}
            data-drop={dropSide(dropIndex, i, rows.length)}
            data-dragging={row.dragging ? 'true' : undefined}
          >
            {mode === 'grid' ? (
              <>
                <div role="gridcell" className={s.cell} ref={targetRef(row.id)} tabIndex={tabIndex}>
                  {content}
                </div>
                {row.trailing != null && (
                  <div role="gridcell" className={s.trailing}>{row.trailing}</div>
                )}
              </>
            ) : content}
          </div>
        );
      })}
    </div>
  );
});

function modsOf(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): PressModifiers {
  return { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey };
}

/** Which edge of row `i` carries the seam for `dropIndex`, if any. */
function dropSide(
  dropIndex: number | null | undefined,
  i: number,
  count: number,
): 'before' | 'after' | undefined {
  if (dropIndex == null) return undefined;
  if (dropIndex === i) return 'before';
  if (dropIndex >= count && i === count - 1) return 'after';
  return undefined;
}
