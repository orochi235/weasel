import type { NodeId, Scene } from '@weasel-js/core';
import { registerRemoval } from './pendingRemovals';

/** A transition's `.remove()`: each node it deletes once the transition ends on it. */
export interface StageRemoval {
  /** Register every node's pending removal, once. */
  arm(): void;
  /** Give up the pending removal of `id`. */
  release(id: NodeId): void;
  releaseAll(): void;
}

/** How a removal reaches the transition it belongs to. */
export interface RemovalHooks {
  /** Stop item `i` through the whole chain, as a later join reclaiming its node does. */
  cancelItem(i: number): void;
  whenItemDone(i: number, fn: () => void): void;
  /** Whether item `i`'s node is still the one the transition was made on. */
  present(i: number): boolean;
}

export function createStageRemoval<TPose>(
  scene: Scene<unknown, string, TPose>,
  ids: readonly NodeId[],
  hooks: RemovalHooks,
): StageRemoval {
  let armed = false;
  const releases: Array<[NodeId, () => void]> = [];
  return {
    arm() {
      if (armed) return;
      armed = true;
      ids.forEach((id, i) => {
        const release = registerRemoval(scene, id, () => hooks.cancelItem(i));
        releases.push([id, release]);
        hooks.whenItemDone(i, () => {
          release();
          if (hooks.present(i)) scene.remove(id);
        });
      });
    },
    release(id) {
      releases.find(([held]) => held === id)?.[1]();
    },
    releaseAll() {
      for (const [, release] of releases) release();
      releases.length = 0;
    },
  };
}
