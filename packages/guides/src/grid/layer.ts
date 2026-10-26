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
  type PlaneUnits,
  type PlaneValue,
  viewportWorldRect,
  type Dims,
  type View,
} from '@weasel-js/core';
import { applyToPoint, invert, mat3, PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { hasArea, lattice, onLattice, type LatticeStyles, type Rect } from './lattice';
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
   *  each cut out of the lattice around it and drawn in its own `frame`.
   *  Read only with `scopes`; `sceneGridRegions` builds them from a scene. */
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

type Point = { x: number; y: number };

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

/** Build a `RenderLayer` that draws a world-space grid with optional accent lines and subdivisions. */
export function createGridLayer(opts: GridLayerOpts): RenderLayer<unknown> {
  const styles: LatticeStyles = {
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

      // A region with no frame runs through the root's anchor, as snapping reads it.
      const anchor = opts.bounds ? { x: b.x, y: b.y } : { x: 0, y: 0 };
      const area = opts.bounds ? b : shown;
      const children: DrawCommand[] = [{ kind: 'group', clip: withHoles(rectOutline(b), regions), children: root }];
      const visit = (r: GridRegion): void => {
        const pitch = gridPitch(opts.spacing, opts.unitSystem, opts.scopes, r.chain);
        const lines = regionLattice(r, area, (box, frame) =>
          lattice(onLattice(box, pitch, every, frame ? { x: 0, y: 0 } : anchor), pitch, opts, view, styles, frame));
        if (lines.length) children.push({ kind: 'group', clip: withHoles(r.outline, r.regions ?? []), children: lines });
        for (const inner of r.regions ?? []) visit(inner);
      };
      for (const r of regions) visit(r);
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
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

/**
 * What `draw` gives for the part of `area` inside `r`, as `r` draws it: in
 * its `frame`, through it, or in world where it has none. A frame with no
 * inverse draws nothing.
 */
function regionLattice(
  r: GridRegion, area: Rect, draw: (box: Rect, frame?: GridRegion['frame']) => DrawCommand[],
): DrawCommand[] {
  if (!r.frame) {
    const box = intersect(outlineBox(r.outline), area);
    return hasArea(box) ? draw(box) : [];
  }
  const back = invert(r.frame);
  if (!back) return [];
  const local = (ps: readonly Point[]) => outlineBox(ps.map((p) => {
    const [x, y] = applyToPoint(back, p.x, p.y);
    return { x, y };
  }));
  const box = intersect(local(r.outline), local(rectOutline(area)));
  if (!hasArea(box)) return [];
  const lines = draw(box, r.frame);
  return lines.length ? [{ kind: 'group', transform: mat3.fromAffine(r.frame), children: lines }] : [];
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
