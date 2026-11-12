/** The `insert` dep over a 3D world: a drag becomes a footprint on the ground. */

import type { InsertDep, InsertEnds, InsertExtras, CommitSelection } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/routing';
import { scale as scaleBy, sub, type Vec3 } from '@weasel-js/geom/3d';
import { groundAxes, groundHit } from './ground';
import type { ViewportSource } from './project';
import { DEFAULT_UP, type World3d } from './world';

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
  const hits: Vec3[] = [];
  for (const corner of corners) {
    const hit = cast(corner);
    if (!hit) return [];
    hits.push(hit);
  }
  return hits;
}

/** Options for `createInsert`: where it casts from, as a world or as its parts. */
export type InsertOptions = InsertCommon & (
  | {
    /** The world the other deps were built from: its viewport, and the up its snap and camera turn about. */
    world: Pick<World3d<unknown, string>, 'viewport' | 'up'>;
    viewport?: never;
    up?: never;
  }
  | {
    /** @deprecated Pass `world`, whose `viewport` this is: `up` then comes from the same place as every other
     *  dep's. */
    viewport: ViewportSource;
    /** @deprecated Pass `world`: a second `up` beside `World3d.up` can disagree with it. Default +y. */
    up?: Vec3;
    world?: never;
  }
);

interface InsertCommon {
  /** The view whose camera a drag is cast through, for a `<CanvasView deps>` of its own. Default the surface's. */
  viewId?: string | null;
  /** Smallest footprint a click-sized drag produces. Default 0.25. */
  minExtent?: number;
  /** Makes the node. Given `select`, it commits that selection change with the
   *  node, in the same batch when it applies ops (`commitSelectionOps`). */
  mint(footprint: Footprint, extras: InsertExtras, select?: CommitSelection): NodeId | null;
}

/**
 * A drag becomes a footprint on the ground plane: its ends, or without them
 * its box's four corners, are cast onto the plane and the hit points give the
 * extent. One that misses the plane, past the horizon, declines the insert. What node that implies is the consumer's answer — the kernel does
 * not know what it is inserting. The depth the 2D contract cannot express
 * comes from the plane, not from the caller.
 */
export function createInsert(opts: InsertOptions): InsertDep {
  const { viewport, up = DEFAULT_UP } = opts.world ?? { viewport: opts.viewport!, up: opts.up };
  const minExtent = opts.minExtent ?? 0.25;
  const { u, v } = groundAxes(up);

  return {
    commit(bounds, extras, ends, select) {
      const vp = viewport(opts.viewId);
      const hits = footprintPoints(bounds, ends, (p) => groundHit(vp, p, up));
      if (hits.length === 0) return null;

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
        select,
      );
    },
  };
}
