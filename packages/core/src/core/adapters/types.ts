import type { Op } from '../ops/types';
import type { ParallaxOpts } from '../viewport/parallax';
import type { View } from '../viewport/view';
import type { PoseDescriptor } from '../geometry/poseDescriptor';
import type { Target } from '@weasel-js/animator';
import type { WorldPoint } from '@weasel-js/routing';

/**
 * Opaque clipboard payload: the kit never inspects entries. The adapter both
 * produces snapshots (`snapshotSelection`) and consumes them (`commitPaste`).
 */
export interface ClipboardSnapshot {
  items: unknown[];
}

/**
 * A copied node a paste did not make, and why:
 *
 * - `dependency-not-copied` — it derives from the nodes in `missing`, which
 *   were not copied with it.
 * - `derivation-not-registered` — it derives from other nodes through a
 *   function that did not survive the clipboard and is not in the scene's
 *   registry.
 * - `container-not-pasted` — its container was left out.
 */
export interface PasteOmission {
  /** The id the node had when it was copied. */
  id: string;
  reason: 'dependency-not-copied' | 'derivation-not-registered' | 'container-not-pasted';
  missing?: string[];
}

/** What `commitPaste` is told beyond the snapshot and the offset. */
export interface PasteCtx {
  dropPoint?: WorldPoint;
  /** Called once per copied node the paste leaves out. */
  onOmit?: (omission: PasteOmission) => void;
}

/**
 * Where a dragged node would re-parent to if released. `slotPose` is the pose
 * (in world coordinates) the node should snap to within the target;
 * `metadata` is an opaque pass-through for app-specific snap details.
 */
export interface SnapTarget<TPose = unknown> {
  parentId: string;
  slotPose: TPose;
  metadata?: unknown;
}

/**
 * The contracts below are slices: each names what one reader asks of an
 * adapter. The whole of it, as the kit builds it over a `Scene`, is
 * `SceneCanvasAdapter` (`sceneToAdapter`).
 *
 * **Pose semantics:** `getPose` / `setPose` work in **local** coordinates —
 * relative to the node's direct parent (or world, for root-parented nodes).
 * `getWorldPose`, where an adapter has it, is the composed reading.
 *
 * **Every adapter carries the tree:** `getNode`, `getParent`, and
 * `getChildren`. A list with no nesting is a tree whose nodes are all roots:
 * `getParent` answers `null` and `getChildren(null)` answers every id,
 * bottom first.
 */

/** Narrow adapter for move. Apps without container-snapping leave out `findSnapTarget`. */
export interface MoveAdapter<TNode extends { id: string }, TPose> {
  getNode(id: string): TNode | undefined;
  getNodes(): TNode[];
  getPose(id: string): TPose;
  /** The node's container, `null` for a root. */
  getParent(id: string): string | null;
  /** Optional paint depth, read by `pickTopMostHit` to resolve two *siblings*
   *  whose bodies both cover the pointer. Without it the hit list's own order
   *  decides, which is right for a back-to-front walk and wrong for anything
   *  else. See `PickTopMostHitAdapter` for the `compareZ` alternative. */
  getZIndex?(id: string): number | null | undefined;
  compareZ?(a: string, b: string): number;
  setPose(id: string, pose: TPose): void;
  /** Optional. Used only by reparent ops; an adapter that never reparents may omit. */
  setParent?(id: string, parentId: string | null): void;
  /** Optional. The commit point of a gesture. When omitted, ops are applied
   *  against the adapter one by one; an adapter with a history of its own
   *  takes them here as one entry. */
  applyOps?(ops: Op[], label: string): void;
  /** Optional. Show each node at its pose without writing the document, so
   *  nothing is recorded; `null` withdraws a node's preview. What a behavior
   *  that keeps moving nodes after the gesture ends writes each frame. */
  previewPoses?(poses: ReadonlyMap<string, TPose | null>): void;
  /** Optional. The animation target of node `id`'s pose, the same one on
   *  every call, so everything animating the node adds; `descriptor` supplies
   *  its axes the first time. `tweenPose`, `springPose`, and `momentum` move
   *  it where it is there, and write `setPose` each frame where it is not or
   *  it answers `undefined`. */
  poseTarget?(id: string, descriptor?: PoseDescriptor<TPose>): Target<TPose> | undefined;
  findSnapTarget?(
    draggedId: string,
    worldX: number,
    worldY: number,
  ): SnapTarget<TPose> | null;
  /** Ordered children of `parentId`, `null` for the root siblings, in
   *  z-order: index 0 is the bottom. One contract with
   *  {@link OrderedAdapter.getChildren} — the two land on the same adapter
   *  object. Picking walks it, and the ops read a node's sibling slot from it.
   *  A node with no children answers `[]`. */
  getChildren(parentId: string | null): string[];
  /** Optional: layout strategy attached to a container, or null if the
   *  container uses absolute positioning. When present, a move uses it to
   *  compute drop targets, sibling reflow, and the commit op batch. */
  getLayout?(containerId: string): import('../../layout/types').LayoutStrategy<TPose> | null;
}

