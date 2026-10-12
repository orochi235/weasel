import type { HistorySelection, Journal } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { createHistory } from 'core/ops/createHistory';
import { rebuildOp as rebuildGlobalOp } from 'core/ops/registry';
import { createArrangeOp, type ArrangeArgs } from 'core/ops/arrange';
import { bindOpToAdapter, bindOpToHistoryAdapter } from './boundOps';
import { CARRY_OP, createCarriedPoses, type CarryArgs } from './carriedPoses';
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
import { createAppliedLog } from './appliedLog';
import { createStaleReplay, SceneMembershipError } from './staleReplay';
import { statedFields } from './statedFields';
import { createLayerStack } from './layerStack';
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
  type SceneArrivalHandler,
  type SceneRegistry,
  type SerializedScene,
  type UseSceneOptions,
  type UserLayerRecord,
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
  if (!options.systemLayers || options.systemLayers.length === 0) {
    throw new Error('useScene: systemLayers must declare at least one layer');
  }

  // ── State ──────────────────────────────────────────────────────────────
  const state: SceneState<TData, TLayer, TPose> = {
    nodes: new Map(),
    roots: [],
    layers: [],
    layerIndex: new Map(),
  };
  const order = createRenderOrder(state);
  const stale = createStaleReplay(state.nodes, () => version);
  const {
    isLocked: isLockedInternal, refuse: refuseLocked, refuseLayer: refuseLockedLayer, reachable,
    lifted: withLocksLifted,
  } = createLockGuard(state);
  const invalidateOrder = order.invalidate;

  // The kit's own registry entries sit under the consumer's, so a snapshot
  // carrying a kit-attached function (a grouped container's derived pose)
  // reloads in any scene, not only one whose consumer registered the key.
  const registry = withKitRegistry(options.registry ?? {});

  /** The registry-keyed function fields, each with its key maps. A function
   *  cannot travel through a serializable op payload, so an op carries its key. */
  const fnFields = createNodeFnFields<TPose>(registry);
  const fnField = (name: 'clipFromPose' | 'derivePath' | 'derivePose' | 'layout'): NodeFnField =>
    fnFields.find((f) => f.spec.field === name)!;

  const layoutFrame = resolveLayoutFrame(options.layoutFrame);
  /** Latched on the first layout a container is given. */
  let hasLayouts = false;
  {
    const field = fnField('layout');
    const write = field.write;
    (field as { write: NodeFnField['write'] }).write = (node, fn) => {
      if (node.kind === 'container') hasLayouts = true;
      write(node, fn);
    };
  }

  function layoutOfInternal(id: NodeId) {
    const node = state.nodes.get(id);
    return node?.kind === 'container' ? (node.layout ?? null) : null;
  }

  const store = createNodeStore(state, invalidateOrder, fnFields);
  const {
    dependents, childDerived, invalidateDependents, requireNode, siblingsOf, descendants, removalClosure,
    patchNodeFunctions,
  } = store;

  const { requireLayerIndex, rebuildLayerIndex, assertSubtreeLayer } =
    createLayerStack(state, invalidateOrder, options.systemLayers);

  const generateId = options.generateId ?? defaultGenerateId;

  const listeners = new Set<() => void>();
  const registered = new Map<string, RegisteredOp<unknown>>();

  // Accessor for the adapter restored external ops apply against.
  let historyAdapterAccessor: (() => unknown) | null = null;

  /** The transient set of active ids. Deliberately not part of `state`:
   *  selection is not document content and never reaches `toJSON`. It is
   *  handed to the history engine so entries can restore it. */
  let selection: readonly NodeId[] = [];

  /** Ephemeral per-node overrides. Deliberately not part of `state`, for the
   *  same reason `selection` isn't: not document content, never reaches
   *  `toJSON`, and never touches history. */
  const overrides = createPoseOverrides<TPose>(
    (id) => state.nodes.get(id),
    invalidateDependents,
  );

  // The scene's undo/redo engine. Recorded ops are `makeOp` wrappers that
  // close over their payloads, so the engine's adapter argument is unused.
  const history = createHistory(undefined, {
    selection: {
      get: () => selection,
      set: (ids) => { selection = reachable(ids as readonly NodeId[]); notify(); },
    },
    ...(options.coalesceWindowMs !== undefined ? { coalesceWindowMs: options.coalesceWindowMs } : {}),
    ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
    // Restore-time rebuild. A null return, when the global registry also
    // misses, makes the engine place its no-op placeholder.
    rebuildOp,
  });

  function rebuildOp(name: string, args: unknown): Op | null {
    if (registered.has(name)) return makeOp(name, args);
    // Its writes are the scene's own, so it replays without an adapter.
    if (name === 'arrange') return stale.tolerant(createArrangeOp(args as ArrangeArgs, undefined, writePose));
    if (name === CARRY_OP) {
      const { op, poses } = args as CarryArgs<TPose>;
      const inner = rebuildOp(op.name, op.args);
      return inner === null ? null : carried.rebuilt(inner, poses);
    }
    const rebuilt = rebuildGlobalOp(name, args);
    return rebuilt === null ? null : bindOpToHistoryAdapter(rebuilt, () => historyAdapterAccessor);
  }

  let version = 0;
  // Keyed by node object: every entry into `state.nodes` is a fresh object and
  // every edit mutates it in place, which is exactly an incarnation's lifetime.
  const incarnations = new WeakMap<object, number>();
  let nextIncarnation = 1;
  let batchDepth = 0;
  let currentBatch: { label: string; ops: Op[]; selectionBefore: readonly NodeId[] } | null = null;
  /** True while the history engine drives mutations (undo/redo/goto, journal
   *  routing) — suppresses scene-side history recording so engine-applied
   *  ops that re-enter scene mutation methods don't record twice. */
  let suppressRecording = false;
  /** Above zero inside `scene.untracked`, where the APIs that exist to
   *  record refuse rather than record. */
  let untrackedDepth = 0;

  // ── Helpers ────────────────────────────────────────────────────────────
  // When `batchDepth > 0` the per-op `notify()` still bumps the version, but
  // listener dispatch is deferred until the outermost batch closes.
  let batchDirty = false;
  // Seeded from options and swappable via `scene.setActiveJournalAccessor(fn)`,
  // so mode machines that depend on `scene.history` can wire it after construction.
  let activeJournalAccessor: (() => Journal | null) | null =
    options.getActiveJournal ?? null;

  const arrivalWindow = createArrivalWindow<TData, TLayer, TPose>({
    nodes: state.nodes,
    declared: () => (hasLayouts ? declaredLayouts : null),
    recordsBareEdits: () => batchDepth === 0 && !suppressRecording,
    writePose,
  });
  const {
    noteArrival, noteDeparture, noteChange, bareLayoutEdit, open: openArrivals, emitReflow,
    settle: settleArrivals, runEdit: runArrivalEdit,
  } = arrivalWindow;

  /** The pass a scene runs over its declared layouts when nothing else is
   *  installed. */
  const declaredLayouts: SceneArrivalHandler<TPose> = (arrived, touched, departed) =>
    runLayoutPass(scene, layoutOfInternal, arrived, touched, layoutFrame, departed);

  function writePose(id: string, pose: unknown): void {
    scene.setPose(asNodeId(id), pose as TPose);
  }

  const carried = createCarriedPoses<TPose>(
    (id) => state.nodes.has(id),
    (id, pose) => scene.setPose(id, pose),
  );

  function refuseUntracked(verb: string): void {
    if (untrackedDepth > 0) throw new Error(`Scene: cannot ${verb} inside untracked() — it records`);
  }

  const { atomically, logApplied } = createAppliedLog({
    registered,
    lifted: withLocksLifted,
    getSelection: () => selection,
    setSelection: (ids) => { selection = ids; },
    notify,
  });

  function notify(): void {
    version++;
    if (batchDepth > 0) {
      batchDirty = true;
      return;
    }
    for (const listener of listeners) listener();
  }

  const { layoutRefs } = registerKitOps<TData, TLayer, TPose>({
    state,
    register: (kind, handler) => { registered.set(kind, handler); },
    store,
    requireLayerIndex,
    rebuildLayerIndex,
    invalidateOrder,
    fnFields,
    // A new array only when one is dropped: readers compare the selection by identity.
    narrowSelection: (gone) => { selection = reachable(selection.some((id) => gone?.has(id)) ? selection.filter((id) => !gone?.has(id)) : selection); },
  });

  // ── Op execution (used by both kit mutations and consumer recordOp) ────
  function runOp(kind: string, payload: unknown): void {
    const handler = registered.get(kind);
    if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
    handler.apply(payload);
  }

  /** Bridge a registered scene op into an engine `Op`. `invert()` flips the
   *  direction with the same payload, so undo replays `revert` and redo
   *  replays `apply`. Handler lookup happens at apply time so re-registered
   *  kinds take effect on replay, but existence is checked eagerly to fail
   *  fast at the call site. */
  function makeOp(kind: string, payload: unknown, dir: 'fwd' | 'rev' = 'fwd'): Op {
    if (!registered.has(kind)) {
      throw new Error(`Scene: no registered op for kind "${kind}"`);
    }
    return {
      name: kind,
      args: payload,
      coalesceKey: coalesceKeyFor(kind, payload),
      apply: () => {
        const handler = registered.get(kind);
        if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
        if (stale.skips(kind, payload, dir === 'fwd')) return 'noop';
        (dir === 'fwd' ? handler.apply : handler.revert)(payload);
        // Only a replay logs here: a first apply is recorded by the entry it
        // creates, and reverting it would leave that entry describing nothing.
        if (suppressRecording) logApplied(kind, payload, dir === 'rev');
        return undefined;
      },
      invert: () => makeOp(kind, payload, dir === 'fwd' ? 'rev' : 'fwd'),
    };
  }

  /** Coalesce-grouping key. Kit ops are keyed by the node or layer they
   *  address; a consumer kind only by the `coalesceKey` it declares. Keys
   *  take effect only under `UseSceneOptions.coalesceWindowMs`. */
  function coalesceKeyFor(kind: string, payload: unknown): string | undefined {
    let token: string | undefined;
    if (kind.startsWith('kit:')) {
      if (payload === null || typeof payload !== 'object') return undefined;
      const p = payload as { id?: unknown; layer?: unknown };
      token =
        typeof p.id === 'string' ? p.id
        : typeof p.layer === 'string' ? p.layer
        : undefined;
    } else {
      token = registered.get(kind)?.coalesceKey?.(payload);
    }
    return token === undefined ? undefined : `${kind}:${token}`;
  }

  /** Run `fn` with scene-side recording suppressed and per-op notifies
   *  batched. Used whenever the engine drives mutations (undo/redo/goto):
   *  engine-applied ops may re-enter scene mutation methods, which must
   *  apply but not record. The caller fires exactly one `notify()` after. */
  function withRecordingSuppressed<T>(fn: () => T): T {
    const prevSuppress = suppressRecording;
    suppressRecording = true;
    batchDepth++;
    const prevDirty = batchDirty;
    try {
      return fn();
    } finally {
      batchDepth--;
      suppressRecording = prevSuppress;
      batchDirty = prevDirty;
    }
  }

  /** Run an engine step that replays recorded ops — undo, redo, goto, a
   *  journal stepping. The engine inverts whole ops when one throws; this
   *  also reverts the scene writes of the op that threw partway. */
  function replay(step: () => void): void {
    atomically(() => withLocksLifted(() => stale.during(() => withRecordingSuppressed(step))), () => true);
  }

  function executeAndLog(kind: string, payload: unknown, label: string): void {
    if (suppressRecording) {
      runOp(kind, payload);
      logApplied(kind, payload);
      notify();
      return;
    }
    if (currentBatch) {
      runOp(kind, payload);
      logApplied(kind, payload);
      currentBatch.ops.push(makeOp(kind, payload));
      notify();
      return;
    }
    // The engine applies the op itself (inside applyOps) — no separate
    // runOp call, or the mutation would run twice.
    history.applyOps([makeOp(kind, payload)], label);
    notify();
  }

  // ── Public Scene object ────────────────────────────────────────────────

  // Register consumer-supplied ops up front.
  if (options.ops) {
    for (const [k, h] of Object.entries(options.ops)) {
      registered.set(k, h);
    }
  }

  const { history: sceneHistory, methods: historyMethods } = createSceneHistory({
    engine: history,
    applying: (step) => atomically(() => withRecordingSuppressed(step), () => true),
    tolerant: stale.tolerant,
    replay,
    notify,
    refuseUntracked,
    runArrivalEdit,
  });

  function applyBatchNow(ops: Op[], label: string, adapter: unknown): void {
    const journal: Journal | null = (activeJournalAccessor ?? (() => null))();
    // Either route drives mutations from a history engine, so scene-side
    // recording is suppressed: op applies that re-enter scene mutation
    // methods via the adapter must mutate without re-recording. batchDepth
    // coalesces the per-op notify() calls into one dispatch at the end.
    const prevSuppress = suppressRecording;
    const prevDirty = batchDirty;
    suppressRecording = true;
    batchDepth++;
    batchDirty = false;
    try {
      atomically(() => {
        // Either engine stores the ops and replays them later, so they are
        // rebound to this call's adapter: the scene's own engine, and any
        // journal opened on it, was built without one.
        const bound = ops.map((op) => carried.recording(stale.tolerant(bindOpToAdapter(op, adapter))));
        if (journal) journal.applyBatch(bound, label);
        else history.applyOps(bound, label);
      }, () => true);
    } finally {
      batchDepth--;
      suppressRecording = prevSuppress;
      // Re-merge any outer batch's pending dirt so a nested call can't
      // swallow it; at true top level prevDirty is always false.
      batchDirty = batchDirty || prevDirty;
      // Flush inside finally so a throwing op can't strand subscribers
      // after earlier ops in the batch already mutated state.
      if (batchDepth === 0 && batchDirty) {
        batchDirty = false;
        for (const listener of listeners) listener();
      }
    }
  }

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
      if (parent !== null && bareLayoutEdit()) {
        // A bare add under a container is an edit of its own, so it settles
        // its arrival like one — as a batch, which is what makes the
        // arrangement part of the same undo step.
        return scene.batch(`add ${spec.kind}`, () => scene.add(spec));
      }
      const sibs = siblingsOf(parent);
      const index = spec.index ?? sibs.length;
      noteArrival(id, parent, null);
      const payload = {
        id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
        parent, index,
        ...(spec.dependsOn !== undefined ? { dependsOn: spec.dependsOn } : {}),
        ...statedFields(spec),
        ...fnKeysOf(fnFields, { ...spec, id, kind: spec.kind } as unknown as FnBearingNode, 'opKey'),
      };
      executeAndLog('kit:add', payload, `add ${spec.kind}`);
      patchNodeFunctions(spec, id, payload);
      return id;
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
      // Ephemeral, and ids are reusable: an override left behind would
      // reattach itself to whatever is added under this id next.
      for (const nid of ids) overrides.clear(nid);
      const fnKeys = snapshot.flatMap((n) => {
        const keys = fnKeysOf(fnFields, n as unknown as FnBearingNode, 'opKey');
        return Object.keys(keys).length === 0 ? [] : [{ id: n.id, ...keys }];
      });
      const payload: RemoveSnapshot<TData, TLayer, TPose> = {
        nodes: snapshot, detached,
        ...(fnKeys.length > 0 ? { fnKeys } : {}),
      };
      if (detached.some((d) => d.parent !== null) && bareLayoutEdit()) {
        scene.batch('remove', () => scene.removeMany(rootIds));
        return;
      }
      for (const d of detached) noteDeparture(d.id, d.parent, null);
      executeAndLog('kit:remove', payload, 'remove');
    },

    update(id, patch) {
      const node = requireNode(id);
      refuseLocked(id, 'update');
      executeAndLog('kit:setData', { id, from: node.data, to: patch.data }, 'update');
    },

    setPose(id, pose) {
      const node = requireNode(id);
      refuseLocked(id, 'set the pose of');
      if (node.kind === 'container' && resized(layoutFrame, id, node.pose, pose)) {
        if (bareLayoutEdit()) {
          scene.batch('setPose', () => scene.setPose(id, pose));
          return;
        }
        noteChange(id);
      }
      carried.wrote(id, node.pose, pose);
      executeAndLog('kit:setPose', { id, from: node.pose, to: pose }, 'setPose');
    },

    carry(id, pose) {
      if (carried.carries()) scene.setPose(id, pose);
    },

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
        executeAndLog('kit:setLayer', { id, from: node.layer, to: layer }, 'setLayer');
      } else {
        scene.batch('setLayer', () => {
          for (const sid of subtree) {
            const cur = requireNode(sid);
            if (cur.layer === layer) continue;
            executeAndLog('kit:setLayer', { id: sid, from: cur.layer, to: layer }, 'setLayer');
          }
        });
      }
    },

    setDependsOn(id, dependsOn) {
      const node = requireNode(id);
      refuseLocked(id, 'retarget');
      if (sameDependsOn(node.dependsOn, dependsOn)) return;
      executeAndLog(
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
      if (to !== null) hasLayouts = true;
      if (bareLayoutEdit()) {
        scene.batch('setLayout', () => scene.setLayout(id, to));
        return;
      }
      noteChange(id);
      const fromKey = from === null ? undefined : field.keyOf(from);
      const toKey = to === null ? undefined : field.keyOf(to);
      const payload: SetLayoutPayload = {
        id,
        ...(fromKey !== undefined ? { fromKey } : {}),
        ...(toKey !== undefined ? { toKey } : {}),
      };
      layoutRefs.set(payload, { from, to });
      executeAndLog('kit:setLayout', payload, 'setLayout');
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
      if ((parent !== null || node.parent !== null) && bareLayoutEdit()) {
        scene.batch('move', () => scene.move(id, parent, index));
        return;
      }
      const fromSibs = siblingsOf(node.parent);
      const fromIndex = fromSibs.indexOf(id);
      const toSibs = parent === node.parent ? fromSibs : siblingsOf(parent);
      const toIndex = index ?? toSibs.length;
      noteArrival(id, parent, node.parent);
      noteDeparture(id, node.parent, parent);
      noteChange(node.parent);
      executeAndLog('kit:move', {
        id, fromParent: node.parent, fromIndex, toParent: parent, toIndex,
      }, 'move');
    },

    reorder(id, index) {
      const node = requireNode(id);
      refuseLocked(id, 'reorder');
      if (node.parent !== null && bareLayoutEdit()) {
        scene.batch('reorder', () => scene.reorder(id, index));
        return;
      }
      noteChange(node.parent);
      const sibs = siblingsOf(node.parent);
      const fromIndex = sibs.indexOf(id);
      executeAndLog('kit:move', {
        id, fromParent: node.parent, fromIndex, toParent: node.parent, toIndex: index,
      }, 'reorder');
    },

    setLayerVisible(layer, visible) {
      const i = requireLayerIndex(layer);
      executeAndLog('kit:setLayerVisible', { layer, from: state.layers[i].visible, to: visible }, 'setLayerVisible');
    },

    setLayerLocked(layer, locked) {
      const i = requireLayerIndex(layer);
      executeAndLog('kit:setLayerLocked', { layer, from: state.layers[i].locked, to: locked }, 'setLayerLocked');
    },

    setLayerParallax(layer, parallax) {
      const i = requireLayerIndex(layer);
      executeAndLog(
        'kit:setLayerParallax',
        { layer, from: state.layers[i].parallax, to: parallax },
        'setLayerParallax',
      );
    },

    isLocked: (id) => isLockedInternal(id),

    unlocked: (fn) => withLocksLifted(fn),

    addLayer(spec) {
      if (state.layerIndex.has(spec.id)) {
        throw new Error(`Scene: duplicate layer id "${spec.id}"`);
      }
      const index = spec.index ?? state.layers.length;
      const clamped = Math.max(0, Math.min(index, state.layers.length));
      const record: UserLayerRecord<TLayer> = {
        kind: 'user',
        id: spec.id,
        name: spec.name,
        visible: spec.visible ?? true,
        locked: spec.locked ?? false,
        ...(spec.parallax ? { parallax: spec.parallax } : {}),
      };
      executeAndLog('kit:addLayer', { record, index: clamped }, 'addLayer');
    },

    removeLayer(layer) {
      const index = requireLayerIndex(layer);
      const rec = state.layers[index];
      if (rec.kind !== 'user') {
        throw new Error(`Scene: cannot remove system layer "${layer}"`);
      }
      // A layer operation, like the lock toggle: taking a locked layer away
      // takes its nodes with it.
      withLocksLifted(() => scene.batch('removeLayer', () => {
        const tagged: NodeId[] = [];
        for (const [id, node] of state.nodes) {
          if (node.layer === layer) tagged.push(id);
        }
        scene.removeMany(tagged);
        const finalIndex = requireLayerIndex(layer);
        executeAndLog('kit:removeLayer', { record: rec, index: finalIndex }, 'removeLayer');
      }));
    },

    renameLayer(layer, name) {
      const rec = state.layers[requireLayerIndex(layer)];
      if (rec.kind !== 'user') {
        throw new Error(`Scene: cannot rename system layer "${layer}"`);
      }
      executeAndLog('kit:renameLayer', { layer, from: rec.name, to: name }, 'renameLayer');
    },

    moveLayer(layer, index) {
      const from = requireLayerIndex(layer);
      const to = Math.max(0, Math.min(index, state.layers.length - 1));
      if (from === to) return;
      // Build the proposed order and a temp index map, then verify the
      // child-below-parent invariant holds for every node before mutating.
      const proposed = [...state.layers];
      const [rec] = proposed.splice(from, 1);
      proposed.splice(to, 0, rec);
      const tempIndex = new Map<TLayer, number>();
      for (let i = 0; i < proposed.length; i++) tempIndex.set(proposed[i].id, i);
      for (const node of state.nodes.values()) {
        if (node.parent === null) continue;
        const parent = state.nodes.get(node.parent);
        if (!parent) continue;
        if (tempIndex.get(node.layer)! < tempIndex.get(parent.layer)!) {
          throw new Error(
            `Scene: moveLayer("${layer}", ${index}) — a child may not render below its parent's layer`,
          );
        }
      }
      executeAndLog('kit:moveLayer', { layer, from, to }, 'moveLayer');
    },

    registerOp(kind, handler) {
      if (kind.startsWith('kit:')) {
        throw new Error(`Scene: op kind "${kind}" is reserved (kit:* prefix)`);
      }
      registered.set(kind, handler as RegisteredOp<unknown>);
    },

    recordOp(op) {
      executeAndLog(op.kind, op.payload, op.kind);
    },

    setActiveJournalAccessor(fn) {
      activeJournalAccessor = fn;
    },

    applyBatch(ops, label, adapter) {
      refuseUntracked('applyBatch');
      return runArrivalEdit(ops, (all) => applyBatchNow(all, label, adapter));
    },

    setArrivalHandler: arrivalWindow.setHandler,

    layoutOf: layoutOfInternal,

    setUnits(id, units) {
      const node = requireNode(id);
      if (node.kind !== 'container') throw new Error(`Scene: "${id}" is not a container`);
      refuseLocked(id, 'set the units of');
      executeAndLog('kit:setUnits', { id, from: node.units, to: units ?? undefined }, 'setUnits');
    },

    onReflow: arrivalWindow.onReflow,

    overrides,

    getSelection: () => selection,

    setSelection(ids) {
      selection = reachable([...ids]);
      notify();
    },

    history: sceneHistory,

    ...historyMethods,

    setHistoryAdapter(fn) {
      historyAdapterAccessor = fn;
    },

    batch(label, fn) {
      // Captured at open, not at recordEntry: by the time the batch closes
      // the selection has already moved to wherever the batch put it.
      const outermost = batchDepth === 0;
      if (outermost) currentBatch = { label, ops: [], selectionBefore: selection };
      const ownsArrivals = outermost && openArrivals(true);
      batchDepth++;
      try {
        if (!outermost) return fn();
        try {
          const result = atomically(() => {
            const r = fn();
            if (ownsArrivals) for (const p of settleArrivals()) scene.setPose(asNodeId(p.id), p.to as TPose);
            return r;
          }, () => (currentBatch?.ops.length ?? 0) > 0);
          if (ownsArrivals) emitReflow();
          return result;
        } catch (err) {
          // Reverted already; the half-built entry must not reach history.
          currentBatch = null;
          throw err;
        }
      } finally {
        batchDepth--;
        if (ownsArrivals) arrivalWindow.abandon();
        if (batchDepth === 0) {
          if (currentBatch) {
            const finished = currentBatch;
            currentBatch = null;
            // Ops were applied live as they were issued (state stays
            // readable mid-batch); recordEntry pushes without re-applying.
            if (finished.ops.length > 0) {
              history.recordEntry(finished.ops, finished.label, { selectionBefore: finished.selectionBefore });
            }
          }
          if (batchDirty) {
            batchDirty = false;
            for (const listener of listeners) listener();
          }
        }
      }
    },

    untracked(fn) {
      const prevSuppress = suppressRecording;
      const versionBefore = version;
      suppressRecording = true;
      untrackedDepth++;
      const ownsArrivals = openArrivals(true);
      batchDepth++;
      try {
        const result = atomically(() => {
          const r = fn();
          if (ownsArrivals) for (const p of settleArrivals()) scene.setPose(asNodeId(p.id), p.to as TPose);
          return r;
        }, () => false);
        if (ownsArrivals) emitReflow();
        return result;
      } finally {
        batchDepth--;
        if (ownsArrivals) arrivalWindow.abandon();
        untrackedDepth--;
        suppressRecording = prevSuppress;
        if (version !== versionBefore) history.seal();
        if (batchDepth === 0 && batchDirty) {
          batchDirty = false;
          for (const listener of listeners) listener();
        }
      }
    },

    toJSON: () => serializeScene(state, fnFields),

    loadState(json) {
      // Validate + map up front (throws before we touch live state on a bad
      // version or unknown registry key).
      const specs = specsFromSerialized(json, registry);
      if (batchDepth > 0) {
        throw new Error('Scene: cannot loadState inside batch() or untracked() — it replaces the state they would revert to');
      }
      // Ephemeral, and every id is a new node after this.
      overrides.clearAll();
      // Reset node + layer state.
      dependents.clear();
      childDerived.clear();
      state.nodes.clear();
      state.roots.length = 0;
      state.layers.length = 0;
      state.layerIndex.clear();
      invalidateOrder();
      for (let i = 0; i < json.systemLayers.length; i++) {
        const spec = json.systemLayers[i];
        if (state.layerIndex.has(spec.id)) {
          throw new Error(`Scene.loadState: duplicate system layer id "${spec.id}"`);
        }
        state.layers.push(layerFromSerialized(spec));
        state.layerIndex.set(spec.id, i);
      }
      history.clear();
      // Rebuild nodes (bypass the log, exactly like construction).
      applyConstructionSpecs(specs);
      selection = selection.filter((id) => state.nodes.has(id));
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getVersion: () => version,
  };

  /** Insert nodes without writing to the undo log — used by construction
   *  (`options.initial`) and by `loadState`. Specs must list parents before
   *  children (the order `toJSON()` emits). Throws on id collision, unknown
   *  layer, non-container parent, or cross-layer subtree. */
  function applyConstructionSpecs(specs: readonly AddNodeSpec<TData, TLayer, TPose>[]): void {
    for (const spec of specs) {
      // Bypass the log: we want construction to start with empty history.
      const id = spec.id ?? generateId();
      if (state.nodes.has(id)) {
        throw new Error(`Scene: id collision on "${id}"`);
      }
      requireLayerIndex(spec.layer);
      const parent = spec.parent ?? null;
      if (parent !== null) {
        const p = requireNode(parent);
        if (p.kind !== 'container') {
          throw new Error(`Scene: parent "${parent}" is not a container`);
        }
        assertSubtreeLayer(spec.id, spec.layer, parent, p.layer);
      }
      const sibs = siblingsOf(parent);
      const index = spec.index ?? sibs.length;
      runOp('kit:add', {
        id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
        parent, index,
        ...(spec.dependsOn !== undefined ? { dependsOn: spec.dependsOn } : {}),
        ...statedFields(spec),
      });
      // No `kit:add` reaches history here, so nothing replays one. A restore
      // after `remove` comes from `kit:remove`'s revert, which clones the
      // whole node and carries every field along.
      patchNodeFunctions(spec, id, null);
    }
  }

  // Apply initial nodes (not undoable — they're part of the construction).
  if (options.initial) {
    applyConstructionSpecs(options.initial);
    notify();
  }

  return scene;
}

