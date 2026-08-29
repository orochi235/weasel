import type { Path } from '../geometry/path';
import type { SerializedHistory } from '@weasel-js/history';

/**
 * Axis-aligned rectangle pose with optional rotation. The canonical pose
 * shape used by `composeRectPose` and the `unionBounds` helper. Rotation is
 * in radians, pivoted on the unrotated AABB center; absent === 0. Kit-side
 * code that consumes rotation already reads `pose.rotation ?? 0`
 * (`wrapNodeOutput`, `rotate/handle.ts`, `pathInWorld.ts`), so
 * the slot exists on every default scene whether or not the consumer
 * populates it.
 */
export interface RectPose {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in radians around the unrotated AABB center. Absent === 0. */
  rotation?: number;
}

/**
 * # SceneNode — the thing in the scene
 *
 * A `SceneNode` is the single canonical unit of a weasel scene. Everything
 * the user sees on the canvas — a shape, a group, an annotation, a tile —
 * is one of these. Containers and leaves are both nodes; the kit has no
 * other concept of "scene element."
 *
 * ## Three orthogonal slots
 *
 * Every node carries three independent slots, plus its tree position:
 *
 *   - **`data: TData`** — app-defined payload. The kit never inspects it.
 *     Color, label, kind, glyph, sample-rate, whatever the app's domain
 *     calls for. Mutated via `Scene.update(id, { data })`.
 *
 *   - **`pose: TPose`** — local transform, relative to the node's direct
 *     parent (or world, for root nodes). Default `RectPose` is
 *     `{ x, y, width, height }`, but `TPose` is fully generic so apps can
 *     use rotated rects, paths, ellipses, etc. The kit composes world
 *     poses via `composeWorldPose` when rendering / hit-testing / snapping.
 *
 *   - **`layer: TLayer`** — a string tag associating the node with a
 *     visual `RenderLayer` at draw time. Separate from `LayerRecord` (the
 *     per-layer visible/locked metadata held by the `Scene`).
 *
 * Tree position lives on the node itself: every node has a `parent` (or
 * `null` for roots), and `ContainerNode` adds an ordered `children: NodeId[]`.
 *
 * ## Identity is by `NodeId`, not by reference
 *
 * Nodes are addressed by `NodeId` everywhere outside the scene tree:
 * selection is `NodeId[]`, ops reference `NodeId`s, adapter methods accept
 * `string` ids and look up the node on demand. The `Node` object itself is
 * a snapshot of current state — don't hold references to it across scene
 * updates; look up by id when you need the latest.
 *
 * Picking helpers (`pickBest`, `pickEvery`) likewise return ids, not nodes —
 * they're hit-testing primitives that stay ignorant of node payload shape.
 *
 * ## Vocabulary
 *
 * The kit-internal name is `Node`; the public re-export is `SceneNode`
 * (avoids collision with DOM `Node` at call sites). Adapter methods speak
 * the same vocabulary: `getNode`, `getNodes`, `insertNode`, `removeNode`,
 * `cloneNode`, `addNode`. Older code, demos, and comments may still say
 * "object" or "item" — those are historical aliases for the same concept.
 */

/** Opaque branded id. Treat as opaque outside the kit. */
export type NodeId = string & { readonly __brand: 'NodeId' };

/** Brand a string as a NodeId. */
export const asNodeId = (s: string): NodeId => s as NodeId;

interface NodeBase<TData, TLayer extends string, TPose> {
  id: NodeId;
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent: NodeId | null;
  /** Nodes whose poses this node's geometry is computed from. Fixed at add
   *  time. Absent or empty means the node's geometry is authored, which is the
   *  normal case. */
  dependsOn?: readonly NodeId[];
  /** Computes this node's path from its dependencies' poses, in `dependsOn`
   *  order. A dependency that has been removed arrives as `undefined`.
   *  Returning `null` means "nothing to draw right now". Re-evaluated when a
   *  dependency's world pose changes, never authored. Absolute-pose `Scene`
   *  makes that the dependency's own pose, and an ancestor's move reaches it as
   *  a `setPose` of its own from the container cascade.
   *  `node` is deliberately widened: naming `TData`/`TLayer` here puts them in
   *  a contravariant position, making `Scene` invariant in both and breaking
   *  assignment kit-wide. The cost is that a `derive` casts to read `node.data`. */
  derive?: (
    node: Node<unknown, string, TPose>,
    deps: readonly (TPose | undefined)[],
  ) => Path | null;
}

