import type { Affine } from '@weasel-js/geom';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { InsertExtras } from './depSchema';

/** The drag an insert's bounds came from, in the same coordinates: `bounds`
 *  is the box `start` and `end` span, or with `fromCenter`, the box centered
 *  on `start` reaching `end`. A host whose bounds lose information on the
 *  way, a 3D one casting them onto a plane, reads the ends instead. */
export interface InsertEnds {
  start: { x: number; y: number };
  end: { x: number; y: number };
  fromCenter?: boolean;
}

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
    /** Absent when no drag made the bounds: a click-place. */
    ends?: InsertEnds,
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

/**
 * What `editAnchorsAction` keeps a path symmetric under. Asked once at the
 * press, with the id of the path being edited; answer every transform of the
 * symmetry group except the identity, in world coordinates. Of those, the
 * ones the path is already its own image under are held through the drag:
 * each image of a dragged anchor or handle follows it, and one a transform
 * fixes stays where that transform allows.
 */
export interface PathSymmetryDep {
  transforms(id: string): readonly Affine[];
}

/** Where the `insert` dep puts what it makes. Read at each insert. A node
 *  goes onto the container's layer, with its pose made local to it when the
 *  scene composes frames; an id naming no container is the same as `null`. */
export interface InsertIntoDep {
  get(): string | null;
}

/** Holder for the insert gesture in flight in one input scope. `gesture` is
 *  `insertAction`'s own state, opaque to everything else, and `null` between
 *  gestures. A source must return the same object on every read. */
export interface InsertLive {
  gesture: unknown;
}
