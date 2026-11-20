/**
 * Pointer-tracking glue that turns hover position into a grid cell, suitable
 * for dropping straight into `createCellHighlightLayer({ getCell })`.
 *
 * State updates only fire when the cell actually changes (not on every
 * pointer tick). Pass `onChange` to trigger a canvas redraw on each transition.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  clientToCanvas,
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
  /** Read the current view transform. Called on every pointermove and every
   *  `getCell()`, so a pan or zoom under a still pointer moves the cell. */
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
  /** Disable the listeners without unmounting, dropping the hovered cell.
   *  Default `true`. */
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

/** Track which grid cell the pointer is over; pairs with `createCellHighlightLayer`.
 *  The cell follows the pointer, and is read again from where it last was
 *  each render (new `spacing`, `regions`…) and each `getCell()` call (a
 *  paint after a pan or zoom). Listeners follow `ref.current` as it stands
 *  after each render, so a remounted element is bound once this component
 *  renders. */
export function useGridCellHover(opts: UseGridCellHoverOptions): UseGridCellHoverReturn {
  const [cell, setCell] = useState<GridCell | null>(null);
  const cellRef = useRef<GridCell | null>(null);
  const optsRef = useLatest(opts);
  // The bound element and the pointer's last client point over it.
  const bound = useRef<{ el: HTMLElement; dispose: () => void } | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  const update = useCallback((next: GridCell | null) => {
    if (cellsEqual(cellRef.current, next)) return;
    cellRef.current = next;
    setCell(next);
    optsRef.current.onChange?.(next);
  }, [optsRef]);

  // The cell under the pointer's last point, read with the current options.
  const refresh = useCallback(() => {
    const el = bound.current?.el;
    const at = pointer.current;
    if (!el || !at) return;
    const o = optsRef.current;
    const [sx, sy] = clientToCanvas(el, at.x, at.y);
    const [wx, wy] = screenToWorld(sx, sy, o.view());
    const scoped = { ...(o.scopes ? { scopes: o.scopes } : {}), ...(o.regions ? { regions: o.regions() } : {}) };
    update(pointToGridCell({ x: wx, y: wy }, o.spacing, o.unitSystem, o.origin, scoped));
  }, [optsRef, update]);

  const getCell = useCallback(() => {
    refresh();
    return cellRef.current;
  }, [refresh]);

  const enabled = opts.enabled ?? true;
  // No deps: the element behind the ref can change on any render.
  useEffect(() => {
    const el = enabled ? opts.ref.current : null;
    if (bound.current?.el === el) {
      refresh();
      return;
    }
    bound.current?.dispose();
    const leave = () => {
      pointer.current = null;
      update(null);
    };
    bound.current = el && {
      el,
      dispose: listen(el, (e) => {
        pointer.current = { x: e.clientX, y: e.clientY };
        refresh();
      }, leave),
    };
  });
  useEffect(() => () => {
    bound.current?.dispose();
    bound.current = null;
  }, []);

  return { cell, getCell };
}

/** Hear `el`'s pointer moving over it and leaving it; the returned call
 *  stops, as a leave. */
function listen(el: HTMLElement, onMove: (e: PointerEvent) => void, onLeave: () => void): () => void {
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointercancel', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('pointercancel', onLeave);
    // No pointerleave reaches a detached listener, so a cell hovered now would stay lit.
    onLeave();
  };
}
