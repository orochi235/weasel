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
import { CONTROL_SELECTOR, isInControlWithin } from '@weasel-js/core';
import { assignRef } from '@weasel-js/react';
import { dropSide, LIST_ROLES, listMode } from '@weasel-js/headless';
import { modsOf, type PressModifiers, type ReorderGhost } from '../../useReorderDragList';
import { useRowNavigation } from '../../useRowNavigation';
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
   *  spelled out because `HTMLAttributes` does not admit it. A handler here
   *  runs before the list's own, and `preventDefault()` in it keeps the list out. */
  rowProps?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
}

/** Props for {@link ItemList}. */
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

/**
 * The row chrome behind a sidebar list — anything that is a flat column of
 * selectable rows in a panel.
 *
 * It owns the container, the row box, the empty state, the list's semantics,
 * and its keyboard; what a row *means* stays with the consumer, through
 * `className` and `rowProps`.
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
 * anchor to it. In a grid, Right steps from the row into its controls, Left
 * and Escape step back; the controls leave the tab order.
 */
export const ItemList = forwardRef(function ItemList(
  {
    rows, empty, className, selection, onActivate, onNudge, onSelectRange, dropIndex, overlay,
    containerProps, ghost,
  }: ItemListProps,
  ref: Ref<HTMLDivElement>,
) {
  const hasTrailing = rows.some((r) => r.trailing != null);
  const mode = listMode({ selection, activatable: onActivate !== undefined, controls: hasTrailing });
  const interactive = mode !== 'list';

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setContainer(el);
      assignRef(ref, el);
    },
    [ref],
  );

  /** The element of each row that takes focus: the row itself, or in a grid its label cell. */
  const targets = useRef(new Map<string, HTMLElement>());
  const ranges = selection === 'multi' && onSelectRange !== undefined;
  const nav = useRowNavigation<HTMLDivElement>({
    rows,
    isSelected: (id) => !!rows.find((r) => r.id === id)?.selected,
    target: (id) => targets.current.get(id),
    anchorOnFocus: true,
    ...(ranges ? {
      onExtend: (to: string, from: string) => {
        let at = rows.findIndex((r) => r.id === nav.anchor.current);
        if (at < 0) {
          nav.anchor.current = from;
          at = rows.findIndex((r) => r.id === from);
        }
        const end = rows.findIndex((r) => r.id === to);
        onSelectRange(rows.slice(Math.min(at, end), Math.max(at, end) + 1).map((r) => r.id));
      },
    } : {}),
    ...(onNudge ? { onNudge: (id: string, delta: -1 | 1) => onNudge(id, rows.findIndex((r) => r.id === id), delta) } : {}),
    onActivate: (id, mods) => {
      nav.anchor.current = id;
      onActivate?.(id, rows.findIndex((r) => r.id === id), mods);
    },
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

    if (onTarget && nav.onKeyDown(row.id, e)) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // From a row's controls, Up and Down still move between rows.
        e.preventDefault();
        nav.go(row.id, i + (e.key === 'ArrowDown' ? 1 : -1), e.shiftKey);
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
    nav.anchor.current = row.id;
    onActivate?.(row.id, i, modsOf(e));
  };

  const onFocus = (row: ItemListRow) => (e: FocusEvent<HTMLDivElement>) => {
    row.rowProps?.onFocus?.(e);
    if (e.target === targets.current.get(row.id)) nav.onFocus(row.id);
  };

  const targetRef = (id: string) => (el: HTMLElement | null) => {
    if (el) targets.current.set(id, el);
    else targets.current.delete(id);
  };

  const roles = LIST_ROLES[mode];
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
        <DragGhost at={ghost} from={container}><GhostRows rows={rows} ids={ghost.ids} /></DragGhost>
      ) : null}
      {rows.map((row, i) => {
        const tabIndex = interactive ? (row.id === nav.tabStop ? 0 : -1) : undefined;
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
            ref={(el) => {
              nav.rowRef(row.id)(el);
              if (mode === 'listbox') targetRef(row.id)(el);
            }}
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

/** The dragged rows as the ghost draws them: leading and label, no controls. */
function GhostRows({ rows, ids }: { rows: readonly ItemListRow[]; ids: readonly string[] }) {
  return rows
    .filter((row) => ids.includes(row.id))
    .map((row) => (
      <div key={row.id} className={[s.row, row.selected && s.selected].filter(Boolean).join(' ')}>
        {row.leading}
        <span className={s.label}>{row.label}</span>
      </div>
    ));
}
