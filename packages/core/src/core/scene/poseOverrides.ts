import { createEmitter } from '@weasel-js/registry';
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import { shownCopyOf } from './nodeAsShown';
import { createPoseHold } from './poseHold';
import { foldLayers } from './poseLayers';
import type { NodeId, PoseOverride, PoseOverrides } from './types';

/**
 * Build a {@link PoseOverrides} map.
 *
 * `getNode` resolves an id to the node object the painter memo is keyed on.
 * `onInvalidate` lets the scene invalidate derived nodes from the same
 * chokepoint.
 *
 * What `read` answers is folded from the node's layers by `foldLayers`; a
 * node holding no entry is never probed.
 */
export function createPoseOverrides<TPose, TData = unknown>(
  getNode: (id: NodeId) => { data?: unknown } | undefined,
  onInvalidate?: (id: NodeId) => void,
): PoseOverrides<TPose, TData> {
  type Entry = PoseOverride<TPose, TData>;
  /** Per node, its entries in the order they were set, the last on top. */
  const layers = new Map<NodeId, Entry[]>();
  const fold = foldLayers(layers);
  const listeners = createEmitter();
  let generation = 0;
  let depth = 1;

  /** Per node: the object `read` folds into and returns, and the generation
   *  it was last folded at. */
  const reads = new Map<NodeId, { out: Entry; at: number }>();

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
    fold.publish(depth);
    listeners.emit();
  }

  function forget(id: NodeId): void {
    reads.delete(id);
    fold.drop(id);
  }

  const table: PoseOverrides<TPose, TData> = {
    set(id, entry) {
      const stack = layers.get(id);
      if (stack === undefined) layers.set(id, [entry]);
      else {
        const at = stack.indexOf(entry);
        if (at >= 0) stack.splice(at, 1);
        stack.push(entry);
        depth = Math.max(depth, stack.length);
      }
      invalidate(id);
      published();
    },
    get(id) {
      return layers.get(id)?.at(-1);
    },
    read(id) {
      if (!layers.has(id)) return undefined;
      let held = reads.get(id);
      if (held === undefined) {
        held = { out: {}, at: -1 };
        reads.set(id, held);
      }
      if (held.at !== generation) {
        fold.probe(id, held.out);
        held.at = generation;
      }
      return held.out;
    },
    has(id, entry) {
      const stack = layers.get(id);
      return stack !== undefined && (entry === undefined || stack.includes(entry));
    },
    ids() {
      return [...layers.keys()];
    },
    clear(id, entry) {
      const stack = layers.get(id);
      if (stack === undefined) return;
      if (entry !== undefined) {
        const at = stack.indexOf(entry);
        if (at < 0) return;
        stack.splice(at, 1);
      }
      if (entry === undefined || stack.length === 0) {
        layers.delete(id);
        forget(id);
      }
      invalidate(id);
      published();
    },
    clearAll() {
      if (layers.size === 0) return;
      for (const id of layers.keys()) {
        forget(id);
        invalidate(id);
      }
      layers.clear();
      published();
    },
    commit() {
      for (const id of layers.keys()) invalidate(id);
      published();
    },
    subscribe: listeners.subscribe,
    getGeneration() {
      return generation;
    },
    hold: () => createPoseHold(table, (id) => layers.get(id)),
  };
  return table;
}
