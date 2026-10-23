/**
 * A scene to and from its JSON snapshot: the walk that writes one, and the
 * two readers that turn one back into layer records and node specs.
 */
import {
  NODE_FN_FIELDS, fnKeysOf, type FnBearingNode, type NodeFnField,
} from './nodeFnFields';
import type { SerializedDoc } from './docValues';
import { treePreorder } from './treeOrder';
import type {
  AddNodeSpec, LayerRecord, Node, NodeId, SceneRegistry, SerializedLayer, SerializedNode, SerializedNodeV1,
  SerializedScene, SerializedSceneV1,
} from './types';

/** Whether `value` is a snapshot `specsFromSerialized` reads, as against a live scene. */
export function isSerializedScene<TData, TLayer extends string, TPose>(
  value: unknown,
): value is SerializedScene<TData, TLayer, TPose> | SerializedSceneV1<TData, TLayer, TPose> {
  const version = typeof value === 'object' && value != null
    ? (value as { version?: unknown }).version : undefined;
  return (version === 1 || version === 2)
    && Array.isArray((value as { nodes?: unknown }).nodes);
}

/** What a snapshot is written from. */
export interface SerializableState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  roots: NodeId[];
  layers: LayerRecord<TLayer>[];
}

/** One layer record from its snapshot form. A snapshot with no `kind` predates
 *  user layers, so everything in it was a system layer. */
export function layerFromSerialized<TLayer extends string>(
  spec: SerializedLayer<TLayer>,
): LayerRecord<TLayer> {
  const base = {
    id: spec.id,
    visible: spec.visible ?? true,
    locked: spec.locked ?? false,
    ...(spec.parallax ? { parallax: spec.parallax } : {}),
    ...(spec.annotation ? { annotation: true } : {}),
  };
  return spec.kind === 'user'
    ? { ...base, kind: 'user', name: spec.name ?? spec.id }
    : { ...base, kind: 'system' };
}

/** The snapshot of `state`: layers in order, nodes in tree preorder, and the
 *  document values when there are any. Throws
 *  when a node carries a function the registry has no key for. */
export function serializeScene<TData, TLayer extends string, TPose>(
  state: SerializableState<TData, TLayer, TPose>,
  fnFields: readonly NodeFnField[],
  doc?: SerializedDoc,
): SerializedScene<TData, TLayer, TPose> {
  const nodes: SerializedNode<TData, TLayer, TPose>[] = [];
  for (const n of treePreorder(state.roots, state.nodes)) {
    const id = n.id;
    const out: SerializedNode<TData, TLayer, TPose> = {
      id,
      kind: n.kind,
      layer: n.layer,
      pose: n.pose,
      data: n.data,
    };
    if (n.parent != null) out.parent = n.parent;
    if (n.dependsOn === 'children') out.dependsOn = 'children';
    else if (n.dependsOn && n.dependsOn.length > 0) out.dependsOn = n.dependsOn;
    if (n.pickable === false) out.pickable = false;
    if (n.hidden === true) out.hidden = true;
    if (n.locked === true) out.locked = true;
    if (n.kind === 'group' && n.units !== undefined) out.units = n.units;
    Object.assign(
      out,
      fnKeysOf(fnFields, n as unknown as FnBearingNode, 'jsonKey', (field) => {
        throw new Error(
          `Scene.toJSON: node '${id}' has ${field.spec.field} but no matching registry key. ` +
          `The function must be registered via createScene's registry option to round-trip.`
        );
      }),
    );
    nodes.push(out);
  }
  const systemLayers = state.layers.map((l) => {
    const layer: SerializedLayer<TLayer> = { id: l.id };
    if (l.visible === false) layer.visible = false;
    if (l.locked === true) layer.locked = true;
    if (l.parallax) layer.parallax = l.parallax;
    if (l.annotation) layer.annotation = true;
    if (l.kind === 'user') {
      layer.kind = 'user';
      layer.name = l.name;
    }
    return layer;
  });
  return { version: 2, systemLayers, nodes, ...(doc ? { doc } : {}) };
}

/** Decides what a version 1 `container` becomes; `leaf` is always a mark. */
export type V1Classifier<TData, TLayer extends string, TPose> =
  (node: SerializedNodeV1<TData, TLayer, TPose>) => 'mark' | 'group';

/** Map a `SerializedScene` to construction specs. Shared by `sceneFromJSON`
 *  (new instance) and `Scene.loadState` (in-place). Validates version and
 *  resolves every `NODE_FN_FIELDS` key → function via the registry;
 *  throws on an unsupported version or an unknown registry key. */
export function specsFromSerialized<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer>,
  opts: { classifyV1?: V1Classifier<TData, TLayer, TPose> } = {},
): AddNodeSpec<TData, TLayer, TPose>[] {
  const version = (json as { version: unknown }).version;
  if (version !== 1 && version !== 2) {
    throw new Error(`Scene: unsupported version ${String(version)}; versions 1 and 2 are supported`);
  }
  return json.nodes.map((n) => {
    const spec: AddNodeSpec<TData, TLayer, TPose> = {
      id: n.id as NodeId,
      kind: version === 1 ? kindFromV1(n as SerializedNodeV1<TData, TLayer, TPose>, opts.classifyV1) : n.kind as 'mark' | 'group',
      layer: n.layer,
      pose: n.pose,
      data: n.data,
    };
    if (n.parent !== undefined) spec.parent = n.parent as NodeId;
    if (n.pickable !== undefined) spec.pickable = n.pickable;
    if (n.hidden === true) spec.hidden = true;
    if (n.locked === true) spec.locked = true;
    if (n.units !== undefined) spec.units = n.units;
    if (n.dependsOn !== undefined) {
      spec.dependsOn = n.dependsOn === 'children'
        ? 'children'
        : (n.dependsOn as readonly NodeId[]);
    }
    const serialized = n as unknown as Record<string, string | undefined>;
    for (const field of NODE_FN_FIELDS) {
      const key = serialized[field.jsonKey];
      if (key === undefined) continue;
      const fn = (registry[field.field] as Record<string, unknown> | undefined)?.[key];
      if (!fn) {
        throw new Error(
          `Scene: unknown ${field.field} key '${key}'. ` +
          `Register a function with this key in the registry option.`,
        );
      }
      (spec as unknown as Record<string, unknown>)[field.field] = fn;
    }
    return spec;
  });
}

function kindFromV1<TData, TLayer extends string, TPose>(
  n: SerializedNodeV1<TData, TLayer, TPose>,
  classify: V1Classifier<TData, TLayer, TPose> | undefined,
): 'mark' | 'group' {
  if (n.kind === 'leaf') return 'mark';
  return classify ? classify(n) : 'group';
}
