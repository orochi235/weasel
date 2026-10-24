import type { History, SerializedHistory } from '@weasel-js/history';
import type { SerializedSceneHistory } from './historyForm';
import type { ParallaxOpts } from '../viewport/parallax';
import type { UnitScope } from '@weasel-js/quantity';
import type { LayoutStrategy } from '../../layout/types';
import type { AddLayerSpec, LayerRecord, SystemLayerRecord, SystemLayerSpec, UserLayerRecord } from './layerTypes';
import type { LayoutFrame, LayoutMove } from './layoutTypes';
import type { PoseComposition } from './composeFrame';
import type { PoseRemoval, PoseWrite, PoseWriteOrigin, RemovedNode, ScenePoseReports } from './poseWrites';
import type { PoseHold, PoseOverride, PoseOverrides } from './poseOverrideTypes';
import type { SceneChanges } from './sceneChanges';
import type {
  SerializedLayer, SerializedNode, SerializedNodeV1, SerializedScene, SerializedSceneV1,
} from './serializedTypes';
import type { UseSceneOptions } from './useSceneOptions';
import type { SceneDocValues } from './docValues';
import type { SceneEditPasses } from './editPass';
import type { SceneArrivalHandler } from './arrivalTypes';
import type { RegisteredOp } from './registeredOp';
import type { SpecsFromSerializedOptions } from './serialization';
import type { RectPose } from '../geometry/rectPose';
export type { RectPose, RegisteredOp, SceneArrivalHandler, UseSceneOptions };
export type { AddLayerSpec, LayerRecord, SystemLayerRecord, SystemLayerSpec, UserLayerRecord };
export type { PoseRemoval, PoseWrite, PoseWriteOrigin, RemovedNode, ScenePoseReports };
export type { LayoutFrame, LayoutMove, PoseHold, PoseOverride, PoseOverrides, SerializedLayer, SerializedNode, SerializedNodeV1, SerializedScene, SerializedSceneV1 };

/**
 * # SceneNode — the thing in the scene
 *
 * Everything the user sees on the canvas — a shape, a group, an annotation,
 * a tile — is a node. Marks and groups are both nodes; the kit has no
 * other concept of "scene element."
 *
 * Every node carries three independent slots, plus its tree position:
 *
 *   - **`data: TData`** — app-defined payload. The kit never inspects it.
 *   - **`pose: TPose`** — local transform, relative to the node's direct
 *     parent (or world, for root nodes).
 *   - **`layer: TLayer`** — a string tag associating the node with a
 *     visual `RenderLayer` at draw time. Separate from `LayerRecord` (the
 *     per-layer visible/locked metadata held by the `Scene`).
 *
 * Nodes are addressed by `NodeId` everywhere outside the scene tree. Don't
 * hold references to a `Node` object across scene updates; look up by id
 * when you need the latest.
 *
 * The kit-internal name is `Node`; the public re-export is `SceneNode`
 * (avoids collision with DOM `Node` at call sites).
 */

/** Opaque branded id. Treat as opaque outside the kit. */
import type { NodeId } from '@weasel-js/routing';
export type { NodeId };

/** Brand a string as a NodeId. */
export const asNodeId = (s: string): NodeId => s as NodeId;

import type { DerivedDep, Bivariant, DerivePathFn, DerivePoseFn, ClipFromPoseFn, CopiesFromPoseFn } from './nodeFnTypes';
export type { DerivedDep, Bivariant, DerivePathFn, DerivePoseFn, ClipFromPoseFn, CopiesFromPoseFn };

/** A clip a node declares by name rather than by function: see `SceneNode.clip`. */
export type NodeClip = 'outline';

