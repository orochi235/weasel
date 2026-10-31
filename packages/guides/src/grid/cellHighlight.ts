/**
 * Cell highlight overlay — a thin render layer that fills a single grid cell
 * (e.g. a snap-target preview). Stack it under or over `createGridLayer` in
 * a layer sequence.
 */

import { type DrawCommand, type RenderLayer, type CommandFill, viewportWorldRect } from '@weasel-js/core';
import { mat3 } from '@weasel-js/geom';
import { hasArea, intersect } from './lattice';
import type { GridCell } from './pointToGridCell';

/** Options for `createCellHighlightLayer`. */
export interface CellHighlightLayerOpts {
  /** Cell to highlight, or `null` to skip drawing: its `box`, in its
   *  `frame` where it has one (`pointToGridCell`, `useGridCellHover`). */
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
    draw: (_data, view, dims) => {
      const cell = opts.getCell();
      if (!cell) return [];
      // A root cell on an axis with no lines runs without end: fill what the canvas shows of it.
      const box = cell.frame ? cell.box : intersect(cell.box, viewportWorldRect(view, dims));
      if (!hasArea(box)) return [];
      const children: DrawCommand[] = [{ kind: 'path', path: { kind: 'rect', ...box }, fill }];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return cell.frame ? [{ kind: 'group', transform: mat3.fromAffine(cell.frame), children }] : children;
    },
  };
}
