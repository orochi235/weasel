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

  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  let unwire: (() => void) | null = null;

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
    return { ...walk(), removed: EMPTY, changed: EMPTY, reset: true };
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      if (unwire === null) {
        const offScene = scene.subscribe(notify);
        const offOverrides = scene.overrides.subscribe(notify);
        unwire = () => {
          offScene();
          offOverrides();
        };
      }
      return () => {
        listeners.delete(fn);
        if (listeners.size === 0 && unwire !== null) {
          unwire();
          unwire = null;
        }
      };
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
