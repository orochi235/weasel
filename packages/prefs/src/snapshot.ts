// What a store reads at one moment: every leaf's stored value repaired, and
// the value each resolves to under the selectors' own values. Rebuilt when a
// record changes, reusing what it read from the records that did not.

import type { OwnedRecordCache } from '@weasel-js/storage';
import { blendPref, type PrefBlend } from './blend';
import { assignPrefValueAtPath } from './helpers';
import { isPrefLocus, locusSelectors, repairLocus, selectionWeights, weighLocus, type PrefLocus, type PrefSelection, type PrefWeights } from './locus';
import { type PrefValidator, repairPrefValue } from './repair';
import type { PrefLeaf } from './schema';
import { recordValue } from './stamp';

export interface Snapshot {
  /** Each leaf's value as read: a split one folded under `selection`. */
  byPath: Map<string, unknown>;
  /** Each leaf's stored value, repaired: a locus where it is split. */
  held: Map<string, unknown>;
  /** What each split leaf holds, by its path. */
  loci: ReadonlyMap<string, PrefLocus>;
  /** The option each selector is set to. */
  selection: PrefSelection;
  /** The leaves split by each selector, by the selector's path. */
  splitBy: Map<string, string[]>;
  tree: Record<string, unknown>;
  unset: ReadonlySet<string>;
}

/** What a store reads its snapshots from. */
export interface SnapshotSource {
  leaves: ReadonlyMap<string, PrefLeaf>;
  cache: OwnedRecordCache;
  /** The options of each leaf a value may be split by. */
  selectors: ReadonlyMap<string, readonly string[]>;
  validators?: Readonly<Record<string, PrefValidator>>;
  blends?: Readonly<Record<string, PrefBlend>>;
}

/** What `stored` reads as for `leaf`: a locus with each member repaired where the leaf may hold one, else the value repaired. */
function readStored(source: SnapshotSource, leaf: PrefLeaf, stored: unknown): unknown {
  const repair = (value: unknown): unknown => repairPrefValue(leaf, value, source.validators);
  if (!leaf.splitBy?.length || !isPrefLocus(stored)) return repair(stored);
  const read = repairLocus(stored, leaf.splitBy, (path) => source.selectors.get(path), repair);
  return read === undefined ? leaf.default : read;
}

/** `held` folded under `weights`: itself where it is not split. */
export function resolveHeld(source: SnapshotSource, leaf: PrefLeaf, held: unknown, weights: PrefWeights): unknown {
  return isPrefLocus(held) ? blendPref(leaf, weighLocus(held, weights, leaf.default), source.blends) : held;
}

/** The store's snapshots: `current` builds one when there is none, and `drop` discards it when a record changed. */
export function createSnapshots(source: SnapshotSource): { current: () => Snapshot; peek: () => Snapshot | null; drop: () => void } {
  const { leaves, cache, selectors } = source;
  let snapshot: Snapshot | null = null;
  let previous: { raw: Map<string, unknown>; held: Map<string, unknown> } | null = null;

  const unsetLoci = new Map<string, unknown>();
  /** What an unset leaf holds: its split default, repaired once, where it has one. */
  const unsetHeld = (path: string, leaf: PrefLeaf): unknown => {
    if (leaf.defaultLocus === undefined) return leaf.default;
    if (!unsetLoci.has(path)) unsetLoci.set(path, readStored(source, leaf, leaf.defaultLocus));
    return unsetLoci.get(path);
  };

  const build = (): Snapshot => {
    const held = new Map<string, unknown>();
    const raw = new Map<string, unknown>();
    const unset = new Set<string>();
    for (const [path, leaf] of leaves) {
      if (!cache.has(path)) {
        held.set(path, unsetHeld(path, leaf));
        unset.add(path);
        continue;
      }
      const record = cache.get(path);
      raw.set(path, record);
      const same = previous?.raw.has(path) && previous.raw.get(path) === record;
      held.set(path, same ? previous!.held.get(path) : readStored(source, leaf, recordValue(record)));
    }
    previous = { raw, held };

    const selection: Record<string, string> = {};
    for (const path of selectors.keys()) selection[path] = held.get(path) as string;
    const weights = selectionWeights(selection);
    const byPath = new Map<string, unknown>();
    const splitBy = new Map<string, string[]>();
    const loci = new Map<string, PrefLocus>();
    const tree: Record<string, unknown> = {};
    for (const [path, leaf] of leaves) {
      const value = held.get(path);
      if (isPrefLocus(value)) loci.set(path, value);
      for (const selector of locusSelectors(value)) splitBy.set(selector, [...(splitBy.get(selector) ?? []), path]);
      const read = resolveHeld(source, leaf, value, weights);
      byPath.set(path, read);
      assignPrefValueAtPath(tree, path, read);
    }
    return { byPath, held, loci, selection, splitBy, tree, unset };
  };

  return {
    current: () => (snapshot ??= build()),
    peek: () => snapshot,
    drop: () => {
      snapshot = null;
    },
  };
}

/**
 * The weights a read is made under: `given` for each selector it names, the
 * options in the selector's own order, and all of every other selector's on
 * the option `selection` has it at.
 */
export function weightsUnder(
  selectors: ReadonlyMap<string, readonly string[]>,
  selection: PrefSelection,
  given: PrefWeights,
): PrefWeights {
  const out: Record<string, Record<string, number>> = {};
  for (const [path, options] of selectors) {
    const own = Object.hasOwn(given, path) ? given[path] : undefined;
    out[path] = own
      ? Object.fromEntries(options.filter((option) => (own[option] ?? 0) > 0).map((option) => [option, own[option]!]))
      : { [selection[path]!]: 1 };
  }
  return out;
}

/** `selection` with each selector `at` names set to the option it gives, where that is one of the selector's. */
export function selectionAt(
  selectors: ReadonlyMap<string, readonly string[]>,
  selection: PrefSelection,
  at: PrefSelection,
): PrefSelection {
  const out: Record<string, string> = { ...selection };
  for (const [path, option] of Object.entries(at)) {
    if (selectors.get(path)?.includes(option)) out[path] = option;
  }
  return out;
}
