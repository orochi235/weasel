import { withKitRegistry } from './kitRegistry';
import { createPoseOverrides } from './poseOverrides';
import { createArrivalWindow } from './arrivalWindow';
import { createNotifier } from './notifier';
import { createPoseWriteLog } from './poseWrites';
import { effectivePose } from './effectivePose';
import { createEditMode } from './editMode';
import { createSceneEdits } from './sceneEdits';
import { createSceneRecording } from './sceneRecording';
import { createSceneSelection } from './sceneSelection';
import { createSceneState } from './sceneState';
import { systemLayerRecord } from './layerStack';
import { layerFromSerialized, specsFromSerialized } from './serialization';
import { resolveLayoutFrame, runLayoutPass } from './layoutPass';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from './composeFrame';
import {
  asNodeId,
  type AddNodeSpec,
  type LayerRecord,
  type NodeId,
  type RegisteredOp,
  type Scene,
  type SceneRegistry,
  type SerializedScene,
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

/** Build a scene outside React. `useScene` is the usual entry point; reach for
 *  this in tests, in headless rendering, or wherever a scene must outlive a
 *  component. Throws if no system layers are declared. */
export function createScene<TData, TLayer extends string, TPose = import('./composePose').RectPose>(
  options: UseSceneOptions<TData, TLayer, TPose>,
): Scene<TData, TLayer, TPose> {
  return buildScene(options, (options.systemLayers ?? []).map(systemLayerRecord), () => options.initial);
}

type SceneConfig<TData, TLayer extends string, TPose> =
  Omit<UseSceneOptions<TData, TLayer, TPose>, 'systemLayers' | 'initial'>;

/** A scene holding `layers`, and the nodes `initialNodes` answers with once
 *  it is handed the registry their functions resolve against. */
function buildScene<TData, TLayer extends string, TPose>(
  options: SceneConfig<TData, TLayer, TPose>,
  layers: readonly LayerRecord<TLayer>[],
  initialNodes: (registry: SceneRegistry<TPose, TData, TLayer>) => readonly AddNodeSpec<TData, TLayer, TPose>[] | undefined,
): Scene<TData, TLayer, TPose> {
  if (layers.length === 0) throw new Error('Scene: systemLayers must declare at least one layer');

  // The kit's own registry entries sit under the consumer's, so a snapshot
  // carrying a kit-attached function (a grouped container's derived pose)
  // reloads in any scene, not only one whose consumer registered the key.
  const registry = withKitRegistry(options.registry ?? {});

  const doc = createSceneState<TData, TLayer, TPose>(registry, layers, () => arrivals.layoutDeclared());
  const { state, locks, reads } = doc;
  const notifier = createNotifier();
  const mode = createEditMode();
  const poseWrites = createPoseWriteLog({ untracked: mode.untracked, changes: notifier, shown: (id) => shownNode(scene, id) });
  const writePose = (id: string, pose: unknown): void =>
    poseWrites.layout(() => scene.setPose(asNodeId(id), pose as TPose));

  const layoutFrame = resolveLayoutFrame(options.layoutFrame);
  const arrivals = createArrivalWindow<TData, TLayer, TPose>({
    nodes: state.nodes,
    layoutPass: (arrived, touched, departed) =>
      runLayoutPass(scene, reads.layoutOf, arrived, touched, layoutFrame, departed),
    recordsBareEdits: () => !mode.open(),
    writePose,
  });

  const generateId = options.generateId ?? defaultGenerateId;
  const selection = createSceneSelection(locks.reachable);
  // A selection change is a scene change to every subscriber; counted, so a
  // reader can tell one that changed nothing else.
  let selectionChanges = 0;
  selection.subscribe(() => {
    selectionChanges++;
    notifier.notify();
  });

  /** Ephemeral per-node overrides. Deliberately not part of `state`: not
   *  document content, never reaches `toJSON`, and never touches history. */
  const overrides = createPoseOverrides<TPose>((id) => state.nodes.get(id), doc.store.invalidateDependents);

  const recording = createSceneRecording({
    notifier,
    mode,
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
    composition: options.composition ?? (IDENTITY_POSE_COMPOSITION as PoseComposition<TPose>),

    ...edits.methods,
    ...recording.methods,

    unlocked: (fn) => locks.lifted(fn),

    setArrivalHandler: arrivals.setHandler,
    onReflow: arrivals.onReflow,
    onPoseWrite: poseWrites.subscribe,

    overrides,

    getSelection: selection.get,
    setSelection: (ids) => selection.set([...ids]),

    loadState(json) {
      // Validate + map up front (throws before we touch live state on a bad
      // version or unknown registry key).
      const specs = specsFromSerialized(json, registry);
      if (mode.open()) {
        throw new Error('Scene: cannot loadState inside another edit — it replaces the state that edit would revert to');
      }
      // Ephemeral, and every id is a new node after this.
      overrides.clearAll();
      doc.reset(json.systemLayers.map(layerFromSerialized));
      recording.clearHistory();
      poseWrites.quiet(() => edits.construct(specs));
      selection.replace(locks.reachable(selection.get().filter((id) => state.nodes.has(id))));
      notifier.notify();
    },

    subscribe: notifier.subscribe,
    getVersion: notifier.version,
    getContentVersion: () => notifier.version() - selectionChanges,
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
  json: SerializedScene<TData, TLayer, TPose>,
  options: {
    registry?: SceneRegistry<TPose, TData, TLayer>;
    historyLimit?: number;
    coalesceWindowMs?: number;
    generateId?: () => NodeId;
    ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
    composition?: UseSceneOptions<TData, TLayer, TPose>['composition'];
    layoutFrame?: UseSceneOptions<TData, TLayer, TPose>['layoutFrame'];
  } = {},
): Scene<TData, TLayer, TPose> {
  return buildScene(
    options,
    json.systemLayers.map(layerFromSerialized),
    (registry) => specsFromSerialized(json, registry),
  );
}
