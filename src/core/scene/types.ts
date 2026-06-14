import type { RectPose } from 'features/groups/composePose';
import type { Path } from 'features/paths/types';

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
}

export interface LeafNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'leaf';
}

export interface ContainerNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'container';
  children: NodeId[];
  /** Optional clip-path source. Re-evaluated each render. Returning `null`
   *  means "no clip for this container right now"; an empty / zero-area path
   *  means "clip everything out" (children render nowhere). When set, the
   *  renderer rasterizes the returned path into the stencil buffer and
   *  paints descendants only where it covers. Phase 2 of nested clipping. */
  clipFromPose?: (pose: TPose) => Path | null;
}

export type Node<TData, TLayer extends string, TPose = RectPose> =
  | LeafNode<TData, TLayer, TPose>
  | ContainerNode<TData, TLayer, TPose>;

interface LayerRecordBase<TLayer extends string> {
  id: TLayer;
  visible: boolean;
  locked: boolean;
}

export interface SystemLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'system';
}

export interface UserLayerRecord<TLayer extends string>
  extends LayerRecordBase<TLayer> {
  kind: 'user';
  name: string;
}

export type LayerRecord<TLayer extends string> =
  | SystemLayerRecord<TLayer>
  | UserLayerRecord<TLayer>;

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
}

export interface RegisteredOp<P> {
  apply: (payload: P) => void;
  revert: (payload: P) => void;
}

export interface SystemLayerSpec<TLayer extends string> {
  id: TLayer;
  visible?: boolean;
  locked?: boolean;
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
  // Future function-field keys (drawOneKey, layoutStrategyKey, etc.) will live here.
}

/** Per-scene registry mapping string keys to live function references.
 *  Passed to `createScene({ ..., registry })` and `sceneFromJSON(json, { registry })`.
 *  Each function-field type has its own keyed map. */
export interface SceneRegistry<TPose> {
  /** Maps registry keys to `clipFromPose` factory functions for container nodes. */
  clipFromPose?: Readonly<Record<string, (pose: TPose) => Path | null>>;
  // Reserved for future function fields.
}

export interface UseSceneOptions<TData, TLayer extends string, TPose = RectPose> {
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  initial?: readonly AddNodeSpec<TData, TLayer, TPose>[];
  ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
  historyLimit?: number;
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
}

export interface Scene<TData, TLayer extends string, TPose = RectPose> {
  // Reads
  readonly nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>;
  readonly roots: readonly NodeId[];
  readonly layers: readonly LayerRecord<TLayer>[];
  get(id: NodeId): Node<TData, TLayer, TPose> | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  ancestorsOf(id: NodeId): readonly NodeId[];
  renderOrder(): Iterable<NodeId>;

  // Mutations (all auto-undoable)
  add(spec: AddNodeSpec<TData, TLayer, TPose>): NodeId;
  remove(id: NodeId): void;
  update(id: NodeId, patch: { data: TData }): void;
  setPose(id: NodeId, pose: TPose): void;
  setLayer(id: NodeId, layer: TLayer): void;
  move(id: NodeId, parent: NodeId | null, index?: number): void;
  reorder(id: NodeId, index: number): void;
  setLayerVisible(layer: TLayer, visible: boolean): void;
  setLayerLocked(layer: TLayer, locked: boolean): void;

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
   *    equivalent to `scene.batch(label, () => ops.forEach(op => op.apply(adapter)))`.
   *    Records one undo entry on the scene's own history.
   *  - **With active journal**: routes ops to `journal.applyBatch(ops, label)`.
   *    The scene's history recording is suppressed for the duration so the
   *    journal's inner history — not the scene's undo stack — tracks the batch.
   *    Mutations still happen on `adapter` / scene state.
   *
   *  `adapter` must be the same adapter the ops expect (typically a
   *  `SceneCanvasAdapter`). Pass `this` from `sceneToAdapter` or a compatible
   *  adapter. */
  applyBatch(ops: import('core/ops/types').Op[], label: string, adapter: unknown): void;

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
