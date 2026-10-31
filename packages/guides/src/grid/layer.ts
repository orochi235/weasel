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
  viewportWorldRect,
  type Dims,
  type View,
} from '@weasel-js/core';
import { applyToPoint, invert, mat3, PATH_L, PATH_M, PATH_Z, type PolygonPath } from '@weasel-js/geom';
import { mapLines, type GridLines, type GridSpacing } from './axes';
import { hasArea, intersect, lattice, outlineBox, type LatticeStyles, type Rect } from './lattice';
import type { GridRegion } from './regions';
import { containerLines, gridLines, type GridScopes } from './reading';

/** Options for `createGridLayer`. */
export interface GridLayerOpts {
  /**
   * The grid's lines: a pitch for both axes, or a rule per axis (`{ x, y }`,
   * see `GridAxis`), an axis left out drawing none. Lengths are a bare
   * number in world (base) units or a tagged `{ value, unit }`, which needs
   * `unitSystem`.
   */
  spacing: GridSpacing;
  /** Optional unit system for resolving tagged `spacing` values. */
  unitSystem?: PlaneUnits;
  /** Read `spacing` in these scopes, in place of `unitSystem`: the root's
   *  system outside every region, and each region's own scope inside it. */
  scopes?: GridScopes;
  /** The containers drawing a lattice of their own, read every paint, each
   *  cut out of the lattice around it and drawn in its own `frame`:
   *  `sceneGridRegions` builds them from a scene. */
  regions?: () => readonly GridRegion[];
  /**
   * The area to cover, in world units, read every paint with that paint's
   * view and canvas size. Lines start at its own `x`/`y`. Omitted, the grid
   * covers whatever the canvas shows, with its lines measured from world
   * zero so they stay put as the view pans.
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
      const b = opts.bounds ? opts.bounds(view, dims) : padded(viewportWorldRect(view, dims), view);
      if (!hasArea(b)) return [];
      // The root's lines run from the bounds' corner, else from world zero, as snapping reads them.
      const anchor = opts.bounds ? { x: b.x, y: b.y } : { x: 0, y: 0 };
      const root = lattice(b, placed(gridLines(opts.spacing, opts.unitSystem, opts.scopes), anchor), opts, view, styles);
      const regions = opts.regions?.() ?? [];
      if (regions.length === 0) return root;

      const children: DrawCommand[] = [{ kind: 'group', clip: withHoles(rectOutline(b), regions), children: root }];
      const visit = (r: GridRegion): void => {
        const own = containerLines(r.spacing, opts.spacing, opts.unitSystem, opts.scopes, r.chain);
        const lines = own
          ? regionLattice(r, b, (box, frame) => lattice(box, placed(own, frame ? { x: 0, y: 0 } : anchor), opts, view, styles, frame))
          : [];
        if (lines.length) children.push({ kind: 'group', clip: withHoles(r.outline, r.regions ?? []), children: lines });
        for (const inner of r.regions ?? []) visit(inner);
      };
      for (const r of regions) visit(r);
      // World-space commands; drawLayers wraps in viewToMat3 automatically.
      return children;
    },
  };
}

/** `r` grown by a screen pixel each way, so a line just off the canvas
 *  still draws the half of it that is on. */
function padded(r: Rect, view: View): Rect {
  const px = 1 / Math.abs(view.scale.x);
  const py = 1 / Math.abs(view.scale.y);
  return { x: r.x - px, y: r.y - py, width: r.width + 2 * px, height: r.height + 2 * py };
}

/** `lines` moved to run from `anchor`. */
function placed(lines: GridLines, anchor: Point): GridLines {
  return { x: lines.x && mapLines(lines.x, 1, anchor.x), y: lines.y && mapLines(lines.y, 1, anchor.y) };
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
