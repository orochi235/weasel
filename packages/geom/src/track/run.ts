import type { Point } from '../paths/cubicMath';
import { clamp } from '../scalar';
import type {
  TrackNearest,
  TrackNearestOptions,
  TrackShape,
  TrackStation,
} from './shape';

/** A station as a run places an item: `normal` is the item's up after any flip, `tangent` its reading direction,
 *  `angle` the CSS rotation in degrees that tips an upright item to it (0 = upright, clockwise positive, in (-180, 180]). */
export interface TrackPlace extends TrackStation {
  angle: number;
}

/** The stretch `from..to` of a shape in reading order. It is itself a TrackShape: `at(g)` and `nearest(p).f` are
 *  in reading order, g = 0 at the reading start. */
export interface TrackRun extends TrackShape {
  readonly shape: TrackShape;
  readonly from: number;
  readonly to: number;
  /** True when items stand on the shape's normal turned over: under `side: 'auto'`, when that normal points down the screen
   *  at `about`, so they stand upright. */
  readonly flipped: boolean;
  /** True when reading order runs against the shape's own direction. */
  readonly reversed: boolean;
  at(g: number): TrackPlace;
}

/** Which side of a shape a run's items stand on: `'auto'` whichever is upright, `'path'` the shape's own normal, `'flipped'`
 *  the other. */
export type TrackSide = 'auto' | 'path' | 'flipped';

export interface TrackRunOptions {
  /** Default `'auto'`. */
  side?: TrackSide;
  /** The shape fraction `'auto'` judges the side at. Default the run's middle, `(from + to) / 2`. */
  about?: number;
}

/** The stretch `from..to` (default the whole shape) as items read it: on the side `options.side` picks, reversed to read
 *  left to right on that side. */
export function trackRun(shape: TrackShape, from = 0, to = 1, options: TrackRunOptions = {}): TrackRun {
  const { side = 'auto', about = (from + to) / 2 } = options;
  const mid = shape.at(about);
  const flipped = side === 'auto' ? mid.normal.y > 1e-9 : side === 'flipped';
  const sgn = flipped ? -1 : 1;
  const reading = (n: Point): Point => ({ x: -(sgn * n.y), y: sgn * n.x });
  const r0 = reading(mid.normal);
  const reversed = r0.x * mid.tangent.x + r0.y * mid.tangent.y < 0;
  const span = to - from;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const toF = (g: number): number => reversed ? to - g * span : from + g * span;

  const at = (g: number): TrackPlace => {
    const s = shape.at(toF(clamp(g, 0, 1)));
    const dir = reading(s.normal);
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    return {
      point: s.point,
      tangent: dir,
      normal: { x: sgn * s.normal.x, y: sgn * s.normal.y },
      angle: angle === 0 ? 0 : angle === -180 ? 180 : angle,
    };
  };

  const toG = (f: number): number => span === 0 ? 0 : reversed ? (to - f) / span : (f - from) / span;

  const nearest = (p: Point, options?: TrackNearestOptions): TrackNearest => {
    const f = clamp(shape.nearest(p).f, lo, hi);
    const q = shape.at(f).point;
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (!options?.open) return { f: toG(f), dist };
    return { f: toG(shape.nearest(p, { open: true, about: toF(options.about ?? 0.5) }).f), dist };
  };

  return {
    kind: shape.kind,
    length: shape.length * Math.abs(span),
    closed: shape.closed && Math.abs(span) === 1,
    shape,
    from,
    to,
    flipped,
    reversed,
    at,
    nearest,
  };
}
