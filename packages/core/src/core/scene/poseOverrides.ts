import { kit, last, mix, mul, patch } from '@msb235/blits';
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import type { NodeId, PoseOverride, PoseOverrides } from './types';

/** What the table's voice says about a node it holds no entry for. */
const NOTHING: PoseOverride<never> = Object.freeze({});

/**
 * Build a {@link PoseOverrides} map.
 *
 * `getNode` resolves an id to the node object the painter memo is keyed on —
 * the only thing this module needs from the scene, and the reason it doesn't
 * import one. `onInvalidate` lets the scene invalidate derived nodes from the
 * same chokepoint.
 *
 * What `read` answers is a blits mix folded per node. The entries a writer
 * `set`s are one voice on it, and the nodes holding an entry are the mix's
 * reach: a node outside it is never probed.
 */
export function createPoseOverrides<TPose>(
  getNode: (id: NodeId) => { data?: unknown } | undefined,
  onInvalidate?: (id: NodeId) => void,
): PoseOverrides<TPose> {
  const entries = new Map<NodeId, PoseOverride<TPose>>();
  const listeners = new Set<() => void>();
  let generation = 0;

  const folded = mix<NodeId, PoseOverride<TPose>>(
    kit<PoseOverride<TPose>>({ pose: last<NonNullable<TPose>>(), alpha: mul() }),
  );
  folded.cue({
    patch: patch<NodeId, PoseOverride<TPose>>(
      0,
      (_phase, id) => entries.get(id) ?? (NOTHING as PoseOverride<TPose>),
      { writes: ['pose', 'alpha'] },
    ),
  });
  // Mix time only has to move between publishes, so a probe after one never
  // hands back the delta a probe before it cached.
  let clock = 0;
  folded.sync(clock);

  /** Per node: the object `read` folds into and returns, and the generation
   *  it was last folded at. */
  const reads = new Map<NodeId, { out: PoseOverride<TPose>; at: number }>();

  function invalidate(id: NodeId): void {
    const node = getNode(id);
    if (node) dropPoseKeyedMemoSlots(node);
    onInvalidate?.(id);
  }

  function published(): void {
    generation++;
    folded.sync(++clock);
    for (const listener of listeners) listener();
  }

  function forget(id: NodeId): void {
    reads.delete(id);
    folded.drop(id);
  }

  return {
    set(id, entry) {
      entries.set(id, entry);
      invalidate(id);
      published();
    },
    get(id) {
      return entries.get(id);
    },
    read(id) {
      if (!entries.has(id)) return undefined;
      let held = reads.get(id);
      if (held === undefined) {
        held = { out: {}, at: -1 };
        reads.set(id, held);
      }
      if (held.at !== generation) {
        folded.probe(id, held.out);
        held.at = generation;
      }
      return held.out;
    },
    has(id) {
      return entries.has(id);
    },
    ids() {
      return [...entries.keys()];
    },
    clear(id) {
      if (!entries.delete(id)) return;
      forget(id);
      invalidate(id);
      published();
    },
    clearAll() {
      if (entries.size === 0) return;
      for (const id of entries.keys()) {
        forget(id);
        invalidate(id);
      }
      entries.clear();
      published();
    },
    commit() {
      for (const id of entries.keys()) invalidate(id);
      published();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    getGeneration() {
      return generation;
    },
  };
}
