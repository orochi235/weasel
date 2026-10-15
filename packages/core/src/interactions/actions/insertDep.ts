import type { PolygonPath, SpiroPoint } from '@weasel-js/geom';
import type { DragSample } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

/**
 * Per-kind extra geometry passed to `InsertDep.commit`.
 *
 * Built-in tools populate a typed variant so the kit's default factory can
 * render the true tool params (line endpoints, polygon side count, star
 * geometry, pencil sample list). Consumer-defined tools may pass any
 * `{ kind: string; ... }` payload; the kit's factory falls back to AABB
 * inscription for unknown kinds.
 *
 * `bounds` is still passed alongside as a useful AABB pose hint — factories
 * may use it as the node's pose even when richer geometry is available.
 */
export type InsertExtras =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'line'; a: { x: number; y: number }; b: { x: number; y: number } }
  | { kind: 'polygon'; sides: number; rotation: number; center?: { x: number; y: number }; radius?: number }
  | { kind: 'star'; points: number; innerRadiusRatio: number; rotation: number; center?: { x: number; y: number }; outerRadius?: number }
  | { kind: 'pencil'; samples: ReadonlyArray<DragSample> }
  | { kind: 'text'; text?: string }
  /** A finished path in world coords, as the pen tool commits one. `bounds`
   *  is its AABB. An open path takes no fill. */
  | { kind: 'path'; path: PolygonPath; closed: boolean }
  /** A spiro curve through `points`, as the spiro tool commits one. The kit
   *  solves it into `data.path` and records the points in `data.spiro`. An
   *  open curve takes no fill. */
  | { kind: 'spiro'; points: SpiroPoint[]; closed: boolean }
  | {
      kind: 'image';
      src?: string;
      opacity?: number;
      /** Chrome-only: what the in-flight drag paints. Read by the overlay
       *  layer, ignored by the insert dep. */
      preview?: 'bitmap' | 'outline';
    }
  | { kind: string; [extra: string]: unknown };

/** Adapter dep for `insertAction`. The `extras` carry the active tool's kind
 *  + per-kind geometry. */
export interface InsertDep {
  /**
   * Materialise a new node from the given drag-rect bounds and typed
   * per-kind extras. Returns the new node's id, or `null` if the consumer
   * rejected the insert (e.g. sub-threshold bounds, unknown kind).
   */
  commit(
    bounds: { x: number; y: number; width: number; height: number },
    extras: InsertExtras,
  ): NodeId | null;
  /**
   * What `commit` would apply, unapplied: the new node's id and the ops that
   * insert it, for a caller that has more to put in the same undo step. The
   * pen joins two paths this way. Without it such a caller declines.
   */
  build?(
    bounds: { x: number; y: number; width: number; height: number },
    extras: InsertExtras,
  ): { id: NodeId; ops: Op[] } | null;
  /** The scene layer `commit` puts the node on. An insert on a layer carrying
   *  `parallax` is dragged out in that plane's world, so `bounds` arrive
   *  there too. Omitted: the camera's world. */
  layer?(): string;
}

/** Holder for the insert gesture in flight in one input scope. `gesture` is
 *  `insertAction`'s own state, opaque to everything else, and `null` between
 *  gestures. A source must return the same object on every read. */
export interface InsertLive {
  gesture: unknown;
}
