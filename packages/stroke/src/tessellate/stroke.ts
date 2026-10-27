import { remapPerAnchor, resolveCornersWithSources, type Path } from '@weasel-js/geom';
import type { ScreenLength, Stroke } from '@weasel-js/paint';
import { alignedStrokeRect, resolveScreenLength } from '@weasel-js/paint';
import { type Mesh, extractPolylines, type Polyline } from '@weasel-js/geom/tessellate';
import { dashPolylines } from './dash';
import { strokeFlattening } from './flattening';
import { populateWidths, type WidthScale } from './vertexWidths';
import { type InsetLength, trimInSpace } from './insets';
import { type Cap, emitCap, emitJoin, type Join, makeSeg, type Seg } from './ribbon';
import {
  type StrokeMetric, coordsOutOfMetric, rectIntoMetric, worldWidthInMetric, worldWidthInMetricAlongWorld,
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
 *     pre-shifted rect; PolygonPath inner/outer alignment via stencil at the
 *     renderer level
 *   - dash splitting
 */
export function tessellateStroke(
  path: Path,
  stroke: Stroke,
  opts: StrokeOptions = {},
): Mesh {
  // The renderer resolves `{ px }` against the accumulated transform before it
  // gets here; a stroke that reaches the tessellator unresolved is read at
  // scale 1, matching what the ribbon cache keys it under.
  const width = resolveStrokeWidth(stroke.width ?? 1, 1);
  if (width <= 0) return EMPTY_MESH;
  const join: Join = stroke.join ?? 'miter';
  const cap: Cap = stroke.cap ?? 'butt';
  const align = stroke.align ?? 'center';
  const miterLimit = stroke.miterLimit ?? DEFAULT_MITER_LIMIT;
  const varyingThreshold = stroke.varyingWidthJoinThreshold ?? DEFAULT_VARYING_WIDTH_JOIN_THRESHOLD;

  // RectPath fast path for inner/outer alignment: shift the rect by half-width
  // so the ribbon's center alignment lands the stroke on the desired side of
  // the original geometric edge. Arbitrary paths handle alignment via stencil
  // clipping at the renderer level (not here).
  const metric = opts.metric;
  const rectInMetric = metric && path.kind === 'rect' ? rectIntoMetric(path, metric) : null;
  let workingPath: Path = rectInMetric ?? path;
  if (workingPath.kind === 'rect' && align !== 'center') {
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
  const polylines = extractPolylines(workingPath, strokeFlattening(opts.flattenTolerance, width, vertexWidths ?? undefined));
  const scale: WidthScale | undefined = !metric ? undefined
    : rectInMetric ? (tx, ty) => worldWidthInMetric(metric, tx, ty)
      : (ux, uy) => worldWidthInMetricAlongWorld(metric, ux, uy);
  const verts: number[] = [];
  const idx: number[] = [];
  const anchorA: number[] = [];
  const anchorB: number[] = [];
  const anchorT: number[] = [];

  // Trim before dashing, so the dash pattern fits the visible line rather than
  // running off under a marker head.
  const ribbonSpace = metric ?? null;
  const trimmed: Polyline[] = [];
  for (const pl of polylines) {
    populateWidths(pl, vertexWidths, stroke.nib, width, scale);
    const t = trimInSpace(pl, rectInMetric ? ribbonSpace : null, ribbonSpace, opts.startInset, opts.endInset);
    if (t !== null) trimmed.push(t);
  }
  for (const sub of dashPolylines(trimmed, stroke.dash)) {
    expandPolyline(sub, width, join, cap, miterLimit, varyingThreshold, verts, idx, anchorA, anchorB, anchorT);
  }

  const vertices = new Float32Array(verts);
  if (metric) coordsOutOfMetric(vertices, metric);
  return {
    vertices,
    indices: new Uint32Array(idx),
    anchorA: new Uint32Array(anchorA),
    anchorB: new Uint32Array(anchorB),
    anchorT: new Float32Array(anchorT),
    ...(path.kind === 'polygon' && path.origin ? { origin: path.origin } : {}),
  };
}

function expandPolyline(
  pl: Polyline,
  width: number,
  join: Join,
  cap: Cap,
  miterLimit: number,
  varyingThreshold: number,
  verts: number[],
  idx: number[],
  anchorA: number[],
  anchorB: number[],
  anchorT: number[],
): void {
  const half = width / 2;
  const pts = pl.points;
  const ptCount = pts.length / 2;
  const segCount = ptCount - 1;
  if (segCount < 1) return;

  // Anchor params per polyline point (set by extractPolylines; splitForDash
  // re-derives them on dash boundaries). Default to A=B=0,t=0 if missing.
  const plA = pl.anchorA ?? new Uint32Array(ptCount);
  const plB = pl.anchorB ?? new Uint32Array(ptCount);
  const plT = pl.anchorT ?? new Float32Array(ptCount);
  // Per-point distance to each edge: derived from pl.widths and pl.offsets
  // if present, else the uniform half. Indexing matches `pts`.
  const W = pl.widths, O = pl.offsets;
  const pos = (i: number) => (W ? W[i] / 2 : half) + (O ? O[i] : 0);
  const neg = (i: number) => (W ? W[i] / 2 : half) - (O ? O[i] : 0);

  const segs: Seg[] = [];
  const segSrcIdx: number[] = [];  // For each seg, the polyline-point index of its start.
  for (let s = 0; s < segCount; s++) {
    const seg = makeSeg(pts[s * 2], pts[s * 2 + 1], pts[(s + 1) * 2], pts[(s + 1) * 2 + 1], pos(s), neg(s), pos(s + 1), neg(s + 1));
    if (seg) {
      segs.push(seg);
      segSrcIdx.push(s);
    }
  }
  let closerSrcIdx = -1;
  if (pl.closed && segs.length >= 1) {
    const last = segs[segs.length - 1];
    const first = segs[0];
    // Closer: from last point back to point 0, with the edges resolved at
    // those source indices.
    const closer = makeSeg(last.bx, last.by, first.ax, first.ay, pos(ptCount - 1), neg(ptCount - 1), pos(0), neg(0));
    if (closer) {
      segs.push(closer);
      closerSrcIdx = ptCount - 1;  // start is the last polyline point.
      segSrcIdx.push(closerSrcIdx);
    }
  }
  if (segs.length === 0) return;

  // Emit ribbon quads. For each emitted vertex, record the (A, B, t) of the
  // source polyline point that the geometric vertex sits at. Per-end
  // half-widths produce trapezoidal segments when the stroke tapers.
  const segBaseIdx: number[] = [];
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const startSrc = segSrcIdx[s];
    // End-source index for the seg. For closer (closed-path wraparound), end is point 0.
    const endSrc = (s === segs.length - 1 && pl.closed && closerSrcIdx >= 0) ? 0 : startSrc + 1;
    const base = verts.length / 2;
    segBaseIdx.push(base);
    const { nxUnit: nx, nyUnit: ny } = seg;
    // L0, R0 — at seg.ax/ay, the +n and −n edges.
    verts.push(seg.ax + nx * seg.posA, seg.ay + ny * seg.posA);
    anchorA.push(plA[startSrc]); anchorB.push(plB[startSrc]); anchorT.push(plT[startSrc]);
    verts.push(seg.ax - nx * seg.negA, seg.ay - ny * seg.negA);
    anchorA.push(plA[startSrc]); anchorB.push(plB[startSrc]); anchorT.push(plT[startSrc]);
    // L1, R1 — at seg.bx/by.
    verts.push(seg.bx + nx * seg.posB, seg.by + ny * seg.posB);
    anchorA.push(plA[endSrc]); anchorB.push(plB[endSrc]); anchorT.push(plT[endSrc]);
    verts.push(seg.bx - nx * seg.negB, seg.by - ny * seg.negB);
    anchorA.push(plA[endSrc]); anchorB.push(plB[endSrc]); anchorT.push(plT[endSrc]);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Joins between consecutive segments.
  const joinCount = pl.closed ? segs.length : segs.length - 1;
  for (let j = 0; j < joinCount; j++) {
    emitJoin(segs, segBaseIdx, j, join, miterLimit, varyingThreshold, verts, idx, anchorA, anchorB, anchorT, segSrcIdx, plA, plB, plT);
  }

  // Caps, from the local edges at each end.
  if (!pl.closed && cap !== 'butt') {
    const first = segs[0];
    const firstBase = segBaseIdx[0];
    emitCap(first, firstBase + 0, firstBase + 1, false, first.posA, first.negA, cap, verts, idx, anchorA, anchorB, anchorT, plA[0], plB[0], plT[0]);

    const last = segs[segs.length - 1];
    const lastBase = segBaseIdx[segs.length - 1];
    const lastSrc = segSrcIdx[segs.length - 1] + 1;
    emitCap(last, lastBase + 2, lastBase + 3, true, last.posB, last.negB, cap, verts, idx, anchorA, anchorB, anchorT, plA[lastSrc], plB[lastSrc], plT[lastSrc]);
  }
}

/**
 * Miter limit for a stroke that does not set one. SVG's default, not
 * Canvas2D's 10, because the serializer omits the attribute when the field is
 * unset — so a kit stroke exported to SVG is read back by every other renderer
 * as 4, and a kit that used 10 would disagree with its own export. 10 also
 * lets an acute corner throw a spike four times the half-width, which is what
 * a glyph outline's sharpest vertices do.
 */
const DEFAULT_MITER_LIMIT = 4;
/** Default `Stroke.varyingWidthJoinThreshold`. */
const DEFAULT_VARYING_WIDTH_JOIN_THRESHOLD = 1.5;