/** The scene's selection in the shape `createHistory` wants, for a consumer
 *  building a second History over the same scene (a modality machine, a
 *  journal owner) that should restore selection the way the scene's own
 *  history does. */
export function sceneSelectionStore(scene: {
  getSelection(): readonly NodeId[];
  setSelection(ids: readonly NodeId[]): void;
}): HistorySelection {
  return {
    get: () => scene.getSelection(),
    set: (ids) => scene.setSelection(ids as readonly NodeId[]),
  };
}

/** Reconstruct a Scene from a JSON snapshot produced by `scene.toJSON()`.
 *  Function fields (e.g., `clipFromPose`) are resolved by string key via the
 *  registry passed in `options`. Throws on unknown version, unknown registry
 *  keys, or invalid scene shape (cross-layer subtrees, unknown layer ids).
 *  Loaded scenes start with empty history — undo/redo is NOT serialized. */
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
  const registry = options.registry ?? {};
  // Built empty and then loaded, so the snapshot's layer stack is rebuilt by
  // the one reader that knows how — `createScene` mints system layers only.
  const scene = createScene<TData, TLayer, TPose>({
    ...options,
    systemLayers: json.systemLayers.map((l) => ({ id: l.id })),
    registry,
  });
  scene.loadState(json);
  return scene;
}
