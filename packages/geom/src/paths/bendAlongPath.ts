/**
 * Bend a shape along a spine: the shape's x becomes distance along the spine
 * and its y distance off it, along the spine's normal. A straight edge of the
 * shape comes out curved wherever the spine bends, so each segment is
 * sampled through the warp and refit to cubics within a tolerance; anchors
 * stay where they were, so a corner of the shape stays a corner.
 */
import type { Path, PolygonPath } from '../path';
import { cubicEvalAt } from '../curve';
import { boundsOfPath } from './bounds';
import { PathBuilder } from './builder';
import { pathToCubicContours, type CubicSegment } from './cubicContours';
import type { Point } from './cubicMath';
import { measurePath, type PathMeasure } from './pathMeasure';
import { schneiderFit } from './schneiderFit';

/** How a shape is laid along its spine. */
export interface BendAlongPathOptions {
  /**
   * `'stretch'`, the default, spreads the shape's width over the spine's
   * whole length. `'natural'` keeps its width: one unit across the shape is
   * one unit along the spine, starting at the spine's start, and a shape
   * longer than the spine runs on straight past its end.
   */
  fit?: 'stretch' | 'natural';
  /** Where across the shape's height the spine runs, 0 at its top and 1 at
   *  its bottom. Default 0.5, the middle. */
  baseline?: number;
  /** Lay the shape on the other side of the spine, mirrored across it. */
  flip?: boolean;
  /** How far the refit curves may stray from the exact bend, in world
   *  units. Default 0.5. */
  tolerance?: number;
}

/**
 * `shape` bent along `spine`. A spine heading left to right keeps the shape
 * upright; one heading the other way turns it over, as a road sign painted
 * along a lane does. Returns `null` when the spine has no length or the shape
 * nothing to bend.
 */
export function bendAlongPath(shape: Path, spine: Path, opts: BendAlongPathOptions = {}): PolygonPath | null {
  const tolerance = Math.max(opts.tolerance ?? 0.5, 1e-3);
  const measure = measurePath(spine, { flattenTolerance: tolerance / 4 });
  if (measure === null || measure.length === 0) return null;
  const contours = pathToCubicContours(shape);
  if (contours.length === 0) return null;

  const box = boundsOfPath(shape);
  const stretch = (opts.fit ?? 'stretch') === 'stretch';
  const along = stretch && box.width > 0 ? measure.length / box.width : 1;
  const baseY = box.y + box.height * (opts.baseline ?? 0.5);
  const side = opts.flip ? -1 : 1;
  const warp = (x: number, y: number): Point =>
    stationOff(measure, (x - box.x) * along, (y - baseY) * side);

  // A sample every few tolerances along the bent outline keeps the warp's own
  // curvature inside what the fit can see.
  const step = Math.max(tolerance * 4, 0.5);
  const b = new PathBuilder().setFillRule(shape.kind === 'polygon' ? shape.fillRule : 'nonzero');
  for (const { segs, closed } of contours) {
    const start = warp(segs[0]!.c[0], segs[0]!.c[1]);
    b.moveTo(start.x, start.y);
    for (const seg of segs) appendBent(b, seg, warp, step, along, tolerance);
    if (closed) b.close();
  }
  return b.build();
}

/** The point `s` along the spine and `v` off it along its normal. Past
 *  either end of an open spine it carries on straight; round a closed one it
 *  wraps. */
function stationOff(measure: PathMeasure, s: number, v: number): Point {
  const L = measure.length;
  let at = s;
  if (measure.closed) at = ((s % L) + L) % L;
  const clamped = Math.min(Math.max(at, 0), L);
  const { point, tangent } = measure.at(clamped, true);
  const run = at - clamped;
  return {
    x: point.x + tangent.x * run - tangent.y * v,
    y: point.y + tangent.y * run + tangent.x * v,
  };
}

function appendBent(
  b: PathBuilder,
  seg: CubicSegment,
  warp: (x: number, y: number) => Point,
  step: number,
  along: number,
  tolerance: number,
): void {
  const c = seg.c;
  const reach = (Math.hypot(c[2] - c[0], c[3] - c[1]) + Math.hypot(c[4] - c[2], c[5] - c[3])
    + Math.hypot(c[6] - c[4], c[7] - c[5])) * Math.max(along, 1);
  const n = Math.min(Math.max(Math.ceil(reach / step), 4), 512);
  const samples: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = cubicEvalAt(...c, i / n);
    samples.push(warp(x, y));
  }
  const fit = schneiderFit(samples, tolerance);
  const { commands, coords } = fit;
  // The fit opens with an M at the first sample, which the pen already holds.
  for (let i = 1, ci = 2; i < commands.length; i++, ci += 6) {
    b.curveTo(coords[ci]!, coords[ci + 1]!, coords[ci + 2]!, coords[ci + 3]!, coords[ci + 4]!, coords[ci + 5]!);
  }
}
