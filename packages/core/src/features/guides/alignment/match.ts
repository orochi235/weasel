import type { Guide } from '../types';
import type {
  AlignAnchor,
  AlignBounds,
  AlignBoundsProjection,
  AlignMatchResult,
} from './types';

/** Move/insert test all three features per axis. */
export const MOVE_ANCHORS: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] } = {
  x: ['min', 'center', 'max'],
  y: ['min', 'center', 'max'],
};

/** Default projection for rect-shaped poses (`{x,y,width,height}`). */
export const RECT_ALIGN_PROJECTION: AlignBoundsProjection<AlignBounds> = {
  boundsOf: (p) => p,
  translate: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
};

function featureOffset(b: AlignBounds, axis: 'x' | 'y', anchor: AlignAnchor): number {
  if (axis === 'x') {
    if (anchor === 'min') return b.x;
    if (anchor === 'center') return b.x + b.width / 2;
    return b.x + b.width;
  }
  if (anchor === 'min') return b.y;
  if (anchor === 'center') return b.y + b.height / 2;
  return b.y + b.height;
}

/** Best (feature, candidate) match on one axis, within tolerance. */
function bestAxis(
  b: AlignBounds,
  axis: 'x' | 'y',
  anchors: readonly AlignAnchor[],
  candidates: readonly Guide[],
  worldTolerance: number,
): { delta: number; guide: Guide | null } {
  let bestAbs = Infinity;
  let bestDelta = 0;
  let bestGuide: Guide | null = null;
  for (const anchor of anchors) {
    const o = featureOffset(b, axis, anchor);
    for (const g of candidates) {
      if (g.axis !== axis) continue;
      const d = g.offset - o;
      const ad = Math.abs(d);
      if (ad <= worldTolerance && ad < bestAbs) {
        bestAbs = ad;
        bestDelta = d;
        bestGuide = g;
      }
    }
  }
  return { delta: bestGuide ? bestDelta : 0, guide: bestGuide };
}

/**
 * Match a moving box's selected edge/center features against candidate guide
 * lines. Returns the per-axis snap delta and the matched candidate line(s).
 * The two axes resolve independently; on each axis the closest in-tolerance
 * (feature, candidate) pair wins.
 *
 * `worldTolerance` is per axis because a screen-pixel tolerance is not one
 * world distance under non-uniform zoom — and each axis here is matched by a
 * distance along that axis alone, so there is an exact answer rather than an
 * approximation. Pass the same number twice for a world-space tolerance.
 */
export function matchAlignment(
  bounds: AlignBounds,
  candidates: readonly Guide[],
  worldTolerance: { x: number; y: number },
  anchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] },
): AlignMatchResult {
  const x = bestAxis(bounds, 'x', anchors.x, candidates, worldTolerance.x);
  const y = bestAxis(bounds, 'y', anchors.y, candidates, worldTolerance.y);
  return { dx: x.delta, dy: y.delta, activeX: x.guide, activeY: y.guide };
}
