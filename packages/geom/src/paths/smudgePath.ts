/**
 * `smudgePath` — one dab of a smudge brush: the outline under a round brush
 * moved along the brush's motion, most at its center and not at all at its rim.
 */
import type { PolygonPath } from '../path';
import { editAnchorSet, insertAnchorOnSegment, translateAnchorBy, type AnchorSet } from './anchorEdits';
import { segmentEnds, type PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';

/** Options for {@link smudgePath}. */
export interface SmudgePathOptions {
  /** The brush's center before this dab's motion. */
  center: Point;
  /** How far the brush moved. */
  delta: Point;
  /** The brush's radius, in the path's units. */
  radius: number;
  /** How much of `delta` a point under the brush's center moves: `1` all of it. Default 1. */
  strength?: number;
  /**
   * The longest a segment under the brush may be before an anchor is added at its
   * middle, in the path's units, so the brush has points to move where it needs
   * them. Default a third of `radius`; `Infinity` adds none.
   */
  detail?: number;
}

/** Samples along a segment when deciding whether it passes under the brush. */
const PROBES = 12;
/** Most anchors a single dab may add. */
const MAX_ADDED = 512;

/**
 * `path` with the outline under the brush pushed along `delta`. A point at distance
 * `d` from `center` moves by `delta × strength × (1 − (d/radius)²)²`, and an anchor's
 * handles move with it, so a smooth anchor stays smooth. First, every segment that
 * passes under the brush and is longer than `detail` is split at its middle until it
 * is not, so a long straight edge bends where the brush meets it. Returns `path`
 * itself when nothing is under the brush.
 */
export function smudgePath(path: PolygonPath, opts: SmudgePathOptions): PolygonPath {
  const { center, delta, radius } = opts;
  const strength = opts.strength ?? 1;
  if (!(radius > 0) || strength === 0 || (delta.x === 0 && delta.y === 0)) return path;
  const detail = opts.detail ?? radius / 3;
  return editAnchorSet(path, (set) => {
    refine(set, center, radius, detail);
    let touched = false;
    let flat = 0;
    for (const sub of set.anchors) {
      for (const a of sub) {
        const w = weight(a, center, radius) * strength;
        if (w !== 0) {
          touched = true;
          translateAnchorBy(set, flat, delta.x * w, delta.y * w);
        }
        flat++;
      }
    }
    return touched;
  }) ?? path;
}

/** The brush's falloff at `p`: 1 at its center, 0 at its rim and beyond. */
function weight(p: Point, c: Point, radius: number): number {
  const u2 = ((p.x - c.x) ** 2 + (p.y - c.y) ** 2) / (radius * radius);
  return u2 >= 1 ? 0 : (1 - u2) ** 2;
}

/** Split the segments under the brush at their middles until none is longer than
 *  `detail`, adding at most {@link MAX_ADDED} anchors. */
function refine(set: AnchorSet, c: Point, radius: number, detail: number): void {
  if (!Number.isFinite(detail) || detail <= 0) return;
  let added = 0;
  for (let sub = 0; sub < set.anchors.length; sub++) {
    // Back to front, so a split does not shift the segments still to visit; a
    // split segment's first half is visited again at the same index.
    for (let seg = set.anchors[sub].length - 1; seg >= 0 && added < MAX_ADDED; seg--) {
      const ends = segmentEnds(set.anchors, set.closed, sub, seg);
      if (!ends || controlLength(ends.a, ends.b) <= detail || !underBrush(ends.a, ends.b, c, radius)) continue;
      insertAnchorOnSegment(set, { sub, segIdx: seg, t: 0.5 });
      added++;
      seg += 2;
    }
  }
}

const controls = (a: PenAnchor, b: PenAnchor): [Point, Point, Point, Point] =>
  [a, a.outHandle ?? a, b.inHandle ?? b, b];

/** The length of the segment's control polygon, which is never shorter than the segment. */
function controlLength(a: PenAnchor, b: PenAnchor): number {
  const [p0, p1, p2, p3] = controls(a, b);
  return Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y)
    + Math.hypot(p3.x - p2.x, p3.y - p2.y);
}

/** Whether any of the segment from `a` to `b` lies under the brush. */
function underBrush(a: PenAnchor, b: PenAnchor, c: Point, radius: number): boolean {
  const [p0, p1, p2, p3] = controls(a, b);
  for (let k = 0; k <= PROBES; k++) {
    const p = cubicPointAt(p0, p1, p2, p3, k / PROBES);
    if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 < radius * radius) return true;
  }
  return false;
}
