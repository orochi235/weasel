/**
 * Grid overlay — a reusable render layer that draws a world-space grid with
 * optional finer subdivisions and accent lines every N cells.
 *
 * The layer renders in world space — the caller is expected to have applied
 * any view transform to the canvas context already. To draw a highlighted
 * cell (snap-target preview), stack `createCellHighlightLayer` alongside
 * this one.
 */

import {
  type DrawCommand,
  type RenderLayer,
  type CommandStroke,
  resolveStrokeWidth,
  resolveAxes,
  type PlaneUnits,
  type PlaneValue,
  pxExtent,
  viewportWorldRect,
  type Dims,
  type View,
} from '@weasel-js/core';
import { PATH_L, PATH_M, type PolygonPath } from '@weasel-js/geom';

/** Options for `createGridLayer`. */
export interface GridLayerOpts {
  /**
   * Distance between adjacent grid lines (also known as grid pitch),
   * in world (base) units. Accepts a bare number or a tagged
   * `{ value, unit }`. Tagged values require `unitSystem` to be supplied.
   * Either may be per axis — `{ x, y }`.
   */
  spacing: PlaneValue;
  /** Optional unit system for resolving tagged `spacing` values. */
  unitSystem?: PlaneUnits;
  /**
   * The area to cover, in world units, read every paint with that paint's
   * view and canvas size. Lines start at its own `x`/`y`. Omitted, the grid
   * covers whatever the canvas shows, with its lines on world multiples of
   * `spacing` so they stay put as the view pans.
   */
  bounds?: (view: View, dims: Dims) => { x: number; y: number; width: number; height: number };
  /** Lines every N cells get the accent style. 0/undef = no accent. */
  accentEvery?: number;
  /** Optional finer subdivisions per cell. e.g. 4 -> 4 sub-lines per cell. */
  subdivisions?: number;
  /** Per-band stroke styles. Each is a Paint+width (etc.) — see `Stroke`. */
  style?: {
    line?: CommandStroke;
    accent?: CommandStroke;
    sub?: CommandStroke;
  };
}

// Defaults express weight via opacity rather than a fixed dark color so the
// grid reads correctly against any background fill (kit demos use a neutral
// gray; consumer apps may use cream / dark / themed surfaces). Override
// per-canvas via `style.{line,accent,sub}.paint` if a hard color is needed.
const DEFAULT_LINE: CommandStroke = {
  paint: { kind: 'solid', color: 'rgba(255, 255, 255, 0.08)' },
  width: 1,
};
const DEFAULT_ACCENT: CommandStroke = {
  paint: { kind: 'solid', color: 'rgba(255, 255, 255, 0.16)' },
  width: 1,
};
const DEFAULT_SUB: CommandStroke = {
  paint: { kind: 'solid', color: 'rgba(255, 255, 255, 0.04)' },
  width: 1,
};

/** Closest, in CSS pixels, a line family is drawn; denser ones are left out. */
const MIN_SCREEN_SPACING = 4;

/** Build a `RenderLayer` that draws a world-space grid with optional accent lines and subdivisions. */
export function createGridLayer(opts: GridLayerOpts): RenderLayer<unknown> {
  const line = opts.style?.line ?? DEFAULT_LINE;
  const accent = opts.style?.accent ?? DEFAULT_ACCENT;
  const sub = opts.style?.sub ?? DEFAULT_SUB;

  return {
    id: 'grid',
    label: 'Grid',
    draw: (_data, view, dims) => {
      const { accentEvery, subdivisions } = opts;
      const spacing = resolveAxes(opts.spacing, opts.unitSystem);
      const b = opts.bounds
        ? opts.bounds(view, dims)
        : onLattice(viewportWorldRect(view, dims), spacing, accentEvery && accentEvery > 0 ? accentEvery : 1);
      // Written so a non-finite extent, which a zero view scale gives, fails it too.
      if (!(b.width > 0 && b.height > 0 && Number.isFinite(b.width) && Number.isFinite(b.height))) return [];

      const x0 = b.x;
      const y0 = b.y;
      const x1 = b.x + b.width;
      const y1 = b.y + b.height;
      // Every line is axis-aligned, so its width runs along one screen axis
      // and one pixel of it is exactly that axis's extent.
      const px = pxExtent(1, view.scale);

      const children: DrawCommand[] = [];

      const pushSegment = (sx: number, sy: number, ex: number, ey: number, s: CommandStroke): void => {
        const path: PolygonPath = {
          kind: 'polygon',
          commands: new Uint8Array([PATH_M, PATH_L]),
          coords: new Float32Array([sx, sy, ex, ey]),
          fillRule: 'nonzero',
        };
        const across = sx === ex ? px.x : px.y;
        children.push({
          kind: 'path',
          path,
          stroke: { ...s, width: resolveStrokeWidth(s.width ?? 1, 1) * across },
        });
      };

      // One family of parallel lines `step` apart, leaving out every
      // `skipEvery`th (the ones a coarser family draws), and none at all once
      // they would sit closer than MIN_SCREEN_SPACING on screen.
      const family = (axis: 'x' | 'y', step: number, skipEvery: number, s: CommandStroke): void => {
        if (!(step * Math.abs(view.scale[axis]) >= MIN_SCREEN_SPACING)) return;
        const [from, to] = axis === 'x' ? [x0, x1] : [y0, y1];
        for (let k = 0; from + k * step <= to + 1e-9; k++) {
          if (skipEvery > 0 && k % skipEvery === 0) continue;
          const at = from + k * step;
          if (axis === 'x') pushSegment(at, y0, at, y1, s);
          else pushSegment(x0, at, x1, at, s);
        }
      };

      const accentOn = accentEvery !== undefined && accentEvery > 0;
      for (const axis of ['x', 'y'] as const) {
        // Sub-lines first so cell lines paint on top, accents last of all.
        if (subdivisions && subdivisions > 1) family(axis, spacing[axis] / subdivisions, subdivisions, sub);
      }
      for (const axis of ['x', 'y'] as const) family(axis, spacing[axis], accentOn ? accentEvery : 0, line);
      if (accentOn) {
        for (const axis of ['x', 'y'] as const) family(axis, spacing[axis] * accentEvery, 0, accent);
      }

      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}

/**
 * Grow `r` outward to whole periods of the lattice, so the first line drawn
 * sits on a world multiple of the pitch, and of the accent pitch for accents.
 */
function onLattice(
  r: { x: number; y: number; width: number; height: number },
  spacing: { x: number; y: number },
  accentEvery: number,
): { x: number; y: number; width: number; height: number } {
  const px = spacing.x * accentEvery;
  const py = spacing.y * accentEvery;
  const x = Math.floor(r.x / px) * px;
  const y = Math.floor(r.y / py) * py;
  return {
    x,
    y,
    width: Math.ceil((r.x + r.width) / px) * px - x,
    height: Math.ceil((r.y + r.height) / py) * py - y,
  };
}
