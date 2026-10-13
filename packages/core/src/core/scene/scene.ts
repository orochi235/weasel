import { createHistory } from 'core/ops/createHistory';
import { sameDependsOn } from './dependents';
import { withKitRegistry } from './kitRegistry';
import {
  createNodeFnFields,
  fnKeysOf,
  type FnBearingNode,
  type NodeFnField,
} from './nodeFnFields';
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
import { createSceneSelection } from './sceneSelection';
import { createAppliedLog } from './appliedLog';
import { createStaleReplay, SceneMembershipError } from './staleReplay';
import { statedFields } from './statedFields';
import { createLayerEdits, createLayerStack, systemLayerRecord } from './layerStack';
import { registerKitOps, type RemoveSnapshot, type SetLayoutPayload } from './kitOps';
import { layerFromSerialized, serializeScene, specsFromSerialized } from './serialization';
import { resized, resolveLayoutFrame, runLayoutPass } from './layoutPass';
import { IDENTITY_POSE_COMPOSITION, type PoseComposition } from './composeFrame';
import type { LayoutStrategy } from '../../layout/types';
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
  const stale = createStaleReplay(state.nodes, notifier.version);
  const {
    isLocked: isLockedInternal, refuse: refuseLocked, refuseLayer: refuseLockedLayer, reachable,
    lifted: withLocksLifted,
  } = createLockGuard(state);
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
  const { noteArrival, noteDeparture, noteChange, runEdit: runArrivalEdit } = arrivalWindow;

  /** The registry-keyed function fields, each with its key maps. A function
   *  cannot travel through a serializable op payload, so an op carries its key. */
  const fnFields = createNodeFnFields<TPose>(registry, (field) => {
    if (field === 'layout') arrivalWindow.layoutDeclared();
  });
  const fnField = (name: 'clipFromPose' | 'derivePath' | 'derivePose' | 'layout'): NodeFnField =>
    fnFields.find((f) => f.spec.field === name)!;

  function layoutOfInternal(id: NodeId) {
    const node = state.nodes.get(id);
    return node?.kind === 'container' ? (node.layout ?? null) : null;
  }

  const store = createNodeStore(state, invalidateOrder, fnFields);
  const {
    dependents, childDerived, invalidateDependents, requireNode, siblingsOf, descendants, removalClosure,
    patchNodeFunctions,
  } = store;

  const layerStack = createLayerStack(state, invalidateOrder);
  layerStack.reset(layers);
  const { requireLayerIndex, rebuildLayerIndex, assertSubtreeLayer } = layerStack;

  const generateId = options.generateId ?? defaultGenerateId;

  const ops = createOpTable({
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

  // The one place the scene's two recorded forms are reconciled: see
  // `outerOps.ts`, and "One recorded form for a scene edit" in docs/TODO.md.
  const outer = createOuterOps<TPose>({
    own: (name, args) => (ops.handlers.has(name) ? ops.op(name, args) : null),
    tolerant: stale.tolerant,
    has: (id) => state.nodes.has(id),
    setPose: (id, pose) => scene.setPose(id, pose),
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

  // Keyed by node object: every entry into `state.nodes` is a fresh object and
  // every edit mutates it in place, which is exactly an incarnation's lifetime.
  const incarnations = new WeakMap<object, number>();
  let nextIncarnation = 1;

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
  const { record, edit, engineDriven } = recorder;

  /** Run an engine step that replays recorded ops — undo, redo, goto, a
   *  journal stepping. The engine inverts whole ops when one throws; this
   *  also reverts the scene writes of the op that threw partway. */
  function replay(step: () => void): void {
    atomically(() => withLocksLifted(() => stale.during(() => engineDriven(step))), () => true);
  }

  const { history: sceneHistory, methods: historyMethods } = createSceneHistory({
    engine: history,
    applying: (step) => atomically(() => engineDriven(step), () => true),
    tolerant: stale.tolerant,
    replay,
    notify,
    refuseUntracked,
    runArrivalEdit,
  });

  /** Check that `spec` can be placed, and answer with the `kit:add` payload
   *  that places it. Throws on an id collision, an unknown or locked layer,
   *  a parent that is not a container or is locked, and a layer below the
   *  parent's. */
  function addPayload(spec: AddNodeSpec<TData, TLayer, TPose>) {
    const id = spec.id ?? generateId();
    if (state.nodes.has(id)) throw new SceneMembershipError(`Scene: id collision on "${id}"`);
    requireLayerIndex(spec.layer);
    refuseLockedLayer(spec.layer, 'add to');
    const parent = spec.parent ?? null;
    if (parent !== null) {
      const p = requireNode(parent);
      if (p.kind !== 'container') {
        throw new Error(`Scene: parent "${parent}" is not a container`);
      }
      assertSubtreeLayer(spec.id, spec.layer, parent, p.layer);
      refuseLocked(parent, 'add under');
    }
    return {
      id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
      parent, index: spec.index ?? siblingsOf(parent).length,
      ...(spec.dependsOn !== undefined ? { dependsOn: spec.dependsOn } : {}),
      ...statedFields(spec),
      ...fnKeysOf(fnFields, { ...spec, id, kind: spec.kind } as unknown as FnBearingNode, 'opKey'),
    };
  }

  /** Place nodes as the document a scene starts from, or is loaded with:
   *  nothing is recorded, and no lock refuses. Specs list parents before
   *  children, the order `toJSON()` emits. */
  function construct(specs: readonly AddNodeSpec<TData, TLayer, TPose>[]): void {
    withLocksLifted(() => {
      for (const spec of specs) {
        const payload = addPayload(spec);
        ops.run('kit:add', payload);
        patchNodeFunctions(spec, payload.id, null);
      }
    });
  }

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

    get(id) { return state.nodes.get(id); },
    incarnation(id) {
      const node = state.nodes.get(id);
      if (!node) return undefined;
      let token = incarnations.get(node);
      if (token === undefined) {
        token = nextIncarnation++;
        incarnations.set(node, token);
      }
      return token;
    },

    childrenOf(id) {
      const n = state.nodes.get(id);
      return n && n.kind === 'container' ? n.children : [];
    },

    ancestorsOf(id) {
      const out: NodeId[] = [];
      let cur = state.nodes.get(id)?.parent ?? null;
      while (cur !== null) {
        out.push(cur);
        cur = state.nodes.get(cur)?.parent ?? null;
      }
      return out;
    },

    renderOrder: order.ids,
    renderOrderNodes: order.nodes,
    nodesOnLayer: order.nodesOnLayer,

    mintId: generateId,
    composition: options.composition ?? (IDENTITY_POSE_COMPOSITION as PoseComposition<TPose>),

    add(spec) {
      const payload = addPayload(spec);
      const label = `add ${spec.kind}`;
      return edit(label, payload.parent !== null, () => {
        noteArrival(payload.id, payload.parent, null);
        record('kit:add', payload, label);
        patchNodeFunctions(spec, payload.id, payload);
        return payload.id;
      });
    },

    remove: (id) => scene.removeMany([id]),

    removalClosure(rootIds) {
      return removalClosure(rootIds).ids;
    },

    removeMany(rootIds) {
      if (rootIds.length === 0) return;
      // Every id resolves against the pre-removal tree, so an id another one
      // cascades away is absorbed rather than being a second, failing removal.
      const { ids, removing } = removalClosure(rootIds);
      for (const nid of ids) refuseLocked(nid, 'remove');
      // requireNode is what rejects an id that is not in the scene, and it runs
      // before anything mutates.
      const snapshot: Node<TData, TLayer, TPose>[] = ids.map((nid) => {
        const n = requireNode(nid);
        return n.kind === 'container' ? { ...n, children: [...n.children] } : { ...n };
      });
      // The rest is reachable through a snapshotted parent's cloned `children`.
      const detached = snapshot
        .filter((n) => n.parent === null || !removing.has(n.parent))
        .map((n) => ({ id: n.id, parent: n.parent, index: siblingsOf(n.parent).indexOf(n.id) }))
        .sort((l, r) => l.index - r.index);
      const fnKeys = snapshot.flatMap((n) => {
        const keys = fnKeysOf(fnFields, n as unknown as FnBearingNode, 'opKey');
        return Object.keys(keys).length === 0 ? [] : [{ id: n.id, ...keys }];
      });
      const payload: RemoveSnapshot<TData, TLayer, TPose> = {
        nodes: snapshot, detached,
        ...(fnKeys.length > 0 ? { fnKeys } : {}),
      };
      edit('remove', detached.some((d) => d.parent !== null), () => {
        for (const d of detached) noteDeparture(d.id, d.parent, null);
        record('kit:remove', payload, 'remove');
      });
    },

    update(id, patch) {
      const node = requireNode(id);
      refuseLocked(id, 'update');
      record('kit:setData', { id, from: node.data, to: patch.data }, 'update');
    },

    setPose(id, pose) {
      const node = requireNode(id);
      refuseLocked(id, 'set the pose of');
      const resizes = node.kind === 'container' && resized(layoutFrame, id, node.pose, pose);
      edit('setPose', resizes, () => {
        if (resizes) noteChange(id);
        outer.wrote(id, node.pose, pose);
        record('kit:setPose', { id, from: node.pose, to: pose }, 'setPose');
      });
    },

    carry: outer.carry,

    setLayer(id, layer) {
      requireLayerIndex(layer);
      const node = requireNode(id);
      refuseLocked(id, 'relayer');
      if (node.layer !== layer) refuseLockedLayer(layer, 'move nodes onto');
      if (node.parent !== null) {
        const parentNode = requireNode(node.parent);
        assertSubtreeLayer(id, layer, node.parent, parentNode.layer, 'relayer');
      }
      if (node.layer === layer) return;
      const subtree: NodeId[] = [id];
      descendants(id, subtree);
      for (const sid of subtree) refuseLocked(sid, 'relayer');
      if (subtree.length === 1) {
        // Fast path: single node, no batch needed.
        record('kit:setLayer', { id, from: node.layer, to: layer }, 'setLayer');
      } else {
        scene.batch('setLayer', () => {
          for (const sid of subtree) {
            const cur = requireNode(sid);
            if (cur.layer === layer) continue;
            record('kit:setLayer', { id: sid, from: cur.layer, to: layer }, 'setLayer');
          }
        });
      }
    },

    setDependsOn(id, dependsOn) {
      const node = requireNode(id);
      refuseLocked(id, 'retarget');
      if (sameDependsOn(node.dependsOn, dependsOn)) return;
      record(
        'kit:setDependsOn',
        { id, from: node.dependsOn, to: dependsOn },
        'setDependsOn',
      );
    },

    setLayout(id, layout) {
      const node = requireNode(id);
      if (node.kind !== 'container') throw new Error(`Scene: "${id}" is not a container`);
      refuseLocked(id, 'set the layout of');
      const field = fnField('layout');
      let to: LayoutStrategy<TPose> | null;
      if (typeof layout === 'string') {
        to = (field.fnOf(layout) as LayoutStrategy<TPose> | undefined) ?? null;
        if (to === null) throw new Error(`Scene: no layout "${layout}" in this scene's registry`);
      } else {
        to = layout;
      }
      const from = node.layout ?? null;
      if (from === to) return;
      if (to !== null) arrivalWindow.layoutDeclared();
      const fromKey = from === null ? undefined : field.keyOf(from);
      const toKey = to === null ? undefined : field.keyOf(to);
      const payload: SetLayoutPayload = {
        id,
        ...(fromKey !== undefined ? { fromKey } : {}),
        ...(toKey !== undefined ? { toKey } : {}),
      };
      layoutRefs.set(payload, { from, to });
      edit('setLayout', true, () => {
        noteChange(id);
        record('kit:setLayout', payload, 'setLayout');
      });
    },

    move(id, parent, index) {
      const node = requireNode(id);
      refuseLocked(id, 'move');
      if (parent !== null) {
        refuseLocked(parent, 'move nodes into');
        const p = requireNode(parent);
        if (p.kind !== 'container') {
          throw new Error(`Scene: parent "${parent}" is not a container`);
        }
        assertSubtreeLayer(id, node.layer, parent, p.layer);
        // Cycle check: parent must not be id or a descendant of id.
        if (parent === id) throw new Error('Scene: cannot parent a node to itself');
        const desc: NodeId[] = [];
        descendants(id, desc);
        if (desc.includes(parent)) {
          throw new Error('Scene: cannot parent a node to its own descendant');
        }
      }
      const fromParent = node.parent;
      edit('move', parent !== null || fromParent !== null, () => {
        const fromIndex = siblingsOf(fromParent).indexOf(id);
        const toIndex = index ?? siblingsOf(parent).length;
        noteArrival(id, parent, fromParent);
        noteDeparture(id, fromParent, parent);
        noteChange(fromParent);
        record('kit:move', { id, fromParent, fromIndex, toParent: parent, toIndex }, 'move');
      });
    },

    reorder(id, index) {
      const node = requireNode(id);
      refuseLocked(id, 'reorder');
      const parent = node.parent;
      edit('reorder', parent !== null, () => {
        noteChange(parent);
        const fromIndex = siblingsOf(parent).indexOf(id);
        record('kit:move', { id, fromParent: parent, fromIndex, toParent: parent, toIndex: index }, 'reorder');
      });
    },

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

    setUnits(id, units) {
      const node = requireNode(id);
      if (node.kind !== 'container') throw new Error(`Scene: "${id}" is not a container`);
      refuseLocked(id, 'set the units of');
      record('kit:setUnits', { id, from: node.units, to: units ?? undefined }, 'setUnits');
    },

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
      selection.replace(selection.get().filter((id) => state.nodes.has(id)));
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
