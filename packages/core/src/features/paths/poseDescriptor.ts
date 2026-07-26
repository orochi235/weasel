import { boundsOfPath } from './bounds';
import { pointInPath } from './hitTest';
import { translatePath } from './transform';
import { PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path, type PolygonPath } from './types';
import { aabbIntersectsRect, type PoseProjection } from 'interactions/actions/resize/geometry';
import type { ResizePose } from 'interactions/gestures/types';

/**
 * `PoseProjection` for `Path` poses — wires `useResize` to operate
 * on `Path` directly. `getBounds` defers to the same `boundsOfPath` kernel
 * the rest of the kit uses; `remapBounds` does an affine scale of every
 * coord against `src`/`dst`. Degenerate axes (zero src extent) collapse to
 * the new origin so resize from a flat edge doesn't produce NaN.
 *
 * Mirrors `scalePathToBounds` but takes `src` explicitly: the resize hook
 * knows the group's origin AABB and uses it for every leaf, instead of
 * each leaf scaling against its own AABB (which would ignore group context).
 */
export const pathPoseDescriptor: PoseProjection<Path> = {
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
  translate: (path, dx, dy) => translatePath(path, dx, dy),
  // WHY: AABB pre-test is cheap; only fall through to per-corner pointInPath
  //      when the rect is fully inside the AABB (silhouette test).
  intersectsRect: (path, rect) => {
    const b = boundsOfPath(path);
    if (!aabbIntersectsRect(b, rect)) return false;
    if (path.kind === 'rect') return true;
    // Sample the rect's four corners; any inside the polygon ⇒ overlap.
    if (
      pointInPath(path, rect.x, rect.y) ||
      pointInPath(path, rect.x + rect.width, rect.y) ||
      pointInPath(path, rect.x, rect.y + rect.height) ||
      pointInPath(path, rect.x + rect.width, rect.y + rect.height)
    ) return true;
    // Conservative fallback: AABB overlap counts. Tighter edge-vs-edge test
    // would be the next step; defer until a demo demands it.
    return true;
  },
  lerp: (a, b, t) => {
    if (a.kind === 'rect' && b.kind === 'rect') {
      return {
        kind: 'rect',
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        width: a.width + (b.width - a.width) * t,
        height: a.height + (b.height - a.height) * t,
      };
    }
    if (a.kind === 'polygon' && b.kind === 'polygon' && a.coords.length === b.coords.length) {
      const next = new Float32Array(a.coords.length);
      for (let i = 0; i < a.coords.length; i++) {
        next[i] = a.coords[i] + (b.coords[i] - a.coords[i]) * t;
      }
      return { kind: 'polygon', commands: a.commands, coords: next, fillRule: a.fillRule };
    }
    throw new Error('pathPoseDescriptor.lerp: incompatible path shapes');
  },
  // Path poses carry no x/y/width/height/rotation fields — the kit's
  // `wrapWithPoseRotation` helper has nothing to bind a rotation to, and
  // `remapBounds` would drop a synthetic rotation field on every commit.
  // Returning false here hides the rotation affordance for Path consumers
  // so the rotate cursor doesn't appear without a working interaction.
  supportsRotation: () => false,
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
