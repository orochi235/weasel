import { resolveAxes, type PlaneUnits, type PlaneValue } from '@weasel-js/core';

/**
 * The integer cell `{col, row}` that contains `point`. Pair with
 * `createCellHighlightLayer` (its `getCell` callback) to draw a snap-target
 * preview that uses the same spacing as `gridSnapSource`.
 */
export function pointToGridCell(
  point: { x: number; y: number },
  spacing: PlaneValue,
  unitSystem?: PlaneUnits,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): { col: number; row: number } {
  const s = resolveAxes(spacing, unitSystem);
  return {
    col: Math.floor((point.x - origin.x) / s.x),
    row: Math.floor((point.y - origin.y) / s.y),
  };
}
