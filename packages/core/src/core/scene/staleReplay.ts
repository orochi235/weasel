/**
 * What a replay does with an op whose node or layer is not where its entry left it.
 *
 * An untracked edit changes the tree without the history stack hearing of it,
 * so an entry can name a node or layer that edit removed, or add one it already put
 * back. Replaying such an op is skipped rather than refused: a refusal leaves
 * the entry on top of its stack, and every entry beneath it out of reach. The
 * inverse of a skipped op is skipped too, so undo then redo changes nothing.
 */
import type { RemoveSnapshot } from './kitOps';
import { hasChildren } from './treeShape';
import type { Node, NodeId } from './types';

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
  const holds = (id: NodeId | null): boolean => id === null || nodes.has(id);
  const onLayer = (layer: TLayer): boolean => {
    for (const n of nodes.values()) if (n.layer === layer) return true;
    return false;
  };
  const childless = (id: NodeId, within?: ReadonlySet<NodeId>): boolean => {
    const node = nodes.get(id);
    return node === undefined || !hasChildren(node) || node.children.every((c) => within?.has(c) === true);
  };

  function stale(kind: string, payload: unknown, forward: boolean): boolean {
    switch (kind) {
      case 'kit:add': {
        const p = payload as { id: NodeId; parent: NodeId | null; layer: TLayer };
        return forward ? nodes.has(p.id) || !holds(p.parent) || !layers.has(p.layer) : !nodes.has(p.id) || !childless(p.id);
      }
      case 'kit:remove': {
        const p = payload as RemoveSnapshot<TData, TLayer, TPose>;
        if (!forward) return p.nodes.some((n) => nodes.has(n.id) || !layers.has(n.layer)) || !p.detached.every((d) => holds(d.parent));
        const taken = new Set(p.nodes.map((n) => n.id));
        return !p.nodes.every((n) => nodes.has(n.id) && childless(n.id, taken));
      }
      case 'kit:move': {
        const p = payload as { id: NodeId; fromParent: NodeId | null; toParent: NodeId | null };
        return !nodes.has(p.id) || !holds(forward ? p.toParent : p.fromParent);
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
      case 'kit:setPose':
      case 'kit:setData':
      case 'kit:setDependsOn':
      case 'kit:setLayout':
      case 'kit:setUnits':
      case 'kit:setClip':
      case 'kit:setPage':
      case 'kit:setPageRun':
      case 'kit:setHidden':
      case 'kit:setLocked':
        return !nodes.has((payload as { id: NodeId }).id);
      default:
        return false;
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
