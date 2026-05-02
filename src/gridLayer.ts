/**
 * Grid overlay — a reusable render layer that draws a world-space grid with
 * optional finer subdivisions and accent lines every N cells.
 *
 * The layer renders in world space — the caller is expected to have applied
 * any view transform to the canvas context already. To draw a highlighted
 * cell (snap-target preview), stack `createCellHighlightLayer` alongside
 * this one.
 */

import type { RenderLayer } from './renderLayer';
import { resolveUnit, type UnitSystem, type UnitValue } from './units';

/** Options for `createGridLayer`. */
export interface GridLayerOpts {
  /**
   * Distance between adjacent grid lines (also known as grid pitch),
   * in world (base) units. Accepts a bare number or a tagged
   * `{ value, unit }`. Tagged values require `unitSystem` to be supplied.
   */
  spacing: UnitValue;
  /** Optional unit system for resolving tagged `spacing` values. */
  unitSystem?: UnitSystem;
  /** Bounds of the area to cover, in world units. */
  bounds: () => { x: number; y: number; width: number; height: number };
  /** Lines every N cells get the accent style. 0/undef = no accent. */
  accentEvery?: number;
  /** Optional finer subdivisions per cell. e.g. 4 -> 4 sub-lines per cell. */
  subdivisions?: number;
  style?: {
    line?: string;
    accent?: string;
    sub?: string;
    lineWidth?: number;
  };
}

const DEFAULT_STYLE = {
  line: '#2a2018',
  accent: '#3a2e22',
  sub: 'rgba(255,255,255,0.04)',
  lineWidth: 1,
};

function drawVLine(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

function drawHLine(ctx: CanvasRenderingContext2D, y: number, x0: number, x1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

/** Build a `RenderLayer` that draws a world-space grid with optional accent lines and subdivisions. */
export function createGridLayer(opts: GridLayerOpts): RenderLayer<unknown> {
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) };

  return {
    id: 'grid',
    label: 'Grid',
    draw: (ctx: CanvasRenderingContext2D) => {
      const b = opts.bounds();
      if (b.width <= 0 || b.height <= 0) return;

      const { accentEvery, subdivisions } = opts;
      const spacing = resolveUnit(opts.spacing, opts.unitSystem);
      const x0 = b.x;
      const y0 = b.y;
      const x1 = b.x + b.width;
      const y1 = b.y + b.height;

      ctx.lineWidth = style.lineWidth;

      // 2. Sub-lines (finest, drawn first so cell lines paint on top).
      if (subdivisions && subdivisions > 1) {
        ctx.strokeStyle = style.sub;
        const step = spacing / subdivisions;
        for (let x = x0; x <= x1 + 1e-9; x += step) {
          // Skip lines that coincide with cell lines — those will be drawn next.
          const k = Math.round((x - x0) / step);
          if (k % subdivisions === 0) continue;
          drawVLine(ctx, x, y0, y1);
        }
        for (let y = y0; y <= y1 + 1e-9; y += step) {
          const k = Math.round((y - y0) / step);
          if (k % subdivisions === 0) continue;
          drawHLine(ctx, y, x0, x1);
        }
      }

      // 3. Cell lines (skip ones that will become accents).
      ctx.strokeStyle = style.line;
      let idx = 0;
      for (let x = x0; x <= x1 + 1e-9; x += spacing) {
        const isAccent = !!accentEvery && accentEvery > 0 && idx % accentEvery === 0;
        if (!isAccent) drawVLine(ctx, x, y0, y1);
        idx++;
      }
      idx = 0;
      for (let y = y0; y <= y1 + 1e-9; y += spacing) {
        const isAccent = !!accentEvery && accentEvery > 0 && idx % accentEvery === 0;
        if (!isAccent) drawHLine(ctx, y, x0, x1);
        idx++;
      }

      // 4. Accent lines on top.
      if (accentEvery && accentEvery > 0) {
        ctx.strokeStyle = style.accent;
        idx = 0;
        for (let x = x0; x <= x1 + 1e-9; x += spacing) {
          if (idx % accentEvery === 0) drawVLine(ctx, x, y0, y1);
          idx++;
        }
        idx = 0;
        for (let y = y0; y <= y1 + 1e-9; y += spacing) {
          if (idx % accentEvery === 0) drawHLine(ctx, y, x0, x1);
          idx++;
        }
      }
    },
  };
}
