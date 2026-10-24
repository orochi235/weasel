import { createEmitter } from '@weasel-js/registry';
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import { shownCopyOf } from './nodeAsShown';
import { createPoseHold } from './poseHold';
import { foldPlies } from './posePlies';
import { createPlyStacks, plyPath, type CarriedPath } from './plyStacks';
import type { NodeId, PoseOverride, PoseOverrides } from './types';

/**
 * Build a {@link PoseOverrides} map.
 *
 * `getNode` resolves an id to the node object the painter memo is keyed on.
 * `onInvalidate` lets the scene invalidate derived nodes from the same
 * chokepoint.
 *
 * What `read` answers is folded from the node's plies by `foldPlies`, its
 * path by `plyPath`; a node holding no entry is never probed.
 */
export function createPoseOverrides<TPose, TData = unknown>(
  getNode: (id: NodeId) => { data?: unknown } | undefined,
  onInvalidate?: (id: NodeId) => void,
): PoseOverrides<TPose, TData> {
  type Entry = PoseOverride<TPose, TData>;
  const stacks = createPlyStacks<Entry>();
  const { plies } = stacks;
  const fold = foldPlies(plies);
  const listeners = createEmitter();
  let generation = 0;

  /** Per node: the object `read` folds into and returns, the generation it
   *  was last folded at, and the last path it carried. */
  const reads = new Map<NodeId, { out: Entry; at: number; carried?: CarriedPath }>();

  function invalidate(id: NodeId): void {
    const node = getNode(id);
    if (node) {
      dropPoseKeyedMemoSlots(node);
      // A painter handed the node as it shows memoized against that copy.
      const shown = shownCopyOf(node);
      if (shown) dropPoseKeyedMemoSlots(shown);
    }
    onInvalidate?.(id);
  }

  function published(): void {
    generation++;
    fold.publish(stacks.depth());
    listeners.emit();
  }

  function forget(id: NodeId): void {
    reads.delete(id);
    fold.drop(id);
  }

  const table: PoseOverrides<TPose, TData> = {
    set(id, entry) {
      stacks.claim(id, entry);
      invalidate(id);
      published();
    },
    get(id) {
      return plies.get(id)?.at(-1);
    },
    read(id) {
      const stack = plies.get(id);
      if (stack === undefined) return undefined;
      let held = reads.get(id);
      if (held === undefined) {
        held = { out: {}, at: -1 };
        reads.set(id, held);
      }
      if (held.at !== generation) {
        fold.probe(id, held.out);
        held.out.path = plyPath(stack, held.out.pose, held);
        held.at = generation;
      }
      return held.out;
    },
    has(id, entry) {
      const stack = plies.get(id);
      return stack !== undefined && (entry === undefined || stack.includes(entry));
    },
    ids() {
      return [...plies.keys()];
    },
    clear(id, entry) {
      if (!(entry === undefined ? stacks.drop(id) : stacks.release(id, entry))) return;
      if (!plies.has(id)) forget(id);
      invalidate(id);
      published();
    },
    clearAll() {
      if (plies.size === 0) return;
      for (const id of plies.keys()) {
        forget(id);
        invalidate(id);
      }
      stacks.dropAll();
      published();
    },
    commit() {
      for (const id of plies.keys()) invalidate(id);
      published();
    },
    subscribe: listeners.subscribe,
    getGeneration() {
      return generation;
    },
    hold: () => createPoseHold(table, (id) => plies.get(id)),
  };
  return table;
}
