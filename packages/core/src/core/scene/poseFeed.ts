import { effectivePose } from './effectivePose';
import type { Node, NodeId, Scene } from './types';

/** A node and the pose a renderer should draw it at. `node.pose` beside it is
 *  still the committed pose, so a host has both without a second channel. */
export interface FeedNode<TData, TLayer extends string, TPose> {
  node: Node<TData, TLayer, TPose>;
  pose: TPose;
}

export interface FeedDelta<TData, TLayer extends string, TPose> {
  added: readonly FeedNode<TData, TLayer, TPose>[];
  removed: readonly NodeId[];
  changed: readonly FeedNode<TData, TLayer, TPose>[];
  /** Discard the object map and rebuild. */
  reset: boolean;
}

export interface PoseFeed<TData, TLayer extends string, TPose> {
  subscribe(fn: () => void): () => void;
  read(): FeedDelta<TData, TLayer, TPose>;
}

const EMPTY = Object.freeze([]) as readonly never[];

/** The three references a node carries that a renderer cares about. The node
 *  object is mutated in place, so it is these — not the node — that move. */
interface Snapshot<TData, TLayer extends string, TPose> {
  pose: TPose;
  data: TData;
  layer: TLayer;
}

export function createPoseFeed<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): PoseFeed<TData, TLayer, TPose> {
  let seen: Map<NodeId, Snapshot<TData, TLayer, TPose>> | null = null;
  let seenVersion = -1;
  let seenGeneration = -1;
  let seenOverridden: readonly NodeId[] = EMPTY;
  // `scene.roots` / `scene.layers` are mutated in place (splice), so their
  // identity never moves — `renderOrderNodes()` is the array the kit itself
  // documents as "cached until a structural edit", so its identity is the
  // real signal that render order (add/remove/move/reorder/setLayer/layer
  // edits) changed under us.
  let seenOrder: readonly Node<TData, TLayer, TPose>[] | null = null;

  const walk = (): {
    added: FeedNode<TData, TLayer, TPose>[];
    removed: NodeId[];
    changed: FeedNode<TData, TLayer, TPose>[];
  } => {
    const prev = seen!;
    const added: FeedNode<TData, TLayer, TPose>[] = [];
    const changed: FeedNode<TData, TLayer, TPose>[] = [];
    const removed: NodeId[] = [];
    const next = new Map<NodeId, Snapshot<TData, TLayer, TPose>>();

    for (const [id, node] of scene.nodes) {
      const pose = effectivePose(scene, node);
      next.set(id, { pose, data: node.data, layer: node.layer });
      const before = prev.get(id);
      if (before === undefined) added.push({ node, pose });
      else if (before.pose !== pose || before.data !== node.data || before.layer !== node.layer) {
        changed.push({ node, pose });
      }
    }
    for (const id of prev.keys()) if (!next.has(id)) removed.push(id);

    seen = next;
    return { added, removed, changed };
  };

  const resetTo = (): FeedDelta<TData, TLayer, TPose> => {
    // An empty `seen` makes the walk report every node as added, and fills the
    // snapshot map in the same pass.
    seen = new Map();
    seenVersion = scene.getVersion();
    seenGeneration = scene.overrides.getGeneration();
    seenOverridden = scene.overrides.ids();
    seenOrder = scene.renderOrderNodes();
    return { ...walk(), removed: EMPTY, changed: EMPTY, reset: true };
  };

  return {
    subscribe() {
      return () => {};
    },
    read() {
      if (seen === null) return resetTo();

      const version = scene.getVersion();
      const generation = scene.overrides.getGeneration();
      const committedMoved = version !== seenVersion;
      const overridesMoved = generation !== seenGeneration;

      if (!committedMoved && !overridesMoved) {
        return { added: EMPTY, removed: EMPTY, changed: EMPTY, reset: false };
      }

      const base = committedMoved
        ? walk()
        : {
            added: [] as FeedNode<TData, TLayer, TPose>[],
            removed: [] as NodeId[],
            changed: [] as FeedNode<TData, TLayer, TPose>[],
          };
      seenVersion = version;

      // A structural edit that neither adds, removes, nor changes any node's
      // tracked references (reorder; a reparent that leaves pose/data/layer
      // untouched) moves render order with nothing for the diff above to
      // report. `renderOrderNodes()`'s identity is the kit's own signal for
      // that — cached until a structural edit — so an empty diff alongside a
      // moved order means the walk missed a real change, not that there
      // wasn't one.
      if (
        committedMoved
        && base.added.length === 0 && base.removed.length === 0 && base.changed.length === 0
        && scene.renderOrderNodes() !== seenOrder
      ) {
        return resetTo();
      }
      if (committedMoved) seenOrder = scene.renderOrderNodes();

      if (overridesMoved) {
        const now = scene.overrides.ids();
        const touched = new Set<NodeId>(now);
        for (const id of seenOverridden) touched.add(id); // a cleared override moved too
        const already = new Set(base.changed.map((n) => n.node.id));
        for (const id of touched) {
          if (already.has(id)) continue;
          const node = scene.get(id);
          if (node !== undefined) base.changed.push({ node, pose: effectivePose(scene, node) });
        }
        seenGeneration = generation;
        seenOverridden = now;
      }

      return { ...base, reset: false };
    },
  };
}
