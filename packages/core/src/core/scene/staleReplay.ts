/**
 * What a replay does with an op whose node or layer is not where its entry left it.
 *
 * An untracked edit changes the tree without the history stack hearing of it,
 * so an entry can name a node or layer that edit removed, or add one it already put
 * back. Replaying such an op is skipped rather than refused: a refusal leaves
 * the entry on top of its stack, and every entry beneath it out of reach. The
 * inverse of a skipped op is skipped too, so undo then redo changes nothing.
 */
import { DECLARED_FIELD_KINDS } from './declaredFieldSetters';
import type { RemoveSnapshot } from './kitOps';
import { NODE_FLAG_KINDS } from './nodeFlags';
import { hasChildren } from './treeShape';
import type { Node, NodeId } from './types';

/** Ops that edit one node, named by `id`, and nothing else. */
const NODE_KINDS: ReadonlySet<string> = new Set([
  'kit:setPose', 'kit:setData', 'kit:setDependsOn', 'kit:setLayout', ...DECLARED_FIELD_KINDS, ...NODE_FLAG_KINDS,
]);

/** A scene edit named a node the scene does not hold, or one it already does. */
export class SceneMembershipError extends Error {
  override name = 'SceneMembershipError';
}

export interface StaleReplay {
  /** Run a step that replays recorded ops. */
  during<T>(step: () => T): T;
  /** Whether replaying this kit op would address a node that is gone, or
   *  restore one that is already there. Always false outside `during`. */
  skips(kind: string, payload: unknown, forward: boolean): boolean;
}

export function createStaleReplay<TData, TLayer extends string, TPose>(
  nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>,
  layers: ReadonlyMap<TLayer, number>,
): StaleReplay {
  let replaying = 0;
  /** Kit payloads whose last replay was skipped, by the direction it ran in. */
  const skipped = new WeakMap<object, boolean>();
  const onLayer = (layer: TLayer): boolean => {
    for (const n of nodes.values()) if (n.layer === layer) return true;
    return false;
  };
  /** Whether a node on `layer` can sit under `parent`: the parent is there,
   *  is not `id` or below it, and paints no higher than `layer`. */
  const fits = (id: NodeId, layer: TLayer, parent: NodeId | null): boolean => {
    if (parent === null) return true;
    const p = nodes.get(parent);
    if (p === undefined || (layers.get(layer) ?? -1) < (layers.get(p.layer) ?? -1)) return false;
    for (let at: NodeId | null = parent; at !== null; at = nodes.get(at)?.parent ?? null) if (at === id) return false;
    return true;
  };
  const childless = (id: NodeId, within?: ReadonlySet<NodeId>): boolean => {
    const node = nodes.get(id);
    return node === undefined || !hasChildren(node) || node.children.every((c) => within?.has(c) === true);
  };

  function stale(kind: string, payload: unknown, forward: boolean): boolean {
    switch (kind) {
      case 'kit:add': {
        const p = payload as { id: NodeId; parent: NodeId | null; layer: TLayer };
        return forward ? nodes.has(p.id) || !layers.has(p.layer) || !fits(p.id, p.layer, p.parent) : !nodes.has(p.id) || !childless(p.id);
      }
      case 'kit:remove': {
        const p = payload as RemoveSnapshot<TData, TLayer, TPose>;
        if (!forward) {
          if (p.nodes.some((n) => nodes.has(n.id) || !layers.has(n.layer))) return true;
          const layerOf = new Map(p.nodes.map((n) => [n.id, n.layer]));
          return !p.detached.every((d) => fits(d.id, layerOf.get(d.id)!, d.parent));
        }
        const taken = new Set(p.nodes.map((n) => n.id));
        return !p.nodes.every((n) => nodes.has(n.id) && childless(n.id, taken));
      }
      case 'kit:move': {
        const p = payload as { id: NodeId; fromParent: NodeId | null; toParent: NodeId | null };
        const node = nodes.get(p.id);
        return node === undefined || !fits(p.id, node.layer, forward ? p.toParent : p.fromParent);
      }
      case 'kit:setLayer': {
        const p = payload as { id: NodeId; from: TLayer; to: TLayer };
        return !nodes.has(p.id) || !layers.has(forward ? p.to : p.from);
      }
      case 'kit:setLayerVisible':
      case 'kit:setLayerLocked':
      case 'kit:setLayerParallax':
      case 'kit:renameLayer':
      case 'kit:moveLayer':
        return !layers.has((payload as { layer: TLayer }).layer);
      case 'kit:addLayer':
      case 'kit:removeLayer': {
        const { id } = (payload as { record: { id: TLayer } }).record;
        const adds = (kind === 'kit:addLayer') === forward;
        // Taking away a layer nodes still sit on would leave them on none.
        return adds ? layers.has(id) : !layers.has(id) || onLayer(id);
      }
      default:
        return NODE_KINDS.has(kind) && !nodes.has((payload as { id: NodeId }).id);
    }
  }

  function skips(kind: string, payload: unknown, forward: boolean): boolean {
    if (replaying === 0 || typeof payload !== 'object' || payload === null) return false;
    if (skipped.get(payload) === !forward) return skipped.delete(payload);
    if (!stale(kind, payload, forward)) return false;
    skipped.set(payload, forward);
    return true;
  }

  return {
    during(step) {
      replaying++;
      try {
        return step();
      } finally {
        replaying--;
      }
    },
    skips,
  };
}
