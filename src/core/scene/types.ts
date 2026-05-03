import type { RectPose } from '../../features/groups/composePose';

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
