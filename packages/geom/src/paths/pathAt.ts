/**
 * A station along a path: where it is at a fraction of its length, and which
 * way it is heading there.
 *
 * For anything positioned *along* geometry rather than beside it — a label on a
 * routed edge, a tick on a curve, a badge near an arrowhead. Curves are
 * flattened first, so the fraction is arc length along the drawn shape rather
 * than a curve parameter, which is what makes 0.5 look like the middle. For
 * many stations along one path, measure it once with `measurePath`.
 */
import type { Path } from '../path';
import { measurePath, type MeasurePathOptions, type PathStation } from './pathMeasure';

export type { PathStation };

/** Options for `pointAlongPath`. */
export type PointAlongPathOptions = MeasurePathOptions;

/**
 * Where `path` is at `t` of its total length, and its heading there.
 *
 * `t` is clamped to 0..1. Subpaths are measured in order and treated as one
 * run, the way a browser measures a whole `<path>`. Returns `null` for a path
 * with no points at all; a path of zero length answers at its single point,
 * heading along +X.
 */
export function pointAlongPath(
  path: Path,
  t: number,
  opts: PointAlongPathOptions = {},
): PathStation | null {
  const measure = measurePath(path, opts);
  if (measure === null) return null;
  return measure.at(Math.min(Math.max(t, 0), 1) * measure.length);
}
