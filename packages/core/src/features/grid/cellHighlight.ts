/**
 * Cell highlight overlay — a thin render layer that fills a single grid cell
 * (e.g. a snap-target preview). Stack it under or over `createGridLayer` in
 * a layer sequence.
 */

import { type DrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { type FillStyle } from '@weasel-js/paint';
import { resolveUnit, type UnitSystem, type UnitValue } from 'core/units';

/** Options for `createCellHighlightLayer`. */
export interface CellHighlightLayerOpts {
  /** Cell size in world units (matches the grid's `spacing`). */
  spacing: UnitValue;
  /** Optional unit system for resolving tagged `spacing` values. */
  unitSystem?: UnitSystem;
  /** Origin the cell grid is anchored to, in world units. Defaults to (0,0). */
  origin?: () => { x: number; y: number };
  /** Cell to highlight, or `null` to skip drawing. */
  getCell: () => { col: number; row: number } | null;
  /** FillStyle strategy for the filled cell. Defaults to a soft green. */
  fill?: FillStyle;
}

const DEFAULT_FILL: FillStyle = { fill: 'solid', color: 'rgba(127,176,105,0.15)' };

/** Build a `RenderLayer` that fills a single grid cell — typically a snap-target preview. */
export function createCellHighlightLayer(opts: CellHighlightLayerOpts): RenderLayer<unknown> {
  const fill = opts.fill ?? DEFAULT_FILL;
  return {
    id: 'cell-highlight',
    label: 'Cell highlight',
    draw: () => {
      const cell = opts.getCell();
      if (!cell) return [];
      const spacing = resolveUnit(opts.spacing, opts.unitSystem);
      const o = opts.origin ? opts.origin() : { x: 0, y: 0 };
      const x = o.x + cell.col * spacing;
      const y = o.y + cell.row * spacing;
      const children: DrawCommand[] = [
        {
          kind: 'path',
          path: { kind: 'rect', x, y, width: spacing, height: spacing },
          fill,
        },
      ];
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}
