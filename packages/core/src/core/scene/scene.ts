import { withKitRegistry } from './kitRegistry';
import { createPoseOverrides } from './poseOverrides';
import { createScrollOffsets } from './scrollOffsets';
import { createArrivalWindow } from './arrivalWindow';
import { documentReads, sceneMutators } from './sceneMutators';
import { createNotifier } from './notifier';
import type { SerializedDoc } from './docValues';
import { sceneChanges } from './sceneChanges';
import { createPoseWriteLog } from './poseWrites';
import { effectivePose } from './effectivePose';
import { createEditMode } from './editMode';
import { createSceneEdits } from './sceneEdits';
import { createSceneRecording } from './sceneRecording';
import { createSceneSelection } from './sceneSelection';
import { createSceneState } from './sceneState';
import { systemLayerRecord } from './layerStack';
import { layerFromSerialized, specsFromSerialized, type SpecsFromSerializedOptions } from './serialization';
import { resolveLayoutFrame, runLayoutPass } from './layoutPass';
import type { PoseComposition } from './composeFrame';
import { RIGID_POSE_COMPOSITION } from './composePose';
import type { SceneOptions } from './useSceneOptions';
import {
  asNodeId,
  type AddNodeSpec,
  type LayerRecord,
  type NodeId,
  type RegisteredOp,
  type Scene,
  type SceneRegistry,
  type SavedScene,
  type UseSceneOptions,
} from './types';

/** A node still in `scene`, with the pose it is shown at. */
function shownNode<TData, TLayer extends string, TPose>(scene: Scene<TData, TLayer, TPose>, id: NodeId) {
  const node = scene.get(id);
  return node && { node, pose: effectivePose(scene, node) };
}

