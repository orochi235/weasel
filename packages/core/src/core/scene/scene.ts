import { createHistory, type HistorySelection, type Journal, type SerializedHistory } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { rebuildOp as rebuildGlobalOp } from 'core/ops/registry';
import { dwarn } from 'debug/flag';
import { createDependentsIndex } from './dependents';
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import { createPoseOverrides } from './poseOverrides';
import {
  asNodeId,
  type AddNodeSpec,
  type ContainerNode,
  type LayerRecord,
  type LeafNode,
  type Node,
  type NodeId,
  type RegisteredOp,
  type Scene,
  type SceneRegistry,
  type SerializedNode,
  type SerializedScene,
  type SystemLayerSpec,
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
export function createScene<TData, TLayer extends string, TPose = import('../../features/groups/composePose').RectPose>(
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

  // Per-scene registry for non-serializable function fields. The forward map
  // (key -> function) is used by sceneFromJSON; the reverse map (function ->
  // key) is used by toJSON to identify which factory a container is using.
  const registry = options.registry ?? {};
  const reverseClipFromPose = new Map<
    NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>,
    string
  >();
  if (registry.clipFromPose) {
    for (const [key, fn] of Object.entries(registry.clipFromPose)) {
      reverseClipFromPose.set(fn, key);
    }
  }
  const reverseDerive = new Map<NonNullable<Node<TData, TLayer, TPose>['derive']>, string>();
  if (registry.derive) {
    for (const [key, fn] of Object.entries(registry.derive)) {
      reverseDerive.set(fn, key);
    }
  }

  /**
   * Side-channel cache of `clipFromPose` functions keyed by node id.
   * Because `clipFromPose` is a function it cannot travel through the
   * serializable op payload. When `scene.add` or the `initial` loader calls
   * `patchClipFromPose`, we also store the function here so the `kit:add`
   * redo path can re-attach it after replaying the op.
   *
   * Entries are pruned at two natural hook points — both delivered via the
   * history engine's `onEvict` callback — to prevent unbounded growth:
   *   1. When the redo stack is cleared by a new op (branch-on-edit): any
   *      kit:add in the discarded entries that references a node absent from
   *      `state.nodes` is permanently unreachable — its cache entry is dropped.
   *   2. When the undo stack overflows `historyLimit` and evicts the oldest
   *      entry: same reasoning applies to the evicted entries.
   * Invariant: after pruning, no entry remains for a node that is both absent
   * from `state.nodes` AND unreachable via any remaining undo/redo log entry.
   */
  const pendingClipPatches = new Map<NodeId, NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>>();

  /** The same side-channel as `pendingClipPatches`, for `derive`. Pruned by
   *  the same `onEvict` scan; see that comment for the invariant. */
  const pendingDerivePatches = new Map<NodeId, NonNullable<Node<TData, TLayer, TPose>['derive']>>();

  /** Maintained from `kit:add` / `kit:remove` — the only two places a node is
   *  created or destroyed, and unlike `add`/`remove` they replay on undo/redo. */
  const dependents = createDependentsIndex();

  /** Walks `id`'s whole subtree. Not required while `Scene` stores absolute
   *  poses and the render walks compose nothing; it is here so `derive`'s
   *  world-pose contract still holds if they ever do. */
  function invalidateDependents(id: NodeId): void {
    if (dependents.isEmpty()) return;
    const subtree: NodeId[] = [id];
    descendants(id, subtree);
    for (const src of subtree) {
      for (const dep of dependents.transitiveDependentsOf(src)) {
        const node = state.nodes.get(dep);
        if (node !== undefined) dropPoseKeyedMemoSlots(node);
      }
    }
  }

  for (let i = 0; i < options.systemLayers.length; i++) {
    const spec = options.systemLayers[i];
    if (state.layerIndex.has(spec.id)) {
      throw new Error(`useScene: duplicate system layer id "${spec.id}"`);
    }
    state.layers.push({
      kind: 'system',
      id: spec.id,
      visible: spec.visible ?? true,
      locked: spec.locked ?? false,
    });
    state.layerIndex.set(spec.id, i);
  }

  const generateId = options.generateId ?? defaultGenerateId;

  const listeners = new Set<() => void>();
  const registered = new Map<string, RegisteredOp<unknown>>();

  // Accessor for the adapter restored external ops apply against.
  let historyAdapterAccessor: (() => unknown) | null = null;

  /** Wrap a globally-rebuilt external op so apply resolves the history
   *  adapter lazily — wiring order vs restoreHistory doesn't matter. An
   *  unset accessor makes the op a debug-warned no-op, and an apply that
   *  throws (e.g. the wired adapter lacks a method the op calls) degrades
   *  the same way — never throws mid-undo, matching the placeholder
   *  degradation policy. (The engine pops entries before applying, so an
   *  uncaught throw would corrupt the stacks.) See `bindOpToAdapter` for
   *  the live `applyBatch` path (fixed call-site adapter). */
  function bindOpToHistoryAdapter(op: Op): Op {
    return {
      name: op.name,
      args: op.args,
      label: op.label,
      coalesceKey: op.coalesceKey,
      apply: () => {
        const get = historyAdapterAccessor;
        if (!get) {
          dwarn('scene', `restored op "${op.name ?? '?'}" has no history adapter — skipping (setHistoryAdapter was not wired)`);
          return 'noop';
        }
        try {
          return op.apply(get());
        } catch (err) {
          dwarn('scene', `restored op "${op.name ?? '?'}" failed against the history adapter — skipping: ${String(err)}`);
          return 'noop';
        }
      },
      invert: () => bindOpToHistoryAdapter(op.invert()),
    };
  }

  // The scene's undo/redo engine. Recorded ops are `makeOp` wrappers over
  // `registered` handlers, so the engine's adapter argument is unused (the
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

  // wrappers close over their payloads). Eviction (branch-edit redo-clears
  // + historyLimit overflow) drives pendingClipPatches pruning via onEvict.
  const history = createHistory(undefined, {
    selection: {
      get: () => selection,
      set: (ids) => { selection = ids as readonly NodeId[]; notify(); },
    },
    ...(options.coalesceWindowMs !== undefined ? { coalesceWindowMs: options.coalesceWindowMs } : {}),
    ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
    onEvict: (entry) => {
      // forwardOps and baseOps are the same array until a coalesce splits
      // them, so the double scan is cheap today and correct later.
      pruneCacheForDroppedOps(entry.forwardOps);
      pruneCacheForDroppedOps(entry.baseOps);
    },
    // Restore-time rebuild: scene-registered kinds (kit:* + consumer
    // registerOp) rebuild via makeOp; external ops rebuild via the global
    // op-factory registry, wrapped in the lazy history-adapter binding.
    // Return null only when the global registry also misses — the engine
    // then places its no-op placeholder. (The engine's own global-registry
    // fallback never fires for scene histories: this hook already
    // consulted it.)
    rebuildOp: (name, args) => {
      if (registered.has(name)) return makeOp(name, args);
      const rebuilt = rebuildGlobalOp(name, args);
      return rebuilt === null ? null : bindOpToHistoryAdapter(rebuilt);
    },
  });

  let version = 0;
  let batchDepth = 0;
  let currentBatch: { label: string; ops: Op[]; selectionBefore: readonly NodeId[] } | null = null;
  /** True while the history engine drives mutations (undo/redo/goto, journal
   *  routing) — suppresses scene-side history recording so engine-applied
   *  ops that re-enter scene mutation methods don't record twice. */
  let suppressRecording = false;

  // ── Helpers ────────────────────────────────────────────────────────────
  // When `batchDepth > 0` the per-op `notify()` is coalesced: we still bump
  // the version so getVersion() reflects in-progress mutations, but we defer
  // listener dispatch until the outermost batch closes. This avoids one
  // React re-render per op during high-frequency gestures (e.g. snap moves
  // that emit ~10 transform ops per pointer-move).
  let batchDirty = false;
  // Mutable accessor for the active journal — seeded from options and
  // swappable via `scene.setActiveJournalAccessor(fn)` so mode machines that
  // depend on `scene.history` can wire it after construction.
  let activeJournalAccessor: (() => Journal | null) | null =
    options.getActiveJournal ?? null;
  function notify(): void {
    version++;
    if (batchDepth > 0) {
      batchDirty = true;
      return;
    }
    for (const listener of listeners) listener();
  }

  /**
   * Prune `pendingClipPatches` / `pendingDerivePatches` entries for nodes
   * referenced only by ops in entries that just became permanently unreachable
   * (redo entries dropped by a branch edit, or undo entries evicted by
   * `historyLimit`) — wired to the engine's `onEvict`. An entry is safe to drop
   * when the node is absent from `state.nodes`: its only path back into the
   * scene was through these now-unreachable ops.
   */
  function pruneCacheForDroppedOps(ops: readonly Op[]): void {
    if (pendingClipPatches.size === 0 && pendingDerivePatches.size === 0) return;
    for (const op of ops) {
      if (op.name !== 'kit:add') continue;
      const id = (op.args as { id?: NodeId } | null)?.id;
      if (id && !state.nodes.has(id)) {
        pendingClipPatches.delete(id);
        pendingDerivePatches.delete(id);
      }
    }
  }

  function requireNode(id: NodeId): Node<TData, TLayer, TPose> {
    const n = state.nodes.get(id);
    if (!n) throw new Error(`Scene: unknown node id "${id}"`);
    return n;
  }

  function requireLayerIndex(layer: TLayer): number {
    const i = state.layerIndex.get(layer);
    if (i === undefined) throw new Error(`Scene: unknown layer "${layer}"`);
    return i;
  }

  /** Repopulate `state.layerIndex` from the current `state.layers` order.
   *  Call after any op that inserts, removes, or reorders a layer record. */
  function rebuildLayerIndex(): void {
    invalidateOrder();
    state.layerIndex.clear();
    for (let i = 0; i < state.layers.length; i++) {
      state.layerIndex.set(state.layers[i].id, i);
    }
  }

  /**
   * A child may sit on its parent's layer **or any layer above it** (higher
   * render index) — never below. `renderOrder()` / `toJSON()` are layer-major
   * (each node yielded in its OWN layer's pass) and `buildSceneTree` buckets by
   * each node's own layer, so a child on a higher layer than its parent renders
   * correctly on top while staying a tree child for hit-testing / move /
   * reparent (e.g. plantings tagged into a top `plantings` layer while remaining
   * children of their container). Rejecting only the *below* case keeps the
   * sensible invariant that a child never paints under its own parent.
   */
  function assertSubtreeLayer(
    nodeId: string | undefined,
    nodeLayer: TLayer,
    parentId: NodeId,
    parentLayer: TLayer,
    verb: 'place' | 'relayer' = 'place',
  ): void {
    if (requireLayerIndex(nodeLayer) < requireLayerIndex(parentLayer)) {
      const action = verb === 'place'
        ? `cannot place node '${nodeId ?? '<new>'}' on layer '${nodeLayer}' under parent '${parentId}' on layer '${parentLayer}'`
        : `cannot setLayer('${nodeId ?? '<new>'}', '${nodeLayer}') — node has parent '${parentId}' on layer '${parentLayer}'`;
      throw new Error(`Scene: ${action} — a child may not render below its parent's layer`);
    }
  }

  function siblingsOf(parent: NodeId | null): NodeId[] {
    if (parent === null) return state.roots;
    const p = requireNode(parent);
    if (p.kind !== 'container') {
      throw new Error(`Scene: parent "${parent}" is not a container`);
    }
    return p.children;
  }

  function detach(id: NodeId): { parent: NodeId | null; index: number } {
    const node = requireNode(id);
    const sibs = siblingsOf(node.parent);
    const idx = sibs.indexOf(id);
    if (idx < 0) throw new Error(`Scene: node "${id}" not found in its parent's children`);
    sibs.splice(idx, 1);
    invalidateOrder();
    return { parent: node.parent, index: idx };
  }

  function attach(id: NodeId, parent: NodeId | null, index: number): void {
    const sibs = siblingsOf(parent);
    const i = Math.max(0, Math.min(index, sibs.length));
    sibs.splice(i, 0, id);
    const node = requireNode(id);
    (node as { parent: NodeId | null }).parent = parent;
    invalidateOrder();
  }

  function descendants(id: NodeId, out: NodeId[]): void {
    const n = state.nodes.get(id);
    if (!n || n.kind !== 'container') return;
    for (const c of n.children) {
      out.push(c);
      descendants(c, out);
    }
  }

  /** Everything removing `rootIds` takes with it: each root's subtree, then
   *  every node deriving from any of those, then those nodes' subtrees in turn.
   *  A dependent is not a descendant, so the second pass is a separate
   *  reachability walk; `ids` grows as it runs, which is what carries the
   *  cascade transitively and upward through a dependent's own ancestors. */
  function removalClosure(rootIds: readonly NodeId[]): {
    ids: NodeId[];
    removing: Set<NodeId>;
  } {
    const ids: NodeId[] = [];
    const removing = new Set<NodeId>();
    function take(id: NodeId): void {
      if (removing.has(id)) return;
      removing.add(id);
      ids.push(id);
      const sub: NodeId[] = [];
      descendants(id, sub);
      for (const s of sub) {
        if (removing.has(s)) continue;
        removing.add(s);
        ids.push(s);
      }
    }
    for (const root of rootIds) take(root);
    for (let i = 0; i < ids.length; i++) {
      for (const dep of dependents.transitiveDependentsOf(ids[i])) take(dep);
    }
    return { ids, removing };
  }

  /** Post-patch `clipFromPose` onto a container node after its `kit:add` op
   *  runs. The function cannot travel through the serializable op payload, so
   *  we attach it directly to the live node here. `cacheForRedo` also keeps the
   *  reference in `pendingClipPatches`, which is where the `kit:add` redo path
   *  reads it from — redo replays the op without a spec.
   *  No-op for leaves or when the spec has no `clipFromPose`. */
  function patchClipFromPose(
    spec: AddNodeSpec<TData, TLayer, TPose>,
    id: NodeId,
    { cacheForRedo }: { cacheForRedo: boolean },
  ): void {
    if (spec.kind === 'container' && spec.clipFromPose !== undefined) {
      (state.nodes.get(id) as ContainerNode<TData, TLayer, TPose>).clipFromPose = spec.clipFromPose;
      if (cacheForRedo) {
        pendingClipPatches.set(id, spec.clipFromPose as NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>);
      }
    }
  }

  /** `patchClipFromPose` for `derive`, on nodes of any kind. `dependsOn` is
   *  plain data and rides the `kit:add` payload instead. */
  function patchDerive(
    spec: AddNodeSpec<TData, TLayer, TPose>,
    id: NodeId,
    { cacheForRedo }: { cacheForRedo: boolean },
  ): void {
    if (spec.derive === undefined) return;
    state.nodes.get(id)!.derive = spec.derive;
    if (cacheForRedo) pendingDerivePatches.set(id, spec.derive);
  }

  // ── Internal kit op kinds ──────────────────────────────────────────────
  // These are registered like any other op; the kit's mutation methods build
  // serializable payloads and route through the same log/replay machinery.
  function registerKitOp<P>(kind: string, handler: RegisteredOp<P>): void {
    registered.set(kind, handler as RegisteredOp<unknown>);
  }

  registerKitOp<{
    id: NodeId; kind: 'leaf' | 'container'; layer: TLayer; pose: TPose; data: TData;
    parent: NodeId | null; index: number; clipKey?: string;
    dependsOn?: readonly NodeId[]; deriveKey?: string;
  }>('kit:add', {
    apply: (p) => {
      if (state.nodes.has(p.id)) {
        throw new Error(`Scene: id collision on "${p.id}"`);
      }
      const node: Node<TData, TLayer, TPose> = p.kind === 'container'
        ? ({ kind: 'container', id: p.id, layer: p.layer, pose: p.pose, data: p.data, parent: p.parent, children: [] } as ContainerNode<TData, TLayer, TPose>)
        : ({ kind: 'leaf', id: p.id, layer: p.layer, pose: p.pose, data: p.data, parent: p.parent } as LeafNode<TData, TLayer, TPose>);
      state.nodes.set(p.id, node);
      attach(p.id, p.parent, p.index);
      // Re-attach clipFromPose from the side-channel cache. This is the redo
      // path: the original apply (via scene.add) calls patchClipFromPose which
      // stores the function; redo replays kit:add without a spec, so we restore
      // from the cache instead.
      if (p.kind === 'container') {
        const cached = pendingClipPatches.get(p.id);
        if (cached) {
          (node as ContainerNode<TData, TLayer, TPose>).clipFromPose = cached;
        } else if (p.clipKey !== undefined) {
          // Restore path: a fresh session has an empty cache, but the payload
          // carries the registry key the function was registered under. Seed
          // the cache so later undo/redo cycles behave like the live path.
          const fn = registry.clipFromPose?.[p.clipKey];
          if (fn) {
            (node as ContainerNode<TData, TLayer, TPose>).clipFromPose = fn;
            pendingClipPatches.set(p.id, fn as NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>);
          } else {
            dwarn('scene', `kit:add: clipKey "${p.clipKey}" not in this scene's registry — container "${p.id}" restored without clip. Register a function with this key in the registry option to restore the clip.`);
          }
        }
      }
      if (p.dependsOn !== undefined) node.dependsOn = p.dependsOn;
      dependents.add(p.id, p.dependsOn ?? []);
      // Same redo/restore pair as clipFromPose above, minus the container guard.
      const cachedDerive = pendingDerivePatches.get(p.id);
      if (cachedDerive) {
        node.derive = cachedDerive;
      } else if (p.deriveKey !== undefined) {
        const fn = registry.derive?.[p.deriveKey];
        if (fn) {
          node.derive = fn;
          pendingDerivePatches.set(p.id, fn);
        } else {
          dwarn('scene', `kit:add: deriveKey "${p.deriveKey}" not in this scene's registry — node "${p.id}" restored without derived geometry. Register a function with this key in the registry option to restore it.`);
        }
      }
      invalidateDependents(p.id);
    },
    revert: (p) => {
      detach(p.id);
      state.nodes.delete(p.id);
      dependents.remove(p.id);
      invalidateDependents(p.id);
      // Note: we intentionally do NOT delete the pendingClipPatches entry —
      // redo will re-apply the node and re-attach clipFromPose from it.
    },
  });

  /**
   * Snapshot of every node a removal deletes, so revert restores it exactly.
   *
   * A cascade unlinks several disjoint subtrees, not one, so `detached` names
   * each node the tree has to re-link; everything else in `nodes` has a parent
   * that is also going and rides back in that parent's cloned `children`.
   * Entries are sorted by ascending sibling index — globally rather than
   * per-parent, because only same-parent order constrains re-insertion and
   * entries under different parents never interact.
   */
  interface RemoveSnapshot {
    nodes: Node<TData, TLayer, TPose>[];
    detached: { id: NodeId; parent: NodeId | null; index: number }[];
  }
  // Neither half invalidates dependents: removal's closure takes every live one.
  registerKitOp<RemoveSnapshot>('kit:remove', {
    apply: (p) => {
      for (const d of p.detached) detach(d.id);
      for (const n of p.nodes) {
        state.nodes.delete(n.id);
        dependents.remove(n.id);
      }
    },
    revert: (p) => {
      // Order-independent: every clone carries its own parent and children.
      for (const n of p.nodes) {
        const clone: Node<TData, TLayer, TPose> = n.kind === 'container'
          ? { ...n, children: [...n.children] }
          : { ...n };
        state.nodes.set(n.id, clone);
        dependents.add(n.id, clone.dependsOn ?? []);
      }
      for (const d of p.detached) attach(d.id, d.parent, d.index);
    },
  });

  registerKitOp<{ id: NodeId; from: TPose; to: TPose }>('kit:setPose', {
    apply: (p) => {
      (requireNode(p.id) as { pose: TPose }).pose = p.to;
      invalidateDependents(p.id);
    },
    revert: (p) => {
      (requireNode(p.id) as { pose: TPose }).pose = p.from;
      invalidateDependents(p.id);
    },
  });

  registerKitOp<{ id: NodeId; from: TData; to: TData }>('kit:setData', {
    apply: (p) => { (requireNode(p.id) as { data: TData }).data = p.to; },
    revert: (p) => { (requireNode(p.id) as { data: TData }).data = p.from; },
  });

  registerKitOp<{ id: NodeId; from: TLayer; to: TLayer }>('kit:setLayer', {
    apply: (p) => {
      requireLayerIndex(p.to);
      (requireNode(p.id) as { layer: TLayer }).layer = p.to;
      invalidateOrder();
    },
    revert: (p) => {
      (requireNode(p.id) as { layer: TLayer }).layer = p.from;
      invalidateOrder();
    },
  });

  registerKitOp<{
    id: NodeId; fromParent: NodeId | null; fromIndex: number;
    toParent: NodeId | null; toIndex: number;
  }>('kit:move', {
    apply: (p) => {
      detach(p.id);
      attach(p.id, p.toParent, p.toIndex);
      invalidateDependents(p.id);
    },
    revert: (p) => {
      detach(p.id);
      attach(p.id, p.fromParent, p.fromIndex);
      invalidateDependents(p.id);
    },
  });

  registerKitOp<{ layer: TLayer; from: boolean; to: boolean }>('kit:setLayerVisible', {
    apply: (p) => { state.layers[requireLayerIndex(p.layer)].visible = p.to; },
    revert: (p) => { state.layers[requireLayerIndex(p.layer)].visible = p.from; },
  });

  registerKitOp<{ layer: TLayer; from: boolean; to: boolean }>('kit:setLayerLocked', {
    apply: (p) => { state.layers[requireLayerIndex(p.layer)].locked = p.to; },
    revert: (p) => { state.layers[requireLayerIndex(p.layer)].locked = p.from; },
  });

  registerKitOp<{ record: UserLayerRecord<TLayer>; index: number }>('kit:addLayer', {
    apply: (p) => {
      state.layers.splice(p.index, 0, { ...p.record });
      rebuildLayerIndex();
    },
    revert: (p) => {
      state.layers.splice(p.index, 1);
      rebuildLayerIndex();
    },
  });

  registerKitOp<{ record: LayerRecord<TLayer>; index: number }>('kit:removeLayer', {
    apply: (p) => {
      state.layers.splice(p.index, 1);
      rebuildLayerIndex();
    },
    revert: (p) => {
      state.layers.splice(p.index, 0, { ...p.record } as LayerRecord<TLayer>);
      rebuildLayerIndex();
    },
  });

  registerKitOp<{ layer: TLayer; from: string; to: string }>('kit:renameLayer', {
    apply: (p) => {
      (state.layers[requireLayerIndex(p.layer)] as UserLayerRecord<TLayer>).name = p.to;
    },
    revert: (p) => {
      (state.layers[requireLayerIndex(p.layer)] as UserLayerRecord<TLayer>).name = p.from;
    },
  });

  registerKitOp<{ layer: TLayer; from: number; to: number }>('kit:moveLayer', {
    apply: (p) => {
      const [rec] = state.layers.splice(p.from, 1);
      state.layers.splice(p.to, 0, rec);
      rebuildLayerIndex();
    },
    revert: (p) => {
      const [rec] = state.layers.splice(p.to, 1);
      state.layers.splice(p.from, 0, rec);
      rebuildLayerIndex();
    },
  });

  // ── Op execution (used by both kit mutations and consumer recordOp) ────
  function runOp(kind: string, payload: unknown): void {
    const handler = registered.get(kind);
    if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
    handler.apply(payload);
  }

  /** Bridge a registered scene op into an engine `Op`: a direction-flipping
   *  wrapper over the `RegisteredOp`'s `apply`/`revert` pair. `invert()`
   *  flips the direction with the same payload, so undo replays `revert`
   *  and redo replays `apply` — no per-op inverse code. `name`/`args` carry
   *  the (kind, payload) pair for eviction pruning (and, later,
   *  serialization). Handler lookup happens at apply time so re-registered
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
        (dir === 'fwd' ? handler.apply : handler.revert)(payload);
      },
      invert: () => makeOp(kind, payload, dir === 'fwd' ? 'rev' : 'fwd'),
    };
  }

  /** Rebind an external op to the adapter supplied at the `applyBatch` call
   *  site — the scene's engine was constructed without an adapter, so ops
   *  it stores and later replays must close over the right one. Forwards
   *  the apply return value (no-op detection) and preserves
   *  `coalesceKey`/`name`/`args`/`label` for coalescing and eviction. See
   *  `bindOpToHistoryAdapter` for RESTORED entries (lazy accessor). */
  function bindOpToAdapter(op: Op, adapter: unknown): Op {
    return {
      name: op.name,
      args: op.args,
      label: op.label,
      coalesceKey: op.coalesceKey,
      apply: () => op.apply(adapter),
      invert: () => bindOpToAdapter(op.invert(), adapter),
    };
  }

  /** Best-effort coalesce-grouping token: node ops carry `payload.id`,
   *  layer ops `payload.layer`. Payloads with neither get no key and never
   *  coalesce (the engine treats a missing key on either side as
   *  "new entry"). Keys only take effect when the scene opts in via
   *  `UseSceneOptions.coalesceWindowMs` (default `0`, which disables
   *  coalescing entirely). */
  function coalesceKeyFor(kind: string, payload: unknown): string | undefined {
    if (payload === null || typeof payload !== 'object') return undefined;
    const p = payload as { id?: unknown; layer?: unknown };
    const token =
      typeof p.id === 'string' ? p.id
      : typeof p.layer === 'string' ? p.layer
      : undefined;
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

  function executeAndLog(kind: string, payload: unknown, label: string): void {
    if (suppressRecording) {
      runOp(kind, payload);
      notify();
      return;
    }
    if (currentBatch) {
      runOp(kind, payload);
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

  /**
   * Layer-major DFS-preorder ids, and the same sequence as nodes. Four walks
   * for two sequences, which wants explaining, because collapsing them is the
   * obvious cleanup and each collapse was measured to cost something:
   *
   * - ids vs nodes: projecting one from the other is a whole extra pass, worth
   *   20% of `renderOrder()` on a multi-layer scene.
   * - flat vs bucketed: a single layer needs no buckets and can compare the
   *   layer id instead of indexing it, which is 1.4x. Behind a branch in one
   *   function it also slows the bucketed path by 20% — the two shapes share
   *   one optimized body, and whichever ran first wins it.
   *
   * All four emit the same order and `renderOrder.test.ts` holds them to it.
   */
  function renderOrderInternal(): NodeId[] {
    return state.layers.length === 1 ? renderOrderFlat() : renderOrderBucketed();
  }

  function renderOrderNodesInternal(): Node<TData, TLayer, TPose>[] {
    return state.layers.length === 1 ? renderOrderNodesFlat() : renderOrderNodesBucketed();
  }

  /**
   * Render order survives everything except a structural edit, so both walks
   * are cached against a counter the structural writers bump: `attach` and
   * `detach` (add / remove / reparent / reorder), `kit:setLayer` (which bucket
   * a node lands in), `rebuildLayerIndex` (the layer list itself), and
   * `loadState`. Pose and data edits leave order alone and must NOT invalidate
   * — they fire per frame during a drag, which is exactly when the cache pays.
   *
   * A missed bump is a silent wrong answer: nodes painted in the wrong z-order,
   * or unpickable. `renderOrder.test.ts` walks each structural op and asserts
   * the order moved.
   */
  let structureGeneration = 0;
  let orderCache: {
    gen: number;
    ids?: NodeId[];
    nodes?: Node<TData, TLayer, TPose>[];
  } = { gen: 0 };

  function invalidateOrder(): void {
    structureGeneration++;
  }

  function currentOrderCache(): typeof orderCache {
    if (orderCache.gen !== structureGeneration) {
      orderCache = { gen: structureGeneration };
    }
    return orderCache;
  }

  function renderOrderFlat(): NodeId[] {
    const only = state.layers[0].id;
    const out: NodeId[] = [];
    const stack: NodeId[] = [...state.roots].reverse();
    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = state.nodes.get(id);
      if (!node) continue;
      if (node.layer === only) out.push(id);
      if (node.kind === 'container') {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
    return out;
  }

  function renderOrderNodesFlat(): Node<TData, TLayer, TPose>[] {
    const only = state.layers[0].id;
    const out: Node<TData, TLayer, TPose>[] = [];
    const stack: NodeId[] = [...state.roots].reverse();
    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = state.nodes.get(id);
      if (!node) continue;
      if (node.layer === only) out.push(node);
      if (node.kind === 'container') {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
    return out;
  }

  /** One DFS of the tree, bucketed by layer: appending in preorder keeps each
   *  bucket in preorder, so concatenating them is the layer-major sequence. */
  function renderOrderBucketed(): NodeId[] {
    const buckets: NodeId[][] = state.layers.map(() => []);
    const stack: NodeId[] = [...state.roots].reverse();
    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = state.nodes.get(id);
      if (!node) continue;
      const bucket = buckets[state.layerIndex.get(node.layer) ?? -1];
      if (bucket) bucket.push(id);
      if (node.kind === 'container') {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
    const out: NodeId[] = [];
    for (const bucket of buckets) {
      for (const id of bucket) out.push(id);
    }
    return out;
  }

  function renderOrderNodesBucketed(): Node<TData, TLayer, TPose>[] {
    const buckets: Node<TData, TLayer, TPose>[][] = state.layers.map(() => []);
    const stack: NodeId[] = [...state.roots].reverse();
    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = state.nodes.get(id);
      if (!node) continue;
      const bucket = buckets[state.layerIndex.get(node.layer) ?? -1];
      if (bucket) bucket.push(node);
      if (node.kind === 'container') {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
    const out: Node<TData, TLayer, TPose>[] = [];
    for (const bucket of buckets) {
      for (const node of bucket) out.push(node);
    }
    return out;
  }

  const scene: Scene<TData, TLayer, TPose> = {
    get nodes() { return state.nodes; },
    get roots() { return state.roots; },
    get layers() { return state.layers; },

    get(id) { return state.nodes.get(id); },

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

    renderOrder() {
      const c = currentOrderCache();
      return (c.ids ??= renderOrderInternal());
    },

    renderOrderNodes() {
      const c = currentOrderCache();
      return (c.nodes ??= renderOrderNodesInternal());
    },

    add(spec) {
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
      const clipKey = spec.kind === 'container' && spec.clipFromPose !== undefined
        ? reverseClipFromPose.get(spec.clipFromPose as NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>)
        : undefined;
      const deriveKey = spec.derive !== undefined ? reverseDerive.get(spec.derive) : undefined;
      executeAndLog('kit:add', {
        id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
        parent, index,
        ...(clipKey !== undefined ? { clipKey } : {}),
        ...(spec.dependsOn !== undefined ? { dependsOn: spec.dependsOn } : {}),
        ...(deriveKey !== undefined ? { deriveKey } : {}),
      }, `add ${spec.kind}`);
      // clipFromPose is a function and cannot travel through the serializable
      // op payload. Patch it directly onto the live node after the op applies.
      patchClipFromPose(spec, id, { cacheForRedo: true });
      patchDerive(spec, id, { cacheForRedo: true });
      return id;
    },

    remove(id) {
      scene.removeMany([id]);
    },

    removeMany(rootIds) {
      if (rootIds.length === 0) return;
      // Every id resolves against the pre-removal tree, so an id another one
      // cascades away is absorbed rather than being a second, failing removal.
      const { ids, removing } = removalClosure(rootIds);
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
      const payload: RemoveSnapshot = { nodes: snapshot, detached };
      executeAndLog('kit:remove', payload, 'remove');
    },

    update(id, patch) {
      const node = requireNode(id);
      executeAndLog('kit:setData', { id, from: node.data, to: patch.data }, 'update');
    },

    setPose(id, pose) {
      const node = requireNode(id);
      executeAndLog('kit:setPose', { id, from: node.pose, to: pose }, 'setPose');
    },

    setLayer(id, layer) {
      requireLayerIndex(layer);
      const node = requireNode(id);
      if (node.parent !== null) {
        const parentNode = requireNode(node.parent);
        assertSubtreeLayer(id, layer, node.parent, parentNode.layer, 'relayer');
      }
      if (node.layer === layer) return;
      // DFS preorder: collect id + all descendants.
      const subtree: NodeId[] = [];
      const stack: NodeId[] = [id];
      while (stack.length > 0) {
        const curId = stack.pop()!;
        const cur = state.nodes.get(curId);
        if (!cur) continue;
        subtree.push(curId);
        if (cur.kind === 'container') {
          for (let i = cur.children.length - 1; i >= 0; i--) {
            stack.push(cur.children[i]);
          }
        }
      }
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

    move(id, parent, index) {
      const node = requireNode(id);
      if (parent !== null) {
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
      const fromSibs = siblingsOf(node.parent);
      const fromIndex = fromSibs.indexOf(id);
      const toSibs = parent === node.parent ? fromSibs : siblingsOf(parent);
      const toIndex = index ?? toSibs.length;
      executeAndLog('kit:move', {
        id, fromParent: node.parent, fromIndex, toParent: parent, toIndex,
      }, 'move');
    },

    reorder(id, index) {
      const node = requireNode(id);
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
      };
      executeAndLog('kit:addLayer', { record, index: clamped }, 'addLayer');
    },

    removeLayer(layer) {
      const index = requireLayerIndex(layer);
      const rec = state.layers[index];
      if (rec.kind !== 'user') {
        throw new Error(`Scene: cannot remove system layer "${layer}"`);
      }
      scene.batch('removeLayer', () => {
        const tagged: NodeId[] = [];
        for (const [id, node] of state.nodes) {
          if (node.layer === layer) tagged.push(id);
        }
        scene.removeMany(tagged);
        const finalIndex = requireLayerIndex(layer);
        executeAndLog('kit:removeLayer', { record: rec, index: finalIndex }, 'removeLayer');
      });
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
      const journal: Journal | null = (activeJournalAccessor ?? (() => null))();
      // Either route drives mutations from a history engine (the journal's
      // inner history, or the scene's own), so scene-side recording is
      // suppressed for the duration: op applies that re-enter scene
      // mutation methods via the adapter must mutate without re-recording.
      // batchDepth coalesces the per-op notify() calls (same as
      // scene.batch); exactly one listener dispatch fires at the end —
      // mirroring the single-notification semantics callers expect.
      const prevSuppress = suppressRecording;
      const prevDirty = batchDirty;
      suppressRecording = true;
      batchDepth++;
      batchDirty = false;
      try {
        if (journal) {
          journal.applyBatch(ops, label);
        } else {
          // Native path: record the external ops themselves as one engine
          // entry — coalescible across applyBatch calls via their own
          // coalesceKeys — rebound to this call's adapter.
          history.applyOps(ops.map((op) => bindOpToAdapter(op, adapter)), label);
        }
      } finally {
        batchDepth--;
        suppressRecording = prevSuppress;
        // Re-merge any outer batch's pending dirt so a nested call can't
        // swallow it; at true top level prevDirty is always false.
        batchDirty = batchDirty || prevDirty;
        // Flush inside finally so a throwing op can't strand subscribers
        // after earlier ops in the batch already mutated state (mirrors
        // scene.batch). Depth-guarded: a nested context defers to the
        // outermost flush.
        if (batchDepth === 0 && batchDirty) {
          batchDirty = false;
          for (const listener of listeners) listener();
        }
      }
    },

    overrides,

    getSelection: () => selection,

    setSelection(ids) {
      selection = [...ids];
      notify();
    },

    undo() {
      if (!history.canUndo()) return false;
      withRecordingSuppressed(() => history.undo());
      notify();
      return true;
    },

    redo() {
      if (!history.canRedo()) return false;
      withRecordingSuppressed(() => history.redo());
      notify();
      return true;
    },

    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),

    /** Read-only snapshot of every history entry currently reachable from
     *  the present state. Order: oldest applied first, then redoable
     *  entries in the order they'd be re-applied (top of redo stack last).
     *  Each entry's `id` is stable for the entry's lifetime. */
    historyEntries() {
      const { undo, redo } = history.entries();
      const out: { id: string; label: string }[] = [];
      for (const e of undo) out.push({ id: String(e.id), label: e.label });
      // entries().redo is already chronological: the next redo comes first.
      for (const e of redo) out.push({ id: String(e.id), label: e.label });
      return out;
    },

    /** Index of the "current state". `0` = nothing applied (initial);
     *  equals the number of applied (undoable) entries —
     *  `historyEntries().length` when fully redone. */
    historyIndex: () => history.undoDepth(),

    /** Walk to a target history index by calling undo/redo repeatedly.
     *  Caps at the valid range; returns true if the index changed. */
    jumpToHistoryIndex(targetIndex: number) {
      const total = history.undoDepth() + history.redoDepth();
      const target = Math.max(0, Math.min(total, targetIndex));
      if (target === history.undoDepth()) return false;
      withRecordingSuppressed(() => history.goto(target));
      notify();
      return true;
    },

    serializeHistory: () => history.serialize(),

    restoreHistory(snapshot: SerializedHistory) {
      // restore() only rebuilds the stacks — no op applies, no node-state
      // mutation. The caller guarantees state already matches the head.
      history.restore(snapshot);
      notify();
    },

    setHistoryAdapter(fn) {
      historyAdapterAccessor = fn;
    },

    batch(label, fn) {
      // Captured at open, not at recordEntry: by the time the batch closes
      // the selection has already moved to wherever the batch put it.
      if (batchDepth === 0) currentBatch = { label, ops: [], selectionBefore: selection };
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
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
          // Fire one coalesced notify if any op inside the batch dirtied
          // state. Nested batches contribute to the same flush — only the
          // outermost emits.
          if (batchDirty) {
            batchDirty = false;
            for (const listener of listeners) listener();
          }
        }
      }
    },

    toJSON(): SerializedScene<TData, TLayer, TPose> {
      const nodes: SerializedNode<TData, TLayer, TPose>[] = [];
      for (const n of renderOrderNodesInternal()) {
        const id = n.id;
        const out: SerializedNode<TData, TLayer, TPose> = {
          id,
          kind: n.kind,
          layer: n.layer,
          pose: n.pose,
          data: n.data,
        };
        if (n.parent != null) out.parent = n.parent;
        if (n.kind === 'container' && n.clipFromPose) {
          const key = reverseClipFromPose.get(n.clipFromPose);
          if (!key) {
            throw new Error(
              `Scene.toJSON: container '${id}' has clipFromPose but no matching registry key. ` +
              `The function must be registered via createScene's registry option to round-trip.`
            );
          }
          out.clipFromPoseKey = key;
        }
        if (n.dependsOn && n.dependsOn.length > 0) out.dependsOn = n.dependsOn;
        if (n.derive) {
          const key = reverseDerive.get(n.derive);
          if (!key) {
            throw new Error(
              `Scene.toJSON: node '${id}' has derive but no matching registry key. ` +
              `The function must be registered via createScene's registry option to round-trip.`
            );
          }
          out.deriveKey = key;
        }
        nodes.push(out);
      }
      const systemLayers = state.layers.map((l) => {
        const layer: SystemLayerSpec<TLayer> = { id: l.id };
        if (l.visible === false) layer.visible = false;
        if (l.locked === true) layer.locked = true;
        return layer;
      });
      return { version: 1, systemLayers, nodes };
    },

    loadState(json) {
      // Validate + map up front (throws before we touch live state on a bad
      // version or unknown registry key).
      const specs = specsFromSerialized(json, registry);
      // Reset node + layer state.
      dependents.clear();
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
        state.layers.push({
          kind: 'system',
          id: spec.id,
          visible: spec.visible ?? true,
          locked: spec.locked ?? false,
        });
        state.layerIndex.set(spec.id, i);
      }
      // Clear history + transient batch/clip caches.
      history.clear();
      pendingClipPatches.clear();
      pendingDerivePatches.clear();
      currentBatch = null;
      batchDepth = 0;
      batchDirty = false;
      // Rebuild nodes (bypass the log, exactly like construction).
      applyConstructionSpecs(specs);
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
      });
      // No `kit:add` reaches history here, so nothing ever replays these and
      // `pruneCacheForDroppedOps` — which only scans `kit:add` — could never
      // drop the entries. A restore after `remove` comes from `kit:remove`'s
      // revert, which clones the whole node and carries both fields along.
      patchClipFromPose(spec, id, { cacheForRedo: false });
      patchDerive(spec, id, { cacheForRedo: false });
    }
  }

  // Apply initial nodes (not undoable — they're part of the construction).
  if (options.initial) {
    applyConstructionSpecs(options.initial);
    notify();
  }

  // ── Internal / test-only access ───────────────────────────────────────
  // Attach private state accessors directly on the returned object, hidden
  // behind `as unknown` because Scene<> is the public interface.
  // __clipCacheSize / __deriveCacheSize: used only by test files to assert
  // prune behaviour.
  (scene as unknown as { __clipCacheSize: () => number }).__clipCacheSize =
    () => pendingClipPatches.size;
  (scene as unknown as { __deriveCacheSize: () => number }).__deriveCacheSize =
    () => pendingDerivePatches.size;

  return scene;
}

/** Map a `SerializedScene` to construction specs. Shared by `sceneFromJSON`
 *  (new instance) and `Scene.loadState` (in-place). Validates version and
 *  resolves `clipFromPoseKey` / `deriveKey` → function via the registry;
 *  throws on an unsupported version or an unknown registry key. */
function specsFromSerialized<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose>,
): AddNodeSpec<TData, TLayer, TPose>[] {
  if (json.version !== 1) {
    throw new Error(`Scene: unsupported version ${json.version}; only v1 supported`);
  }
  return json.nodes.map((n) => {
    const spec: AddNodeSpec<TData, TLayer, TPose> = {
      id: n.id as NodeId,
      kind: n.kind,
      layer: n.layer,
      pose: n.pose,
      data: n.data,
    };
    if (n.parent !== undefined) spec.parent = n.parent as NodeId;
    if (n.clipFromPoseKey !== undefined) {
      const fn = registry.clipFromPose?.[n.clipFromPoseKey];
      if (!fn) {
        throw new Error(
          `Scene: unknown clipFromPose key '${n.clipFromPoseKey}'. ` +
          `Register a function with this key in the registry option.`,
        );
      }
      (spec as { clipFromPose?: typeof fn }).clipFromPose = fn;
    }
    if (n.dependsOn !== undefined) spec.dependsOn = n.dependsOn as readonly NodeId[];
    if (n.deriveKey !== undefined) {
      const fn = registry.derive?.[n.deriveKey];
      if (!fn) {
        throw new Error(
          `Scene: unknown derive key '${n.deriveKey}'. ` +
          `Register a function with this key in the registry option.`,
        );
      }
      spec.derive = fn;
    }
    return spec;
  });
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
    registry?: SceneRegistry<TPose>;
    historyLimit?: number;
    coalesceWindowMs?: number;
    generateId?: () => NodeId;
    ops?: Readonly<Record<string, RegisteredOp<unknown>>>;
  },
): Scene<TData, TLayer, TPose> {
  const registry = options.registry ?? {};
  const initial = specsFromSerialized(json, registry);
  return createScene<TData, TLayer, TPose>({
    systemLayers: json.systemLayers,
    initial,
    registry,
    ...(options.historyLimit !== undefined ? { historyLimit: options.historyLimit } : {}),
    ...(options.coalesceWindowMs !== undefined ? { coalesceWindowMs: options.coalesceWindowMs } : {}),
    ...(options.generateId !== undefined ? { generateId: options.generateId } : {}),
    ...(options.ops !== undefined ? { ops: options.ops } : {}),
  });
}
