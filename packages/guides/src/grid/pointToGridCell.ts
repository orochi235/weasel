import type { PlaneUnits } from '@weasel-js/core';
import { applyToPoint, invert, type Affine } from '@weasel-js/geom';
import { cellOf, type GridLines, type GridSpacing } from './axes';
import { outlineBox, type Rect } from './lattice';
import { containerLines, gridLines, type GridScopes } from './reading';
import { regionAt, type GridRegion } from './regions';

/** A cell of a grid: the gap between two adjacent lines on each axis,
 *  numbered from the line through each axis's offset (or its first explicit
 *  line). `box` is the cell in the grid's space: world, or `frame`'s, the
 *  frame of the region whose lattice it is on. An axis with no lines is one
 *  cell, `0`, spanning the region, or without end at the root. */
export interface GridCell {
  col: number;
  row: number;
  box: Rect;
  frame?: Affine;
}

/** Where a grid's containers run lattices of their own: the unit `scopes`
 *  it reads, and the `regions` (`sceneGridRegions`) running them. */
export interface GridScoping {
  scopes?: GridScopes;
  regions?: readonly GridRegion[];
}

/**
 * The cell holding `point`, on the lattice of the innermost region holding
 * it, else the root's, which runs through `origin`. Pair with
 * `createCellHighlightLayer` (its `getCell` callback) to draw a snap-target
 * preview on the lattice `gridSnapSource` snaps to. `null` where `point` is
 * outside the lines: past a range a pitch is limited to, or the explicit
 * lines, or in a region with no grid.
 */
export function pointToGridCell(
  point: { x: number; y: number },
  spacing: GridSpacing,
  unitSystem?: PlaneUnits,
  origin: { x: number; y: number } = { x: 0, y: 0 },
  scoped?: GridScoping,
): GridCell | null {
  const region = regionAt(scoped?.regions, point);
  if (!region) {
    const cell = cellIn(gridLines(spacing, unitSystem, scoped?.scopes), point.x - origin.x, point.y - origin.y);
    return cell && { ...cell, box: { ...cell.box, x: cell.box.x + origin.x, y: cell.box.y + origin.y } };
  }
  const lines = containerLines(region.spacing, spacing, unitSystem, scoped?.scopes, region.chain);
  if (!lines) return null;
  const back = region.frame && invert(region.frame);
  if (region.frame && !back) return null;
  const local = (p: { x: number; y: number }) => {
    if (!back) return p;
    const [x, y] = applyToPoint(back, p.x, p.y);
    return { x, y };
  };
  const at = local(point);
  const cell = cellIn(lines, at.x, at.y, outlineBox(region.outline.map(local)));
  return cell && (region.frame ? { ...cell, frame: region.frame } : cell);
}

function cellIn(lines: GridLines, x: number, y: number, within?: Rect): Omit<GridCell, 'frame'> | null {
  const cx = cellOf(lines.x, x);
  const cy = cellOf(lines.y, y);
  if (!cx || !cy) return null;
  const [x0, x1] = within && !lines.x ? [within.x, within.x + within.width] : [cx.lo, cx.hi];
  const [y0, y1] = within && !lines.y ? [within.y, within.y + within.height] : [cy.lo, cy.hi];
  return { col: cx.index, row: cy.index, box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } };
}
