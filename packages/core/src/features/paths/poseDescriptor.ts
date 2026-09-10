import { boxToBox } from '@weasel-js/geom';
import { boundsOfPath } from './bounds';
import { pointInPath } from './hitTest';
import { translatePath } from './transform';
import { transformPath } from './transformPath';
import type { Path } from './types';
import { aabbIntersectsRect, type PoseProjection } from 'interactions/actions/resize/geometry';

/**
 * `PoseProjection` for `Path` poses — wires `useResize` to operate
 * on `Path` directly. `getBounds` defers to the same `boundsOfPath` kernel
 * the rest of the kit uses.
 *
 * `remapBounds` mirrors `scalePathToBounds` but takes `src` explicitly: the
 * resize hook knows the group's origin AABB and uses it for every leaf,
 * instead of each leaf scaling against its own AABB (which would ignore
 * group context).
 */
export const pathPoseDescriptor: PoseProjection<Path> = {
  getBounds: (path) => boundsOfPath(path),
  remapBounds: (path, src, dst) => transformPath(
    path,
    boxToBox(src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height),
  ),
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
