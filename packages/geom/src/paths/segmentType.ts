/**
 * Straight and curved segments, converted in place. A segment runs from one
 * anchor to the next, the closing segment of a closed subpath included, and is
 * named `(sub, segIdx)` as `segmentAt` reports it.
 */

import { locateAnchor, type AnchorSet } from './anchorEdits';
import { isStraightSegment, segmentEnds } from './anchors';

/** A segment of an `AnchorSet`: `segIdx === sub.length - 1` is a closed
 *  subpath's closing segment. */
export interface SegmentRef {
  sub: number;
  segIdx: number;
}

/** What a segment is made: a line, a curve, or the other of what it is. */
export type SegmentType = 'line' | 'curve';

/**
 * The segments both of whose ends are among `flatIndexes`, in walk order.
 * Two adjacent selected anchors select the segment between them; a closed
 * subpath with every anchor selected has all its segments.
 */
export function segmentsBetweenAnchors(set: AnchorSet, flatIndexes: Iterable<number>): SegmentRef[] {
  const picked = new Map<number, Set<number>>();
  for (const flat of flatIndexes) {
    const loc = locateAnchor(set, flat);
    if (!loc) continue;
    let s = picked.get(loc.sub);
    if (!s) picked.set(loc.sub, (s = new Set()));
    s.add(loc.idx);
  }
  const out: SegmentRef[] = [];
  for (const [sub, idxs] of [...picked].sort((a, b) => a[0] - b[0])) {
    const n = set.anchors[sub].length;
    const count = set.closed[sub] ? n : n - 1;
    for (let i = 0; i < count; i++) {
      if (idxs.has(i) && idxs.has((i + 1) % n)) out.push({ sub, segIdx: i });
    }
  }
  return out;
}

/** Whether segment `seg` is straight, or null when it does not exist. */
export function isSegmentStraight(set: AnchorSet, seg: SegmentRef): boolean | null {
  const ends = segmentEnds(set.anchors, set.closed, seg.sub, seg.segIdx);
  return ends ? isStraightSegment(ends.a, ends.b) : null;
}

/**
 * Make each segment in `segs` straight or curved without moving its anchors.
 * A line becomes a curve with its handles a third of the way in from each
 * end, which draws the same line; a curve becomes a line by dropping the two
 * handles that shape it, leaving the handles of the segments beside it alone.
 * With no `to`, every segment turns curved when any of them is straight, and
 * straight when all are curved: one press flips the lot.
 *
 * Returns whether any segment changed.
 */
export function convertSegments(set: AnchorSet, segs: readonly SegmentRef[], to?: SegmentType): boolean {
  const target = to ?? (segs.some((seg) => isSegmentStraight(set, seg) === true) ? 'curve' : 'line');
  let changed = false;
  for (const seg of segs) {
    const ends = segmentEnds(set.anchors, set.closed, seg.sub, seg.segIdx);
    if (!ends) continue;
    const { a, b } = ends;
    const straight = isStraightSegment(a, b);
    if (target === 'line' && !straight) {
      delete a.outHandle;
      delete b.inHandle;
      changed = true;
    } else if (target === 'curve' && straight) {
      a.outHandle = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 };
      b.inHandle = { x: b.x + (a.x - b.x) / 3, y: b.y + (a.y - b.y) / 3 };
      changed = true;
    }
  }
  return changed;
}
