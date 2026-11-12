import { remapPerAnchor, resolveCornersWithSources, type Path, type RectPath } from '@weasel-js/geom';
import type { ScreenLength, Stroke } from '@weasel-js/paint';
import { alignedStrokeRect, alignedStrokeRectHolds, DEFAULT_MITER_LIMIT, resolveScreenLength } from '@weasel-js/paint';
import { type Mesh, extractPolylines, type Polyline } from '@weasel-js/geom/tessellate';
import { dashPolylines } from './dash';
import { strokeFlattening } from './flattening';
import { populateWidths, type WidthScale } from './vertexWidths';
import { type InsetLength, trimInSpace } from './insets';
import { windowRibbon } from './ribbonWindow';
import { windowTrim } from '../trim/windowPolylines';
import { expandPolyline, type RibbonOut, type RibbonStyle } from './expandPolyline';
import {
  type StrokeMetric, coordsOutOfMetric, polylineOutOfMetric, rectIntoMetric, worldWidthInMetric,
  worldWidthInMetricAlongWorld,
} from './metric';

/** Options for stroke tessellation. */
export interface StrokeOptions {
  flattenTolerance?: number;
  /**
   * Shorten each open subpath by this much at its start / end: a length in
   * the ribbon's space, or one measured in a space of its own. Stroke markers
   * use this so a filled head is not speared by its own line; the caller
   * resolves the distance, because this layer knows nothing about the marker
   * registry.
   */
  startInset?: InsetLength;
  endInset?: InsetLength;
  /**
   * Build the ribbon in this metric's space and map it back out, so the
   * transform it was derived from draws it at an exact screen width — see
   * `./metric`. Width and dash are then lengths in that space; `vertexWidths`
   * stay world widths. The path is flattened in world first, so the ribbon
   * follows the same vertices its fill does.
   */
  metric?: StrokeMetric;
}

const EMPTY_MESH: Mesh = {
  vertices: new Float32Array(0),
  indices: new Uint32Array(0),
  anchorA: new Uint32Array(0),
  anchorB: new Uint32Array(0),
  anchorT: new Float32Array(0),
};


/** Resolve a stroke width to world units. A number is already world units;
 *  `{ px }` is screen pixels divided by the accumulated scale, so it holds its
 *  on-screen thickness as the view zooms. */
export function resolveStrokeWidth(width: ScreenLength, scale: number): number {
  return resolveScreenLength(width, scale);
}

/**
 * Build a triangle-mesh ribbon from a stroked Path.
 *
 * Supports:
 *   - cap: 'butt' | 'round' | 'square'
 *   - join: 'miter' | 'round' | 'bevel'
 *   - center alignment directly; RectPath inner/outer alignment via a
 *     pre-shifted rect; any other inner/outer alignment (`ribbonAligns` says
 *     which) as a centered ribbon the caller cuts to its side
 *   - dash splitting
 */
export function tessellateStroke(
  path: Path,
  stroke: Stroke,
  opts: StrokeOptions = {},
): Mesh {
  const style = ribbonStyle(stroke);
  if (!inkWidth(style.width)) return EMPTY_MESH;
  const metric = opts.metric;
  const { polylines, rectInMetric } = strokePolylines(path, stroke, style.width, opts.flattenTolerance, metric);
  const out: RibbonOut = { verts: [], idx: [], anchorA: [], anchorB: [], anchorT: [] };

  // Trim before dashing, so the dash pattern fits the visible line rather than
  // running off under a marker head.
  const ribbonSpace = metric ?? null;
  const from = rectInMetric ? ribbonSpace : null;
  let runs: Polyline[];
  let phases: number[] | undefined;
  let dashLength: number | undefined;
  if (stroke.trim !== undefined) {
    if (from) for (const pl of polylines) polylineOutOfMetric(pl, from);
    // Resolved on the authored path, whose segments a rect shifted by alignment shares.
    ({ runs, phases, dashLength } = windowRibbon(
      polylines, windowTrim(polylines, path, stroke.trim), ribbonSpace,
      opts.startInset, opts.endInset, stroke.dash !== undefined,
    ));
  } else {
    runs = polylines.flatMap((pl) => trimInSpace(pl, from, ribbonSpace, opts.startInset, opts.endInset) ?? []);
  }
  for (const sub of dashPolylines(runs, stroke.dash, phases, dashLength, stroke.dashOffset)) {
    expandPolyline(sub, style, out);
  }

  const mesh = ribbonMesh(out, path);
  if (metric) coordsOutOfMetric(mesh.vertices, metric);
  return mesh;
}

