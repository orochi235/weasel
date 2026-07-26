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

import { cubicBounds, elevateQuadraticToCubic } from '@weasel-js/geom';
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
  let ci = 0;
  let seen = false;
  // Pen position carried across segments — needed because curves are
  // defined relative to the previous endpoint, which is itself the start
  // of the next segment but not re-encoded in `coords`.
  let px = 0, py = 0;

  const include = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    seen = true;
  };

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    switch (cmd) {
      case PATH_M:
      case PATH_L: {
        const x = coords[ci], y = coords[ci + 1];
        include(x, y);
        px = x; py = y;
        ci += 2;
        break;
      }
      case PATH_C: {
        const x1 = coords[ci],     y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const x3 = coords[ci + 4], y3 = coords[ci + 5];
        const [bMinX, bMinY, bMaxX, bMaxY] = cubicBounds(px, py, x1, y1, x2, y2, x3, y3);
        include(bMinX, bMinY);
        include(bMaxX, bMaxY);
        px = x3; py = y3;
        ci += 6;
        break;
      }
      case PATH_Q: {
        const qx1 = coords[ci],     qy1 = coords[ci + 1];
        const qx2 = coords[ci + 2], qy2 = coords[ci + 3];
        const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(px, py, qx1, qy1, qx2, qy2);
        const [bMinX, bMinY, bMaxX, bMaxY] = cubicBounds(px, py, c1x, c1y, c2x, c2y, qx2, qy2);
        include(bMinX, bMinY);
        include(bMaxX, bMaxY);
        px = qx2; py = qy2;
        ci += 4;
        break;
      }
      case PATH_Z:
        break;
      default:
        throw new Error(`boundsOfPath: unknown command ${cmd}`);
    }
  }

  if (!seen) return { kind: 'rect', x: 0, y: 0, width: 0, height: 0 };
  return { kind: 'rect', x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

