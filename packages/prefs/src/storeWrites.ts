// What a store writes: a value encoded for storage, into the member the
// selectors name where the leaf is split, and a value split or joined.

import type { OwnedRecordCache } from '@weasel-js/storage';
import { prefSectionLeaves } from './helpers';
import type { PrefList } from './list';
import { isPrefLocus, joinLocus, mapLocusMembers, repairLocus, splitLocus, writeMember, type PrefSelection } from './locus';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import { selectionAt } from './snapshot';
import { recordValue, stampRecord } from './stamp';
import { prefVariantOf, type PrefUnion } from './union';

/** JSON storage cannot keep an infinity; `repairPrefValue` reads these back. */
const encodeInfinity = (leaf: PrefLeaf, value: unknown): unknown => {
  if (leaf.kind === 'number') return value === Infinity || value === -Infinity ? String(value) : value;
  if (leaf.kind === 'list' && Array.isArray(value)) {
    const { item } = leaf as PrefList;
    return value.map((entry) => encodeInfinity(item, entry));
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const held = value as Record<string, unknown>;
  if (leaf.kind === 'map') {
    const { item } = leaf as PrefMap;
    return Object.fromEntries(Object.entries(held).map(([key, entry]) => [key, encodeInfinity(item, entry)]));
  }
  const fields = leaf.kind === 'union' ? prefVariantOf(leaf as PrefUnion, held)?.[1] : leaf;
  if (fields?.kind !== 'object') return value;
  let out: Record<string, unknown> | undefined;
  for (const [key, field] of prefSectionLeaves((fields as PrefObject).children)) {
    if (!Object.hasOwn(held, key)) continue;
    const encoded = encodeInfinity(field, held[key]);
    if (encoded !== held[key]) (out ??= { ...held })[key] = encoded;
  }
  return out ?? value;
};

/** What the writes of a store are made over. */
export interface PrefWritesSource {
  leaves: ReadonlyMap<string, PrefLeaf>;
  cache: OwnedRecordCache;
  /** The options of each leaf a value may be split by. */
  selectors: ReadonlyMap<string, readonly string[]>;
  /** The schema version a value written is in, stamped on its record. */
  version: number;
  /** The option each selector is set to, read as a write is made. */
  selection: () => PrefSelection;
  warnIfClosed: (path: string | undefined) => void;
}

/** A store's `set`, `split`, and `join`. */
export function prefWrites({ leaves, cache, selectors, version, selection, warnIfClosed }: PrefWritesSource): {
  set: (path: string, value: unknown, write?: { at?: PrefSelection }) => void;
  split: (path: string, by: string) => void;
  join: (path: string, by: string) => void;
} {
  /** The leaf's split default as stored, where it has one it can hold. */
  const unsetLocus = (leaf: PrefLeaf): unknown => {
    if (leaf.defaultLocus === undefined || !leaf.splitBy?.length) return undefined;
    return repairLocus(leaf.defaultLocus, leaf.splitBy, (by) => selectors.get(by), (member) => encodeInfinity(leaf, member));
  };
  /** What the leaf holds in storage, unrepaired; its default, as stored, where it holds nothing. */
  const rawAt = (path: string, leaf: PrefLeaf): unknown =>
    (cache.has(path) ? recordValue(cache.get(path)) : unsetLocus(leaf) ?? encodeInfinity(leaf, leaf.default));
  const store = (path: string, stored: unknown): void => {
    // Unset is stored as nothing, which a stamp would turn into something.
    cache.set(path, stored === undefined ? undefined : stampRecord(stored, version));
  };
  /** The leaf and the selector's options, for a leaf that may be split by it. */
  const splitOf = (path: string, by: string): { leaf: PrefLeaf; options: readonly string[] } | undefined => {
    warnIfClosed(path);
    const leaf = leaves.get(path);
    const options = selectors.get(by);
    if (leaf?.splitBy?.includes(by) && options) return { leaf, options };
    console.warn(`[prefs] "${path}" cannot be split by "${by}"; ignoring`);
    return undefined;
  };

  const set = (path: string, value: unknown, write?: { at?: PrefSelection }): void => {
    warnIfClosed(path);
    const leaf = leaves.get(path);
    if (!leaf) {
      console.warn(`[prefs] no leaf at "${path}"; ignoring the write`);
      return;
    }
    if (leaf.splitBy?.length && isPrefLocus(value)) {
      store(path, mapLocusMembers(value, (member) => encodeInfinity(leaf, member)));
      return;
    }
    const stored = encodeInfinity(leaf, value);
    const had = cache.has(path) ? recordValue(cache.get(path)) : unsetLocus(leaf);
    const intoMember = stored !== undefined && leaf.splitBy?.length && isPrefLocus(had);
    const under = write?.at ? selectionAt(selectors, selection(), write.at) : selection();
    store(path, intoMember ? writeMember(had, under, stored) : stored);
  };
  const split = (path: string, by: string): void => {
    const found = splitOf(path, by);
    if (!found) return;
    const had = rawAt(path, found.leaf);
    const next = splitLocus(had, by, found.options, found.leaf.splitBy!);
    if (next !== had) store(path, next);
  };
  const join = (path: string, by: string): void => {
    const found = splitOf(path, by);
    if (!found) return;
    const had = rawAt(path, found.leaf);
    const next = joinLocus(had, by, selection(), encodeInfinity(found.leaf, found.leaf.default));
    if (next !== had) store(path, next);
  };
  return { set, split, join };
}
