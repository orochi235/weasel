/**
 * Shape interpolation between two paths: the steps of a blend, or the frames
 * of a morph.
 *
 * The two shapes are matched once — contour to contour, then segment to
 * segment — and every step is a straight lerp of the matched control points.
 * Where one contour has fewer segments, its longest ones are split in half
 * until the counts agree, which adds anchors without moving the outline.
 */
import type { Path, PathFillRule, PolygonPath } from '../path';
import {
  cubicContoursToPath, pathToCubicContours, reverseContour, splitSegment,
  type CubicContour, type CubicSegment,
} from './cubicContours';

/** How a blend matches the second shape's anchors to the first's. */
export interface BlendPathsOptions {
  /**
   * Choose, for each pair of contours, the start point (and, when `reverse`
   * is unset, the direction) of the second that keeps matched anchors
   * closest, with both contours centered on their own middles first so that
   * where the shapes sit does not decide it. Default `true`.
   */
  autoAlign?: boolean;
  /**
   * Turn the second shape's start point this many anchors further round each
   * closed contour, after any `autoAlign` choice. Negative turns it back.
   * Default 0.
   */
  startOffset?: number;
  /** Run the second shape's contours backwards. Unset, `autoAlign` decides;
   *  without it, they run as drawn. */
  reverse?: boolean;
}

/** Two shapes matched for interpolation. */
export interface PathBlend {
  /** The shape `t` of the way from the first to the second: exactly the
   *  first at 0 and the second at 1, up to the anchors matching added. */
  at(t: number): PolygonPath;
  /** Segments per matched pair of contours. */
  readonly segmentCounts: readonly number[];
}

/** The shape `t` of the way from `a` to `b`. Matching once with
 *  {@link prepareBlend} is cheaper when several steps are wanted. */
export function blendPaths(a: Path, b: Path, t: number, opts: BlendPathsOptions = {}): PolygonPath {
  return prepareBlend(a, b, opts).at(t);
}

/** Match `a` to `b` for interpolation. */
export function prepareBlend(a: Path, b: Path, opts: BlendPathsOptions = {}): PathBlend {
  const ca = pathToCubicContours(a);
  const cb = pathToCubicContours(b);
  const n = Math.max(ca.length, cb.length);
  const pairs: [CubicContour, CubicContour][] = [];
  for (let i = 0; i < n; i++) {
    const x = ca[i] ?? collapsed(cb[i]!);
    const y = cb[i] ?? collapsed(ca[i]!);
    pairs.push(matchContours(x, y, opts));
  }
  const ruleA = fillRuleOf(a);
  const ruleB = fillRuleOf(b);
  return {
    segmentCounts: pairs.map(([x]) => x.segs.length),
    at(t) {
      const out = pairs.map(([x, y]) => lerpContour(x, y, t));
      return cubicContoursToPath(out, t < 0.5 ? ruleA : ruleB);
    },
  };
}

function fillRuleOf(path: Path): PathFillRule {
  return path.kind === 'polygon' ? path.fillRule : 'nonzero';
}

/** A contour with nothing to blend against grows from, or shrinks to, a
 *  point at its own middle. */
function collapsed(contour: CubicContour): CubicContour {
  const [cx, cy] = centroid(contour);
  return {
    closed: contour.closed,
    segs: contour.segs.map(({ line }) => ({ c: [cx, cy, cx, cy, cx, cy, cx, cy], line })),
  };
}

/** The mean of a contour's anchors. */
function centroid(contour: CubicContour): [number, number] {
  let x = 0;
  let y = 0;
  for (const { c } of contour.segs) {
    x += c[0];
    y += c[1];
  }
  const n = Math.max(contour.segs.length, 1);
  return [x / n, y / n];
}

/** `a` and `b` with equal segment counts and `b` started where it best
 *  corresponds to `a`. Both closed stay closed; otherwise both open. */