interface NodeBase<TData, TLayer extends string, TPose> {
  id: NodeId;
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent: NodeId | null;
  /** Nodes whose poses this node's geometry is computed from. Fixed at add
   *  time. Absent or empty means the node's geometry is authored, which is the
   *  normal case.
   *
   *  `'children'` means "my own children, in child order" — a container that
   *  hugs its contents, which a fixed id list cannot express because
   *  reparenting would have to maintain it. The two forms differ in lifetime
   *  as well as in membership: deleting a node deletes everything that names
   *  it in `dependsOn`, but a container outlives the children it derives
   *  from — an emptied group is still a group. */
  dependsOn?: readonly NodeId[] | 'children';
  /** Whether the hit-test walk can return this node. Default `true`; `false`
   *  makes it transparent to picking, so a click on it lands on whatever is
   *  behind — normally its own container.
   *
   *  For content a container owns rather than content the user selects on its
   *  own: the label inside a box, a body's rows. It does not hide the node
   *  from anything else — it still paints, still clips, and a consumer can
   *  still select it by id. */
  pickable?: boolean;
  /** Not drawn, with its whole subtree: picking, area selection, select-all,
   *  snapping and the selection pass over it, and an SVG export writes it with
   *  `display="none"`. Absent means shown; `Scene.isHidden` folds in its
   *  ancestors' flags and its layer's visibility. */
  hidden?: boolean;
  /** Out of reach, with its whole subtree: still drawn, but picking and area
   *  selection pass over it, the selection drops it, and every edit to it
   *  throws, as on a locked layer. Absent means unlocked; `Scene.isLocked`
   *  folds in its ancestors' and its layer's. */
  locked?: boolean;
  /** Computes this node's path from its dependencies, in `dependsOn` order —
   *  each one the node and the pose it is painted at.
   *  A dependency that has been removed arrives as `undefined`.
   *  Returning `null` means "nothing to draw right now". Re-evaluated when a
   *  dependency's world pose changes, never authored. */
  derivePath?: DerivePathFn<TPose, TData, TLayer>;
  /** Computes this node's pose from its dependencies' poses, the same way
   *  `derivePath` computes its path — same `dependsOn` list, same
   *  registry-keyed serialization.
   *
   *  Where a derived path is resolved at paint time and reaches only the
   *  painter, a derived pose is what the node *is* at: it feeds bounds,
   *  hit-testing, selection chrome, snapping and layout, and every reader
   *  gets it through `effectivePose`. A pose override still wins over it.
   *
   *  Returning `null` means "I have nothing to derive from right now", and
   *  the node falls back to its authored `pose`. `setPose` on a derived node
   *  still writes that authored pose; it is simply not what anything reads. */
  derivePose?: DerivePoseFn<TPose, TData, TLayer>;
  /** Ordered child ids. Absent until the node gets its first child. */
  children?: NodeId[];
  /** Optional clip-path source. Re-evaluated each render. Returning `null`
   *  means "no clip for this node right now"; an empty / zero-area path
   *  means "clip everything out" (children render nowhere). Wins over `clip`. */
  clipFromPose?: ClipFromPoseFn<TPose>;
  /** `'outline'` clips the children to this node's own outline: a mark's
   *  painter silhouette, or for a group the silhouette of its `data.path`.
   *  Absent, and with no `clipFromPose`, the children are not clipped. */
  clip?: NodeClip;
  /** Draws the whole subtree again under each affine it returns, on top of
   *  the original, which still draws once as authored. The copies are paint,
   *  not nodes: nothing stores them, so they follow every edit to the
   *  children, and a pick that lands on one answers with the child it copies.
   *  A copy is a copy of the clipped content — the clip travels with it.
   *  Re-evaluated each render; `null` or `[]` draws no copies. */
  copiesFromPose?: CopiesFromPoseFn<TPose, TData, TLayer>;
  /** How this node arranges its children. Whenever the node's
   *  child set or order changes, its bounds change size, or a child's pose is
   *  written, the scene hands the change to the strategy — `depart` for children that left it,
   *  `arrive` for children that joined it, `childPoses` otherwise — and records the poses it writes in the same
   *  undo entry as the change. A drag reads it too: it is the layout `move`
   *  reflows and drops against. */
  layout?: LayoutStrategy<TPose>;
  /** The units its children are shown, typed and snapped in (their poses stay
   *  in world units), and what one base unit is worth in the enclosing scope's.
   *  It covers the children, not the node; `sceneUnitScopes` reads the chain. */
  units?: UnitScope;
}

/** A node that is drawn and picked as one thing — a shape, a label, an image.
 *  It may still hold children, which are what it is made of. */
