import { nearestOnLine } from '../nearest';
import type { Point } from '../paths/cubicMath';
import type { PathStation } from '../paths/pathMeasure';
import { clamp } from '../scalar';

/** A station on a track, plus the side items stand on. */
export interface TrackStation extends PathStation {
  /** Unit vector the items stand on: away from an arc's center, left of travel on a line. */
  normal: Point;
}

/** The nearest spot on a track to a point: its fraction along and the distance to it. */
export interface TrackNearest {
  f: number;
  dist: number;
}

/** How `nearest` treats a track's ends. */
export interface TrackNearestOptions {
  /** Let `f` run on past 0 and 1: a line extends straight, an arc by angle, unwrapped about `about`. A shape
   *  that cannot extend clamps. `dist` is to the track either way. */
  open?: boolean;
  /** Where along the track an open arc is unwrapped about, in the same terms as the `f` this `nearest` answers (a
   *  `TrackRun` reads it in reading order): a point is placed on whichever side of it is nearer by angle. Default 0.5,
   *  the middle. */
  about?: number;
}

/** Which family a track shape belongs to. `'path'` is reserved for a shape over `nearestOnPath`. */
export type TrackShapeKind = 'line' | 'arc' | 'path';

/** A curve a control lies along, addressed by fraction 0..1 of its length. */
export interface TrackShape {
  readonly kind: TrackShapeKind;
  readonly length: number;
  /** The station at fraction `f`, clamped to 0..1. */
  at(f: number): TrackStation;
  /** The spot on the track nearest `p`. */
  nearest(p: Point, options?: TrackNearestOptions): TrackNearest;
}

/** A straight track from `from` to `to`; its normal is the left of travel. */
export function lineShape(from: Point, to: Point): TrackShape {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const tangent = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
  const normal = { x: tangent.y, y: -tangent.x };
  return {
    kind: 'line',
    length,
    at(f) {
      const t = clamp(f, 0, 1);
      return {
        point: { x: from.x + t * dx, y: from.y + t * dy },
        tangent: { ...tangent },
        normal: { ...normal },
      };
    },
    nearest(p, options) {
      const n = nearestOnLine(p.x, p.y, from.x, from.y, to.x, to.y);
      if (!options?.open || length === 0) return { f: n.t, dist: n.dist };
      const f = ((p.x - from.x) * dx + (p.y - from.y) * dy) / (length * length);
      return { f, dist: n.dist };
    },
  };
}
