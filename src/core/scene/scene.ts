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
  type UseSceneOptions,
} from './types';

interface LogEntry {
  label: string;
  ops: { kind: string; payload: unknown }[];
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
  function notify(): void {
    version++;
    if (batchDepth > 0) {
      batchDirty = true;
      return;
    }
    for (const listener of listeners) listener();
  }

  function pushEntry(entry: LogEntry): void {
    if (replaying) return;
    if (currentBatch) {
      currentBatch.ops.push(...entry.ops);
      return;
    }
    undoStack.push(entry);
    redoStack.length = 0;
    while (undoStack.length > historyLimit) undoStack.shift();
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

  function assertSubtreeLayer(
    nodeId: string | undefined,
    nodeLayer: TLayer,
    parentId: NodeId,
    parentLayer: TLayer,
    verb: 'place' | 'relayer' = 'place',
  ): void {
    if (parentLayer !== nodeLayer) {
      const action = verb === 'place'
        ? `cannot place node '${nodeId ?? '<new>'}' on layer '${nodeLayer}' under parent '${parentId}' on layer '${parentLayer}'`
        : `cannot setLayer('${nodeId ?? '<new>'}', '${nodeLayer}') — node has parent '${parentId}' on layer '${parentLayer}'`;
      throw new Error(`Scene: ${action} — subtree layer must match parent`);
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
   *  we attach it directly to the live node here. No-op for leaves or when
   *  the spec has no `clipFromPose`. */
  function patchClipFromPose(spec: AddNodeSpec<TData, TLayer, TPose>, id: NodeId): void {
    if (spec.kind === 'container' && spec.clipFromPose !== undefined) {
      (state.nodes.get(id) as ContainerNode<TData, TLayer, TPose>).clipFromPose = spec.clipFromPose;
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
    },
    revert: (p) => {
      detach(p.id);
      state.nodes.delete(p.id);
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
    pushEntry({ label, ops: [{ kind, payload }] });
    notify();
  }

  // ── Public Scene object ────────────────────────────────────────────────

  // Register consumer-supplied ops up front.
  if (options.ops) {
    for (const [k, h] of Object.entries(options.ops)) {
      registered.set(k, h);
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

    *renderOrder() {
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

    batch(label, fn) {
      if (batchDepth === 0) currentBatch = { label, ops: [] };
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
              redoStack.length = 0;
              while (undoStack.length > historyLimit) undoStack.shift();
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

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getVersion: () => version,
  };

  // Apply initial nodes (not undoable — they're part of the construction).
  if (options.initial) {
    for (const spec of options.initial) {
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
    notify();
  }

  return scene;
}
