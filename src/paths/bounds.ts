/**
 * AABB bounds of a `Path`. Returned as `RectPath` for direct reuse with the
 * rect fast path machinery (selection AABB, area-select intersection).
 *
 * `RectPath` is its own bounds — O(1). For `PolygonPath`, walk every
 * vertex and every bezier control point. Bezier bounds via control points
 * is loose (the tightest cubic bounds requires solving for derivative
 * roots) but always conservative; tightness can be revisited if a
 * consumer hits a real visual bug.
 *
 * Empty paths (no commands) return a zero-size rect anchored at the
 * origin — the convention used elsewhere in the kit for missing geometry.
 */

import {
  PATH_C,
  PATH_L,
  PATH_M,
  PATH_Q,
  PATH_Z,
  type Path,
  type RectPath,
} from './types';

export function boundsOfPath(path: Path): RectPath {
  if (path.kind === 'rect') return path;

  const { commands, coords } = path;
  if (commands.length === 0) {
    return { kind: 'rect', x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let ci = 0;
  let seen = false;

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
        include(coords[ci], coords[ci + 1]);
        ci += 2;
        break;
      }
      case PATH_C: {
        // Loose bound: include both control points and the endpoint.
        include(coords[ci], coords[ci + 1]);
        include(coords[ci + 2], coords[ci + 3]);
        include(coords[ci + 4], coords[ci + 5]);
        ci += 6;
        break;
      }
      case PATH_Q: {
        include(coords[ci], coords[ci + 1]);
        include(coords[ci + 2], coords[ci + 3]);
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
