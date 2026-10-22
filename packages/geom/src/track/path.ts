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
  const measure = measurePath(path, options);
  if (!measure) return null;
  const { length, closed } = measure;

  const shape: TrackShape = {
    kind: 'path',
    length,
    closed,
    at(f) {
      const { point, tangent } = measure.at(clamp(f, 0, 1) * length, true);
      return { point, tangent, normal: { x: tangent.y, y: -tangent.x } };
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
