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
  type PlaneUnits,
  type PlaneValue,
  pxExtent,
  viewportWorldRect,
  type Dims,
  type View,
} from '@weasel-js/core';
import { PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import type { GridRegion } from './regions';
import { gridPitch, type GridScopes } from './scopedPitch';

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
  /** Read `spacing` in these scopes, in place of `unitSystem`: the root's
   *  system outside every region, and each region's own scope inside it. */
  scopes?: GridScopes;
  /** The containers drawing their own scope's lattice, read every paint,
   *  each cut out of the lattice around it. Read only with `scopes`;
   *  `sceneGridRegions` builds them from a scene. */
  regions?: () => readonly GridRegion[];
  /**
   * The area to cover, in world units, read every paint with that paint's
   * view and canvas size. Lines start at its own `x`/`y`. Omitted, the grid
   * covers whatever the canvas shows, with its lines on world multiples of
   * `spacing` so they stay put as the view pans.
   */
  bounds?: (view: View, dims: Dims) => Rect;
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

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Styles = { line: CommandStroke; accent: CommandStroke; sub: CommandStroke };

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
  const styles: Styles = {
    line: opts.style?.line ?? DEFAULT_LINE,
    accent: opts.style?.accent ?? DEFAULT_ACCENT,
    sub: opts.style?.sub ?? DEFAULT_SUB,
  };

  return {
    id: 'grid',
    label: 'Grid',
    draw: (_data, view, dims) => {
      const every = opts.accentEvery && opts.accentEvery > 0 ? opts.accentEvery : 1;
      const spacing = gridPitch(opts.spacing, opts.unitSystem, opts.scopes);
      const shown = viewportWorldRect(view, dims);
      const b = opts.bounds ? opts.bounds(view, dims) : onLattice(shown, spacing, every, { x: 0, y: 0 });
      if (!hasArea(b)) return [];
      const root = lattice(b, spacing, opts, view, styles);
      const regions = opts.scopes && opts.regions ? opts.regions() : [];
      if (regions.length === 0) return root;

      // Every lattice runs through the root's anchor, as snapping reads it.
      const anchor = opts.bounds ? { x: b.x, y: b.y } : { x: 0, y: 0 };
      const area = opts.bounds ? b : shown;
      const children: DrawCommand[] = [{ kind: 'group', clip: withHoles(rectOutline(b), regions), children: root }];
      const visit = (r: GridRegion): void => {
        const pitch = gridPitch(opts.spacing, opts.unitSystem, opts.scopes, r.chain);
        const box = intersect(outlineBox(r.outline), area);
        if (hasArea(box)) {
          const lines = lattice(onLattice(box, pitch, every, anchor), pitch, opts, view, styles);
          if (lines.length) children.push({ kind: 'group', clip: withHoles(r.outline, r.regions ?? []), children: lines });
        }
        for (const inner of r.regions ?? []) visit(inner);
      };
      for (const r of regions) visit(r);
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}

// Written so a non-finite extent, which a zero view scale gives, fails it too.
function hasArea(r: Rect): boolean {
  return r.width > 0 && r.height > 0 && Number.isFinite(r.width) && Number.isFinite(r.height);
}

/** One lattice of pitch `spacing` across `b`: its sub-lines, cell lines and accents. */
function lattice(b: Rect, spacing: Point, opts: GridLayerOpts, view: View, styles: Styles): DrawCommand[] {
  const { accentEvery, subdivisions } = opts;
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
    if (subdivisions && subdivisions > 1) family(axis, spacing[axis] / subdivisions, subdivisions, styles.sub);
  }
  for (const axis of ['x', 'y'] as const) family(axis, spacing[axis], accentOn ? accentEvery : 0, styles.line);
  if (accentOn) {
    for (const axis of ['x', 'y'] as const) family(axis, spacing[axis] * accentEvery, 0, styles.accent);
  }
  return children;
}

/**
 * Grow `r` outward to whole periods of the lattice through `anchor`, so the
 * first line drawn sits on a multiple of the pitch from it, and of the accent
 * pitch for accents.
 */
function onLattice(r: Rect, spacing: Point, accentEvery: number, anchor: Point): Rect {
  const px = spacing.x * accentEvery;
  const py = spacing.y * accentEvery;
  const x = anchor.x + Math.floor((r.x - anchor.x) / px) * px;
  const y = anchor.y + Math.floor((r.y - anchor.y) / py) * py;
  return {
    x,
    y,
    width: anchor.x + Math.ceil((r.x + r.width - anchor.x) / px) * px - x,
    height: anchor.y + Math.ceil((r.y + r.height - anchor.y) / py) * py - y,
  };
}

function rectOutline(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

/** `outline` with each of `holes` cut out of it. The renderer clips by
 *  parity, so a hole is one more closed contour. */
function withHoles(outline: readonly Point[], holes: readonly GridRegion[]): PolygonPath {
  const commands: number[] = [];
  const coords: number[] = [];
  for (const contour of [outline, ...holes.map((h) => h.outline)]) {
    contour.forEach((p, i) => {
      commands.push(i === 0 ? PATH_M : PATH_L);
      coords.push(p.x, p.y);
    });
    commands.push(PATH_Z);
  }
  return { kind: 'polygon', commands: new Uint8Array(commands), coords: new Float32Array(coords), fillRule: 'evenodd' };
}

function outlineBox(outline: readonly Point[]): Rect {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, width: Math.min(a.x + a.width, b.x + b.width) - x, height: Math.min(a.y + a.height, b.y + b.height) - y };
}
