/**
 * Cell highlight overlay — a thin render layer that fills a single grid cell
 * (e.g. a snap-target preview). Stack it under or over `createGridLayer` in
 * a layer sequence.
 */

import {
  type DrawCommand,
  type RenderLayer,
  type CommandFill,
  resolveAxes,
  type PlaneUnits,
  type PlaneValue,
} from '@weasel-js/core';
import type { GridCell } from './pointToGridCell';

/** Options for `createCellHighlightLayer`. */
export interface CellHighlightLayerOpts {
  /** Cell size in world units (matches the grid's `spacing`). */
  spacing: PlaneValue;
  /** Optional unit system for resolving tagged `spacing` values. */
  unitSystem?: PlaneUnits;
  /** Origin the cell grid is anchored to, in world units. Defaults to (0,0). */
  origin?: () => { x: number; y: number };
  /** Cell to highlight, or `null` to skip drawing. A cell carrying its
   *  lattice's `pitch` (`useGridCellHover` with `scopes`) is drawn at it. */
  getCell: () => GridCell | null;
  /** Fill for the highlighted cell. Defaults to a soft green. */
  fill?: CommandFill;
}

const DEFAULT_FILL: CommandFill = { paint: { kind: 'solid', color: 'rgba(127,176,105,0.15)' } };

/** Build a `RenderLayer` that fills a single grid cell — typically a snap-target preview. */
export function createCellHighlightLayer(opts: CellHighlightLayerOpts): RenderLayer<unknown> {
  const fill = opts.fill ?? DEFAULT_FILL;
  return {
    id: 'cell-highlight',
    label: 'Cell highlight',
    draw: () => {
      const cell = opts.getCell();
      if (!cell) return [];
      const spacing = cell.pitch ?? resolveAxes(opts.spacing, opts.unitSystem);
      const o = opts.origin ? opts.origin() : { x: 0, y: 0 };
      const x = o.x + cell.col * spacing.x;
      const y = o.y + cell.row * spacing.y;
      const children: DrawCommand[] = [
        {
          kind: 'path',
          path: { kind: 'rect', x, y, width: spacing.x, height: spacing.y },
          fill,
        },
      ];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}
