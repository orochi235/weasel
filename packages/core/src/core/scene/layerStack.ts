/**
 * The scene's layer stack: the ordered layer records, the index from a
 * layer's id to its place in that order, the rule tying a node's layer to
 * its parent's, and the edits a caller makes to the stack.
 */
import type { LayerRecord, Node, NodeId, Scene, UseSceneOptions, UserLayerRecord } from './types';

/** What the stack keeps of a scene's state. */
export interface LayerStackState<TLayer extends string> {
  layers: LayerRecord<TLayer>[];
  layerIndex: Map<TLayer, number>;
}

/** A declared system layer as the stack holds it. */
export function systemLayerRecord<TLayer extends string>(
  spec: UseSceneOptions<unknown, TLayer, unknown>['systemLayers'][number],
): LayerRecord<TLayer> {
  return {
    kind: 'system',
    id: spec.id,
    visible: spec.visible ?? true,
    locked: spec.locked ?? false,
    ...(spec.parallax ? { parallax: spec.parallax } : {}),
  };
}

/** The reads over `state`'s layers the rest of the scene uses, and the two
 *  ways the stack is rebuilt. It starts empty; `reset` fills it. */
export function createLayerStack<TLayer extends string>(
  state: LayerStackState<TLayer>,
  /** Called whenever the layer order changes. */
  invalidateOrder: () => void,
) {
  /** Replace the whole stack with `records`, in order. Throws on a duplicate
   *  id, leaving the stack holding the records before it. */
  function reset(records: readonly LayerRecord<TLayer>[]): void {
    state.layers.length = 0;
    state.layerIndex.clear();
    invalidateOrder();
    for (const record of records) {
      if (state.layerIndex.has(record.id)) {
        throw new Error(`Scene: duplicate ${record.kind} layer id "${record.id}"`);
      }
      state.layerIndex.set(record.id, state.layers.length);
      state.layers.push(record);
    }
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
   * render index) — never below. `renderOrder()` is layer-major
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

  return { reset, requireLayerIndex, rebuildLayerIndex, assertSubtreeLayer };
}

/** What the layer edits read of the scene, and what they record through. */
export interface LayerEditsEnv<TData, TLayer extends string, TPose> {
  layers: readonly LayerRecord<TLayer>[];
  layerIndex: ReadonlyMap<TLayer, number>;
  nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>;
  requireLayerIndex(layer: TLayer): number;
  /** Apply a kit op and record it as an edit. */
  record(kind: string, payload: unknown, label: string): void;
  /** Run with the lock guard lifted. */
  lifted<T>(fn: () => T): T;
  batch<T>(label: string, fn: () => T): T;
  removeMany(ids: readonly NodeId[]): void;
}

export type LayerEdits<TData, TLayer extends string, TPose> = Pick<
  Scene<TData, TLayer, TPose>,
  | 'setLayerVisible' | 'setLayerLocked' | 'setLayerParallax'
  | 'addLayer' | 'removeLayer' | 'renameLayer' | 'moveLayer'
>;

/** Throw when moving a layer to give `order` would put a child below its parent. */
function assertOrderKeepsChildrenAbove<TData, TLayer extends string, TPose>(
  nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>,
  order: readonly LayerRecord<TLayer>[],
  layer: TLayer,
  index: number,
): void {
  const place = new Map<TLayer, number>();
  for (let i = 0; i < order.length; i++) place.set(order[i].id, i);
  for (const node of nodes.values()) {
    if (node.parent === null) continue;
    const parent = nodes.get(node.parent);
    if (!parent) continue;
    if (place.get(node.layer)! < place.get(parent.layer)!) {
      throw new Error(
        `Scene: moveLayer("${layer}", ${index}) — a child may not render below its parent's layer`,
      );
    }
  }
}

export function createLayerEdits<TData, TLayer extends string, TPose>(
  env: LayerEditsEnv<TData, TLayer, TPose>,
): LayerEdits<TData, TLayer, TPose> {
  const { layers, nodes, requireLayerIndex, record } = env;

  function userLayer(layer: TLayer, verb: string): UserLayerRecord<TLayer> {
    const rec = layers[requireLayerIndex(layer)];
    if (rec.kind !== 'user') throw new Error(`Scene: cannot ${verb} system layer "${layer}"`);
    return rec;
  }

  return {
    setLayerVisible(layer, visible) {
      const rec = layers[requireLayerIndex(layer)];
      record('kit:setLayerVisible', { layer, from: rec.visible, to: visible }, 'setLayerVisible');
    },

    setLayerLocked(layer, locked) {
      const rec = layers[requireLayerIndex(layer)];
      record('kit:setLayerLocked', { layer, from: rec.locked, to: locked }, 'setLayerLocked');
    },

    setLayerParallax(layer, parallax) {
      const rec = layers[requireLayerIndex(layer)];
      record('kit:setLayerParallax', { layer, from: rec.parallax, to: parallax }, 'setLayerParallax');
    },

    addLayer(spec) {
      if (env.layerIndex.has(spec.id)) throw new Error(`Scene: duplicate layer id "${spec.id}"`);
      const index = Math.max(0, Math.min(spec.index ?? layers.length, layers.length));
      const layer: UserLayerRecord<TLayer> = {
        kind: 'user',
        id: spec.id,
        name: spec.name,
        visible: spec.visible ?? true,
        locked: spec.locked ?? false,
        ...(spec.parallax ? { parallax: spec.parallax } : {}),
      };
      record('kit:addLayer', { record: layer, index }, 'addLayer');
    },

    removeLayer(layer) {
      const rec = userLayer(layer, 'remove');
      // A layer operation, like the lock toggle: taking a locked layer away
      // takes its nodes with it.
      env.lifted(() => env.batch('removeLayer', () => {
        const tagged: NodeId[] = [];
        for (const [id, node] of nodes) {
          if (node.layer === layer) tagged.push(id);
        }
        env.removeMany(tagged);
        record('kit:removeLayer', { record: rec, index: requireLayerIndex(layer) }, 'removeLayer');
      }));
    },

    renameLayer(layer, name) {
      const rec = userLayer(layer, 'rename');
      record('kit:renameLayer', { layer, from: rec.name, to: name }, 'renameLayer');
    },

    moveLayer(layer, index) {
      const from = requireLayerIndex(layer);
      const to = Math.max(0, Math.min(index, layers.length - 1));
      if (from === to) return;
      const proposed = [...layers];
      const [rec] = proposed.splice(from, 1);
      proposed.splice(to, 0, rec);
      assertOrderKeepsChildrenAbove(nodes, proposed, layer, index);
      record('kit:moveLayer', { layer, from, to }, 'moveLayer');
    },
  };
}
