import type { SnapStrategy } from '../../types';
import { resolveUnit, type UnitSystem, type UnitValue } from '../../../../units';

/** Snap-strategy that rounds `x`/`y` to the nearest multiple of `spacing` (resolved through `unitSystem`). */
export function gridSnapStrategy<TPose extends { x: number; y: number }>(
  spacing: UnitValue,
  unitSystem?: UnitSystem,
): SnapStrategy<TPose> {
  const c = resolveUnit(spacing, unitSystem);
  return {
    snap(pose) {
      return {
        ...pose,
        x: Math.round(pose.x / c) * c,
        y: Math.round(pose.y / c) * c,
      };
    },
  };
}

/**
 * Compute the integer cell `{col, row}` that contains `point`, given a grid
 * `spacing` and optional `origin` and `unitSystem`. Pair with
 * `createCellHighlightLayer` (its `getCell` callback) to draw a snap-target
 * preview that uses the same spacing as `gridSnapStrategy` — so the visual
 * and behavioral grids stay in lockstep:
 *
 *     const SPACING = 20;
 *     const snap = gridSnapStrategy(SPACING);
 *     // visual grid:
 *     createGridLayer({ spacing: SPACING, bounds: () => ... });
 *     // hover-preview overlay:
 *     createCellHighlightLayer({
 *       spacing: SPACING,
 *       getCell: () => hoverPoint && pointToGridCell(hoverPoint, SPACING),
 *     });
 */
export function pointToGridCell(
  point: { x: number; y: number },
  spacing: UnitValue,
  unitSystem?: UnitSystem,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): { col: number; row: number } {
  const s = resolveUnit(spacing, unitSystem);
  return {
    col: Math.floor((point.x - origin.x) / s),
    row: Math.floor((point.y - origin.y) / s),
  };
}
