// What a store writes: a value encoded for storage, into the value the
// selectors name where the pref is scoped.

import type { OwnedRecordCache } from '@weasel-js/storage';
import { prefSectionLeaves } from './helpers';
import type { PrefList } from './list';
import { dropUnlisted, isPrefScope, mapScopeValues, repairScope, writeDeclared, type PrefSelection } from './scope';
import type { PrefMap } from './map';
import type { PrefLeaf, PrefObject } from './schema';
import { optionsOf, selectionAt } from './snapshot';
import { overridesOfPref, prefScopedDefault, scopeSelectorsOf } from './scopeSpec';
import { isAutoRecord, recordValue, stampRecord } from './stamp';
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
  /** The admitted selectors: paths the schema admits as no pref, whose options the app names. */
  admitted: ReadonlySet<string>;
  /** The schema version a value written is in, stamped on its record. */
  version: number;
  /** The option each selector is set to, read as a write is made. */
  selection: () => PrefSelection;
  warnIfClosed: (path: string | undefined) => void;
}

/** A store's `set`. */
export function prefWrites({ leaves, cache, selectors, admitted, version, selection, warnIfClosed }: PrefWritesSource): {
  set: (path: string, value: unknown, write?: { at?: PrefSelection }) => void;
} {
  /** The leaf's split default as stored, where it has one it can hold. */
  const unsetScope = (leaf: PrefLeaf): unknown => {
    const scope = prefScopedDefault(leaf);
    const axes = scopeSelectorsOf(leaf);
    if (scope === undefined || !axes?.length) return undefined;
    return repairScope(scope, axes, (by) => optionsOf({ selectors, admitted }, by), (member) => encodeInfinity(leaf, member), overridesOfPref(leaf));
  };
  const store = (path: string, stored: unknown): void => {
    // Unset is stored as nothing, which a stamp would turn into something.
    cache.set(path, stored === undefined ? undefined : stampRecord(stored, version));
  };
  const set = (path: string, value: unknown, write?: { at?: PrefSelection }): void => {
    warnIfClosed(path);
    const leaf = leaves.get(path);
    if (!leaf) {
      console.warn(`[prefs] no leaf at "${path}"; ignoring the write`);
      return;
    }
    const split = !!scopeSelectorsOf(leaf)?.length;
    if (split && isPrefScope(value)) {
      store(path, dropUnlisted(mapScopeValues(value, (member) => encodeInfinity(leaf, member)), overridesOfPref(leaf)));
      return;
    }
    const stored = encodeInfinity(leaf, value);
    if (stored === undefined || !split) {
      store(path, stored);
      return;
    }
    const had = cache.has(path) && !isAutoRecord(cache.get(path)) ? recordValue(cache.get(path)) : unsetScope(leaf);
    const now = selection();
    const under = write?.at ? selectionAt(selectors, now, write.at, admitted) : now;
    const overridesOf = overridesOfPref(leaf);
    const absent = encodeInfinity(leaf, leaf.default);
    store(path, writeDeclared(dropUnlisted(had, overridesOf), scopeSelectorsOf(leaf)!, under, now, stored, absent, overridesOf, had !== undefined));
  };
  return { set };
}
