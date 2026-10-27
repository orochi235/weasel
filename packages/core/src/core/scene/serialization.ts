/**
 * A scene to and from its JSON snapshot: the walk that writes one, and the
 * two readers that turn one back into layer records and node specs.
 */
import {
  NODE_FN_FIELDS, fnKeysOf, type FnBearingNode, type NodeFnField,
} from './nodeFnFields';
import type { SerializedDoc } from './docValues';
import { treePreorder } from './treeOrder';
import type { PoseComposition } from './composeFrame';
import { RIGID_POSE_COMPOSITION } from './composePose';
import { localizeWorldPoses } from './worldSave';
import type {
  AddNodeSpec, LayerRecord, Node, NodeId, SavedScene, SceneRegistry, SerializedLayer, SerializedNode, SerializedNodeV1,
  SerializedScene,
} from './types';

/** Whether `value` is a snapshot `specsFromSerialized` reads, as against a live scene. */
export function isSerializedScene<TData, TLayer extends string, TPose>(
  value: unknown,
): value is SavedScene<TData, TLayer, TPose> {
  const version = typeof value === 'object' && value != null
    ? (value as { version?: unknown }).version : undefined;
  return (version === 1 || version === 2 || version === 3)
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
    if (n.units !== undefined) out.units = n.units;
    if (n.clip !== undefined) out.clip = n.clip;
    if (n.consumesChildren === true) out.consumesChildren = true;
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
  return { version: 3, systemLayers, nodes, ...(doc ? { doc } : {}) };
}

/** Decides what a version 1 `container` becomes; `leaf` is always a mark. */
export type V1Classifier<TData, TLayer extends string, TPose> =
  (node: SerializedNodeV1<TData, TLayer, TPose>) => 'mark' | 'group';

/** Options for {@link specsFromSerialized}. */
export interface SpecsFromSerializedOptions<TData, TLayer extends string, TPose> {
  /** What a version 1 `container` loads as; see {@link V1Classifier}. */
  classifyV1?: V1Classifier<TData, TLayer, TPose>;
  /** `'skip'` loads a node whose registry key is unknown without that
   *  function, for a save that outlived the code that registered it.
   *  Default `'throw'`. */
  unknownKeys?: 'throw' | 'skip';
  /** Hears each key `unknownKeys: 'skip'` leaves out, as it is left out. */
  onSkip?: (skipped: SkippedKey) => void;
  /** How a version 1 or 2 save's world poses are made local to their
   *  containers' frames. Default `RIGID_POSE_COMPOSITION`; a scene passes its own. */
  composition?: PoseComposition<TPose>;
}

/** A registry key a load left out: the node, the function field it named,
 *  and the key. */
export interface SkippedKey {
  id: NodeId;
  field: keyof SceneRegistry<unknown>;
  key: string;
}

/** Map a `SerializedScene` to construction specs. Shared by `sceneFromJSON`
 *  (new instance) and `Scene.loadState` (in-place). Validates version and
 *  resolves every `NODE_FN_FIELDS` key → function via the registry;
 *  throws on an unsupported version, and on an unknown registry key unless
 *  `opts.unknownKeys` is `'skip'`. */
export function specsFromSerialized<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer>,
  opts: SpecsFromSerializedOptions<TData, TLayer, TPose> = {},
): AddNodeSpec<TData, TLayer, TPose>[] {
  const specs = currentSpecs(json, registry, opts);
  if (json.version === 3) return specs;
  return localizeWorldPoses(specs, opts.composition ?? (RIGID_POSE_COMPOSITION as PoseComposition<TPose>));
}

/** `json`'s nodes as specs, with every pose as the save stored it. */
function currentSpecs<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer>,
  opts: SpecsFromSerializedOptions<TData, TLayer, TPose>,
): AddNodeSpec<TData, TLayer, TPose>[] {
  type Entry = { n: Omit<SerializedNode<TData, TLayer, TPose>, 'kind'>; kind: 'mark' | 'group' };
  let entries: Entry[];
  if (json.version === 1) {
    entries = json.nodes.map((n) => ({ n, kind: nodeKindOf(1, n, opts.classifyV1) }));
  } else if (json.version === 2 || json.version === 3) {
    entries = json.nodes.map((n) => ({ n, kind: nodeKindOf(2, n) }));
  } else {
    throw new Error(`Scene: unsupported version ${String(Reflect.get(json, 'version'))}; versions 1, 2 and 3 are supported`);
  }
  return entries.map(({ n, kind }) => {
    const spec: AddNodeSpec<TData, TLayer, TPose> = {
      id: n.id as NodeId,
      kind,
      layer: n.layer,
      pose: n.pose,
      data: n.data,
    };
    if (n.parent !== undefined) spec.parent = n.parent as NodeId;
    if (n.pickable !== undefined) spec.pickable = n.pickable;
    if (n.hidden === true) spec.hidden = true;
    if (n.locked === true) spec.locked = true;
    if (n.units !== undefined) spec.units = n.units;
    if (n.clip !== undefined) spec.clip = n.clip;
    if (n.consumesChildren === true) spec.consumesChildren = true;
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
      if (!fn && opts.unknownKeys === 'skip') {
        opts.onSkip?.({ id: spec.id!, field: field.field, key });
        continue;
      }
      if (!fn) {
        throw new Error(
          `Scene: unknown ${field.field} key '${key}'. ` +
          `Register a function with this key in the registry option.`,
        );
      }
      (spec as unknown as Record<string, unknown>)[field.field] = fn;
    }
    if (clipsAsV1(json.version, spec)) spec.clip = 'outline';
    return spec;
  });
}

/** Version 1 clipped a container with no clip function to its outline, which
 *  is what `clip: 'outline'` draws on a group. One a classifier makes a mark
 *  gets no clip, since which painter claims it is not known here; one whose
 *  clip key was skipped loads as it would have without it. */
function clipsAsV1(version: 1 | 2 | 3, spec: { kind: string; clipFromPose?: unknown }): boolean {
  return version === 1 && spec.kind === 'group' && spec.clipFromPose === undefined;
}

/** The kind a saved node loads as: its own from version 2; on version 1 a `leaf` is a
 *  mark and a `container` goes to `classify`, or is a group without one. */
export function nodeKindOf<TData, TLayer extends string, TPose>(
  version: 1 | 2,
  n: SerializedNode<TData, TLayer, TPose> | SerializedNodeV1<TData, TLayer, TPose>,
  classify?: V1Classifier<TData, TLayer, TPose>,
): 'mark' | 'group' {
  if (version === 2) return (n as SerializedNode<TData, TLayer, TPose>).kind;
  if (n.kind === 'leaf') return 'mark';
  return classify ? classify(n as SerializedNodeV1<TData, TLayer, TPose>) : 'group';
}