let defaultIdCounter = 0;
const defaultGenerateId = (): NodeId =>
  asNodeId(`n${(defaultIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

/** `mint`, passing over any id `taken` already holds: a document reloaded into a new session keeps the ids the last
 *  session minted, and a generator restarted with the session can mint them again. */
function freshIds(mint: () => NodeId, taken: (id: NodeId) => boolean): () => NodeId {
  return () => {
    for (let tries = 0; tries < 1000; tries++) {
      const id = mint();
      if (!taken(id)) return id;
    }
    throw new Error('scene: generateId gave 1000 ids the scene already holds');
  };
}

/** Build a scene outside React. `useScene` is the usual entry point; reach for
 *  this in tests, in headless rendering, or wherever a scene must outlive a
 *  component. Throws if no system layers are declared. */
export function createScene<TData, TLayer extends string, TPose = import('./composePose').RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose> {
  return buildScene(options, (options.systemLayers ?? []).map(systemLayerRecord), () => options.initial, options.doc);
}

type SceneConfig<TData, TLayer extends string, TPose> =
  Omit<SceneOptions<TData, TLayer, TPose>, 'systemLayers' | 'initial' | 'doc'>;

/** A scene holding `layers`, the document values `initialDoc`, and the nodes
 *  `initialNodes` answers with once it is handed the registry their functions
 *  resolve against. */
function buildScene<TData, TLayer extends string, TPose>(
  options: SceneConfig<TData, TLayer, TPose>,
  layers: readonly LayerRecord<TLayer>[],
  initialNodes: (registry: SceneRegistry<TPose, TData, TLayer>) => readonly AddNodeSpec<TData, TLayer, TPose>[] | undefined,
  initialDoc: SerializedDoc | undefined,
): Scene<TData, TLayer, TPose> {
  if (layers.length === 0) throw new Error('Scene: systemLayers must declare at least one layer');

  // The kit's own registry entries sit under the consumer's, so a snapshot carrying a kit-attached
  // function (a grouped container's derived pose) reloads in any scene, not only one that registered it.
  const registry = withKitRegistry(options.registry ?? {});

  const doc = createSceneState<TData, TLayer, TPose>(registry, layers, () => arrivals.layoutDeclared(), initialDoc);
  const { state, locks, reads } = doc;
  const notifier = createNotifier();
  const mode = createEditMode();
  const poseWrites = createPoseWriteLog({ untracked: mode.untracked, changes: notifier, shown: (id) => shownNode(scene, id) });
  const writePose = (id: string, pose: unknown): void => poseWrites.layout(() => scene.setPose(asNodeId(id), pose as TPose));

  const layoutFrame = resolveLayoutFrame(options.layoutFrame);
  const arrivals = createArrivalWindow<TData, TLayer, TPose>({
    nodes: state.nodes,
    layoutPass: (arrived, touched, departed) =>
      runLayoutPass(scene, reads.layoutOf, arrived, touched, layoutFrame, departed),
    recordsBareEdits: () => !mode.open(),
    writePose,
  });

  const generateId = freshIds(options.generateId ?? defaultGenerateId, (id) => state.nodes.has(id));
  const selection = createSceneSelection(locks.reachable, (id) => state.nodes.get(id)?.parent);
  // A selection change is a scene change to every subscriber.
  selection.subscribe(notifier.notify);

  /** Ephemeral, deliberately not part of `state`: not document content, never in `toJSON` or history. */
  const overrides = createPoseOverrides<TPose, TData>((id) => state.nodes.get(id), doc.store.invalidateDependents);
  const scroll = createScrollOffsets();

  const recording = createSceneRecording({
    notifier,
    mode,
    passAdapter: () => ({ ...sceneMutators(scene), ...documentReads(scene) }),
    stale: doc.stale,
    lifted: locks.lifted,
    selection,
    arrivals,
    writePose,
    poseWrites,
    config: options,
  });

  const edits = createSceneEdits<TData, TLayer, TPose>({
    state,
    store: doc.store,
    locks,
    layers: doc.layers,
    invalidateOrder: doc.order.invalidate,
    fnFields: doc.fnFields,
    ops: { ...recording.ops, register: poseWrites.reporting(recording.ops.register) },
    recorder: recording.recorder,
    arrivals,
    layoutFrame,
    generateId,
    narrowSelection: selection.narrow,
    clearOverride: overrides.clear,
  });
  for (const [kind, handler] of Object.entries(options.ops ?? {})) recording.ops.register(kind, handler);

  const scene: Scene<TData, TLayer, TPose> = {
    get nodes() { return state.nodes; },
    get roots() { return state.roots; },
    get layers() { return state.layers; },
    registry,

    ...reads,

    mintId: generateId,
    composition: options.composition ?? (RIGID_POSE_COMPOSITION as PoseComposition<TPose>),

    ...edits.methods,
    ...recording.methods,

    unlocked: (fn) => locks.lifted(fn),

    setArrivalHandler: arrivals.setHandler,
    onReflow: arrivals.onReflow,
    onPoseWrite: poseWrites.subscribe,

    overrides,
    scroll,

    getSelection: selection.get,
    setSelection: (ids) => selection.set([...ids]),

    loadState(json, opts) {
      // Validate + map up front: throws on a bad version or registry key before live state is touched.
      const specs = specsFromSerialized(json, registry, { composition: scene.composition, ...opts });
      if (mode.open()) {
        throw new Error('Scene: cannot loadState inside another edit — it replaces the state that edit would revert to');
      }
      // Ephemeral, and every id is a new node after this.
      overrides.clearAll();
      scroll.clearAll();
      doc.reset(json.systemLayers.map(layerFromSerialized), json.doc);
      recording.clearHistory();
      poseWrites.quiet(() => edits.construct(specs));
      selection.replace(selection.legal(selection.get().filter((id) => state.nodes.has(id))));
      notifier.notify();
    },

    ...sceneChanges(notifier, selection),
  };

  const initial = initialNodes(registry);
  if (initial) {
    poseWrites.quiet(() => edits.construct(initial));
    notifier.notify();
  }

  return scene;
}

/** Reconstruct a Scene from a JSON snapshot produced by `scene.toJSON()`.
 *  Function fields (e.g., `clipFromPose`) are resolved by string key via the
 *  registry passed in `options`. Throws on unknown version, unknown registry
 *  keys, or invalid scene shape (cross-layer subtrees, unknown layer ids).
 *  The scene starts with empty history. */
export function sceneFromJSON<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  options: {
    registry?: SceneRegistry<TPose, TData, TLayer>;
    historyLimit?: number;
    coalesceWindowMs?: number;
    generateId?: () => NodeId;
    ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
    composition?: SceneOptions<TData, TLayer, TPose>['composition'];
    layoutFrame?: SceneOptions<TData, TLayer, TPose>['layoutFrame'];
  } & SpecsFromSerializedOptions<TData, TLayer, TPose> = {},
): Scene<TData, TLayer, TPose> {
  return buildScene(
    options,
    json.systemLayers.map(layerFromSerialized),
    (registry) => specsFromSerialized(json, registry, options),
    json.doc,
  );
}
