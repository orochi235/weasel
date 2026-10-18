import { flatAnchorIndex, type AnchorSet } from './anchorEdits';
import { isStraightSegment, segmentEnds, type PenAnchor } from './anchors';
import { moveHandleSymmetric, type AnchorSymmetry } from './anchorSymmetry';
import type { Point } from './cubicMath';

/** A curved segment's balance line: from its first handle's tip to its
 *  second's, with a grip at the middle. */
export interface HandleBalance {
  sub: number;
  segIdx: number;
  /** Flat index of the anchor the segment starts at, which names the segment
   *  the way an anchor's flat index names the anchor. */
  flat: number;
  /** Tip of the segment's first handle, the start anchor's out-handle. */
  from: Point;
  /** Tip of the segment's second handle, the end anchor's in-handle. */
  to: Point;
  /** Midway between the two tips. */
  grip: Point;
}

/**
 * The balance line of every curved segment in `set` that has both handles
 * pulled off their anchors. Dragging a line's grip scales both handles
 * together ({@link scaleSegmentHandles}), which fills the curve out toward
 * its corner or flattens it toward its chord without turning either end.
 */
export function handleBalances(set: AnchorSet): HandleBalance[] {
  const out: HandleBalance[] = [];
  for (let sub = 0; sub < set.anchors.length; sub++) {
    const count = set.anchors[sub].length - (set.closed[sub] ? 0 : 1);
    for (let segIdx = 0; segIdx < count; segIdx++) {
      const handles = segmentHandles(set, sub, segIdx);
      if (!handles) continue;
      const { from, to } = handles;
      out.push({
        sub,
        segIdx,
        flat: flatAnchorIndex(set, sub, segIdx),
        from: { ...from },
        to: { ...to },
        grip: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
      });
    }
  }
  return out;
}

/** The segment's anchors and handle tips, when it is curved with both
 *  handles off their anchors. */
function segmentHandles(
  set: AnchorSet,
  sub: number,
  segIdx: number,
): { a: PenAnchor; b: PenAnchor; from: Point; to: Point } | null {
  const ends = segmentEnds(set.anchors, set.closed, sub, segIdx);
  if (!ends || isStraightSegment(ends.a, ends.b)) return null;
  const { a, b } = ends;
  if (!a.outHandle || !b.inHandle) return null;
  if (length(a, a.outHandle) === 0 || length(b, b.inHandle) === 0) return null;
  return { a, b, from: a.outHandle, to: b.inHandle };
}

/**
 * Scale both handles of segment `(sub, segIdx)` by `factor`, each along its
 * own direction, so the segment keeps its end tangents. A smooth anchor at
 * either end stays smooth: its other handle points the same way as before.
 * `factor` below zero counts as zero, which retracts both handles.
 *
 * Under `syms`, as `anchorSymmetries` gives them, every image of either handle
 * moves to the image of where that handle goes, the way `moveHandleSymmetric`
 * moves a dragged handle's.
 *
 * Returns false when the segment has no balance line or nothing moved.
 */
export function scaleSegmentHandles(
  set: AnchorSet,
  sub: number,
  segIdx: number,
  factor: number,
  syms: readonly AnchorSymmetry[] = [],
): boolean {
  const handles = segmentHandles(set, sub, segIdx);
  if (!handles) return false;
  const k = Math.max(0, factor);
  if (k === 1) return false;
  const { a, b } = handles;
  // Both targets before either write: an image of the first handle can be the second.
  const out = scaledFrom(a, a.outHandle!, k);
  const into = scaledFrom(b, b.inHandle!, k);
  const next = segIdx + 1 === set.anchors[sub].length ? 0 : segIdx + 1;
  moveHandleSymmetric(set, flatAnchorIndex(set, sub, segIdx), 'out', out.x, out.y, true, syms);
  moveHandleSymmetric(set, flatAnchorIndex(set, sub, next), 'in', into.x, into.y, true, syms);
  return true;
}

/**
 * The factor {@link scaleSegmentHandles} takes to bring segment
 * `(sub, segIdx)`'s grip as near `to` as scaling can: `to` projected onto the
 * line the grip slides along as both handles grow. 1 when the segment has no
 * balance line.
 */
export function balanceFactorToward(set: AnchorSet, sub: number, segIdx: number, to: Point): number {
  const handles = segmentHandles(set, sub, segIdx);
  if (!handles) return 1;
  const { a, b, from, to: tip } = handles;
  // grip(k) = mid + k·w, where mid is the chord's middle and w the handles'
  // mean offset; k = 1 is where the grip is now.
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const w = { x: (from.x - a.x + tip.x - b.x) / 2, y: (from.y - a.y + tip.y - b.y) / 2 };
  const w2 = w.x * w.x + w.y * w.y;
  if (w2 < 1e-12) return 1;
  return Math.max(0, ((to.x - mid.x) * w.x + (to.y - mid.y) * w.y) / w2);
}

/**
 * Give both handles of segment `(sub, segIdx)` the same proportion: each
 * reaches the same fraction of the way from its anchor to the corner where
 * the two handle lines cross, that fraction being the mean of the two they
 * had. Where the lines don't cross ahead of both handles, both take the mean
 * length instead. Directions are kept either way.
 *
 * Returns false when the segment has no balance line or the handles already
 * match.
 */
export function equalizeSegmentHandles(set: AnchorSet, sub: number, segIdx: number): boolean {
  const handles = segmentHandles(set, sub, segIdx);
  if (!handles) return false;
  const { a, b, from, to } = handles;
  const lenA = length(a, from);
  const lenB = length(b, to);
  const ua = { x: (from.x - a.x) / lenA, y: (from.y - a.y) / lenA };
  const ub = { x: (to.x - b.x) / lenB, y: (to.y - b.y) / lenB };
  const corner = rayCrossing(a, ua, b, ub);
  let nextA: number;
  let nextB: number;
  if (corner) {
    const share = (lenA / corner.ta + lenB / corner.tb) / 2;
    nextA = share * corner.ta;
    nextB = share * corner.tb;
  } else {
    nextA = nextB = (lenA + lenB) / 2;
  }
  if (Math.abs(nextA - lenA) < 1e-9 && Math.abs(nextB - lenB) < 1e-9) return false;
  a.outHandle = { x: a.x + ua.x * nextA, y: a.y + ua.y * nextA };
  b.inHandle = { x: b.x + ub.x * nextB, y: b.y + ub.y * nextB };
  return true;
}

/** Where the ray from `p` along `u` meets the ray from `q` along `v`, as the
 *  distance along each; null when they are parallel or meet behind either. */
function rayCrossing(p: Point, u: Point, q: Point, v: Point): { ta: number; tb: number } | null {
  const den = u.x * v.y - u.y * v.x;
  if (Math.abs(den) < 1e-12) return null;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const ta = (dx * v.y - dy * v.x) / den;
  const tb = (dx * u.y - dy * u.x) / den;
  return ta > 0 && tb > 0 ? { ta, tb } : null;
}

function length(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function scaledFrom(anchor: Point, handle: Point, k: number): Point {
  return { x: anchor.x + (handle.x - anchor.x) * k, y: anchor.y + (handle.y - anchor.y) * k };
}
