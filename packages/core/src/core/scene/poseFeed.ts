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

export function createPoseFeed<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): PoseFeed<TData, TLayer, TPose> {
  let seen: Map<NodeId, Node<TData, TLayer, TPose>> | null = null;

  const posed = (node: Node<TData, TLayer, TPose>): FeedNode<TData, TLayer, TPose> => ({
    node,
    pose: effectivePose(scene, node),
  });

  return {
    subscribe() {
      return () => {};
    },
    read() {
      if (seen === null) {
        seen = new Map(scene.nodes);
        return {
          added: [...seen.values()].map(posed),
          removed: EMPTY,
          changed: EMPTY,
          reset: true,
        };
      }
      return { added: EMPTY, removed: EMPTY, changed: EMPTY, reset: false };
    },
  };
}
