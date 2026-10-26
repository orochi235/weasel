import type { PerAxis, PlaneUnits, PlaneValue } from '@weasel-js/core';
import { applyToPoint, invert, type Affine } from '@weasel-js/geom';
import { regionAt, type GridRegion } from './regions';
import { gridPitch, type GridScopes } from './scopedPitch';

/** A cell of a grid. `pitch` names the lattice it belongs to, in world units,
 *  where a grid reads unit scopes; without it, the cell is the grid's own.
 *  `frame` is that lattice's region's frame, the cell counted from its origin. */
export interface GridCell {
  col: number;
  row: number;
  pitch?: PerAxis<number>;
  frame?: Affine;
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
 * carries that lattice's `pitch`, and its `frame` where the region has one.
 */
export function pointToGridCell(
  point: { x: number; y: number },
  spacing: PlaneValue,
  unitSystem?: PlaneUnits,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  scoped?: GridScoping,
): GridCell {
  const region = scoped ? regionAt(scoped.regions, point) : null;
  const s = gridPitch(spacing, unitSystem, scoped?.scopes, region?.chain);
  const back = region?.frame && invert(region.frame);
  if (region?.frame && back) {
    const [x, y] = applyToPoint(back, point.x, point.y);
    return { col: Math.floor(x / s.x), row: Math.floor(y / s.y), pitch: s, frame: region.frame };
  }
  return {
    col: Math.floor((point.x - origin.x) / s.x),
    row: Math.floor((point.y - origin.y) / s.y),
    ...(scoped ? { pitch: s } : {}),
  };
}