function matchContours(a: CubicContour, b: CubicContour, opts: BlendPathsOptions): [CubicContour, CubicContour] {
  const closed = a.closed && b.closed;
  const x: CubicContour = { closed, segs: a.segs };
  const y: CubicContour = { closed, segs: b.segs };
  const auto = opts.autoAlign ?? true;
  const offset = Math.round(opts.startOffset ?? 0);
  const directions = opts.reverse !== undefined ? [opts.reverse] : auto ? [false, true] : [false];

  let best: { score: number; a: CubicContour; b: CubicContour; reversed: boolean; turn: number } | null = null;
  for (const reversed of directions) {
    const run = reversed ? reverseContour(y) : y;
    const turns = closed && auto ? run.segs.length : 1;
    for (let k = 0; k < turns; k++) {
      const [ma, mb] = equalize(x, rotate(run, k));
      const score = auto ? correspondence(ma, mb) : 0;
      if (best === null || score < best.score - 1e-9) best = { score, a: ma, b: mb, reversed, turn: k };
    }
  }
  const chosen = best!;
  if (!closed || offset === 0) return [chosen.a, chosen.b];
  const run = chosen.reversed ? reverseContour(y) : y;
  return equalize(x, rotate(run, chosen.turn + offset));
}

/** `contour` started `k` segments later; a no-op on an open one. */
function rotate(contour: CubicContour, k: number): CubicContour {
  const n = contour.segs.length;
  if (!contour.closed || n === 0) return contour;
  const s = ((k % n) + n) % n;
  if (s === 0) return contour;
  return { closed: true, segs: [...contour.segs.slice(s), ...contour.segs.slice(0, s)] };
}

/** Both contours split until they have as many segments as each other. */
function equalize(a: CubicContour, b: CubicContour): [CubicContour, CubicContour] {
  const n = Math.max(a.segs.length, b.segs.length);
  return [
    { closed: a.closed, segs: subdivideTo(a.segs, n) },
    { closed: b.closed, segs: subdivideTo(b.segs, n) },
  ];
}

/** `segs` with its longest segments halved until there are `n` of them. */
function subdivideTo(segs: readonly CubicSegment[], n: number): CubicSegment[] {
  const out = segs.slice();
  if (out.length === 0) return out;
  while (out.length < n) {
    let longest = 0;
    let longestLen = -1;
    for (let i = 0; i < out.length; i++) {
      const len = hullLength(out[i]!);
      if (len > longestLen) { longest = i; longestLen = len; }
    }
    out.splice(longest, 1, ...splitSegment(out[longest]!, 0.5));
  }
  return out;
}

/** A segment's length estimate: the mean of its chord and control polygon. */
function hullLength({ c }: CubicSegment): number {
  const chord = Math.hypot(c[6] - c[0], c[7] - c[1]);
  const hull = Math.hypot(c[2] - c[0], c[3] - c[1])
    + Math.hypot(c[4] - c[2], c[5] - c[3])
    + Math.hypot(c[6] - c[4], c[7] - c[5]);
  return (chord + hull) / 2;
}

/** How far matched anchors sit apart once each contour is centered: the sum
 *  of squared distances. */
function correspondence(a: CubicContour, b: CubicContour): number {
  const [ax, ay] = centroid(a);
  const [bx, by] = centroid(b);
  let sum = 0;
  const add = (pa: number, pb: number, qa: number, qb: number) => {
    sum += (pa - ax - (qa - bx)) ** 2 + (pb - ay - (qb - by)) ** 2;
  };
  for (let i = 0; i < a.segs.length; i++) {
    const p = a.segs[i]!.c;
    const q = b.segs[i]!.c;
    add(p[0], p[1], q[0], q[1]);
  }
  if (!a.closed && a.segs.length > 0) {
    const p = a.segs.at(-1)!.c;
    const q = b.segs.at(-1)!.c;
    add(p[6], p[7], q[6], q[7]);
  }
  return sum;
}

function lerpContour(a: CubicContour, b: CubicContour, t: number): CubicContour {
  return {
    closed: a.closed,
    segs: a.segs.map((sa, i) => {
      const sb = b.segs[i]!;
      const c = sa.c.map((v, j) => v + (sb.c[j]! - v) * t) as CubicSegment['c'];
      return { c, line: sa.line && sb.line };
    }),
  };
}
