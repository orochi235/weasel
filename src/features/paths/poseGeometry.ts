import { boundsOfPath } from './bounds';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath } from './types';
import type { PoseGeometry } from '../../interactions/gestures/resize/geometry';
import type { ResizePose } from '../../interactions/gestures/types';

/**
 * `PoseGeometry` for `Path` poses — wires `useResize` to operate
 * on `Path` directly. `getBounds` defers to the same `boundsOfPath` kernel
 * the rest of the kit uses; `remapBounds` does an affine scale of every
 * coord against `src`/`dst`. Degenerate axes (zero src extent) collapse to
 * the new origin so resize from a flat edge doesn't produce NaN.
 *
 * Mirrors `scalePathToBounds` but takes `src` explicitly: the resize hook
 * knows the group's origin AABB and uses it for every leaf, instead of
 * each leaf scaling against its own AABB (which would ignore group context).
 */
export const pathPoseGeometry: PoseGeometry<Path> = {
  getBounds: (path) => boundsOfPath(path),
  remapBounds: (path, src, dst) => {
    const sx = src.width === 0 ? 0 : dst.width / src.width;
    const sy = src.height === 0 ? 0 : dst.height / src.height;
    if (path.kind === 'rect') {
      return {
        kind: 'rect',
        x: dst.x + (path.x - src.x) * sx,
        y: dst.y + (path.y - src.y) * sy,
        width: path.width * sx,
        height: path.height * sy,
      };
    }
    return remapPolygon(path, src, dst, sx, sy);
  },
};

function remapPolygon(path: PolygonPath, src: ResizePose, dst: ResizePose, sx: number, sy: number): PolygonPath {
  const next = new Float32Array(path.coords.length);
  const { commands, coords } = path;
  let ci = 0;
  for (let i = 0; i < commands.length; i++) {
    const len = COORD_COUNT[commands[i]];
    for (let k = 0; k < len; k += 2) {
      next[ci + k] = dst.x + (coords[ci + k] - src.x) * sx;
      next[ci + k + 1] = dst.y + (coords[ci + k + 1] - src.y) * sy;
    }
    ci += len;
  }
  return { kind: 'polygon', commands: path.commands, coords: next, fillRule: path.fillRule };
}

const COORD_COUNT: Readonly<Record<number, number>> = {
  [PATH_M]: 2,
  [PATH_L]: 2,
  [PATH_C]: 6,
  [PATH_Q]: 4,
  [PATH_Z]: 0,
};
