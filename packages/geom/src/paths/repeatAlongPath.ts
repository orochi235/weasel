/**
 * Copies of a shape placed at intervals along a path: the stations they sit
 * at, and the copies themselves.
 */
import { multiply, rotate, translate } from '../affine';
import type { Path } from '../path';
import { boundsOfPath } from './bounds';
import type { Point } from './cubicMath';
import { measurePath } from './pathMeasure';
import { transformPath } from './transformPath';

/** How copies are spaced along a path. */
export interface RepeatAlongPathOptions {
  /**
   * How many copies. With no `spacing`, they spread evenly over the whole
   * path — end to end on an open one, evenly round a closed one — and the
   * default is 5. With a `spacing`, it caps the run; unset, as many as fit.
   */
  count?: number;
  /** Distance along the path from one copy's center to the next. */
  spacing?: number;
  /** Where a spaced run that is shorter than the path sits on it. Default
   *  `'start'`. */
  align?: 'start' | 'center' | 'end';
  /** Slide every copy this far along the path. On an open path a copy slid
   *  off either end is dropped; round a closed one it wraps. Default 0. */
  offset?: number;
  /** Turn each copy to the path's heading where it sits. Default `true`. */
  orient?: boolean;
  /** Curve flattening tolerance for measuring the path. Default 0.5. */
  flattenTolerance?: number;
}

/** Where one copy sits. */
export interface RepeatStation {
  point: Point;
  /** The path's heading there, radians clockwise from +X in a y-down frame. */
  angle: number;
  /** Arc length from the path's start. */
  distance: number;
}

const EPS = 1e-6;

/** The stations copies sit at along `path`, in order. Empty for a path with
 *  no points. */
export function stationsAlongPath(path: Path, opts: RepeatAlongPathOptions = {}): RepeatStation[] {
  const measure = measurePath(path, opts.flattenTolerance === undefined ? {} : { flattenTolerance: opts.flattenTolerance });
  if (measure === null) return [];
  const L = measure.length;
  const offset = opts.offset ?? 0;
  const distances: number[] = [];
  const spacing = opts.spacing;
  if (spacing === undefined || !(spacing > 0)) {
    const n = Math.max(Math.floor(opts.count ?? 5), 0);
    if (measure.closed) for (let i = 0; i < n; i++) distances.push(offset + (i * L) / Math.max(n, 1));
    else if (n === 1) distances.push(offset + L / 2);
    else for (let i = 0; i < n; i++) distances.push(offset + (i * L) / (n - 1));
  } else {
    const fit = measure.closed ? Math.floor(L / spacing + EPS) : Math.floor(L / spacing + EPS) + 1;
    const n = Math.max(Math.min(opts.count === undefined ? fit : Math.floor(opts.count), fit), 0);
    const run = Math.max(n - 1, 0) * spacing;
    const align = opts.align ?? 'start';
    const start = align === 'center' ? (L - run) / 2 : align === 'end' ? L - run : 0;
    for (let i = 0; i < n; i++) distances.push(start + offset + i * spacing);
  }

  const out: RepeatStation[] = [];
  for (const d of distances) {
    let s = d;
    if (measure.closed && L > 0) s = ((d % L) + L) % L;
    else if (d < -EPS || d > L + EPS) continue;
    const { point, tangent } = measure.at(s);
    out.push({ point, angle: Math.atan2(tangent.y, tangent.x), distance: s });
  }
  return out;
}

/**
 * Copies of `shape`, each centered on a station along `path` — its bounding
 * box's middle on the path — and, with `orient`, turned to the heading
 * there. The shape's own +X runs along the path.
 */
export function repeatAlongPath(shape: Path, path: Path, opts: RepeatAlongPathOptions = {}): Path[] {
  const box = boundsOfPath(shape);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const orient = opts.orient ?? true;
  return stationsAlongPath(path, opts).map(({ point, angle }) => {
    const toOrigin = translate(-cx, -cy);
    const place = translate(point.x, point.y);
    const m = orient ? multiply(place, multiply(rotate(angle), toOrigin)) : multiply(place, toOrigin);
    return transformPath(shape, m);
  });
}
