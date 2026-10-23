/**
 * A scene's render order: its nodes layer-major, each layer in tree preorder,
 * cached until the structure changes.
 */
import { hasChildren } from './treeShape';
import type { Node, NodeId } from './types';

/** What the walks read of a scene's state. */
export interface RenderOrderState<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  roots: NodeId[];
  layers: { id: TLayer }[];
  layerIndex: Map<TLayer, number>;
}

export interface RenderOrder<TData, TLayer extends string, TPose> {
  ids(): NodeId[];
  nodes(): Node<TData, TLayer, TPose>[];
  nodesOnLayer(layer: TLayer): readonly Node<TData, TLayer, TPose>[];
  /** Call on every structural edit; see the cache note below. */
  invalidate(): void;
}

export function createRenderOrder<TData, TLayer extends string, TPose>(
  state: RenderOrderState<TData, TLayer, TPose>,
): RenderOrder<TData, TLayer, TPose> {
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
  function walkIds(): NodeId[] {
    return state.layers.length === 1 ? renderOrderFlat() : renderOrderBucketed();
  }

  function walkNodes(): Node<TData, TLayer, TPose>[] {
    return state.layers.length === 1 ? renderOrderNodesFlat() : renderOrderNodesBucketed();
  }

  /**
   * Render order survives everything except a structural edit, so both walks
   * are cached against a counter the structural writers bump. Pose and data
   * edits leave order alone and must NOT invalidate — they fire per frame
   * during a drag, which is exactly when the cache pays.
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
    byLayer?: Map<TLayer, Node<TData, TLayer, TPose>[]>;
  } = { gen: 0 };

  function invalidate(): void {
    structureGeneration++;
  }

  const EMPTY_NODES: readonly Node<TData, TLayer, TPose>[] = [];

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
      if (hasChildren(node)) {
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
      if (hasChildren(node)) {
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
      if (hasChildren(node)) {
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
      if (hasChildren(node)) {
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

  return {
    ids() {
      const c = currentOrderCache();
      return (c.ids ??= walkIds());
    },
    nodes() {
      const c = currentOrderCache();
      return (c.nodes ??= walkNodes());
    },
    nodesOnLayer(layer) {
      const c = currentOrderCache();
      let byLayer = c.byLayer;
      if (!byLayer) {
        byLayer = new Map();
        for (const node of (c.nodes ??= walkNodes())) {
          let bucket = byLayer.get(node.layer);
          if (!bucket) byLayer.set(node.layer, (bucket = []));
          bucket.push(node);
        }
        c.byLayer = byLayer;
      }
      return byLayer.get(layer) ?? EMPTY_NODES;
    },
    invalidate,
  };
}
