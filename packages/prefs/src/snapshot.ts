// What a store reads at one moment: every leaf's stored value repaired, and
// the value each resolves to under the selectors' own values. Rebuilt when a
// record changes, reusing what it read from the records that did not.

import type { OwnedRecordCache } from '@weasel-js/storage';
import { blendPref, type PrefBlend } from './blend';
import { assignPrefValueAtPath, setOwnPrefValue } from './helpers';
import { overridesOfPref, prefScopedDefault } from './scopeSpec';
import { isPrefScope, scopeSelectors, repairScope, selectionWeights, weighScope, type PrefScope, type PrefSelection, type PrefWeights } from './scope';
import { type PrefValidator, repairPrefValue } from './repair';
import type { PrefLeaf } from './schema';
import { isAutoRecord, recordValue } from './stamp';
import { prefAutoValue, prefCanAuto, prefStartsAuto } from './autoReset';

export interface Snapshot {
  /** Each leaf's value as read: a split one folded under `selection`. */
  byPath: Map<string, unknown>;
  /** Each leaf's stored value, repaired: a scope where it is split. */
  held: Map<string, unknown>;
  /** What each split leaf holds, by its path. */
  scopes: ReadonlyMap<string, PrefScope>;
  /** The option each selector is set to. */
  selection: PrefSelection;
  /** The leaves split by each selector, by the selector's path. */
  splitUnder: Map<string, string[]>;
  tree: Record<string, unknown>;
  unset: ReadonlySet<string>;
  /** The leaves now auto, unpinned. */
  auto: ReadonlySet<string>;
}

/** What a store reads its snapshots from. */
export interface SnapshotSource {
  leaves: ReadonlyMap<string, PrefLeaf>;
  cache: OwnedRecordCache;
  /** The options of each leaf a value may be split by. */
  selectors: ReadonlyMap<string, readonly string[]>;
  /** The admitted selectors: paths the schema admits as no pref, whose options the app names. */
  admitted?: ReadonlySet<string>;
  validators?: Readonly<Record<string, PrefValidator>>;
  blends?: Readonly<Record<string, PrefBlend>>;
}

/**
 * What `stored` reads as for `leaf`: a scope with each value repaired, else
 * the value repaired. A scope by any selector of the schema reads, not only
 * one the pref declares, so a value stored before its scopes changed reads as
 * it did until its first write rebuilds it.
 */
export function readStored(source: Pick<SnapshotSource, 'selectors' | 'admitted' | 'validators'>, leaf: PrefLeaf, stored: unknown): unknown {
  const repair = (value: unknown): unknown => repairPrefValue(leaf, value, source.validators);
  if (!isPrefScope(stored)) return repair(stored);
  const known = [...source.selectors.keys(), ...(source.admitted ?? [])];
  const read = repairScope(stored, known, (path) => optionsOf(source, path), repair, overridesOfPref(leaf));
  return read === undefined ? leaf.default : read;
}

/** A selector's options: `null` for an admitted one, and `undefined` for a path that is neither. */
export const optionsOf = (source: Pick<SnapshotSource, 'selectors' | 'admitted'>, path: string): readonly string[] | null | undefined =>
  source.selectors.get(path) ?? (source.admitted?.has(path) ? null : undefined);

/** `held` folded under `weights`: itself where it is not split. */
export function resolveHeld(source: Pick<SnapshotSource, 'blends'>, leaf: PrefLeaf, held: unknown, weights: PrefWeights): unknown {
  return isPrefScope(held) ? blendPref(leaf, weighScope(held, weights, leaf.default, overridesOfPref(leaf)), source.blends) : held;
}