/** A node with no children — a shape, a label, an image. */
export interface LeafNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'leaf';
}

/** A node with an ordered list of children. This is the real group: what
 *  Cmd+G creates, what SVG `<g>` round-trips to. A container has its own pose,
 *  which its children's poses are relative to, and may optionally clip them. */
export interface ContainerNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'container';
  children: NodeId[];
  /** Optional clip-path source. Re-evaluated each render. Returning `null`
   *  means "no clip for this container right now"; an empty / zero-area path
   *  means "clip everything out" (children render nowhere). When set, the
   *  renderer rasterizes the returned path into the stencil buffer and
   *  paints descendants only where it covers. */
  clipFromPose?: (pose: TPose) => Path | null;
}

/** A node in the scene tree: either a leaf or a container. Re-exported
 *  publicly as `SceneNode`, to avoid colliding with the DOM's `Node`. */
export type Node<TData, TLayer extends string, TPose = RectPose> =
  | LeafNode<TData, TLayer, TPose>
  | ContainerNode<TData, TLayer, TPose>;

interface LayerRecordBase<TLayer extends string> {
  id: TLayer;
  visible: boolean;
  locked: boolean;
}

/** A layer declared when the scene was created. Fixed set, no display name —
 *  these are the kit's own render bands, not something a user manages. */
export interface SystemLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'system';
}

/** A layer the user created and can rename, reorder or delete. */
export interface UserLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'user';
  name: string;
}

/** Per-layer metadata held by the scene: whether it is visible and locked,
 *  and where it sits in the render stack. Distinct from a node's `layer` tag,
 *  which merely names one of these. */
export type LayerRecord<TLayer extends string> =
  | SystemLayerRecord<TLayer>
  | UserLayerRecord<TLayer>;

/** What `Scene.add` needs to mint a node. Everything except the id is
 *  required; the id is generated unless one is supplied. */
export interface AddNodeSpec<TData, TLayer extends string, TPose = RectPose> {
  kind: 'leaf' | 'container';
  layer: TLayer;
  pose: TPose;
  data: TData;
  parent?: NodeId | null;
  index?: number;
  /** Explicit id wins over the Scene's `generateId` and the kit default. */
  id?: NodeId;
  /** Only meaningful when `kind === 'container'`. Attach a clip-path function
   *  to the node; ignored for leaves. Mirrors `ContainerNode.clipFromPose`. */
  clipFromPose?: (pose: TPose) => Path | null;
  /** Mirrors `SceneNode.dependsOn`. */
  dependsOn?: readonly NodeId[];
  /** Mirrors `SceneNode.derive`. Taken as a live function; its registry key is
   *  looked up from it, never passed in. */
  derive?: (
    node: Node<unknown, string, TPose>,
    deps: readonly (TPose | undefined)[],
  ) => Path | null;
}

/** A custom scene mutation registered with `Scene.registerOp`: how to apply
 *  it and how to undo it. The pair is what makes it participate in history. */
export interface RegisteredOp<P> {
  apply: (payload: P) => void;
  revert: (payload: P) => void;
}

/** One of the layers a scene is created with. */
export interface SystemLayerSpec<TLayer extends string> {
  id: TLayer;
  visible?: boolean;
  locked?: boolean;
}

/** Argument to `Scene.addLayer`. Always produces a `UserLayerRecord`
 *  (`kind: 'user'`). */
export interface AddLayerSpec<TLayer extends string> {
  id: TLayer;
  name: string;
  /** Default `true`. */
  visible?: boolean;
  /** Default `false`. */
  locked?: boolean;
  /** Render-stack position. Default: top of stack (highest render index). */
  index?: number;
}

/** JSON-serializable shape of a Scene's current state. Produced by
 *  `scene.toJSON()`; consumed by `sceneFromJSON()`. Function fields
 *  (e.g., `clipFromPose`) appear as string keys (`clipFromPoseKey`) and
 *  are resolved through `SceneRegistry` at load time. */
export interface SerializedScene<TData, TLayer extends string, TPose> {
  version: 1;
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  nodes: readonly SerializedNode<TData, TLayer, TPose>[];
}

