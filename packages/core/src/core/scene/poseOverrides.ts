import type { Path } from '@weasel-js/geom';
import { createEmitter } from '@weasel-js/registry';
import { kit, last, mix, mul, patch } from '@msb235/blits';
import { dropPoseKeyedMemoSlots } from './nodeMemo';
import { shownCopyOf } from './nodeAsShown';
import { createPoseHold } from './poseHold';
import type { NodeId, PoseOverride, PoseOverrides } from './types';

/** What the table's voice says about a node it holds no entry for. */
const NOTHING: PoseOverride<never> = Object.freeze({});

/**
 * Build a {@link PoseOverrides} map.
 *
 * `getNode` resolves an id to the node object the painter memo is keyed on.
 * `onInvalidate` lets the scene invalidate derived nodes from the same
 * chokepoint.
 *
 * What `read` answers is a blits mix folded per node. The entries a writer
 * `set`s are one voice on it, and a node holding no entry is never probed.
 */
export function createPoseOverrides<TPose, TData = unknown>(
  getNode: (id: NodeId) => { data?: unknown } | undefined,
  onInvalidate?: (id: NodeId) => void,
): PoseOverrides<TPose, TData> {
  type Entry = PoseOverride<TPose, TData>;
  const entries = new Map<NodeId, Entry>();
  const listeners = createEmitter();
  let generation = 0;

  const folded = mix<NodeId, Entry>(
    kit<Entry>({ pose: last<NonNullable<TPose>>(), alpha: mul(), path: last<Path>(), data: last<NonNullable<Entry['data']>>() }),
  );
  folded.cue({
    patch: patch<NodeId, Entry>(
      0,
      (_phase, id) => entries.get(id) ?? (NOTHING as Entry),
      { writes: ['pose', 'alpha', 'path', 'data'] },
    ),
  });
  // Mix time only has to move between publishes, so a probe after one never
  // hands back the delta a probe before it cached.
  let clock = 0;
  folded.sync(clock);

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
    folded.sync(++clock);
    listeners.emit();
  }

  function forget(id: NodeId): void {
    reads.delete(id);
    folded.drop(id);
  }

  const table: PoseOverrides<TPose, TData> = {
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
    subscribe: listeners.subscribe,
    getGeneration() {
      return generation;
    },
    hold: () => createPoseHold(table),
  };
  return table;
}
