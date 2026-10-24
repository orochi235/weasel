import type { Path } from '@weasel-js/geom';
import type { NodeId } from './types';

/**
 * One node's ephemeral presentation override — what a frame loop wants to say
 * about a node without saying it about the document.
 *
 * Not document content: never recorded in history, never in `toJSON`, and
 * writing one does not bump `Scene.getVersion()`. Hoist one entry per node and
 * mutate it in place on a frame loop; `PoseOverrides.commit()` is what makes a
 * mutation visible.
 */
export interface PoseOverride<TPose, TData = unknown> {
  /** Replaces the node's document pose everywhere the render and hit-test
   *  paths read one, including the clip a container derives from its pose, and
   *  winning over a `derivePose`. Resolved by `effectivePose` — reading
   *  `node.pose` directly is how those paths came to disagree about where a
   *  node is. */
  pose?: TPose;
  /** Multiplied into the node's painted alpha, on top of any `alphaFor`. */
  alpha?: number;
  /** Replaces the geometry the node paints and is picked by: the path in its data, or the one
   *  it derives. It is in the frame a painter draws in, so give `pose` beside it, as the
   *  path's bounds with no rotation, or the pose's turn is applied to the path again and the
   *  selection chrome stays on the old box. A skinned rig is the writer. */
  path?: Path;
  /** The data the node is shown with, from the data it stores — so a recorded write made while it is
   *  installed shows through. Painting, picking, drawn bounds and the effective reading of every
   *  derivation read it through `nodeAsShown`; the document never sees it. Replace the function to
   *  change what it answers: the shown data is kept per stored data and function. A text edit's
   *  drafts and a gesture's `previewData` are the writers. */
  data?(stored: TData): TData;
}

/**
 * The scene's ephemeral per-node overrides — see {@link PoseOverride}.
 *
 * The intended shape of a frame is: `set` each node once, mutate the entries
 * in place per frame, `commit()` once. `commit` is not optional bookkeeping —
 * the painter memo keys on pose *reference*, so a mutation without a commit
 * paints the previous frame with no error.
 *
 * To promote a frame to document state (dropping a drag, baking an animation),
 * write it once through `Scene.setPose` and `clear` the override.
 */
export interface PoseOverrides<TPose, TData = unknown> {
  /** Store `entry` for `id` **by reference**; the caller keeps mutating it. */
  set(id: NodeId, entry: PoseOverride<TPose, TData>): void;
  /** The entry `set` stored, by reference — what a writer checks to know
   *  whether its own entry is still installed. Painting reads `read`. */
  get(id: NodeId): PoseOverride<TPose, TData> | undefined;
  /** What the node is drawn and picked with: every source of overrides for
   *  it folded into one, as of the last write or `commit()`. `undefined` for
   *  a node nothing overrides. The object is reused per node. */
  read(id: NodeId): PoseOverride<TPose, TData> | undefined;
  has(id: NodeId): boolean;
  /** The overridden ids, as a snapshot array. */
  ids(): readonly NodeId[];
  clear(id: NodeId): void;
  clearAll(): void;
  /** Publish this frame's in-place mutations: invalidate the painter memo for
   *  every overridden node, then notify subscribers. */
  commit(): void;
  /** Notified after every write. The canvas uses this to repaint without a
   *  scene version bump. */
  subscribe(fn: () => void): () => void;
  /** Monotonic write counter. A snapshot for observers that poll. */
  getGeneration(): number;
  /** A claim on some nodes' poses for a writer that publishes a whole frame
   *  at a time: a gesture's preview, a layout run. Each call is a new claim. */
  hold(): PoseHold<TPose, TData>;
}

/**
 * One writer's claim on some nodes' pose overrides, from
 * {@link PoseOverrides.hold}.
 *
 * A hold knows which entries are its own, so several writers share the table
 * without clearing each other: a drag and a layout run each publish their
 * frame, and each sees the other's nodes as pinned.
 */
export interface PoseHold<TPose, TData = unknown> {
  /** Publish this frame's poses. It is the whole picture, not a delta: an id
   *  the frame leaves out is released. Subscribers are notified once. */
  set(poses: Iterable<readonly [NodeId, TPose]>): void;
  /** {@link PoseHold.set} for a frame that shows data as well as poses. An id another writer's
   *  entry holds is left to that writer rather than displaced. */
  show(frame: Iterable<readonly [NodeId, Pick<PoseOverride<TPose, TData>, 'pose' | 'data'>]>): void;
  /** The poses other writers are publishing, by id. */
  others(): ReadonlyMap<NodeId, TPose>;
  /** Release every id still held. An id whose entry another writer has since
   *  replaced is left alone: that writer owns it now. When the frame is being
   *  committed to the document, call this after the write lands, or the scene
   *  answers with the old pose in between. */
  drop(): void;
}
