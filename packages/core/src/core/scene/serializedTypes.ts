import type { UnitScope } from '@weasel-js/quantity';
import type { SystemLayerSpec } from './types';

/** One layer as it appears in a snapshot. A snapshot written before layer
 *  kind was serialized carries neither field, and loads as a system layer —
 *  which is what every layer in such a snapshot was. */
export interface SerializedLayer<TLayer extends string>
  extends SystemLayerSpec<TLayer> {
  kind?: 'system' | 'user';
  /** Present on a user layer, absent on a system one. */
  name?: string;
}

/** JSON-serializable shape of a Scene's current state. Produced by
 *  `scene.toJSON()`; consumed by `sceneFromJSON()`. Function fields
 *  (e.g., `clipFromPose`) appear as string keys (`clipFromPoseKey`) and
 *  are resolved through `SceneRegistry` at load time. */
export interface SerializedScene<TData, TLayer extends string, TPose> {
  version: 2;
  /** The whole layer stack, system and user alike — the name predates user
   *  layers and is kept so existing snapshots still parse. */
  systemLayers: readonly SerializedLayer<TLayer>[];
  nodes: readonly SerializedNode<TData, TLayer, TPose>[];
  /** The scene's document values, JSON only. Omitted when it has none. */
  doc?: Readonly<Record<string, unknown>>;
}

/** JSON-serializable shape of a single node. Mirrors `AddNodeSpec` but
 *  with function fields replaced by registry keys. */
export interface SerializedNode<TData, TLayer extends string, TPose> {
  id: string;
  kind: 'mark' | 'group';
  layer: TLayer;
  pose: TPose;
  data: TData;
  /** Parent id; omitted for roots. */
  parent?: string;
  /** Registry key for the container's clip-path factory.
   *  Containers only; omitted when the container has no clip. */
  clipFromPoseKey?: string;
  /** Registry key for the container's `copiesFromPose`. Containers only;
   *  omitted when it draws no copies. */
  copiesFromPoseKey?: string;
  /** Ids this node's geometry derives from, or `'children'`. Omitted when it
   *  derives from nothing. */
  dependsOn?: readonly string[] | 'children';
  /** Mirrors `SceneNode.pickable`. Omitted when the node is pickable. */
  pickable?: boolean;
  /** Mirrors `SceneNode.hidden`. Omitted when the node is shown. */
  hidden?: boolean;
  /** Mirrors `SceneNode.locked`. Omitted when the node is unlocked. */
  locked?: boolean;
  /** Registry key for the node's `derivePath` function. Omitted when it has none. */
  derivePathKey?: string;
  /** Registry key for the node's `derivePose` function. Omitted when it has none. */
  derivePoseKey?: string;
  /** Registry key for the container's layout strategy. Omitted when it has none. */
  layoutKey?: string;
  /** Mirrors `ContainerNode.units`. Omitted when the container declares none. */
  units?: UnitScope;
}

/** A node as version 1 saves wrote it: the kinds were `leaf` and `container`. */
export interface SerializedNodeV1<TData, TLayer extends string, TPose>
  extends Omit<SerializedNode<TData, TLayer, TPose>, 'kind'> {
  kind: 'leaf' | 'container';
}

/** A version 1 save, still read and never written. */
export interface SerializedSceneV1<TData, TLayer extends string, TPose>
  extends Omit<SerializedScene<TData, TLayer, TPose>, 'version' | 'nodes'> {
  version: 1;
  nodes: readonly SerializedNodeV1<TData, TLayer, TPose>[];
}
