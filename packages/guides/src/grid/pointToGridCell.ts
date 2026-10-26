import type { PerAxis, PlaneUnits, PlaneValue } from '@weasel-js/core';
import { regionAt, type GridRegion } from './regions';
import { gridPitch, type GridScopes } from './scopedPitch';

/** A cell of a grid. `pitch` names the lattice it belongs to, in world units,
 *  where a grid reads unit scopes; without it, the cell is the grid's own. */
export interface GridCell {
  col: number;
  row: number;
  pitch?: PerAxis<number>;
}

/** Where a grid reads unit scopes: `scopes`, and the containers declaring them. */
export interface GridScoping {
  scopes: GridScopes;
  regions?: readonly GridRegion[];
}

/**
 * The integer cell `{col, row}` that contains `point`. Pair with
 * `createCellHighlightLayer` (its `getCell` callback) to draw a snap-target
 * preview that uses the same spacing as `gridSnapSource`. Given `scoped`,
 * the cell is on the lattice of the innermost region holding `point`, and
 * carries that lattice's `pitch`.
 */
export function pointToGridCell(
  point: { x: number; y: number },
  spacing: PlaneValue,
  unitSystem?: PlaneUnits,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  scoped?: GridScoping,
): GridCell {
  const chain = scoped ? regionAt(scoped.regions, point)?.chain : undefined;
  const s = gridPitch(spacing, unitSystem, scoped?.scopes, chain);
  return {
    col: Math.floor((point.x - origin.x) / s.x),
    row: Math.floor((point.y - origin.y) / s.y),
    ...(scoped ? { pitch: s } : {}),
  };
}