/** JSON-serializable shape of a single node. Mirrors `AddNodeSpec` but
 *  with function fields replaced by registry keys. */
export interface SerializedNode<TData, TLayer extends string, TPose> {
  id: string;
  kind: 'leaf' | 'container';
  layer: TLayer;
  pose: TPose;
  data: TData;
  /** Parent id; omitted for roots. */
  parent?: string;
  /** Registry key for the container's clip-path factory.
   *  Containers only; omitted when the container has no clip. */
  clipFromPoseKey?: string;
  /** Ids this node's geometry derives from. Omitted when it derives from nothing. */
  dependsOn?: readonly string[];
  /** Registry key for the node's `derive` function. Omitted when it has none. */
  deriveKey?: string;
  // Future function-field keys (drawOneKey, layoutStrategyKey, etc.) will live
  // here; a third one should be the point this stops being copied per field and
  // becomes one shared registry-keyed-function-field helper.
}

/** Per-scene registry mapping string keys to live function references.
 *  Passed to `createScene({ ..., registry })` and `sceneFromJSON(json, { registry })`.
 *  Each function-field type has its own keyed map. */
export interface SceneRegistry<TPose> {
  /** Maps registry keys to `clipFromPose` factory functions for container nodes. */
  clipFromPose?: Readonly<Record<string, (pose: TPose) => Path | null>>;
  /** Maps registry keys to `derive` functions for nodes with `dependsOn`. */
  derive?: Readonly<Record<string, (
    node: Node<unknown, string, TPose>,
    deps: readonly (TPose | undefined)[],
  ) => Path | null>>;
  // Reserved for future function fields.
}

/** Options for `useScene` — the layers the scene has, what it starts out
 *  holding, and how its history behaves. */
export interface UseSceneOptions<TData, TLayer extends string, TPose = RectPose> {
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  initial?: readonly AddNodeSpec<TData, TLayer, TPose>[];
  ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
  historyLimit?: number;
  /** Window (ms) within which consecutive same-shaped mutations merge into
   *  the previous undo entry (matching per-op coalesce keys — e.g. repeated
   *  `setPose` on the same node, or repeated `applyBatch` calls whose ops
   *  carry matching `coalesceKey` multisets). `0` (default) disables
   *  coalescing: every mutation is a discrete undo entry. Undo of a
   *  coalesced entry returns to the state before the first merged mutation;
   *  redo restores the latest. `scene.batch` entries never coalesce. */
  coalesceWindowMs?: number;
  generateId?: () => NodeId;
  /** Per-scene registry for non-serializable function fields (clipFromPose, etc.).
   *  Required only when serializing/deserializing scenes that use function fields. */
  registry?: SceneRegistry<TPose>;
  /** When supplied, `scene.applyOps(ops, label)` consults this on every call.
   *  If it returns a non-null `Journal`, ops are routed to the journal's
   *  `applyBatch` instead of recording a new parent-history entry. The journal
   *  drives adapter mutation internally (via `op.apply(adapter)`), so the
   *  scene state changes as normal; only the history tracking differs.
   *
   *  The accessor is called on every `applyOps` invocation so the caller can
   *  swap the active journal in and out by updating the closure's reference
   *  (e.g., an app's mode machine holds `let activeJournal: Journal | null`
   *  and the accessor reads that variable).
   *
   *  When the accessor isn't known at scene-construction time (typical for
   *  mode machines that depend on `scene.history`), pass nothing here and
   *  wire it after construction via `scene.setActiveJournalAccessor(fn)`. */
  getActiveJournal?: () => import('@weasel-js/history').Journal | null;
  /** Re-render the host on every scene mutation. Default `true`. Set `false`
   *  when the scene is read by a frame loop rather than by a render — a game
   *  loop, a simulation — and nothing in the host's DOM derives from it.
   *  Read by `useScene`; `createScene` ignores it. */
  subscribe?: boolean;
}

/**
 * One node's ephemeral presentation override — what a frame loop wants to say
 * about a node without saying it about the document.
 *
 * Not document content: never recorded in history, never in `toJSON`, and
 * writing one does not bump `Scene.getVersion()`. Hoist one entry per node and
 * mutate it in place on a frame loop; `PoseOverrides.commit()` is what makes a
 * mutation visible.
 */
