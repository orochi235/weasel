import type { CurvatureSource } from '../paths/curvature';
import type { CurveRepresentation, SharedAnchor } from './types';

/** Step in t for the tangent's central difference. */
const TANGENT_STEP = 1e-4;

/**
 * `anchors` read through `rep`, as a {@link CurvatureSource} over the whole
 * curve, so any representation can stand a curvature comb with `combTeeth`.
 * Representations carry no derivative, so the tangent is a central difference
 * of `evaluate`, one-sided at the ends.
 */
export function curvatureSourceOf(rep: CurveRepresentation, anchors: SharedAnchor[]): CurvatureSource {
  return {
    pointAt: (t) => rep.evaluate(anchors, t),
    tangentAt: (t) => {
      const a = rep.evaluate(anchors, Math.max(0, t - TANGENT_STEP));
      const b = rep.evaluate(anchors, Math.min(1, t + TANGENT_STEP));
      return { x: b.x - a.x, y: b.y - a.y };
    },
    curvatureAt: (t) => rep.curvatureAt(anchors, t),
  };
}