/** The store's snapshots: `current` builds one when there is none, and `drop` discards it when a record changed. */
export function createSnapshots(source: SnapshotSource): { current: () => Snapshot; peek: () => Snapshot | null; drop: () => void } {
  const { leaves, cache, selectors } = source;
  let snapshot: Snapshot | null = null;
  let previous: { raw: Map<string, unknown>; held: Map<string, unknown> } | null = null;

  const unsetScopes = new Map<string, unknown>();
  /** What an unset leaf holds: its split default, repaired once, where it has one. */
  const unsetHeld = (path: string, leaf: PrefLeaf): unknown => {
    const scope = prefScopedDefault(leaf);
    if (scope === undefined) return leaf.default;
    if (!unsetScopes.has(path)) unsetScopes.set(path, readStored(source, leaf, scope));
    return unsetScopes.get(path);
  };
  const autoValues = new Map<string, unknown>();
  /** What an auto leaf holds: its `auto.value`, repaired once, else what it holds unset. */
  const autoHeld = (path: string, leaf: PrefLeaf): unknown => {
    if (!autoValues.has(path)) {
      const otherwise = unsetHeld(path, leaf);
      const value = prefAutoValue(leaf, undefined, otherwise);
      autoValues.set(path, value === otherwise ? value : readStored(source, leaf, value));
    }
    return autoValues.get(path);
  };

  const build = (): Snapshot => {
    const held = new Map<string, unknown>();
    const raw = new Map<string, unknown>();
    const unset = new Set<string>();
    const auto = new Set<string>();
    for (const [path, leaf] of leaves) {
      const has = cache.has(path);
      if (!has) unset.add(path);
      if (has ? prefCanAuto(leaf) && isAutoRecord(cache.get(path)) : prefStartsAuto(leaf)) {
        held.set(path, autoHeld(path, leaf));
        auto.add(path);
        continue;
      }
      if (!has) {
        held.set(path, unsetHeld(path, leaf));
        continue;
      }
      const record = cache.get(path);
      raw.set(path, record);
      const same = previous?.raw.has(path) && previous.raw.get(path) === record;
      held.set(path, same ? previous!.held.get(path) : readStored(source, leaf, recordValue(record)));
    }
    previous = { raw, held };

    const selection: Record<string, string> = {};
    for (const path of selectors.keys()) setOwnPrefValue(selection, path, held.get(path) as string);
    const weights = selectionWeights(selection);
    const byPath = new Map<string, unknown>();
    const splitUnder = new Map<string, string[]>();
    const scopes = new Map<string, PrefScope>();
    const tree: Record<string, unknown> = {};
    for (const [path, leaf] of leaves) {
      const value = held.get(path);
      if (isPrefScope(value)) scopes.set(path, value);
      for (const selector of scopeSelectors(value)) splitUnder.set(selector, [...(splitUnder.get(selector) ?? []), path]);
      const read = resolveHeld(source, leaf, value, weights);
      byPath.set(path, read);
      assignPrefValueAtPath(tree, path, read);
    }
    return { byPath, held, scopes, selection, splitUnder, tree, unset, auto };
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
 * the option `selection` has it at. An admitted selector neither names reads its
 * shared member.
 */
export function weightsUnder(
  selectors: ReadonlyMap<string, readonly string[]>,
  selection: PrefSelection,
  given: PrefWeights,
  admitted: ReadonlySet<string> = new Set(),
): PrefWeights {
  const out: Record<string, Record<string, number>> = {};
  for (const [path, options] of selectors) {
    const own = Object.hasOwn(given, path) ? given[path] : undefined;
    setOwnPrefValue(out, path, own
      ? Object.fromEntries(options.filter((option) => (own[option] ?? 0) > 0).map((option) => [option, own[option]!]))
      : { [selection[path]!]: 1 });
  }
  for (const path of admitted) {
    if (Object.hasOwn(given, path)) setOwnPrefValue(out, path, { ...given[path] });
    else if (selection[path] !== undefined) setOwnPrefValue(out, path, { [selection[path]]: 1 });
  }
  return out;
}

/** `selection` with each selector `at` names set to the option it gives, where that is one of the selector's; any option of an admitted one. */
export function selectionAt(
  selectors: ReadonlyMap<string, readonly string[]>,
  selection: PrefSelection,
  at: PrefSelection,
  admitted: ReadonlySet<string> = new Set(),
): PrefSelection {
  const out: Record<string, string> = { ...selection };
  for (const [path, option] of Object.entries(at)) {
    if (selectors.get(path)?.includes(option) || (admitted.has(path) && typeof option === 'string')) setOwnPrefValue(out, path, option);
  }
  return out;
}