export interface MarkNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'mark';
}

/** A node the user gathers things into: what Cmd+G creates, what SVG `<g>`
 *  round-trips to. An emptied group is still a group. */
export interface GroupNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'group';
}

/** A node in the scene tree: either a mark or a group. Re-exported
 *  publicly as `SceneNode`, to avoid colliding with the DOM's `Node`. */
export type Node<TData, TLayer extends string, TPose = RectPose> =
  | MarkNode<TData, TLayer, TPose>
  | GroupNode<TData, TLayer, TPose>;

/** What `Scene.add` needs to mint a node. Everything except the id is
 *  required; the id is generated unless one is supplied. */
export interface AddNodeSpec<TData, TLayer extends string, TPose = RectPose> {
  kind: 'mark' | 'group';
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent?: NodeId | null;
  index?: number;
  /** Explicit id wins over the Scene's `generateId` and the kit default. */
  id?: NodeId;
  /** Mirrors `SceneNode.pickable`. Omit for the default, which is pickable. */
  pickable?: boolean;
  /** Mirrors `SceneNode.hidden`. */
  hidden?: boolean;
  /** Mirrors `SceneNode.locked`. */
  locked?: boolean;
  /** Attach a clip-path function to the node; mirrors `SceneNode.clipFromPose`. */
  clipFromPose?: ClipFromPoseFn<TPose>;
  /** Mirrors `SceneNode.clip`. */
  clip?: NodeClip;
  /** Mirrors `SceneNode.copiesFromPose`. */
  copiesFromPose?: CopiesFromPoseFn<TPose, TData, TLayer>;
  /** Mirrors `SceneNode.dependsOn`. */
  dependsOn?: readonly NodeId[] | 'children';
  /** Mirrors `SceneNode.derivePath`. Taken as a live function; its registry key is
   *  looked up from it, never passed in. */
  derivePath?: DerivePathFn<TPose, TData, TLayer>;
  /** Mirrors `SceneNode.derivePose`, on the same terms as `derivePath`. */
  derivePose?: DerivePoseFn<TPose, TData, TLayer>;
  /** Mirrors `SceneNode.layout`. */
  layout?: LayoutStrategy<TPose>;
  /** Mirrors `SceneNode.units`. */
  units?: UnitScope;
}

/** Per-scene registry mapping string keys to live function references.
 *  Passed to `createScene({ ..., registry })` and `sceneFromJSON(json, { registry })`.
 *  Each function-field type has its own keyed map. */
export interface SceneRegistry<TPose, TData = unknown, TLayer extends string = string> {
  /** Maps registry keys to `clipFromPose` factory functions for nodes. */
  clipFromPose?: Readonly<Record<string, ClipFromPoseFn<TPose>>>;
  /** Maps registry keys to `copiesFromPose` functions for nodes. */
  copiesFromPose?: Readonly<Record<string, CopiesFromPoseFn<TPose, TData, TLayer>>>;
  /** Maps registry keys to `derivePath` functions for nodes with `dependsOn`. */
  derivePath?: Readonly<Record<string, DerivePathFn<TPose, TData, TLayer>>>;
  /** Maps registry keys to `derivePose` functions for nodes with `dependsOn`. */
  derivePose?: Readonly<Record<string, DerivePoseFn<TPose, TData, TLayer>>>;
  /** Maps registry keys to layout strategies. */
  layout?: Readonly<Record<string, LayoutStrategy<TPose>>>;
  // A new function field is a row in `NODE_FN_FIELDS` (core/scene/nodeFnFields.ts)
  // plus its entry here; the field name is the registry key by construction.
}

/**
 * The kit-owned scene tree: nodes, layers, and the undo history over both.
 *
 * A scene is logical, not visual — it says what exists and where, and nothing
 * about how it is painted. Every mutating method is undoable, and reads are
 * snapshots rather than live views. Nodes are addressed by `NodeId`; hold ids
 * across mutations, not node objects.
 *
 * Three type parameters keep it domain-agnostic: `TData` is the app's payload,
 * which the kit never inspects; `TPose` is the transform shape, `RectPose` by
 * default; `TLayer` is the union of layer names.
 */
