/**
 * Cell highlight overlay — a thin render layer that fills a single grid cell
 * (e.g. a snap-target preview). Stack it under or over `createGridLayer` in
 * a `runLayers([...])` sequence.
 */

import type { RenderLayer } from './renderLayer';
import { applyPaint, type Paint } from './paint';
import { resolveUnit, type UnitSystem, type UnitValue } from './units';

export interface CellHighlightLayerOpts {
  /** Cell size in world units (matches the grid's `spacing`). */
  spacing: UnitValue;
  /** Optional unit system for resolving tagged `spacing` values. */
  unitSystem?: UnitSystem;
  /** Origin the cell grid is anchored to, in world units. Defaults to (0,0). */
  origin?: () => { x: number; y: number };
  /** Cell to highlight, or `null` to skip drawing. */
  getCell: () => { col: number; row: number } | null;
  /** Paint strategy for the filled cell. Defaults to a soft green. */
  fill?: Paint;
}

const DEFAULT_FILL: Paint = { fill: 'solid', color: 'rgba(127,176,105,0.15)' };

export function createCellHighlightLayer(opts: CellHighlightLayerOpts): RenderLayer<unknown> {
  const fill = opts.fill ?? DEFAULT_FILL;
  return {
    id: 'cell-highlight',
    label: 'Cell highlight',
    draw: (ctx: CanvasRenderingContext2D) => {
      const cell = opts.getCell();
      if (!cell) return;
      const spacing = resolveUnit(opts.spacing, opts.unitSystem);
      const o = opts.origin ? opts.origin() : { x: 0, y: 0 };
      const x = o.x + cell.col * spacing;
      const y = o.y + cell.row * spacing;
      ctx.save();
      applyPaint(ctx, fill, { x, y });
      ctx.fillRect(x, y, spacing, spacing);
      ctx.restore();
    },
  };
}
