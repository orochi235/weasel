/**
 * Anchors at the extremes of a path's curves: where a curved segment is
 * furthest left, right, up or down along its own run. Splitting there puts
 * an anchor with an axis-aligned tangent at each turn, and changes no point
 * of the shape.
 */
import { cubicAxisExtremaTs } from '../curve';
import { isStraightSegment, segmentEnds, type PenAnchor } from './anchors';
import { insertAnchorOnSegment, type AnchorSet } from './anchorEdits';

/** How close to an end, in curve parameter, an extreme may sit and still get
 *  an anchor of its own. Nearer, it is the end's. */
const END_SLOP = 1e-4;

/** Which turns count as extremes: in x (furthest left and right), in y (furthest up and down), or both. */
export type ExtremaAxes = 'xy' | 'x' | 'y';

/** The parameters in (0, 1) where the segment from `a` to `b` turns along
 *  `axes`, ascending, or none for a straight segment. */
export function segmentExtremaTs(a: PenAnchor, b: PenAnchor, axes: ExtremaAxes = 'xy'): number[] {
  if (isStraightSegment(a, b)) return [];
  const c1 = a.outHandle ?? a;
  const c2 = b.inHandle ?? b;
  const ts = [
    ...(axes === 'y' ? [] : cubicAxisExtremaTs(a.x, c1.x, c2.x, b.x)),
    ...(axes === 'x' ? [] : cubicAxisExtremaTs(a.y, c1.y, c2.y, b.y)),
  ].filter((t) => t > END_SLOP && t < 1 - END_SLOP).sort((p, q) => p - q);
  return ts.filter((t, i) => i === 0 || t - ts[i - 1] > END_SLOP);
}

/**
 * Split every curved segment of `set` at its extremes along `axes`
 * ({@link segmentExtremaTs}), in place. `include(sub, segIdx)` limits it to
 * some segments, named as `segmentEnds` names them; absent, every one.
 * Returns the new anchors' flat indices in the edited set. Each new anchor is
 * smooth, and every anchor after one moves up an index.
 */
export function addExtremaAnchors(
  set: AnchorSet,
  include?: (sub: number, segIdx: number) => boolean,
  axes: ExtremaAxes = 'xy',
): number[] {
  const added = new Set<PenAnchor>();
  set.anchors.forEach((sub, s) => {
    const segCount = sub.length - (set.closed[s] && sub.length > 1 ? 0 : 1);
    // Last to first, so a split never renumbers a segment still to come.
    for (let segIdx = segCount - 1; segIdx >= 0; segIdx--) {
      if (include && !include(s, segIdx)) continue;
      const ends = segmentEnds(set.anchors, set.closed, s, segIdx);
      if (!ends) continue;
      // Highest first: what is left to split is then always [0, end].
      let end = 1;
      for (const t of segmentExtremaTs(ends.a, ends.b, axes).reverse()) {
        const at = insertAnchorOnSegment(set, { sub: s, segIdx, t: t / end });
        if (at >= 0) added.add(sub[segIdx + 1]);
        end = t;
      }
    }
  });
  const out: number[] = [];
  let flat = 0;
  for (const sub of set.anchors) {
    for (const a of sub) {
      if (added.has(a)) out.push(flat);
      flat++;
    }
  }
  return out;
}
