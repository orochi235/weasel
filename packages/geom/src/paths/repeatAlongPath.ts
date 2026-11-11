/**
 * Copies of a shape placed along a path, laid as items of a run by
 * `placeAlongRun`: the stations they sit at, and the copies themselves.
 */
import { multiply, rotate, translate } from '../affine';
import type { Path } from '../path';
import { pathShape } from '../track/path';
import { placeAlongRun } from '../track/place';
import { trackRun } from '../track/run';
import { boundsOfPath } from './bounds';
import type { Point } from './cubicMath';
import { transformPath } from './transformPath';

/** How copies are laid along a path. Each copy is an item as long, along the
 *  path, as the shape is wide. */
export interface RepeatAlongPathOptions {
  /**
   * How many copies. With no `spacing`, or 0, they spread evenly over the whole
   * path — the first starting at its start and the last ending at its end on
   * an open one, evenly round a closed one — and the default is 5. With a
   * `spacing`, it caps the run; unset, as many as fit.
   */
  count?: number;
  /** Space along the path between one copy's end and the next one's start. */
  spacing?: number;
  /** Where a run shorter than the path sits on it. Default `'start'`. */
  align?: 'start' | 'center' | 'end';
  /** Slide every copy this far along the path. On an open path a copy slid
   *  wholly off either end is dropped; round a closed one it wraps. Default 0. */
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

/** The stations copies `size` long along the path sit at along `path`, in
 *  order. Empty for a path with no points. */
export function stationsAlongPath(path: Path, opts: RepeatAlongPathOptions = {}, size = 0): RepeatStation[] {
  const shape = pathShape(path, opts.flattenTolerance === undefined ? {} : { flattenTolerance: opts.flattenTolerance });
  if (shape === null) return [];
  const { length: L, closed } = shape;
  const { n, gap } = layout(L, closed, Math.max(size, 0), opts);
  if (n === 0) return [];
  const align = opts.align ?? 'start';
  const at = align === 'start' ? 0 : align === 'end' ? L : L / 2;
  const run = trackRun(shape, 0, 1, { side: 'path' });
  const places = placeAlongRun(run, new Array<number>(n).fill(size), { gap, align, at, offset: -(opts.offset ?? 0), wrap: closed });
  return places.filter((p) => p.clipped !== 'past').map(({ point, tangent, center }) => ({
    point,
    angle: Math.atan2(tangent.y, tangent.x),
    distance: closed && L > 0 ? ((center % L) + L) % L : center,
  }));
}

/** How many copies `size` long go on a path `L` long, and the gap between each two. */
function layout(L: number, closed: boolean, size: number, opts: RepeatAlongPathOptions): { n: number; gap: number } {
  const { spacing } = opts;
  if (spacing === undefined || !(spacing > 0)) {
    const n = Math.max(Math.floor(opts.count ?? 5), 0);
    if (closed) return { n, gap: n > 0 ? L / n - size : 0 };
    return { n, gap: n > 1 ? (L - n * size) / (n - 1) : 0 };
  }
  const step = size + spacing;
  const hair = 1e-9 * Math.max(1, L);
  const fit = Math.max(Math.floor((closed ? L + hair : L + spacing + hair) / step), 0);
  return { n: Math.max(Math.min(opts.count === undefined ? fit : Math.floor(opts.count), fit), 0), gap: spacing };
}

/**
 * Copies of `shape`, each centered on a station along `path` — its bounding
 * box's middle on the path — and, with `orient`, turned to the heading
 * there. The shape's own +X runs along the path, and its width is its length
 * along it.
 */
export function repeatAlongPath(shape: Path, path: Path, opts: RepeatAlongPathOptions = {}): Path[] {
  const box = boundsOfPath(shape);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const orient = opts.orient ?? true;
  return stationsAlongPath(path, opts, box.width).map(({ point, angle }) => {
    const toOrigin = translate(-cx, -cy);
    const place = translate(point.x, point.y);
    const m = orient ? multiply(place, multiply(rotate(angle), toOrigin)) : multiply(place, toOrigin);
    return transformPath(shape, m);
  });
}