/** Narrow adapter for resize. */
export interface ResizeAdapter<
  TNode extends { id: string },
  TPose,
> {
  getNode(id: string): TNode | undefined;
  getPose(id: string): TPose;
  setPose(id: string, pose: TPose): void;
  /** Optional: see MoveAdapter.applyOps. */
  applyOps?(ops: Op[], label: string): void;
}

/** Narrow adapter for rotate, which mutates pose only and never reparents. */
export interface RotateAdapter<
  TNode extends { id: string },
  TPose,
> {
  getNode(id: string): TNode | undefined;
  getPose(id: string): TPose;
  setPose(id: string, pose: TPose): void;
  /** Optional: see MoveAdapter.applyOps. */
  applyOps?(ops: Op[], label: string): void;
}

/** The view a region pick answers for. */
export interface RegionPickView {
  /** The camera the region was drawn under. With it, a node on a parallax
   *  layer is tested where that camera's plane paints it. */
  get?(): View;
  /** Whether that view paints a layer at all. */
  layerIsPainted?(layer: string): boolean;
}

/**
 * Narrow adapter for marquee selection. Transient: no checkpoint, no
 * history — `applyOps(ops)` is called with no label.
 *
 * All fields are **optional**. `useSelectTool` only wires the default marquee
 * behavior when `hitTestArea`, `getSelection`, `setSelection`, and `applyOps`
 * are all present on the adapter; otherwise empty-space drags do nothing.
 */
export interface AreaSelectAdapter {
  /** Returns ids of nodes intersecting the world-space rect, as the view the
   *  rect was drawn in paints them. */
  hitTestArea?(
    rect: { x: number; y: number; width: number; height: number },
    view?: RegionPickView,
  ): string[];
  /** Current selection — read by behaviors to compute additive merges. */
  getSelection?(): string[];
  /** Mutator wired by `setSelection` op. */
  setSelection?(ids: string[]): void;
  /** Apply ops without checkpointing or pushing a history entry. The optional
   *  `label` parameter is accepted (and ignored by transient implementations)
   *  so that this signature is compatible with `MoveAdapter.applyOps`. */
  applyOps?(ops: Op[], label?: string): void;
}

/**
 * Hit mode for `LassoSelectAdapter.hitTestLasso`:
 *   - 'centers'   — the center of the node's visual bounds is inside the polygon.
 *   - 'intersect' — the node's outline meets the polygon anywhere.
 *   - 'enclosed'  — the node's whole outline is inside the polygon.
 *
 * The outline is the drawn silhouette, rotation included.
 */
export type LassoHitMode = 'centers' | 'intersect' | 'enclosed';

/**
 * Narrow adapter for lasso selection: `AreaSelectAdapter` plus a polygon
 * hit-test. `selectFromLasso` does nothing without `hitTestLasso`.
 */