export interface PoseOverride<TPose> {
  /** Replaces the node's document pose everywhere the render and hit-test
   *  paths read one, including the clip a container derives from its pose. */
  pose?: TPose;
  /** Multiplied into the node's painted alpha, on top of any `alphaFor`. */
  alpha?: number;
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
export interface PoseOverrides<TPose> {
  /** Store `entry` for `id` **by reference**; the caller keeps mutating it. */
  set(id: NodeId, entry: PoseOverride<TPose>): void;
  get(id: NodeId): PoseOverride<TPose> | undefined;
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
export interface Scene<TData, TLayer extends string, TPose = RectPose> {
  // Reads
  readonly nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>;
  readonly roots: readonly NodeId[];
  readonly layers: readonly LayerRecord<TLayer>[];
  get(id: NodeId): Node<TData, TLayer, TPose> | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  ancestorsOf(id: NodeId): readonly NodeId[];
  renderOrder(): Iterable<NodeId>;
  /** The same layer-major sequence as {@link Scene.renderOrder}, as the nodes
   *  themselves. Prefer this wherever the ids are only going to be resolved
   *  back to nodes: the traversal already holds them, and re-looking each one
   *  up was ~40% of the area hit-test's per-node cost. Cached until a
   *  structural edit, so repeat calls hand back the same array — a snapshot,
   *  not a live view, and not yours to mutate. */
  renderOrderNodes(): readonly Node<TData, TLayer, TPose>[];

  // Mutations (all auto-undoable)
  add(spec: AddNodeSpec<TData, TLayer, TPose>): NodeId;
  /** Delete `id` **and its entire subtree** — every descendant is removed in
   *  the same operation. Recorded as one undoable step; `undo()` restores the
   *  whole subtree (root + descendants, child order intact). */
  remove(id: NodeId): void;
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
  /** Reparent `id` under `parent` (or to a root when `parent` is `null`) at
   *  `index` within the new sibling list, appending when `index` is omitted.
   *  Siblings are reindexed. Recorded as one undoable step.
   *
   *  Rejected (throws) when:
   *  - `parent` exists but is a **leaf**, not a container;
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
  setLayerVisible(layer: TLayer, visible: boolean): void;
  setLayerLocked(layer: TLayer, locked: boolean): void;
  addLayer(spec: AddLayerSpec<TLayer>): void;
  removeLayer(layer: TLayer): void;
  renameLayer(layer: TLayer, name: string): void;
  moveLayer(layer: TLayer, index: number): void;

  // Custom op seam
  registerOp<P>(kind: string, handler: RegisteredOp<P>): void;
  recordOp<P>(op: { kind: string; payload: P }): void;

  /** Install (or clear) the active-journal accessor after scene construction.
   *  Useful when the journal source (typically a mode machine) is built
   *  with `scene.history` as a dependency — a chicken-and-egg situation
   *  where the accessor can't be passed in via `UseSceneOptions`.
   *
   *  Pass `null` to detach. Overrides any `getActiveJournal` set in
   *  `UseSceneOptions`. */
  setActiveJournalAccessor(
    fn: (() => import('@weasel-js/history').Journal | null) | null,
  ): void;

  /** Apply a batch of ops with journal-aware routing.
   *
   *  - **Without active journal** (or no `getActiveJournal` in options):
   *    the ops themselves are recorded as one undo entry on the scene's own
   *    history, rebound to `adapter` — undo replays each op's `invert()`
   *    against that same adapter. Consecutive `applyBatch` entries can
   *    coalesce via matching op `coalesceKey`s when the scene opts into
   *    `coalesceWindowMs`.
   *  - **With active journal**: routes ops to `journal.applyBatch(ops, label)`.
   *    The scene's history recording is suppressed for the duration so the
   *    journal's inner history — not the scene's undo stack — tracks the batch.
   *    Mutations still happen on `adapter` / scene state.
   *
   *  `adapter` must be the same adapter the ops expect (typically a
   *  `SceneCanvasAdapter`). Pass `this` from `sceneToAdapter` or a compatible
   *  adapter. */
  applyBatch(ops: import('core/ops/types').Op[], label: string, adapter: unknown): void;

  // Selection

