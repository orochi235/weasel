/**
 * The scene's layer stack: the ordered layer records, the index from a
 * layer's id to its place in that order, and the rule tying a node's layer to
 * its parent's.
 */
import type { LayerRecord, NodeId, UseSceneOptions } from './types';

/** What the stack keeps of a scene's state. */
export interface LayerStackState<TLayer extends string> {
  layers: LayerRecord<TLayer>[];
  layerIndex: Map<TLayer, number>;
}

/** Fill `state` with the declared system layers, and answer with the reads
 *  and the rebuild the rest of the scene uses. Throws on a duplicate id. */
export function createLayerStack<TLayer extends string>(
  state: LayerStackState<TLayer>,
  /** Called whenever the layer order changes. */
  invalidateOrder: () => void,
  systemLayers: UseSceneOptions<unknown, TLayer, unknown>['systemLayers'],
) {
  for (let i = 0; i < systemLayers.length; i++) {
    const spec = systemLayers[i];
    if (state.layerIndex.has(spec.id)) {
      throw new Error(`useScene: duplicate system layer id "${spec.id}"`);
    }
    state.layers.push({
      kind: 'system',
      id: spec.id,
      visible: spec.visible ?? true,
      locked: spec.locked ?? false,
      ...(spec.parallax ? { parallax: spec.parallax } : {}),
    });
    state.layerIndex.set(spec.id, i);
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

  return { requireLayerIndex, rebuildLayerIndex, assertSubtreeLayer };
}
