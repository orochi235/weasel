// A pref's `scopes`: the selectors its value is kept separately for, read
// into what the scope functions take.

import { PREF_ELSE, type OverridesOf, type PrefOverrides, type PrefScope } from './scope';
import type { PrefLeaf } from './schema';

/**
 * One selector a pref's value is kept separately for, as `.per(selector,
 * overrides?)` declares it. `selector` is the full path of an `enum` pref,
 * or of a selector the schema's root `admits`, whose option the app names as
 * it reads and writes (`at`).
 *
 * With `overrides` the selector is closed, and without, open: see
 * {@link PrefOverrides}. Scopes are the declaration's to say: a reader never
 * splits or joins a pref.
 */
export interface PrefScopeSpec {
  selector: string;
  overrides?: PrefOverrides;
}

/** The selectors a pref's value is kept separately for, outermost first. */
export function prefScopesOf(pref: PrefLeaf): readonly PrefScopeSpec[] {
  return pref.scopes ?? [];
}

/** The override list a pref gives the selector at `selector`, where it is closed. */
export function prefOverridesOf(pref: PrefLeaf, selector: string): PrefOverrides | undefined {
  return pref.scopes?.find((scope) => scope.selector === selector)?.overrides;
}

/** The paths of a pref's selectors, outermost first, where it has any. */
export function scopeSelectorsOf(pref: PrefLeaf): readonly string[] | undefined {
  return pref.scopes?.length ? pref.scopes.map((scope) => scope.selector) : undefined;
}

const lookups = new WeakMap<PrefLeaf, OverridesOf | undefined>();

/** {@link prefOverridesOf} for one pref, as the scope functions take it: none where no selector is closed. */
export function overridesOfPref(pref: PrefLeaf): OverridesOf | undefined {
  if (!lookups.has(pref)) {
    lookups.set(pref, pref.scopes?.some((scope) => scope.overrides !== undefined) ? (selector) => prefOverridesOf(pref, selector) : undefined);
  }
  return lookups.get(pref);
}

const withElse = (by: string, shared: PrefScope): PrefScope => ({ $by: by, $in: {}, [PREF_ELSE]: shared });

/**
 * What a pref holds while nothing is stored for it: its `defaultLocus`, or
 * else one scope per selector, outermost first, each holding no value of its
 * own and the next one in as its shared value, the last with none so it
 * reads `default`.
 */
export function prefScopedDefault(pref: PrefLeaf): PrefScope | undefined {
  if (pref.defaultLocus !== undefined || !pref.scopes?.length) return pref.defaultLocus;
  let inner: PrefScope | undefined;
  for (const scope of [...pref.scopes].reverse()) inner = inner === undefined ? { $by: scope.selector, $in: {} } : withElse(scope.selector, inner);
  return inner;
}