  /** The transient set of active ids — "operate on these N as a unit".
   *  Shared by every view over this scene unless a view supplies its own
   *  (see `CanvasView.selection`). Not document content: it never appears
   *  in `toJSON`. It does ride on history entries, so undo and redo put
   *  back the selection an edit was made under; changing it is never an
   *  undo step of its own. */
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;

  // Ephemeral presentation state

  /** Per-node pose / alpha overrides the render and hit-test paths read
   *  through. Like {@link Scene.getSelection} this is not document content:
   *  writes are never recorded, never serialized, and do not bump
   *  {@link Scene.getVersion}. See {@link PoseOverrides}. */
  readonly overrides: PoseOverrides<TPose>;

  // History
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  batch<T>(label: string, fn: () => T): T;
  /** Read-only snapshot of every history entry currently reachable from
   *  the present state. Oldest applied first, then redoable entries in
   *  the order they'd be re-applied. Each entry id is stable. */
  historyEntries(): readonly { id: string; label: string }[];
  /** Index of the "current state". Equals the count of applied entries;
   *  `0` means "nothing applied" (initial). */
  historyIndex(): number;
  /** Jump to the given history index by calling undo/redo repeatedly.
   *  Clamps to [0, total]. Returns true if any movement occurred. */
  jumpToHistoryIndex(index: number): boolean;

  // History persistence
  /** Snapshot the undo/redo history in a JSON-serializable form (the
   *  engine's `SerializedHistory`). Entries containing any nameless op are
   *  dropped (hand-rolled anonymous ops passed to `applyBatch`); kit and
   *  consumer-registered ops always carry names. Payload JSON-safety
   *  (e.g. typed arrays inside poses) is the caller's concern. Do not call
   *  mid-`batch` — the open batch's ops are not yet recorded. */
  serializeHistory(): SerializedHistory;
  /** Replace the undo/redo history from a `serializeHistory()` snapshot.
   *  Call on a scene whose node/layer state already matches the snapshot's
   *  head state (i.e. right after `loadState` from the paired scene
   *  snapshot); node state is NOT mutated. Ops re-registered via
   *  `registerOp` before this call round-trip; unknown kinds become no-op
   *  placeholders; external ops rebuild via the global op-factory registry
   *  and replay against the `setHistoryAdapter` accessor. Restored entries
   *  never coalesce with new ones. Notifies once. Do not call mid-`batch`:
   *  the stacks are replaced underneath the open batch, whose eventual
   *  flush would graft onto (and evict against) the restored stacks. */
  restoreHistory(snapshot: SerializedHistory): void;
  /** Install (or clear with `null`) the accessor for the adapter that
   *  RESTORED external ops (recorded via `applyBatch`, rebuilt from a
   *  `restoreHistory` snapshot) apply against on undo/redo. Resolved lazily
   *  at each apply, so wiring order relative to `restoreHistory` doesn't
   *  matter. Live `applyBatch` entries are unaffected (they bind their
   *  call-site adapter). If unset when a restored op applies, the op is a
   *  debug-warned no-op. */
  setHistoryAdapter(fn: (() => unknown) | null): void;

  // Serialization
  /** Snapshot the current scene state to a JSON-serializable shape.
   *  History (undo/redo stacks) is NOT captured. Function fields like
   *  `ContainerNode.clipFromPose` are translated to string keys via the
   *  scene's registry; throws if any function field has no matching key. */
  toJSON(): SerializedScene<TData, TLayer, TPose>;
  /** Replace this scene's entire node + layer state in place from a snapshot
   *  produced by `toJSON()`. Unlike `sceneFromJSON`, the existing Scene
   *  instance is preserved — holders such as `<SceneCanvas>` keep their
   *  reference. History (undo/redo) is cleared, matching `sceneFromJSON`.
   *  Bumps `getVersion()` and notifies subscribers exactly once.
   *
   *  Throws on an unsupported version or unknown registry/layer ids; on a
   *  malformed snapshot the scene is left empty or partially populated (callers should treat a
   *  `loadState` throw as fatal and reload). Snapshots from `toJSON()` are
   *  always well-formed. */
  loadState(json: SerializedScene<TData, TLayer, TPose>): void;

  // Subscription (used by useScene; also for non-React observers)
  subscribe(listener: () => void): () => void;
  /** Monotonically increasing version. Snapshot for `useSyncExternalStore`. */
  getVersion(): number;
}