export interface LassoSelectAdapter extends AreaSelectAdapter {
  /** Hit-test against a closed polygon. Vertex order may be CW or CCW; the
   *  closing edge from last → first is implicit. */
  hitTestLasso?(
    polygon: ReadonlyArray<{ x: number; y: number }>,
    mode: LassoHitMode,
    view?: RegionPickView,
  ): string[];
}

/**
 * Narrow adapter for insert and `useClipboardOps`. The kit knows nothing
 * about what shape to construct; it asks the adapter to produce node(s) given
 * gesture or paste inputs, and wraps each in an `InsertOp`.
 */
export interface InsertAdapter<TNode extends { id: string }> {
  getNode(id: string): TNode | undefined;
  getParent(id: string): string | null;
  /** Ordered children of `parentId`, `null` for the root siblings. An insert
   *  resolves its sibling slot against it. */
  getChildren(parentId: string | null): string[];
  /** Materialize a new node from drag-rect bounds (drag-to-insert tools).
   *  Optional: `sceneToAdapter` only fills it in when `options.commitInsert`
   *  is supplied. */
  commitInsert?(bounds: { x: number; y: number; width: number; height: number }): TNode | null;
  /** Materialize the new nodes from a clipboard snapshot, in order.
   *  Optional — required only for paste. */
  commitPaste?(
    clipboard: ClipboardSnapshot,
    offset: { dx: number; dy: number },
    ctx?: PasteCtx,
  ): TNode[];
  /** Snapshot the current selection into the clipboard payload shape.
   *  Optional — required only for copy, cut, and clone's ghost capture. */
  snapshotSelection?(ids: string[]): ClipboardSnapshot;
  getPasteOffset?(clipboard: ClipboardSnapshot): { dx: number; dy: number };
  /** Mutator wired by `insertNode`-using ops (kit-side InsertOp). `index` is
   *  the node's z-position among its siblings. `createDeleteOp` captures it
   *  and `invert()` forwards it, so an implementation that drops it makes
   *  undo of a delete restore the node at the top instead of where it was.
   *  Omit only for an unordered store. */
  insertNode(node: TNode, index?: number): void;
  /** Mutator wired by `setSelection` ops batched alongside paste. */
  setSelection(ids: string[]): void;
  /** Optional: see MoveAdapter.applyOps. */
  applyOps?(ops: Op[], label: string): void;
  /** Returns the current selection. Used by clone behaviors. */
  getSelection(): string[];
}

/**
 * The layer list of an adapter whose nodes sit on layers. The scene slot
 * paints one canvas layer per entry; a pick over a bare adapter reads it for
 * parallax planes where it is there.
 */
export interface LayerEnumerableAdapter<TLayer extends string = string> {
  getLayers?(): readonly { id: TLayer; visible: boolean; parallax?: ParallaxOpts }[];
  /** Call `listener` whenever the list `getLayers` answers may have changed.
   *  A canvas reads the list at mount and again on each call, so an adapter
   *  whose list never changes leaves this out. */
  subscribeLayers?(listener: () => void): () => void;
}

/**
 * Sibling z-order: what the reorder ops read and write.
 *
 * **Convention:** array order IS z-order. Index 0 is the bottom of the
 * stack, the last index is the top. Hit-testing should iterate the returned
 * list in REVERSE (top to bottom). Render layers iterate FORWARD (bottom to
 * top).
 */
export interface OrderedAdapter {
  /** Ordered children of `parentId` (or root siblings if null), in z-order:
   *  index 0 is bottom, last index is top. The same contract
   *  {@link MoveAdapter.getChildren} declares — one method, two readers. */
  getChildren(parentId: string | null): string[];

  /** Rewrite the order of `parentId`'s children. Length and contents must
   *  match the existing children — reorder only, no add/remove. */
  setChildOrder(parentId: string | null, ids: string[]): void;
}
