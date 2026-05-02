/**
 * Pointer-tracking glue that turns hover position into a grid cell, suitable
 * for dropping straight into `createCellHighlightLayer({ getCell })`. Pairs
 * with `gridSnapStrategy` / `createGridLayer` so the visual hover preview
 * uses the exact same spacing as the snap behavior.
 *
 * Wires three things you'd otherwise glue by hand:
 *   1. pointermove on a target element → client coords
 *   2. client coords → world coords via your `ViewTransform`
 *   3. world coords → integer `{col, row}` via `pointToGridCell`
 *
 * State updates only fire when the cell actually changes (not on every
 * pointer tick). Pass `onChange` to trigger a canvas redraw on each transition.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { screenToWorld, type ViewTransform } from '../grid';
import { pointToGridCell } from '../interactions/gestures/shared/strategies/grid';
import type { UnitSystem, UnitValue } from '../units';

export interface UseGridCellHoverOptions {
  /** Element to attach pointer listeners to (typically the canvas). */
  ref: RefObject<HTMLElement | null>;
  /** Read the current view transform. Called on every pointermove so it can
   *  reflect live pan/zoom without a re-binding step. */
  view: () => ViewTransform;
  /** Cell spacing in world units. Same value you pass to `createGridLayer`
   *  and `createCellHighlightLayer`. */
  spacing: UnitValue;
  /** Required if `spacing` is tagged (e.g. `{ value: 1, unit: 'ft' }`). */
  unitSystem?: UnitSystem;
  /** Origin the cell grid is anchored to, in world units. Default `(0, 0)`. */
  origin?: { x: number; y: number };
  /** Fires when the hovered cell changes (including to/from `null`). Use it
   *  to invalidate your layer renderer. */
  onChange?: (cell: { col: number; row: number } | null) => void;
  /** Disable the listeners without unmounting. Default `true`. */
  enabled?: boolean;
}

export interface UseGridCellHoverReturn {
  /** Current hovered cell, or `null` when the pointer is outside the element. */
  cell: { col: number; row: number } | null;
  /** Stable callback that returns the current cell — drop straight into
   *  `createCellHighlightLayer({ getCell })`. */
  getCell: () => { col: number; row: number } | null;
}

function cellsEqual(
  a: { col: number; row: number } | null,
  b: { col: number; row: number } | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.col === b.col && a.row === b.row;
}

export function useGridCellHover(opts: UseGridCellHoverOptions): UseGridCellHoverReturn {
  const [cell, setCell] = useState<{ col: number; row: number } | null>(null);
  const cellRef = useRef<{ col: number; row: number } | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const getCell = useCallback(() => cellRef.current, []);

  const enabled = opts.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    const el = opts.ref.current;
    if (!el) return;

    const update = (next: { col: number; row: number } | null) => {
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
      update(pointToGridCell({ x: wx, y: wy }, o.spacing, o.unitSystem, o.origin));
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
  }, [enabled, opts.ref]);

  return { cell, getCell };
}
