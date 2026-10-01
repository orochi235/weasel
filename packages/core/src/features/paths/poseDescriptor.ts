import {
  boxToBox,
  boundsOfPath,
  translatePath,
  transformPath,
  type Path,
} from '@weasel-js/geom';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';

/**
 * `PoseDescriptor` for `Path` poses — wires `useResize` to operate
 * on `Path` directly. `getBounds` defers to the same `boundsOfPath` kernel
 * the rest of the kit uses.
 *
 * `remapBounds` mirrors `scalePathToBounds` but takes `src` explicitly: the
 * resize hook knows the group's origin AABB and uses it for every leaf,
 * instead of each leaf scaling against its own AABB (which would ignore
 * group context).
 */
export const pathPoseDescriptor: PoseDescriptor<Path> = {
  getBounds: (path) => boundsOfPath(path),
  remapBounds: (path, src, dst) => transformPath(
    path,
    boxToBox(src.x, src.y, src.width, src.height, dst.x, dst.y, dst.width, dst.height),
  ),
  fromBounds: (b) => ({ kind: 'rect', x: b.x, y: b.y, width: b.width, height: b.height }),
  translate: (path, dx, dy) => translatePath(path, dx, dy),
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
