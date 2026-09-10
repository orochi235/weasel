/**
 * AABB bounds of a `Path`. Returned as `RectPath` for direct reuse with the
 * rect fast path machinery (selection AABB, area-select intersection).
 *
 * `RectPath` is its own bounds — O(1). For `PolygonPath`, walk segment by
 * segment, computing the tight bound per segment:
 *
 *   - `M` / `L`: just the endpoint.
 *   - `Q`: quadratic Bezier — endpoints plus axis-aligned extrema (one
 *     possible inflection per axis).
 *   - `C`: cubic Bezier — endpoints plus axis-aligned extrema (up to two
 *     possible inflections per axis, found via the quadratic formula on
 *     the derivative).
 *
 * Control points are NOT included directly; they're used only to compute
 * extrema that actually lie on the curve. This avoids the classic "AABB
 * extends past where the curve visibly reaches" bug for curved paths whose
 * control points poke outside the visible extent.
 *
 * Empty paths (no commands) return a zero-size rect anchored at the
 * origin — the convention used elsewhere in the kit for missing geometry.
 */

import { cubicBounds, elevateQuadraticToCubic, forEachSegment } from '@weasel-js/geom';
import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  type RectPath,
} from './types';

/** AABB of a `Path`, returned as a `RectPath` for direct reuse with rect-fast-path machinery. */
export function boundsOfPath(path: Path): RectPath {
  if (path.kind === 'rect') return path;

  const { commands, coords } = path;
  if (commands.length === 0) {
    return { kind: 'rect', x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let seen = false;

  const include = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    seen = true;
  };

  forEachSegment(commands, coords, (cmd, ci, px, py) => {
    switch (cmd) {
      case PATH_M:
      case PATH_L: {
        include(coords[ci], coords[ci + 1]);
        break;
      }
      case PATH_C: {
        const [bMinX, bMinY, bMaxX, bMaxY] = cubicBounds(
          px, py,
          coords[ci], coords[ci + 1],
          coords[ci + 2], coords[ci + 3],
          coords[ci + 4], coords[ci + 5],
        );
        include(bMinX, bMinY);
        include(bMaxX, bMaxY);
        break;
      }
      case PATH_Q: {
        const qx2 = coords[ci + 2], qy2 = coords[ci + 3];
        const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(px, py, coords[ci], coords[ci + 1], qx2, qy2);
        const [bMinX, bMinY, bMaxX, bMaxY] = cubicBounds(px, py, c1x, c1y, c2x, c2y, qx2, qy2);
        include(bMinX, bMinY);
        include(bMaxX, bMaxY);
        break;
      }
      case PATH_Z:
        break;
      default:
        throw new Error(`boundsOfPath: unknown command ${cmd}`);
    }
  });

  if (!seen) return { kind: 'rect', x: 0, y: 0, width: 0, height: 0 };
  return { kind: 'rect', x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

