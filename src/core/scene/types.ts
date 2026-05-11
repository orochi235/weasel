import type { RectPose } from 'features/groups/composePose';

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

export interface UseSceneOptions<TData, TLayer extends string, TPose = RectPose> {
  systemLayers: readonly SystemLayerSpec<TLayer>[];
  initial?: readonly AddNodeSpec<TData, TLayer, TPose>[];
  ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
  historyLimit?: number;
  generateId?: () => NodeId;
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

  // History
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  batch<T>(label: string, fn: () => T): T;

  // Subscription (used by useScene; also for non-React observers)
  subscribe(listener: () => void): () => void;
  /** Monotonically increasing version. Snapshot for `useSyncExternalStore`. */
  getVersion(): number;
}