export interface Scene<TData, TLayer extends string, TPose = RectPose>
  extends ScenePoseReports<TPose, Node<TData, TLayer, TPose>>, SceneChanges, SceneDocValues, SceneEditPasses {
  // Reads
  readonly nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>;
  readonly roots: readonly NodeId[];
  readonly layers: readonly LayerRecord<TLayer>[];
  /** The registry this scene resolves node functions against — the consumer's
   *  entries over the kit's. */
  readonly registry: SceneRegistry<TPose, TData, TLayer>;
  /** See {@link UseSceneOptions.composition}. */
  readonly composition: PoseComposition<TPose>;
  get(id: NodeId): Node<TData, TLayer, TPose> | undefined;
  /** A token for the node `id` names right now, for telling one node from a
   *  later one that reuses its id. It holds for as long as the node stays in
   *  the scene, whatever edits it takes, and is different every time the id
   *  enters the scene — by `add`, by an undo or redo that brings it back, or
   *  by `loadState`. `undefined` when `id` is not in the scene. Compare tokens
   *  for equality only; their order means nothing. */
  incarnation(id: NodeId): number | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  ancestorsOf(id: NodeId): readonly NodeId[];
  renderOrder(): Iterable<NodeId>;
  /** The same layer-major sequence as {@link Scene.renderOrder}, as the nodes
   *  themselves. Prefer this wherever the ids are only going to be resolved
   *  back to nodes. Cached until a structural edit, so repeat calls hand back
   *  the same array — a snapshot, not a live view, and not yours to mutate. */
  renderOrderNodes(): readonly Node<TData, TLayer, TPose>[];
  /** The nodes on one layer, in render order. Cached alongside
   *  {@link Scene.renderOrderNodes} until a structural edit. A snapshot, not
   *  a live view, and not yours to mutate. An unknown layer id yields an
   *  empty array. */
  nodesOnLayer(layer: TLayer): readonly Node<TData, TLayer, TPose>[];

  /** A fresh id from this scene's `generateId`, or the kit default: the id
   *  `add` would give a spec with none. For code that has to name a node
   *  before it exists, such as one building an insert op. */
  mintId(): NodeId;

  // Mutations (all auto-undoable)
  add(spec: AddNodeSpec<TData, TLayer, TPose>): NodeId;
  /** Delete `id`, its **entire subtree**, and **everything that derives from**
   *  any of those nodes — a node listing one of them in `dependsOn` goes too,
   *  along with its own subtree, transitively. A dependent can live anywhere in
   *  the tree, so this deletes nodes the caller never named and may unlink
   *  several disjoint subtrees at once. Recorded as one undoable step; `undo()`
   *  restores every one of them where it was, child order intact. */
  remove(id: NodeId): void;
  /** {@link remove} over several roots at once, as a **single** undoable step.
   *  Ids resolve against the tree as it stands at the call, so an id that
   *  another one would cascade away is absorbed rather than removed twice —
   *  which is what makes it safe to pass a whole selection. Throws if any id is
   *  not in the scene; an empty list does nothing and records no step. */
  removeMany(ids: readonly NodeId[]): void;
  /** Every node {@link removeMany} would take if given `ids`: each id, its
   *  subtree, everything deriving from any of those, and those nodes' subtrees
   *  in turn. Ids not in the scene come back unchanged.
   *
   *  A set, not a restore order: a dependent can be reached before the parent
   *  it sits under, which is also in the closure. */
  removalClosure(ids: readonly NodeId[]): readonly NodeId[];
  update(id: NodeId, patch: { data: TData }): void;
  setPose(id: NodeId, pose: TPose): void;
  /** Retag `id` to `layer`. On a **container this cascades**: every descendant
   *  is moved to the same layer, recorded as a **single** undo step.
   *
   *  Invariants:
   *  - **Layer floor** — a child may not render below its parent, so retagging
   *    to a layer *below* the node's parent throws. Retagging to the parent's
   *    layer or any higher one is allowed; a node with no parent is
   *    unconstrained.
   *  - **No-op elision** — setting the layer a node already has does nothing
   *    and pushes **no** history entry. */
  setLayer(id: NodeId, layer: TLayer): void;
  /** Point `id` at a different set of dependencies — retargeting an edge's end
   *  onto another node, or switching a container between an id list and
   *  `'children'`. Recorded as one undoable step.
   *
   *  Order is significant: a derivation reads its dependencies positionally,
   *  so `[b, a]` is not `[a, b]`. Ids need not be in the scene — a declared
   *  dependency that appears later invalidates the node when it does, the same
   *  as one declared at `add`. Passing `undefined` drops the declaration, after
   *  which nothing cascades the node away.
   *
   *  **No-op elision** — declaring what the node already declares does nothing
   *  and pushes no history entry. */
  setDependsOn(id: NodeId, dependsOn: readonly NodeId[] | 'children' | undefined): void;
  /** Give container `id` a different layout — a strategy, its key in
   *  `SceneRegistry.layout`, or `null` for none — and re-arrange its children
   *  under it, as one undoable step. Throws for a mark, or a key the registry
   *  does not hold. A registered layout is recorded by its key, so a
   *  serialized history restores it; an unregistered one lives only as long
   *  as the session.
   *
   *  **No-op elision** — setting the layout a container already has does
   *  nothing and pushes no history entry. */
  setLayout(id: NodeId, layout: LayoutStrategy<TPose> | string | null): void;
  /** Reparent `id` under `parent` (or to a root when `parent` is `null`) at
   *  `index` within the new sibling list, appending when `index` is omitted.
   *  Siblings are reindexed. Recorded as one undoable step.
   *
   *  Rejected (throws) when:
   *  - the move would form a **cycle** — `parent` is `id` itself or one of
   *    `id`'s own descendants;
   *  - it would drop `id` **below its new parent's layer** (child may not
   *    render below its parent).
   *
   *  `move(id, null)` — detaching to a root — is always allowed regardless of
   *  layer, since a root has no parent to render beneath. */
  move(id: NodeId, parent: NodeId | null, index?: number): void;
  /** Shift `id` to `index` within its **current** parent's child list. Unlike
   *  {@link move}, the parent never changes — only sibling order. */
  reorder(id: NodeId, index: number): void;
  /** Show or hide a layer. Hiding drops its nodes from the selection. */
  setLayerVisible(layer: TLayer, visible: boolean): void;
  /** Lock or unlock a layer. A locked layer still paints, but its nodes are
   *  out of reach: picking and area selection pass over them, the selection
   *  drops them, and every node mutation on them throws. Locking is never
   *  blocked by the lock, and neither are the other layer operations. */
  setLayerLocked(layer: TLayer, locked: boolean): void;
  /** Set or clear (`undefined`) a layer's parallax — see
   *  `LayerRecord.parallax`. Undoable; an animation tweening it writes inside
   *  {@link Scene.untracked} so no frame becomes an undo step. */
  setLayerParallax(layer: TLayer, parallax: ParallaxOpts | undefined): void;
  /** Whether `id` is locked: it or an ancestor carries `locked`, or sits on a
   *  locked layer. A lock covers its whole subtree, whatever layers the
   *  descendants are tagged to. An id not in the scene is not locked. */
  isLocked(id: NodeId): boolean;
  /** Whether `id` is not drawn: its own layer is hidden, or it or an ancestor
   *  carries `hidden`. A hidden layer hides only the nodes tagged to it. An
   *  id not in the scene is not hidden. */
  isHidden(id: NodeId): boolean;
  /** Hide or show node `id` and its subtree — see `SceneNode.hidden`. One
   *  undo step; hiding drops the subtree from the selection. Never blocked by
   *  a lock, and setting what the node already has records nothing. */
  setHidden(id: NodeId, hidden: boolean): void;
  /** Lock or unlock node `id` and its subtree — see `SceneNode.locked`. One
   *  undo step; locking drops the subtree from the selection. Never blocked
   *  by a lock, and setting what the node already has records nothing. */
  setLocked(id: NodeId, locked: boolean): void;
  /** Run `fn` with the lock guard lifted, for a programmatic edit that has to
   *  reach a locked node. Undo and redo never need it. */
  unlocked<T>(fn: () => T): T;
  addLayer(spec: AddLayerSpec<TLayer>): void;
  /** Drop a user layer and every node tagged to it, as one undoable step.
   *  Removal cascades, so this also deletes nodes **on other layers** that
   *  derive from a node on this one. */
  removeLayer(layer: TLayer): void;
  renameLayer(layer: TLayer, name: string): void;
  moveLayer(layer: TLayer, index: number): void;

  // Custom op seam
  registerOp<P>(kind: string, handler: RegisteredOp<P>): void;
  recordOp<P>(op: { kind: string; payload: P }): void;

  /** Install (or clear with `null`) the active-journal accessor after scene
   *  construction, for a journal source built with `scene.history` as a
   *  dependency. Overrides any `getActiveJournal` set in `UseSceneOptions`. */
  setActiveJournalAccessor(
    fn: (() => import('@weasel-js/history').Journal | null) | null,
  ): void;

  /** Install what the scene does when nodes join a container, replacing any
   *  handler installed before; `null` removes it. Returns a function that
   *  removes this handler, and does nothing once another has replaced it.
   *  See {@link SceneArrivalHandler}. */
  setArrivalHandler(handler: SceneArrivalHandler<TPose> | null): () => void;

  /** Apply a batch of ops against `adapter` as one undo entry.
   *
   *  The entry holds the scene writes the ops made, as a direct call records
   *  them, and beside them any op that wrote no scene state, bound to
   *  `adapter`. Undo restores those writes; it does not call an op's
   *  `invert()` or the adapter again. **What an op states is not recorded**:
   *  one applied over a document that already holds its result, as after an
   *  `untracked` preview, records a write from that pose to itself, and undo
   *  goes nowhere. Put the document back first.
   *
   *  The entry lands in the open `batch` when there is one, else on the
   *  active journal, else on the scene's own history, where it can coalesce
   *  under `coalesceWindowMs` with one whose ops' keys match.
   *
   *  Returns false when the arrival handler refused the batch: it is reverted
   *  and unrecorded. Inside `batch` it is true; that batch may still refuse. */
  applyBatch(ops: import('core/ops/types').Op[], label: string, adapter: unknown): boolean;

  // Selection

  /** The transient set of active ids — "operate on these N as a unit".
   *  Shared by every view over this scene unless a view supplies its own
   *  (see `CanvasView.selection`). Not document content: it never appears
   *  in `toJSON`. It does ride on history entries, so undo and redo put
   *  back the selection an edit was made under; changing it is never an
   *  undo step of its own. Removing a node deselects it. */
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;

  // Ephemeral presentation state

  /** Per-node pose / alpha / path / data overrides the render and hit-test paths read
   *  through. Like {@link Scene.getSelection} this is not document content:
   *  writes are never recorded, never serialized, and do not bump
   *  {@link Scene.getVersion}. See {@link PoseOverrides}. */
  readonly overrides: PoseOverrides<TPose, TData>;

  // History
  /** The scene's undo/redo engine, in the shape `@weasel-js/history` defines.
   *  Mutating members route through
   *  the scene's own wrappers, so an undo driven through this bumps
   *  {@link Scene.getVersion} and notifies subscribers exactly as
   *  {@link Scene.undo} does; `getVersion` / `subscribe` on it report the
   *  engine's history version, not the scene's. */
  readonly history: History;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  batch<T>(label: string, fn: () => T, options?: import('./recorder').SceneBatchOptions): T;
  /** The layout group `id` declares, or `null` for a mark or a group with none. */
  layoutOf(id: NodeId): LayoutStrategy<TPose> | null;
  /** Declare the unit scope of container `id`, or clear it with `null`. */
  setUnits(id: NodeId, units: UnitScope | null): void;
  /** Run `fn` with every mutation applied but none recorded — for writes
   *  that are not edits, such as a simulation stepping poses each frame.
   *  Undo and redo move between recorded states and never restore an
   *  untracked write; the next recorded change starts from whatever the
   *  untracked writes left, so undoing it lands there. A `batch` inside
   *  records nothing; inside a `batch`, these writes stay out of its entry.
   *  Notifies once, reverts `fn`'s writes if it throws, and throws on
   *  `applyBatch` and `history.apply` / `applyOps`, which exist to record. */
  untracked<T>(fn: () => T): T;
  /** Read-only snapshot of every history entry currently reachable from
   *  the present state. Oldest applied first, then redoable entries in
   *  the order they'd be re-applied. Each entry id is stable. */
  historyEntries(): readonly { id: string; label: string }[];
  /** Index of the "current state". Equals the count of applied entries;
   *  `0` means "nothing applied" (initial). */
  historyIndex(): number;
  /** Jump to the given history index, clamped to [0, total]. Returns true
   *  if any movement occurred. */
  jumpToHistoryIndex(index: number): boolean;

  // History persistence
  /** Snapshot the undo/redo history in a JSON-serializable form (the
   *  engine's `SerializedHistory`, marked with the scene's recorded form).
   *  An entry holds the scene's own ops, whichever way the edit was made.
   *  An op handed to `applyBatch` that wrote no scene state is held as
   *  itself, and an entry with a nameless one is dropped. Payload
   *  JSON-safety (e.g. typed arrays inside poses) is the caller's concern.
   *  Do not call mid-`batch` — the open batch's ops are not yet recorded. */
  serializeHistory(): SerializedSceneHistory;
  /** Replace the undo/redo history from a `serializeHistory()` snapshot.
   *  Call on a scene whose node/layer state already matches the snapshot's
   *  head state (i.e. right after `loadState` from the paired scene
   *  snapshot); node state is NOT mutated. Ops re-registered via
   *  `registerOp` before this call round-trip; unknown kinds become no-op
   *  placeholders; external ops rebuild via the global op-factory registry
   *  and replay against the `setHistoryAdapter` accessor. Restored entries
   *  never coalesce with new ones. Notifies once. A snapshot that is not in
   *  the current recorded form (see `SCENE_HISTORY_FORM`) is dropped:
   *  the history is left as it was. Do not call mid-`batch`:
   *  the stacks are replaced underneath the open batch, whose eventual
   *  flush would graft onto (and evict against) the restored stacks. */
  restoreHistory(snapshot: SerializedHistory): void;
  /** Install (or clear with `null`) the accessor for the adapter that
   *  RESTORED external ops apply against on undo/redo: the ops handed to
   *  `applyBatch` that wrote no scene state, such as a selection change,
   *  rebuilt from a `restoreHistory` snapshot. Resolved lazily at each
   *  apply, so wiring order relative to `restoreHistory` doesn't matter.
   *  Live `applyBatch` entries are unaffected (they bind their call-site
   *  adapter). If unset when a restored op applies, the op is a debug-warned
   *  no-op. */
  setHistoryAdapter(fn: (() => unknown) | null): void;

  // Serialization
  /** Snapshot the current scene state to a JSON-serializable shape.
   *  History (undo/redo stacks) is NOT captured. Function fields like
   *  `GroupNode.clipFromPose` are translated to string keys via the
   *  scene's registry; throws if any function field has no matching key. */
  toJSON(): SerializedScene<TData, TLayer, TPose>;
  /** Replace this scene's entire node + layer state in place from a snapshot
   *  produced by `toJSON()`. Unlike `sceneFromJSON`, the existing Scene
   *  instance is preserved — holders such as `<SceneCanvas>` keep their
   *  reference. History (undo/redo) is cleared, matching `sceneFromJSON`.
   *  Bumps `getVersion()` and notifies subscribers exactly once. Selected
   *  ids the snapshot does not hold leave the selection, and every pose
   *  override is cleared.
   *
   *  Throws inside any other edit — `batch`, `untracked`, `applyBatch`, an
   *  undo — which would revert to a state this replaces. Throws on an unsupported version or unknown registry/layer ids; on a
   *  malformed snapshot the scene is left empty or partially populated (callers should treat a
   *  `loadState` throw as fatal and reload). Snapshots from `toJSON()` are
   *  always well-formed. `opts` reads the snapshot as `specsFromSerialized` does. */
  loadState(
    json: SerializedScene<TData, TLayer, TPose> | SerializedSceneV1<TData, TLayer, TPose>,
    opts?: SpecsFromSerializedOptions<TData, TLayer, TPose>,
  ): void;

}
