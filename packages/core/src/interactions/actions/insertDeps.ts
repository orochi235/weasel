import type { Affine, PolygonPath } from '@weasel-js/geom';
import type { DragSample, WorldPoint } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { CommitSelection } from './defaultCommitAdapter';

/**
 * Per-kind extra geometry passed to `InsertDep.commit`.
 *
 * Built-in tools populate a typed variant so the kit's default factory can
 * render the true tool params (line endpoints, polygon side count, star
 * geometry, pencil sample list). Consumer-defined tools may pass any
 * `{ kind: string; ... }` payload, the binding's `params` as they stand; a
 * kind the kit builds no node for needs an entry in `<SceneCanvas
 * insertNodeFactories>`, or the insert is skipped. The sticky tool's extras are its
 * `StickyStyle` (`stickyNode.ts`) under `kind: 'sticky'`.
 *
 * `bounds` is still passed alongside as a useful AABB pose hint — factories
 * may use it as the node's pose even when richer geometry is available. Any may carry a `minSize`
 * (`{ width, height }`), which the kit's factories keep as `data.minSize` so a resize holds to it, and a `style`
 * (`InsertStyle`), the fill, stroke, and fill rule the kit's factories paint the node with.
 */
export type InsertExtras =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'line'; a: WorldPoint; b: WorldPoint }
  | { kind: 'polygon'; sides: number; rotation: number; center?: WorldPoint; radius?: number }
  | { kind: 'star'; points: number; innerRadiusRatio: number; rotation: number; center?: WorldPoint; outerRadius?: number }
  | { kind: 'pencil'; samples: ReadonlyArray<DragSample> }
  | { kind: 'text'; text?: string }
  /** A finished path in world coords, as the pen tool commits one. `bounds`
   *  is its AABB. An open path takes no fill. `data` is laid under the path
   *  and paint on the node's data: the form the path was drawn from
   *  (`data.representation`), say. */
  | {
      kind: 'path';
      path: PolygonPath;
      closed: boolean;
      data?: Readonly<Record<string, unknown>>;
    }
  | {
      kind: 'image';
      src?: string;
      opacity?: number;
      /** Chrome-only: what the in-flight drag paints. Read by the overlay
       *  layer, ignored by the insert dep. */
      preview?: 'bitmap' | 'outline';
    }
  | { kind: string; [extra: string]: unknown };

/** The gesture an insert's bounds came from, in the same coordinates: `bounds`
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
    /** Absent when no gesture made the bounds: a path the pen or spiro
     *  drew, or content a paste ingests. A click-place reads as a drag out
     *  from its center. */
    ends?: InsertEnds,
    /** The selection change to commit in the same undo entry as the node. A
     *  `commit` that applies ops appends `commitSelectionOps(select, id)` to
     *  them; one that applies none still sets the selection it names. */
    select?: CommitSelection,
  ): NodeId | null;
  /**
   * What `commit` would apply, unapplied: the new node's id and the ops that
   * insert it, for a caller that has more to put in the same undo step. The
   * pen joins two paths this way. Without it such a caller declines.
   */
  build?(
    bounds: { x: number; y: number; width: number; height: number },
    extras: InsertExtras,
    ends?: InsertEnds,
  ): { id: NodeId; ops: Op[] } | null;
  /**
   * The node `build` would insert, made the same way and inserting nothing: no
   * id is minted and nothing counted per insert (the palette's step) advances,
   * so a live preview can ask on every frame. `pose` is the pose the node would
   * be stored at. `null` when `build` would decline, or when the insert makes
   * more than one node. A preview runs the scene's quantize rule over it, so it
   * shows the shape where the release will land it.
   */
  peek?(
    bounds: { x: number; y: number; width: number; height: number },
    extras: InsertExtras,
    ends?: InsertEnds,
  ): { data: unknown; pose: unknown } | null;
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
