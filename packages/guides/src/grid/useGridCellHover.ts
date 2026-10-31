/**
 * Pointer-tracking glue that turns hover position into a grid cell, suitable
 * for dropping straight into `createCellHighlightLayer({ getCell })`.
 *
 * State updates only fire when the cell actually changes (not on every
 * pointer tick). Pass `onChange` to trigger a canvas redraw on each transition.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  useLatest,
  screenToWorld,
  type ViewTransform,
  type PlaneUnits,
} from '@weasel-js/core';
import type { GridSpacing } from './axes';
import { pointToGridCell, type GridCell } from './pointToGridCell';
import type { GridRegion } from './regions';
import type { GridScopes } from './reading';

/** Options for `useGridCellHover`. */
export interface UseGridCellHoverOptions {
  /** Element to attach pointer listeners to (typically the canvas). */
  ref: RefObject<HTMLElement | null>;
  /** Read the current view transform. Called on every pointermove so it can
   *  reflect live pan/zoom without a re-binding step. */
  view: () => ViewTransform;
  /** The grid's lines. Same value you pass to `createGridLayer`. */
  spacing: GridSpacing;
  /** Required if `spacing` is tagged (e.g. `{ value: 1, unit: 'ft' }`). */
  unitSystem?: PlaneUnits;
  /** Origin the cell grid is anchored to, in world units. Default `(0, 0)`. */
  origin?: { x: number; y: number };
  /** Read `spacing` in these scopes, as `createGridLayer` does. */
  scopes?: GridScopes;
  /** The containers running lattices of their own, read on every
   *  pointermove: a cell inside one is on its lattice, in its frame. */
  regions?: () => readonly GridRegion[];
  /** Fires when the hovered cell changes (including to/from `null`). Use it
   *  to invalidate your layer renderer. */
  onChange?: (cell: GridCell | null) => void;
  /** Disable the listeners without unmounting. Default `true`. */
  enabled?: boolean;
}

/** Return shape of `useGridCellHover`. */
export interface UseGridCellHoverReturn {
  /** Current hovered cell, or `null` when the pointer is outside the element. */
  cell: GridCell | null;
  /** Stable callback that returns the current cell — drop straight into
   *  `createCellHighlightLayer({ getCell })`. */
  getCell: () => GridCell | null;
}

function cellsEqual(
  a: GridCell | null,
  b: GridCell | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.col === b.col && a.row === b.row
    && a.box.x === b.box.x && a.box.y === b.box.y && a.box.width === b.box.width && a.box.height === b.box.height
    && (a.frame === b.frame || (!!a.frame && !!b.frame && a.frame.every((v, i) => v === b.frame![i])));
}

/** Track which grid cell the pointer is over; pairs with `createCellHighlightLayer`. */
export function useGridCellHover(opts: UseGridCellHoverOptions): UseGridCellHoverReturn {
  const [cell, setCell] = useState<GridCell | null>(null);
  const cellRef = useRef<GridCell | null>(null);
  const optsRef = useLatest(opts);

  const getCell = useCallback(() => cellRef.current, []);

  const enabled = opts.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    const el = opts.ref.current;
    if (!el) return;

    const update = (next: GridCell | null) => {
      if (cellsEqual(cellRef.current, next)) return;
      cellRef.current = next;
      setCell(next);
      optsRef.current.onChange?.(next);
    };

    const onMove = (e: PointerEvent) => {
      const o = optsRef.current;
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wy] = screenToWorld(sx, sy, o.view());
      const scoped = { ...(o.scopes ? { scopes: o.scopes } : {}), ...(o.regions ? { regions: o.regions() } : {}) };
      update(pointToGridCell({ x: wx, y: wy }, o.spacing, o.unitSystem, o.origin, scoped));
    };
    const onLeave = () => update(null);

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointercancel', onLeave);
    };
  }, [enabled, opts.ref, optsRef]);

  return { cell, getCell };
}
