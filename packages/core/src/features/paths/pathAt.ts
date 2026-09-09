/**
 * A station along a path: where it is at a fraction of its length, and which
 * way it is heading there.
 *
 * For anything positioned *along* geometry rather than beside it — a label on a
 * routed edge, a tick on a curve, a badge near an arrowhead. Curves are
 * flattened first, so the fraction is arc length along the drawn shape rather
 * than a curve parameter, which is what makes 0.5 look like the middle.
 */
import type { Vec2 } from 'core/geometry/polygonHitTestRect';
import type { Path } from 'core/geometry/path';
import { extractPolylines } from './tessellate/polyline';

export interface PathStation {
  point: Vec2;
  /** Unit vector along the path at `point`, pointing toward the end. */
  tangent: Vec2;
}

export interface PointAlongPathOptions {
  /** Curve flattening tolerance, in world units. Default 0.5. */
  flattenTolerance?: number;
}

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
  const polylines = extractPolylines(
    path,
    opts.flattenTolerance === undefined ? {} : { flattenTolerance: opts.flattenTolerance },
  );

  /** Every segment, in order, with the length it contributes. */
  const segments: { ax: number; ay: number; bx: number; by: number; len: number }[] = [];
  let total = 0;
  let first: Vec2 | undefined;
  for (const pl of polylines) {
    const count = pl.points.length / 2;
    if (count === 0) continue;
    first ??= { x: pl.points[0]!, y: pl.points[1]! };
    const last = pl.closed ? count : count - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % count;
      const ax = pl.points[i * 2]!;
      const ay = pl.points[i * 2 + 1]!;
      const bx = pl.points[j * 2]!;
      const by = pl.points[j * 2 + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      if (len === 0) continue;
      segments.push({ ax, ay, bx, by, len });
      total += len;
    }
  }

  if (first === undefined) return null;
  if (segments.length === 0) return { point: first, tangent: { x: 1, y: 0 } };

  const target = Math.min(Math.max(t, 0), 1) * total;
  let walked = 0;
  for (const seg of segments) {
    if (walked + seg.len < target) {
      walked += seg.len;
      continue;
    }
    const u = (target - walked) / seg.len;
    return {
      point: { x: seg.ax + (seg.bx - seg.ax) * u, y: seg.ay + (seg.by - seg.ay) * u },
      tangent: { x: (seg.bx - seg.ax) / seg.len, y: (seg.by - seg.ay) / seg.len },
    };
  }

  // Float drift can leave `target` a hair past the last segment.
  const last = segments[segments.length - 1]!;
  return {
    point: { x: last.bx, y: last.by },
    tangent: { x: (last.bx - last.ax) / last.len, y: (last.by - last.ay) / last.len },
  };
}
