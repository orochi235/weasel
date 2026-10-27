import { cubicBounds, elevateQuadraticToCubic } from '../curve';
import { forEachSegment, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z } from '../commands';
import type { Path, RectPath } from '../path';
import { resolveCorners } from './corners';

/**
 * AABB of a `Path`, returned as a `RectPath` for direct reuse with rect-fast-path machinery.
 * Control points are NOT included directly; they're used only to compute extrema that actually
 * lie on the curve. Corner shapes are bounded as they are drawn, expanded. Empty paths (no commands) return a zero-size rect anchored at the origin.
 */
export function boundsOfPath(path: Path): RectPath {
  if (path.kind === 'rect') return path;

  const { commands, coords } = resolveCorners(path);
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
  return {
    kind: 'rect', x: minX + (path.origin?.x ?? 0), y: minY + (path.origin?.y ?? 0),
    width: maxX - minX, height: maxY - minY,
  };
}

