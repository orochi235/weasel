import type { ResetWrite } from '../autoReset';
import type { PrefSection } from '../groups';
import { prefLeafValue } from '../leafValue';
import type { PrefLeaf } from '../schema';
import { sourceResetPlan } from './policy';
import { LEAF_FREE, sharedReading, type LeafState, type PrefsSource, type SourceWriteOptions } from './prefsSource';

/** What a selection source reads and writes: several targets, each holding its own value at every path. */
export interface SelectionSourceInput {
  /** Each leaf the source edits, by the path it reads. */
  leaves: Readonly<Record<string, PrefLeaf>>;
  /** Each target's value at `path` as it holds it, in selection order. */
  read: (path: string) => readonly unknown[];
  /** What a target holding `held` at `leaf` shows. Default: {@link prefLeafValue}, holding nothing showing the
   *  default. A host whose targets hold nothing where they have no such property says so here. */
  shown?: (leaf: PrefLeaf, held: unknown) => unknown;
  /** Write into every target what `next` derives from the value it shows at `path`, as one undo step; a draft is
   *  kept out of undo. */
  write: (path: string, next: (prev: unknown) => unknown, options?: SourceWriteOptions) => void;
  /** Make the writes of `plan` in every target as one undo step named `label`. */
  reset: (plan: readonly ResetWrite[], label: string) => void;
  /** What the conditions over a path leave it. */
  stateAt?: (path: string) => LeafState;
}

/** A selection's source, whose reset also takes the name of its undo step. */
export interface SelectionSource extends PrefsSource {
  /** {@link PrefsSource.reset}, as one undo step named `label`. */
  resetAs(paths: readonly string[], label: string): void;
}

/**
 * A source over a selection: each selected thing is a target, so a reading's `each` holds one value per target
 * and a write lands in every one. A target keeps no auto state, so no leaf is auto here.
 */
export function selectionSource(input: SelectionSourceInput): SelectionSource {
  const { leaves, read, shown = prefLeafValue, write, stateAt = () => LEAF_FREE } = input;
  const schema: PrefSection = { name: '', members: leaves };
  const source: SelectionSource = {
    schema,
    valueAt: (path) => {
      const leaf = leaves[path];
      return sharedReading(read(path).map((held) => (leaf ? shown(leaf, held) : held)));
    },
    write: (path, value, options) => write(path, () => value, options),
    update: (path, fn, options) => write(path, (prev) => fn(prev), options),
    autoAt: () => undefined,
    stateAt,
    reset: (paths) => source.resetAs(paths, paths.length === 1 ? (leaves[paths[0]!]?.name ?? '') : ''),
    resetAs: (paths, label) => {
      const plan = sourceResetPlan(source, paths);
      if (plan.length > 0) input.reset(plan, label);
    },
  };
  return source;
}
