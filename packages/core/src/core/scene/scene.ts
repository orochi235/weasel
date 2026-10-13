import { createHistory } from 'core/ops/createHistory';
import { withKitRegistry } from './kitRegistry';
import { createNodeFnFields } from './nodeFnFields';
import { createPoseOverrides } from './poseOverrides';
import { createRenderOrder } from './renderOrder';
import { createLockGuard } from './lockGuard';
import { createArrivalWindow } from './arrivalWindow';
import { createSceneHistory } from './historyFacade';
import { createNodeStore } from './nodeStore';
import { createNotifier } from './notifier';
import { createOpTable } from './opTable';
import { createOuterOps } from './outerOps';
import { createRecorder } from './recorder';
import { createEditMode } from './editMode';
import { createFieldEdits } from './fieldEdits';
import { createTreeEdits } from './treeEdits';
import { createTreeReads } from './treeReads';
import { createSceneSelection } from './sceneSelection';
import { createAppliedLog } from './appliedLog';
import { createStaleReplay } from './staleReplay';
import { createLayerEdits, createLayerStack, systemLayerRecord } from './layerStack';
import { registerKitOps } from './kitOps';
import { layerFromSerialized, serializeScene, specsFromSerialized } from './serialization';
import { resolveLayoutFrame, runLayoutPass } from './layoutPass';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from './composeFrame';
import {
  asNodeId,
  type AddNodeSpec,
  type LayerRecord,
  type Node,
  type NodeId,
  type RegisteredOp,
  type Scene,
  type SceneRegistry,
  type SerializedScene,
  type UseSceneOptions,
} from './types';

