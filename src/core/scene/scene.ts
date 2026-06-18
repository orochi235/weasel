import type { Journal } from '@weasel-js/history';
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
} from './types';

interface LogEntry {
  id: string;
  label: string;
  ops: { kind: string; payload: unknown }[];
}

let logEntryCounter = 0;
function nextLogEntryId(): string {
  return `h${++logEntryCounter}`;
}

interface SceneState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  roots: NodeId[];
  layers: LayerRecord<TLayer>[];
  layerIndex: Map<TLayer, number>;
}

let defaultIdCounter = 0;
const defaultGenerateId = (): NodeId =>
  asNodeId(`n${(defaultIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

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

  /**
   * Side-channel cache of `clipFromPose` functions keyed by node id.
   * Because `clipFromPose` is a function it cannot travel through the
   * serializable op payload. When `scene.add` or the `initial` loader calls
   * `patchClipFromPose`, we also store the function here so the `kit:add`
   * redo path can re-attach it after replaying the op.
   *
   * Entries are pruned at two natural hook points to prevent unbounded growth:
   *   1. When `redoStack` is cleared by a new op (branch-on-edit): any kit:add
   *      in the discarded entries that references a node absent from
   *      `state.nodes` is permanently unreachable — its cache entry is dropped.
   *   2. When `undoStack` overflows `historyLimit` and evicts the oldest entry:
   *      same reasoning applies to the evicted entries.
   * Invariant: after pruning, no entry remains for a node that is both absent
   * from `state.nodes` AND unreachable via any remaining undo/redo log entry.
   */
  const pendingClipPatches = new Map<NodeId, NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>>();

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
  const historyLimit = options.historyLimit ?? Infinity;

  const undoStack: LogEntry[] = [];
  const redoStack: LogEntry[] = [];
  const listeners = new Set<() => void>();
  const registered = new Map<string, RegisteredOp<unknown>>();

  let version = 0;
  let batchDepth = 0;
  let currentBatch: LogEntry | null = null;
  /** True while inside undo/redo replay — suppresses log writes. */
  let replaying = false;

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
   * Prune `pendingClipPatches` entries for nodes that were referenced only by
   * the given dropped log entries (redoStack entries being discarded, or
   * undoStack entries evicted by `historyLimit`). An entry is safe to drop
   * when the node is absent from `state.nodes` — meaning its only path back
   * into the scene was through these now-unreachable log entries.
   */
  function pruneCacheForDroppedEntries(droppedEntries: LogEntry[]): void {
    if (pendingClipPatches.size === 0) return;
    for (const entry of droppedEntries) {
      for (const op of entry.ops) {
        if (op.kind !== 'kit:add') continue;
        const id = (op.payload as { id?: NodeId }).id;
        if (id && !state.nodes.has(id) && pendingClipPatches.has(id)) {
          pendingClipPatches.delete(id);
        }
      }
    }
  }

  function pushEntry(entry: LogEntry): void {
    if (replaying) return;
    if (currentBatch) {
      currentBatch.ops.push(...entry.ops);
      return;
    }
    undoStack.push(entry);
    // Hook 1: clear the redo stack ("branch on edit"). Any kit:add in the
    // cleared entries that refers to a node no longer in state.nodes is
    // permanently unreachable — drop the corresponding cache entry.
    const droppedRedo = redoStack.splice(0);
    pruneCacheForDroppedEntries(droppedRedo);
    // Hook 2: evict the oldest undo entries that overflow historyLimit.
    // Evicted entries are also permanently unreachable.
    while (undoStack.length > historyLimit) {
      const evicted = undoStack.shift()!;
      pruneCacheForDroppedEntries([evicted]);
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
    return { parent: node.parent, index: idx };
  }

  function attach(id: NodeId, parent: NodeId | null, index: number): void {
    const sibs = siblingsOf(parent);
    const i = Math.max(0, Math.min(index, sibs.length));
    sibs.splice(i, 0, id);
    const node = requireNode(id);
    (node as { parent: NodeId | null }).parent = parent;
  }

  function descendants(id: NodeId, out: NodeId[]): void {
    const n = state.nodes.get(id);
    if (!n || n.kind !== 'container') return;
    for (const c of n.children) {
      out.push(c);
      descendants(c, out);
    }
  }

  /** Post-patch `clipFromPose` onto a container node after its `kit:add` op
   *  runs. The function cannot travel through the serializable op payload, so
   *  we attach it directly to the live node here. Also caches the function in
   *  `pendingClipPatches` so the `kit:add` redo path can re-attach it.
   *  No-op for leaves or when the spec has no `clipFromPose`. */
  function patchClipFromPose(spec: AddNodeSpec<TData, TLayer, TPose>, id: NodeId): void {
    if (spec.kind === 'container' && spec.clipFromPose !== undefined) {
      (state.nodes.get(id) as ContainerNode<TData, TLayer, TPose>).clipFromPose = spec.clipFromPose;
      // Cache for redo: kit:add apply doesn't have access to the spec, so we
      // keep the function reference here and re-attach it after redo replays.
      pendingClipPatches.set(id, spec.clipFromPose as NonNullable<ContainerNode<TData, TLayer, TPose>['clipFromPose']>);
    }
  }

  // ── Internal kit op kinds ──────────────────────────────────────────────
  // These are registered like any other op; the kit's mutation methods build
  // serializable payloads and route through the same log/replay machinery.
  function registerKitOp<P>(kind: string, handler: RegisteredOp<P>): void {
    registered.set(kind, handler as RegisteredOp<unknown>);
  }

  registerKitOp<{
    id: NodeId; kind: 'leaf' | 'container'; layer: TLayer; pose: TPose; data: TData;
    parent: NodeId | null; index: number;
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
        }
      }
    },
    revert: (p) => {
      detach(p.id);
      state.nodes.delete(p.id);
      // Note: we intentionally do NOT delete the pendingClipPatches entry —
      // redo will re-apply the node and re-attach clipFromPose from it.
    },
  });

  // Remove captures a snapshot of the subtree so revert can restore it exactly.
  interface RemoveSnapshot {
    nodes: Node<TData, TLayer, TPose>[];
    parent: NodeId | null;
    index: number;
    rootId: NodeId;
  }
  registerKitOp<RemoveSnapshot>('kit:remove', {
    apply: (p) => {
      detach(p.rootId);
      for (const n of p.nodes) state.nodes.delete(n.id);
    },
    revert: (p) => {
      // Restore nodes in original order (parents before children).
      for (const n of p.nodes) {
        const clone: Node<TData, TLayer, TPose> = n.kind === 'container'
          ? { ...n, children: [...n.children] }
          : { ...n };
        state.nodes.set(n.id, clone);
      }
      attach(p.rootId, p.parent, p.index);
    },
  });

  registerKitOp<{ id: NodeId; from: TPose; to: TPose }>('kit:setPose', {
    apply: (p) => { (requireNode(p.id) as { pose: TPose }).pose = p.to; },
    revert: (p) => { (requireNode(p.id) as { pose: TPose }).pose = p.from; },
  });

  registerKitOp<{ id: NodeId; from: TData; to: TData }>('kit:setData', {
    apply: (p) => { (requireNode(p.id) as { data: TData }).data = p.to; },
    revert: (p) => { (requireNode(p.id) as { data: TData }).data = p.from; },
  });

  registerKitOp<{ id: NodeId; from: TLayer; to: TLayer }>('kit:setLayer', {
    apply: (p) => {
      requireLayerIndex(p.to);
      (requireNode(p.id) as { layer: TLayer }).layer = p.to;
    },
    revert: (p) => { (requireNode(p.id) as { layer: TLayer }).layer = p.from; },
  });

  registerKitOp<{
    id: NodeId; fromParent: NodeId | null; fromIndex: number;
    toParent: NodeId | null; toIndex: number;
  }>('kit:move', {
    apply: (p) => {
      detach(p.id);
      attach(p.id, p.toParent, p.toIndex);
    },
    revert: (p) => {
      detach(p.id);
      attach(p.id, p.fromParent, p.fromIndex);
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

  // ── Op execution (used by both kit mutations and consumer recordOp) ────
  function runOp(kind: string, payload: unknown): void {
    const handler = registered.get(kind);
    if (!handler) throw new Error(`Scene: no registered op for kind "${kind}"`);
    handler.apply(payload);
  }

  function executeAndLog(kind: string, payload: unknown, label: string): void {
    runOp(kind, payload);
    pushEntry({ id: nextLogEntryId(), label, ops: [{ kind, payload }] });
    notify();
  }

  // ── Public Scene object ────────────────────────────────────────────────

  // Register consumer-supplied ops up front.
  if (options.ops) {
    for (const [k, h] of Object.entries(options.ops)) {
      registered.set(k, h);
    }
  }

  /** Layer-major DFS-preorder iterator. Shared by renderOrder() and toJSON(). */
  function* renderOrderInternal(): Iterable<NodeId> {
    // For each layer in order, walk the entire tree DFS-preorder, yielding
    // any node whose layer matches.
    for (const layer of state.layers) {
      const stack: NodeId[] = [...state.roots].reverse();
      while (stack.length > 0) {
        const id = stack.pop()!;
        const node = state.nodes.get(id);
        if (!node) continue;
        if (node.layer === layer.id) yield id;
        if (node.kind === 'container') {
          for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
          }
        }
      }
    }
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
      return renderOrderInternal();
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
      executeAndLog('kit:add', {
        id, kind: spec.kind, layer: spec.layer, pose: spec.pose, data: spec.data,
        parent, index,
      }, `add ${spec.kind}`);
      // clipFromPose is a function and cannot travel through the serializable
      // op payload. Patch it directly onto the live node after the op applies.
      patchClipFromPose(spec, id);
      return id;
    },

    remove(id) {
      const node = requireNode(id);
      const sibs = siblingsOf(node.parent);
      const index = sibs.indexOf(id);
      // Snapshot subtree (root + descendants) so revert can restore it.
      const ids: NodeId[] = [id];
      descendants(id, ids);
      const snapshot: Node<TData, TLayer, TPose>[] = ids.map((nid) => {
        const n = requireNode(nid);
        return n.kind === 'container' ? { ...n, children: [...n.children] } : { ...n };
      });
      executeAndLog('kit:remove', {
        rootId: id, parent: node.parent, index, nodes: snapshot,
      }, 'remove');
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
      if (journal) {
        // Route through the journal. The journal's inner history will track the
        // ops; the scene's own undo stack must NOT also record them. We reuse
        // the `replaying` flag (which already suppresses `pushEntry`) to block
        // scene-side recording while op mutations happen through the adapter.
        //
        // We also increment batchDepth to coalesce the per-op notify() calls
        // (same as scene.batch does), then fire exactly one notify() at the
        // end — mirroring the single-notification semantics callers expect.
        replaying = true;
        batchDepth++;
        batchDirty = false;
        try {
          journal.applyBatch(ops, label);
        } finally {
          batchDepth--;
          replaying = false;
        }
        if (batchDirty) {
          batchDirty = false;
          for (const listener of listeners) listener();
        }
      } else {
        scene.batch(label, () => {
          for (const op of ops) op.apply(adapter);
        });
      }
    },

    undo() {
      const entry = undoStack.pop();
      if (!entry) return false;
      replaying = true;
      try {
        for (let i = entry.ops.length - 1; i >= 0; i--) {
          const o = entry.ops[i];
          const h = registered.get(o.kind);
          if (!h) throw new Error(`Scene: no registered op for kind "${o.kind}" during undo`);
          h.revert(o.payload);
        }
      } finally {
        replaying = false;
      }
      redoStack.push(entry);
      notify();
      return true;
    },

    redo() {
      const entry = redoStack.pop();
      if (!entry) return false;
      replaying = true;
      try {
        for (const o of entry.ops) runOp(o.kind, o.payload);
      } finally {
        replaying = false;
      }
      undoStack.push(entry);
      notify();
      return true;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    /** Read-only snapshot of every history entry currently reachable from
     *  the present state. Order: oldest applied first, then redoable
     *  entries in the order they'd be re-applied (top of redo stack last).
     *  Each entry's `id` is stable for the entry's lifetime. */
    historyEntries() {
      const out: { id: string; label: string }[] = [];
      for (const e of undoStack) out.push({ id: e.id, label: e.label });
      // redoStack is stored newest-first (push on undo); reverse so the
      // list reads oldest-first (next-redo is just past currentIndex).
      for (let i = redoStack.length - 1; i >= 0; i--) {
        const e = redoStack[i];
        out.push({ id: e.id, label: e.label });
      }
      return out;
    },

    /** Index of the "current state". `0` = nothing applied (initial);
     *  `undoStack.length` = at the head of history. Equals the count of
     *  entries currently on the undo stack. */
    historyIndex: () => undoStack.length,

    /** Walk to a target history index by calling undo/redo repeatedly.
     *  Caps at the valid range; returns true if the index changed. */
    jumpToHistoryIndex(targetIndex: number) {
      const total = undoStack.length + redoStack.length;
      const target = Math.max(0, Math.min(total, targetIndex));
      let moved = false;
      while (undoStack.length > target) {
        if (!this.undo()) break;
        moved = true;
      }
      while (undoStack.length < target) {
        if (!this.redo()) break;
        moved = true;
      }
      return moved;
    },

    batch(label, fn) {
      if (batchDepth === 0) currentBatch = { id: nextLogEntryId(), label, ops: [] };
      batchDepth++;
      try {
        return fn();
      } finally {
        batchDepth--;
        if (batchDepth === 0) {
          if (currentBatch) {
            const finished = currentBatch;
            currentBatch = null;
            if (finished.ops.length > 0) {
              undoStack.push(finished);
              // Hook 1 (batch path): same redo-stack clear as pushEntry.
              const droppedRedo = redoStack.splice(0);
              pruneCacheForDroppedEntries(droppedRedo);
              // Hook 2 (batch path): historyLimit eviction.
              while (undoStack.length > historyLimit) {
                const evicted = undoStack.shift()!;
                pruneCacheForDroppedEntries([evicted]);
              }
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
      for (const id of renderOrderInternal()) {
        const n = state.nodes.get(id);
        if (!n) continue;
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
      state.nodes.clear();
      state.roots.length = 0;
      state.layers.length = 0;
      state.layerIndex.clear();
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
      undoStack.length = 0;
      redoStack.length = 0;
      pendingClipPatches.clear();
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
      });
      patchClipFromPose(spec, id);
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
  // __clipCacheSize: used only by test files to assert prune behaviour.
  (scene as unknown as { __clipCacheSize: () => number }).__clipCacheSize =
    () => pendingClipPatches.size;

  return scene;
}

/** Map a `SerializedScene` to construction specs. Shared by `sceneFromJSON`
 *  (new instance) and `Scene.loadState` (in-place). Validates version and
 *  resolves `clipFromPoseKey` → function via the registry; throws on an
 *  unsupported version or an unknown registry key. */
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
    return spec;
  });
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
    ...(options.generateId !== undefined ? { generateId: options.generateId } : {}),
    ...(options.ops !== undefined ? { ops: options.ops } : {}),
  });
}
