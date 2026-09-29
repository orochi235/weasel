import type { Guide } from '../types';
import type {
  AlignAnchor,
  AlignMatchResult,
} from './types';
import type { Bounds } from '@weasel-js/core';

/** Move/insert test all three features per axis. */
export const MOVE_ANCHORS: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] } = {
  x: ['min', 'center', 'max'],
  y: ['min', 'center', 'max'],
};

function featureOffset(b: Bounds, axis: 'x' | 'y', anchor: AlignAnchor): number {
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
  b: Bounds,
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
 * (feature, candidate) pair wins. A matched guide that carries a `span` comes
 * back with it stretched to cover the snapped box, so the drawn segment runs
 * from the aligned siblings to the box being dragged.
 *
 * `worldTolerance` is per axis because a screen-pixel tolerance is not one
 * world distance under non-uniform zoom — and each axis here is matched by a
 * distance along that axis alone, so there is an exact answer rather than an
 * approximation. Pass the same number twice for a world-space tolerance.
 */
export function matchAlignment(
  bounds: Bounds,
  candidates: readonly Guide[],
  worldTolerance: { x: number; y: number },
  anchors: { x: readonly AlignAnchor[]; y: readonly AlignAnchor[] },
): AlignMatchResult {
  const x = bestAxis(bounds, 'x', anchors.x, candidates, worldTolerance.x);
  const y = bestAxis(bounds, 'y', anchors.y, candidates, worldTolerance.y);
  const top = bounds.y + y.delta;
  const left = bounds.x + x.delta;
  return {
    dx: x.delta,
    dy: y.delta,
    activeX: stretchSpan(x.guide, top, top + bounds.height),
    activeY: stretchSpan(y.guide, left, left + bounds.width),
  };
}

/** A matched guide whose span also covers the snapped box. */
export function stretchSpan(g: Guide | null, min: number, max: number): Guide | null {
  if (g === null || g.span === undefined) return g;
  return { ...g, span: { min: Math.min(g.span.min, min), max: Math.max(g.span.max, max) } };
}