interface SceneState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  roots: NodeId[];
  layers: LayerRecord<TLayer>[];
  layerIndex: Map<TLayer, number>;
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

  const state: SceneState<TData, TLayer, TPose> = {
    nodes: new Map(),
    roots: [],
    layers: [],
    layerIndex: new Map(),
  };
  const order = createRenderOrder(state);
  const notifier = createNotifier();
  const { notify } = notifier;
  const mode = createEditMode();
  const stale = createStaleReplay(state.nodes);
  const locks = createLockGuard(state);
  const { isLocked: isLockedInternal, reachable, lifted: withLocksLifted } = locks;
  const invalidateOrder = order.invalidate;

  // The kit's own registry entries sit under the consumer's, so a snapshot
  // carrying a kit-attached function (a grouped container's derived pose)
  // reloads in any scene, not only one whose consumer registered the key.
  const registry = withKitRegistry(options.registry ?? {});

  const layoutFrame = resolveLayoutFrame(options.layoutFrame);
  const arrivalWindow = createArrivalWindow<TData, TLayer, TPose>({
    nodes: state.nodes,
    layoutPass: (arrived, touched, departed) =>
      runLayoutPass(scene, layoutOfInternal, arrived, touched, layoutFrame, departed),
    recordsBareEdits: () => !mode.open(),
    writePose,
  });
  const { runEdit: runArrivalEdit } = arrivalWindow;

  /** The registry-keyed function fields, each with its key maps. A function
   *  cannot travel through a serializable op payload, so an op carries its key. */
  const fnFields = createNodeFnFields<TPose>(registry, (field) => {
    if (field === 'layout') arrivalWindow.layoutDeclared();
  });

  function layoutOfInternal(id: NodeId) {
    const node = state.nodes.get(id);
    return node?.kind === 'container' ? (node.layout ?? null) : null;
  }

  const store = createNodeStore(state, invalidateOrder, fnFields);
  const { dependents, childDerived, invalidateDependents } = store;

  const layerStack = createLayerStack(state, invalidateOrder);
  layerStack.reset(layers);
  const { requireLayerIndex, rebuildLayerIndex } = layerStack;

  const generateId = options.generateId ?? defaultGenerateId;

  const ops = createOpTable({
    driven: mode.open,
    replayAlone: (step) => { replay(step); notify(); },
    skips: stale.skips,
    // Only a replay is logged: a first apply is recorded by the entry it
    // creates, and reverting it would leave that entry describing nothing.
    applied: (kind, payload, reverted) => { if (!mode.records()) logApplied(kind, payload, reverted); },
  });

  const selection = createSceneSelection(reachable);
  // A selection change is a scene change to every subscriber.
  selection.subscribe(notify);

  /** Ephemeral per-node overrides. Deliberately not part of `state`: not
   *  document content, never reaches `toJSON`, and never touches history. */
  const overrides = createPoseOverrides<TPose>(
    (id) => state.nodes.get(id),
    invalidateDependents,
  );

  const outer = createOuterOps({
    own: (name, args) => (ops.handlers.has(name) ? ops.op(name, args) : null),
    recorder: () => recorder,
    // Deferred rather than muted, so a throwing op cannot strand subscribers
    // after earlier ops in the batch already mutated state.
    driving: (step) => notifier.deferred(() => mode.during('engine', () => atomically(step, () => true))),
    getActiveJournal: options.getActiveJournal ?? null,
  });

  // The scene's undo/redo engine. Its recorded ops close over their payloads,
  // so the engine's adapter argument is unused.
  const history = createHistory(undefined, {
    selection: { get: selection.get, set: (ids) => selection.set(ids as readonly NodeId[]) },
    ...(options.coalesceWindowMs !== undefined ? { coalesceWindowMs: options.coalesceWindowMs } : {}),
    ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
    rebuildOp: outer.rebuild,
  });

  function writePose(id: string, pose: unknown): void {
    scene.setPose(asNodeId(id), pose as TPose);
  }

  function refuseUntracked(verb: string): void {
    if (mode.untracked()) throw new Error(`Scene: cannot ${verb} inside untracked() — it records`);
  }

  const appliedLog = createAppliedLog({
    registered: ops.handlers,
    lifted: withLocksLifted,
    getSelection: selection.get,
    setSelection: selection.replace,
    notify,
  });
  const { atomically, logApplied } = appliedLog;

  const { layoutRefs } = registerKitOps<TData, TLayer, TPose>({
    state,
    register: ops.register,
    store,
    requireLayerIndex,
    rebuildLayerIndex,
    invalidateOrder,
    fnFields,
    narrowSelection: selection.narrow,
    clearOverride: overrides.clear,
  });
  for (const [kind, handler] of Object.entries(options.ops ?? {})) ops.register(kind, handler);

  const recorder = createRecorder({
    notifier,
    mode,
    engine: history,
    runOp: ops.run,
    makeOp: ops.op,
    log: appliedLog,
    arrivals: arrivalWindow,
    selection: selection.get,
    writePose,
  });
  const { record, engineDriven } = recorder;

  /** Run an engine step that replays recorded ops — undo, redo, goto, a
   *  journal stepping. The engine inverts whole ops when one throws; this
   *  also reverts the scene writes of the op that threw partway. */
  function replay(step: () => void): void {
    atomically(() => withLocksLifted(() => stale.during(() => engineDriven(step))), () => true);
  }

  const { history: sceneHistory, methods: historyMethods } = createSceneHistory({
    engine: history,
    applying: (step) => atomically(() => engineDriven(step), () => true),
    causing: outer.causing,
    replay,
    notify,
    refuseUntracked,
    runArrivalEdit,
  });

  const treeEdits = createTreeEdits<TData, TLayer, TPose>({
    nodes: state.nodes,
    generateId,
    store,
    locks,
    layers: layerStack,
    fnFields,
    runOp: ops.run,
    recorder,
    arrivals: arrivalWindow,
  });
  const { construct } = treeEdits;

  const fieldEdits = createFieldEdits<TData, TLayer, TPose>({
    store,
    locks,
    layers: layerStack,
    recorder,
    arrivals: arrivalWindow,
    layoutFrame,
    layoutField: fnFields.find((f) => f.spec.field === 'layout')!,
    layoutRefs,
  });

  const layerEdits = createLayerEdits<TData, TLayer, TPose>({
    layers: state.layers,
    layerIndex: state.layerIndex,
    nodes: state.nodes,
    requireLayerIndex,
    record,
    lifted: withLocksLifted,
    batch: (label, fn) => scene.batch(label, fn),
    removeMany: (ids) => scene.removeMany(ids),
  });

  const scene: Scene<TData, TLayer, TPose> = {
    get nodes() { return state.nodes; },
    get roots() { return state.roots; },
    get layers() { return state.layers; },
    registry,

    ...createTreeReads(state.nodes),

    renderOrder: order.ids,
    renderOrderNodes: order.nodes,
    nodesOnLayer: order.nodesOnLayer,

    mintId: generateId,
    composition: options.composition ?? (IDENTITY_POSE_COMPOSITION as PoseComposition<TPose>),

    add: treeEdits.add,
    remove: treeEdits.remove,
    removalClosure: treeEdits.removalClosure,
    removeMany: treeEdits.removeMany,
    move: treeEdits.move,
    reorder: treeEdits.reorder,

    ...fieldEdits,

    ...layerEdits,

    isLocked: (id) => isLockedInternal(id),

    unlocked: (fn) => withLocksLifted(fn),

    registerOp(kind, handler) {
      if (kind.startsWith('kit:')) {
        throw new Error(`Scene: op kind "${kind}" is reserved (kit:* prefix)`);
      }
      ops.register(kind, handler as RegisteredOp<unknown>);
    },

    recordOp(op) {
      record(op.kind, op.payload, op.kind);
    },

    setActiveJournalAccessor: outer.setActiveJournalAccessor,

    applyBatch(batch, label, adapter) {
      refuseUntracked('applyBatch');
      return runArrivalEdit(batch, (all) => outer.apply(history, all, label, adapter));
    },

    setArrivalHandler: arrivalWindow.setHandler,

    layoutOf: layoutOfInternal,

    onReflow: arrivalWindow.onReflow,

    overrides,

    getSelection: selection.get,
    setSelection: (ids) => selection.set([...ids]),

    history: sceneHistory,

    ...historyMethods,

    setHistoryAdapter: outer.setHistoryAdapter,

    batch: recorder.batch,
    untracked: recorder.untracked,

    toJSON: () => serializeScene(state, fnFields),

    loadState(json) {
      // Validate + map up front (throws before we touch live state on a bad
      // version or unknown registry key).
      const specs = specsFromSerialized(json, registry);
      if (mode.open()) {
        throw new Error('Scene: cannot loadState inside another edit — it replaces the state that edit would revert to');
      }
      // Ephemeral, and every id is a new node after this.
      overrides.clearAll();
      dependents.clear();
      childDerived.clear();
      state.nodes.clear();
      state.roots.length = 0;
      layerStack.reset(json.systemLayers.map(layerFromSerialized));
      history.clear();
      construct(specs);
      selection.replace(reachable(selection.get().filter((id) => state.nodes.has(id))));
      notify();
    },

    subscribe: notifier.subscribe,
    getVersion: notifier.version,
  };

  const initial = initialNodes(registry);
  if (initial) {
    construct(initial);
    notify();
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
