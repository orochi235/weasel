import { useLayoutEffect, type KeyboardEvent, type RefObject } from 'react';
import { untabControls, walkControls } from '../../rowControls';
import { CONTROLS_ATTR } from './TreeRow';

/** In a treegrid, takes every row's controls out of the tab order. On every render: a consumer's control mounts, or
 *  remounts, with any render of its own. */
export function useUntabbedControls(grid: boolean, tree: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    if (grid) tree.current?.querySelectorAll(`[${CONTROLS_ATTR}]`).forEach(untabControls);
  });
}

/**
 * A key pressed inside a treegrid row's control cell, with the row as `currentTarget`. Up and Down still move
 * between rows, by `go`; Left, Right and Escape walk the controls, and step back to the row past the first.
 * Returns whether the key came from the cell: every other key there is the control's own, and not the tree's.
 */
export function controlCellKey(e: KeyboardEvent<HTMLElement>, go: (delta: -1 | 1, extend: boolean) => void): boolean {
  const cell = (e.target as Element).closest<HTMLElement>(`[${CONTROLS_ATTR}]`);
  if (!cell || !e.currentTarget.contains(cell)) return false;
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    go(e.key === 'ArrowDown' ? 1 : -1, e.shiftKey);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Escape') {
    walkControls(e, cell, e.currentTarget, false);
  }
  return true;
}

/** Right on a leaf or an open branch steps into the row's controls, as a treegrid steps into a row's cells. A closed
 *  branch opens first; a row with no controls is left to the tree's keys. */
export function enterControls(e: KeyboardEvent<HTMLElement>, closedBranch: boolean): boolean {
  if (closedBranch || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return false;
  const cell = e.currentTarget.querySelector<HTMLElement>(`[${CONTROLS_ATTR}]`);
  return !!cell && walkControls(e, cell, e.currentTarget, true);
}
