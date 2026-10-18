/** The `insert` dep over a 3D world: a drag becomes a footprint on the ground. */

import type { InsertDep, InsertEnds, InsertExtras, NodeId } from '@weasel-js/core';
import { intersectRayPlane, pointOnRay, scale as scaleBy, sub, type Vec3 } from '@weasel-js/geom/3d';
import { rayAt, type ViewportSource } from './project';
import { DEFAULT_UP } from './world';

/** The ground-plane rectangle a drag swept out, in world units. */
export interface Footprint {
  /** Centre of the swept rectangle, on the ground plane. */
  center: Vec3;
  /** Extent along the two axes the up axis is not. */
  width: number;
  depth: number;
}

/** The ground points a footprint spans. A drag's two ends are cast rather
 *  than its box's corners: in perspective the other two corners land outside
 *  the rectangle the ends make, and would carry the footprint past a corner
 *  the drag snapped to. */
function footprintPoints(
  bounds: { x: number; y: number; width: number; height: number },
  ends: InsertEnds | undefined,
  cast: (p: { x: number; y: number }) => Vec3 | null,
): Vec3[] {
  if (ends) {
    const start = cast(ends.start);
    const end = cast(ends.end);
    if (!start || !end) return [];
    return ends.fromCenter ? [end, sub(scaleBy(start, 2), end)] : [start, end];
  }
  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  ];
  return corners.map(cast).filter((h): h is Vec3 => h !== null);
}

/**
 * A drag becomes a footprint on the ground plane: its ends, or without them
 * its box's four corners, are cast onto the plane and the hit points give the
 * extent. What node that implies is the consumer's answer — the kernel does
 * not know what it is inserting. The depth the 2D contract cannot express
 * comes from the plane, not from the caller.
 */
export function createInsert(opts: {
  viewport: ViewportSource;
  up?: Vec3;
  /** Smallest footprint a click-sized drag produces. Default 0.25. */
  minExtent?: number;
  mint(footprint: Footprint, extras: InsertExtras): NodeId | null;
}): InsertDep {
  const up = opts.up ?? DEFAULT_UP;
  const minExtent = opts.minExtent ?? 0.25;
  // The two axes the up axis is not, so a footprint reads the same whichever
  // way up the world is.
  const axes: readonly ['x' | 'y' | 'z', 'x' | 'y' | 'z'] =
    up.y !== 0 ? ['x', 'z'] : up.x !== 0 ? ['y', 'z'] : ['x', 'y'];

  return {
    commit(bounds, extras, ends) {
      const vp = opts.viewport();
      const cast = (p: { x: number; y: number }): Vec3 | null => {
        const ray = rayAt(vp, p);
        const t = ray && intersectRayPlane(ray, up, 0);
        return ray && t !== null ? pointOnRay(ray, t) : null;
      };
      const hits = footprintPoints(bounds, ends, cast);
      if (hits.length === 0) return null;

      const [u, v] = axes;
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      for (const h of hits) {
        minU = Math.min(minU, h[u]); maxU = Math.max(maxU, h[u]);
        minV = Math.min(minV, h[v]); maxV = Math.max(maxV, h[v]);
      }

      const center = { x: 0, y: 0, z: 0 };
      center[u] = (minU + maxU) / 2;
      center[v] = (minV + maxV) / 2;
      return opts.mint(
        {
          center,
          width: Math.max(minExtent, maxU - minU),
          depth: Math.max(minExtent, maxV - minV),
        },
        extras,
      );
    },
  };
}
