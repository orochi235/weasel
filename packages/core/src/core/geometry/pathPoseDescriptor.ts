import {
  boxToBox,
  boundsOfPath,
  coordsFrom,
  lerpCorners,
  translatePath,
  transformPath,
  worldCoords,
  type Path,
} from '@weasel-js/geom';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';

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
      const aw = worldCoords(a), bw = worldCoords(b);
      const mid = new Float64Array(aw.length);
      for (let i = 0; i < aw.length; i++) mid[i] = aw[i] + (bw[i] - aw[i]) * t;
      const next = coordsFrom(a.origin, mid);
      const { corners: _a, ...bare } = a;
      const corners = lerpCorners(a.corners, b.corners, t);
      return corners ? { ...bare, coords: next, corners } : { ...bare, coords: next };
    }
    throw new Error('pathPoseDescriptor.lerp: incompatible path shapes');
  },
  // A polygon's axes are its coordinates, so a move needs both ends to have as many points.
  axes: (like) => {
    if (like.kind === 'rect') {
      return {
        count: 4,
        names: ['x', 'y', 'width', 'height'],
        to: (p) => (p.kind === 'rect' ? [p.x, p.y, p.width, p.height] : []),
        from: (a) => ({ kind: 'rect', x: a[0]!, y: a[1]!, width: a[2]!, height: a[3]! }),
        add: (p, d) => (p.kind !== 'rect' ? p : {
          kind: 'rect', x: p.x + d[0]!, y: p.y + d[1]!, width: p.width + d[2]!, height: p.height + d[3]!,
        }),
        write: (p, out, at) => {
          if (p.kind !== 'rect') return;
          out[at] = p.x;
          out[at + 1] = p.y;
          out[at + 2] = p.width;
          out[at + 3] = p.height;
        },
      };
    }
    return {
      count: like.coords.length,
      to: (p) => (p.kind === 'polygon' ? Array.from(worldCoords(p)) : []),
      from: (a) => ({ ...like, coords: coordsFrom(like.origin, a as ArrayLike<number>) }),
      add: (p, d) => {
        if (p.kind !== 'polygon') return p;
        const moved = Float64Array.from(worldCoords(p));
        for (let i = 0; i < moved.length; i++) moved[i]! += d[i]!;
        return { ...like, coords: coordsFrom(like.origin, moved) };
      },
      write: (p, out, at) => {
        if (p.kind !== 'polygon') return;
        const world = worldCoords(p);
        for (let i = 0; i < world.length; i++) out[at + i] = world[i]!;
      },
    };
  },
  // Path poses carry no x/y/width/height/rotation fields — the kit's
  // `wrapWithPoseRotation` helper has nothing to bind a rotation to, and
  // `remapBounds` would drop a synthetic rotation field on every commit.
  // Returning false here hides the rotation affordance for Path consumers
  // so the rotate cursor doesn't appear without a working interaction.
  supportsRotation: () => false,
};