/** How `stroke` draws its ribbon, its `{ px }` width read at scale 1. */
export function ribbonStyle(stroke: Stroke): RibbonStyle {
  // The renderer resolves `{ px }` against the accumulated transform before it
  // gets here; a stroke that reaches the tessellator unresolved is read at
  // scale 1, matching what the ribbon cache keys it under.
  return {
    width: resolveStrokeWidth(stroke.width ?? 1, 1),
    join: stroke.join ?? 'miter',
    cap: stroke.cap ?? 'butt',
    miterLimit: stroke.miterLimit ?? DEFAULT_MITER_LIMIT,
    varyingThreshold: stroke.varyingWidthJoinThreshold ?? DEFAULT_VARYING_WIDTH_JOIN_THRESHOLD,
  };
}

/**
 * The polylines `stroke` is tessellated along, widths populated: `path`
 * corner-resolved and flattened in world, or, for a rect under `metric`, in
 * that metric's space (`rectInMetric`).
 */
export function strokePolylines(
  path: Path, stroke: Stroke, width: number, flattenTolerance: number | undefined, metric?: StrokeMetric,
): { polylines: Polyline[]; rectInMetric: RectPath | null } {
  const align = stroke.align ?? 'center';
  // RectPath fast path for inner/outer alignment: shift the rect by half-width
  // so the ribbon's center alignment lands the stroke on the desired side of
  // the original geometric edge. Arbitrary paths handle alignment via stencil
  // clipping at the renderer level (not here).
  const rectInMetric = metric && path.kind === 'rect' ? rectIntoMetric(path, metric) : null;
  let workingPath: Path = rectInMetric ?? path;
  if (workingPath.kind === 'rect' && align !== 'center' && alignedStrokeRectHolds(workingPath, align, width)) {
    workingPath = { kind: 'rect', ...alignedStrokeRect(workingPath, align, width) };
  }

  // Per-point widths come first, in the space the points are in, so a trim
  // interpolates them rather than re-reading an anchor's.
  // Expanded here rather than inside `extractPolylines`, so each width moves
  // to the anchors its corner's cut leaves.
  const resolved = workingPath.kind === 'polygon' ? resolveCornersWithSources(workingPath) : null;
  if (resolved) workingPath = resolved.path;
  const given = stroke.vertexWidths && stroke.vertexWidths.length > 0 ? stroke.vertexWidths : null;
  const vertexWidths = given && resolved?.anchorSources ? remapPerAnchor(given, resolved.anchorSources, 1) : given;
  const polylines = extractPolylines(workingPath, strokeFlattening(flattenTolerance, width, vertexWidths ?? undefined));
  const scale: WidthScale | undefined = !metric ? undefined
    : rectInMetric ? (tx, ty) => worldWidthInMetric(metric, tx, ty)
      : (ux, uy) => worldWidthInMetricAlongWorld(metric, ux, uy);
  for (const pl of polylines) populateWidths(pl, vertexWidths, stroke.nib, width, scale);
  return { polylines, rectInMetric };
}

/**
 * Whether the ribbon {@link tessellateStroke} builds for `stroke` on `path` is
 * already on its `align` side: centered strokes, and a rect's inner or outer
 * one, built from the rect shifted by half the width (in `metric`'s space,
 * where one is given) while {@link alignedStrokeRectHolds}. Anything else gets
 * a centered ribbon, which the caller cuts to its side of the path.
 */
export function ribbonAligns(path: Path, stroke: Stroke, metric?: StrokeMetric): boolean {
  const align = stroke.align ?? 'center';
  if (align === 'center') return true;
  if (path.kind !== 'rect') return false;
  const rect = metric ? rectIntoMetric(path, metric) : path;
  return rect !== null && alignedStrokeRectHolds(rect, align, ribbonStyle(stroke).width);
}

/** What `out` holds, as a mesh placed where `path`'s own vertices are. */
export function ribbonMesh(out: RibbonOut, path: Path): Mesh {
  return {
    vertices: new Float32Array(out.verts),
    indices: new Uint32Array(out.idx),
    anchorA: new Uint32Array(out.anchorA),
    anchorB: new Uint32Array(out.anchorB),
    anchorT: new Float32Array(out.anchorT),
    ...(path.kind === 'polygon' && path.origin ? { origin: path.origin } : {}),
  };
}

/** Default `Stroke.varyingWidthJoinThreshold`. */
const DEFAULT_VARYING_WIDTH_JOIN_THRESHOLD = 1.5;

/** Whether a ribbon `width` wide has vertices to give: positive and finite.
 *  An infinite one would put NaN in every vertex its normals scale. */
export function inkWidth(width: number): boolean {
  return width > 0 && Number.isFinite(width);
}
