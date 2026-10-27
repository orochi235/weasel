import type { Point } from '../paths/cubicMath';
import { clamp } from '../scalar';
import type {
  TrackAtOptions,
  TrackNearest,
  TrackNearestOptions,
  TrackShape,
  TrackStation,
} from './shape';

/** A station as a run places an item: `normal` is the item's up after any flip, `tangent` its reading direction,
 *  `angle` the CSS rotation in degrees that tips an upright item to the place (0 = upright, clockwise positive, in
 *  (-180, 180]). Read right to left, `tangent` points against the direction `angle` turns an item's own left to right. */
export interface TrackPlace extends TrackStation {
  angle: number;
  /** True when `normal` points down the screen, so an item tipped by `angle` reads upside down. A run is turned over
   *  by one place alone, so one across 3 or 9 o'clock has turned places toward one end; an item that should read
   *  upright turns a half turn about its own center there. Nothing else in the place reflects it. */
  turned: boolean;
}

/** Whether an up `normal` points down the screen, y growing downward. */
const pointsDown = (normal: Point): boolean => normal.y > 1e-9;

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
  /** The inline direction it reads in, from {@link TrackRunOptions.direction}. */
  readonly direction: 'ltr' | 'rtl';
  at(g: number, options?: TrackAtOptions): TrackPlace;
  /** The shape fraction reading fraction `g` falls at, unclamped: `from` at g = 0 and `to` at g = 1, or the other way
   *  round when the run is `reversed`. */
  toShape(g: number): number;
}

/** Which side of a shape a run's items stand on: `'auto'` whichever is upright, `'path'` the shape's own normal, `'flipped'`
 *  the other. */
export type TrackSide = 'auto' | 'path' | 'flipped';

/** How {@link trackRun} reads a shape: which side of it is up, and where that is judged. */
export interface TrackRunOptions {
  /** Default `'auto'`. */
  side?: TrackSide;
  /** The shape fraction `'auto'` judges the side at. Default the run's middle, `(from + to) / 2`. */
  about?: number;
  /** The inline direction items read in on the side the run stands on: `'rtl'` starts the run at its right end. Each
   *  item still stands as it would read left to right. Default `'ltr'`. */
  direction?: 'ltr' | 'rtl';
}

/** The stretch `from..to` (default the whole shape) as items read it: on the side `options.side` picks, reversed to read
 *  left to right on that side, or right to left under `options.direction: 'rtl'`. */
export function trackRun(shape: TrackShape, from = 0, to = 1, options: TrackRunOptions = {}): TrackRun {
  const { side = 'auto', about = (from + to) / 2, direction = 'ltr' } = options;
  const rtl = direction === 'rtl';
  const mid = shape.at(about);
  const flipped = side === 'auto' ? pointsDown(mid.normal) : side === 'flipped';
  const sgn = flipped ? -1 : 1;
  const reading = (n: Point): Point => ({ x: -(sgn * n.y), y: sgn * n.x });
  const r0 = reading(mid.normal);
  const reversed = (r0.x * mid.tangent.x + r0.y * mid.tangent.y < 0) !== rtl;
  const span = to - from;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const toShape = (g: number): number => reversed ? to - g * span : from + g * span;

  const at = (g: number, options?: TrackAtOptions): TrackPlace => {
    const s = options?.open ? shape.at(toShape(g), options) : shape.at(toShape(clamp(g, 0, 1)));
    const dir = reading(s.normal);
    const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const normal = { x: sgn * s.normal.x, y: sgn * s.normal.y };
    return {
      point: s.point,
      tangent: rtl ? { x: -dir.x, y: -dir.y } : dir,
      normal,
      angle: angle === 0 ? 0 : angle === -180 ? 180 : angle,
      turned: pointsDown(normal),
    };
  };

  const toG = (f: number): number => span === 0 ? 0 : reversed ? (to - f) / span : (f - from) / span;

  const nearest = (p: Point, options?: TrackNearestOptions): TrackNearest => {
    const f = clamp(shape.nearest(p).f, lo, hi);
    const q = shape.at(f).point;
    const dist = Math.hypot(p.x - q.x, p.y - q.y);
    if (!options?.open) return { f: toG(f), dist };
    return { f: toG(shape.nearest(p, { open: true, about: toShape(options.about ?? 0.5) }).f), dist };
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
    direction,
    at,
    toShape,
    nearest,
  };
}
