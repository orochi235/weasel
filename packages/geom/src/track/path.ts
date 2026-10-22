import type { Path } from '../path';
import type { Point } from '../paths/cubicMath';
import { measurePath } from '../paths/pathMeasure';
import { clamp } from '../scalar';
import type { TrackShape } from './shape';

/** A track shape that remembers the path it was built from, so path data can be drawn as the path itself. */
export type PathTrackShape = TrackShape & { readonly path: Path };

/**
 * A track along any path, every subpath counted in order, addressed by fraction of its length. Its normal is the left of
 * travel, as a line's is: outward on a contour drawn clockwise on screen. `null` for a path with no points.
 */
export function pathShape(path: Path, options: { flattenTolerance?: number } = {}): PathTrackShape | null {
  const measure = measurePath(path, { ...options, keepCorners: true });
  if (!measure) return null;
  const { length, closed } = measure;

  const shape: TrackShape = {
    kind: 'path',
    length,
    closed,
    at(f, options) {
      const open = options?.open === true && (f < 0 || f > 1);
      const g = open && closed ? ((f % 1) + 1) % 1 : clamp(f, 0, 1);
      const { point, tangent } = measure.at(g * length, true);
      // An open path past an end carries on straight along it.
      const past = open && !closed ? (f - g) * length : 0;
      return { point: { x: point.x + past * tangent.x, y: point.y + past * tangent.y }, tangent, normal: { x: tangent.y, y: -tangent.x } };
    },
    nearest(p: Point, opts) {
      const n = measure.nearest(p);
      const f = length === 0 ? 0 : n.s / length;
      if (!opts?.open || !closed || length === 0) return { f, dist: n.dist };
      const about = opts.about ?? 0.5;
      const unwrapped = [f - 1, f + 1].reduce((best, g) => (Math.abs(g - about) < Math.abs(best - about) ? g : best), f);
      return { f: unwrapped, dist: n.dist };
    },
  };
  Object.defineProperty(shape, 'path', { value: path, enumerable: false });
  return shape as PathTrackShape;
}
