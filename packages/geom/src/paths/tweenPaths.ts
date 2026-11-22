/**
 * Shape interpolation between two paths: the steps of a tween, or the frames
 * of a morph.
 *
 * The two shapes are matched once — contour to contour, then segment to
 * segment — and every step is a straight lerp of the matched control points.
 * Where one contour has fewer segments, its longest ones are split in half
 * until the counts agree, which adds anchors without moving the outline.
 */
import type { Path, PolygonPath } from '../path';
import {
  cubicContoursToPath, pathToCubicContours, reverseContour, splitSegment,
  type CubicContour, type CubicSegment,
} from './cubicContours';
import { lerp } from '../scalar';
import { wrapPositive } from '../angle';

/** How a tween matches the second shape's anchors to the first's. */
export interface TweenPathsOptions {
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
export interface PathTween {
  /** The shape `t` of the way from the first to the second: exactly the
   *  first at 0 and the second at 1, up to the anchors matching added. */
  at(t: number): PolygonPath;
  /** Segments per matched pair of contours. */
  readonly segmentCounts: readonly number[];
}

/** The shape `t` of the way from `a` to `b`. Matching once with
 *  {@link prepareTween} is cheaper when several steps are wanted. */
export function tweenPaths(a: Path, b: Path, t: number, opts: TweenPathsOptions = {}): PolygonPath {
  return prepareTween(a, b, opts).at(t);
}

/** Match `a` to `b` for interpolation. */
export function prepareTween(a: Path, b: Path, opts: TweenPathsOptions = {}): PathTween {
  const ca = pathToCubicContours(a);
  const cb = pathToCubicContours(b);
  const n = Math.max(ca.length, cb.length);
  const pairs: [CubicContour, CubicContour][] = [];
  for (let i = 0; i < n; i++) {
    const x = ca[i] ?? collapsed(cb[i]!);
    const y = cb[i] ?? collapsed(ca[i]!);
    pairs.push(matchContours(x, y, opts));
  }
  return {
    segmentCounts: pairs.map(([x]) => x.segs.length),
    at(t) {
      const out = pairs.map(([x, y]) => lerpContour(x, y, t));
      return cubicContoursToPath(out, t < 0.5 ? a : b);
    },
  };
}

/** A contour with nothing to tween against grows from, or shrinks to, a
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
 *  corresponds to `a`, each keeping its own `closed`; `b` turns round only
 *  when both are closed. */
function matchContours(a: CubicContour, b: CubicContour, opts: TweenPathsOptions): [CubicContour, CubicContour] {
  const closed = a.closed && b.closed;
  const auto = opts.autoAlign ?? true;
  const offset = Math.round(opts.startOffset ?? 0);
  const directions = opts.reverse !== undefined ? [opts.reverse] : auto ? [false, true] : [false];

  const n = Math.max(a.segs.length, b.segs.length);
  const ma = { closed: a.closed, segs: subdivideTo(a.segs, n) };
  let best: { score: number; a: CubicContour; b: CubicContour; reversed: boolean; turn: number } | null = null;
  for (const reversed of directions) {
    const run = reversed ? reverseContour(b) : b;
    const turns = closed && auto ? run.segs.length : 1;
    for (let k = 0; k < turns; k++) {
      const turned = rotate(run, k);
      const mb = { closed: turned.closed, segs: subdivideTo(turned.segs, n) };
      const score = auto ? correspondence(ma, mb) : 0;
      if (best === null || score < best.score * (1 - TIE) - 1e-9) best = { score, a: ma, b: mb, reversed, turn: k };
    }
  }
  const chosen = best!;
  if (!closed || offset === 0) return [chosen.a, chosen.b];
  const run = chosen.reversed ? reverseContour(b) : b;
  const turned = rotate(run, chosen.turn + offset);
  return [ma, { closed: turned.closed, segs: subdivideTo(turned.segs, n) }];
}

/** `contour` started `k` segments later; a no-op on an open one. */
function rotate(contour: CubicContour, k: number): CubicContour {
  const n = contour.segs.length;
  if (!contour.closed || n === 0) return contour;
  const s = wrapPositive(k, n);
  if (s === 0) return contour;
  return { closed: true, segs: [...contour.segs.slice(s), ...contour.segs.slice(0, s)] };
}

/** `segs` with its longest segments halved until there are `n` of them; of
 *  two as long, the one earlier in the contour. */
function subdivideTo(segs: readonly CubicSegment[], n: number): CubicSegment[] {
  if (segs.length === 0 || segs.length >= n) return segs.slice();
  const heap = segs.map((seg, i): Piece => ({ seg, len: hullLength(seg), at: i, from: 0, width: 1 }));
  for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(heap, i);
  for (let count = segs.length; count < n; count++) {
    const top = heap[0]!;
    const [first, second] = splitSegment(top.seg, 0.5);
    const width = top.width / 2;
    heap[0] = { seg: first, len: hullLength(first), at: top.at, from: top.from, width };
    siftDown(heap, 0);
    heap.push({ seg: second, len: hullLength(second), at: top.at, from: top.from + width, width });
    siftUp(heap, heap.length - 1);
  }
  return heap.sort((p, q) => p.at - q.at || p.from - q.from).map((p) => p.seg);
}

/** A piece of segment `at` of the contour, from parameter `from` over `width` of it. */
interface Piece { seg: CubicSegment; len: number; at: number; from: number; width: number }

/** Whether `p` is split before `q`: the longer, or of two as long, the earlier. */
function splitsFirst(p: Piece, q: Piece): boolean {
  if (Math.abs(p.len - q.len) > TIE * Math.max(p.len, q.len)) return p.len > q.len;
  return p.at < q.at || (p.at === q.at && p.from < q.from);
}

function siftUp(heap: Piece[], i: number): void {
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!splitsFirst(heap[i]!, heap[parent]!)) return;
    [heap[i], heap[parent]] = [heap[parent]!, heap[i]!];
    i = parent;
  }
}

function siftDown(heap: Piece[], i: number): void {
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let top = i;
    if (l < heap.length && splitsFirst(heap[l]!, heap[top]!)) top = l;
    if (r < heap.length && splitsFirst(heap[r]!, heap[top]!)) top = r;
    if (top === i) return;
    [heap[i], heap[top]] = [heap[top]!, heap[i]!];
    i = top;
  }
}

/** How near, as a fraction, two measures are taken as equal when choosing between them. Paths store float32,
 *  so a rectangle's opposite sides come back a few parts in 10^8 apart, and which of them is longer flips as
 *  the shape is scaled: decided on that, the choice jumps from one step of a drag to the next. */
const TIE = 1e-6;

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
  if (!(a.closed && b.closed) && a.segs.length > 0) {
    const p = a.segs.at(-1)!.c;
    const q = b.segs.at(-1)!.c;
    add(p[6], p[7], q[6], q[7]);
  }
  return sum;
}

function lerpContour(a: CubicContour, b: CubicContour, t: number): CubicContour {
  return {
    closed: t < 0.5 ? a.closed : b.closed,
    segs: a.segs.map((sa, i) => {
      const sb = b.segs[i]!;
      const c = sa.c.map((v, j) => lerp(v, sb.c[j]!, t)) as CubicSegment['c'];
      return { c, line: sa.line && sb.line };
    }),
  };
}
