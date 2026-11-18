import { useRef, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { isInControlWithin } from '@weasel-js/gestures';
import type { ListMode } from '@weasel-js/ui-logic';
import { modsOf } from '../../useReorderDragList';
import { useRowNavigation } from '../../useRowNavigation';
import { walkControls } from '../../rowControls';
import type { ItemListProps, ItemListRow } from './ItemList';
import s from './ItemList.module.css';

/** What a list's row input reads, as of this render. */
export interface RowInputs extends Pick<ItemListProps, 'onAction' | 'onNudge' | 'onSelectRange'> {
  rows: readonly ItemListRow[];
  mode: ListMode;
  /** Activation and range moves report: the list is not disabled. */
  looks: boolean;
  /** Rows move by key: the list is neither disabled nor read-only. */
  moves: boolean;
  /** Shift+Up/Down and Shift+Home/End report a range, in a multi-select list. */
  ranges: boolean;
}

/**
 * How an item list's rows take input: which element of each takes focus, moving between rows and into a grid row's
 * controls by key, and activating a row by click or key with the modifiers held. A row's own handler runs first, and
 * `preventDefault()` in it keeps the list out.
 */
export function useRowInput({ rows, mode, looks, moves, ranges, onAction, onNudge, onSelectRange }: RowInputs) {
  /** The element of each row that takes focus: the row itself, or in a grid its label cell. */
  const targets = useRef(new Map<string, HTMLElement>());
  const indexOf = (id: string): number => rows.findIndex((r) => r.id === id);
  const nav = useRowNavigation<HTMLDivElement>({
    rows,
    isSelected: (id) => !!rows.find((r) => r.id === id)?.selected,
    target: (id) => targets.current.get(id),
    anchorOnFocus: true,
    ...(ranges && onSelectRange ? {
      onExtend: (to: string, from: string) => {
        let at = rows.findIndex((r) => r.id === nav.anchor.current);
        if (at < 0) {
          nav.anchor.current = from;
          at = indexOf(from);
        }
        const end = indexOf(to);
        onSelectRange(rows.slice(Math.min(at, end), Math.max(at, end) + 1).map((r) => r.id));
      },
    } : {}),
    ...(onNudge && moves ? { onNudge: (id: string, delta: -1 | 1) => onNudge(id, indexOf(id), delta) } : {}),
    onAction: (id, mods) => {
      nav.anchor.current = id;
      if (looks) onAction?.(id, indexOf(id), mods);
    },
  });

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
      case 'Escape':
        if (controlCell) walkControls(e, controlCell, target, onTarget);
        return;
      default:
    }
  };

  const onClick = (row: ItemListRow, i: number) => (e: MouseEvent<HTMLDivElement>) => {
    row.rowProps?.onClick?.(e);
    if (e.defaultPrevented || isInControlWithin(e.target, e.currentTarget)) return;
    nav.anchor.current = row.id;
    if (looks) onAction?.(row.id, i, modsOf(e));
  };

  const onFocus = (row: ItemListRow) => (e: FocusEvent<HTMLDivElement>) => {
    row.rowProps?.onFocus?.(e);
    if (e.target === targets.current.get(row.id)) nav.onFocus(row.id);
  };

  const targetRef = (id: string) => (el: HTMLElement | null) => {
    if (el) targets.current.set(id, el);
    else targets.current.delete(id);
  };

  return { targets: targets.current, tabStop: nav.tabStop, rowRef: nav.rowRef, targetRef, onKeyDown, onClick, onFocus };
}
